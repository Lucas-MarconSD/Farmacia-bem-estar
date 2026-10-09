const csv = require('csv-parser');
const fs = require('fs');
const xlsx = require('xlsx');
const CategoryRepository = require('../repositories/CategoryRepository');
const ProductRepository = require('../repositories/ProductRepository');
const { createSlug } = require('../utils/slugify');

const toTitleCase = (str) => {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const isValidBarcode = (str) => typeof str === 'string' && str.trim().length >= 8 && /^\\d+$/.test(str.trim());
const isValidExtId = (str) => typeof str === 'string' && str.trim().length > 0 && !str.toUpperCase().includes('E+');
const normalizeName = (str) => (str || '').toString().toLowerCase().trim();

class ImportService {
  async processImport(filePath, isPreview, deactivateMissing = false) {
    const results = [];
    
    // Load all current products to memory for smart diffing
    const fullProducts = require('../database/sqlite').prepare('SELECT id, barcode, external_id, name, price, stock, active, category_id FROM products').all();

    const byBarcode = new Map();
    const byExtId = new Map();
    const byName = new Map();

    fullProducts.forEach(p => {
      if (p.barcode && isValidBarcode(p.barcode)) {
        const b = p.barcode.trim();
        if (!byBarcode.has(b)) byBarcode.set(b, []);
        byBarcode.get(b).push(p);
      }
      if (p.external_id && isValidExtId(p.external_id)) {
        const e = p.external_id.trim();
        if (!byExtId.has(e)) byExtId.set(e, []);
        byExtId.get(e).push(p);
      }
      const n = normalizeName(p.name);
      if (n) {
        if (!byName.has(n)) byName.set(n, []);
        byName.get(n).push(p);
      }
    });

    const summary = {
      totalAnalyzed: 0,
      newProducts: 0,
      priceChanged: 0,
      nameChanged: 0,
      categoryChanged: 0,
      stockIncreased: 0,
      stockDecreased: 0,
      unchanged: 0,
      removed: 0,
      invalidRow: 0,
      invalidEan: 0,
      duplicateEan: 0,
      ambiguous: 0,
      review: 0
    };

    const eansToFetch = [];
    const processedIds = new Set();
    const seenBarcodes = new Set();

    if (filePath.endsWith('.csv')) {
      const firstLine = await new Promise((resolve) => {
        const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
        let data = '';
        stream.on('data', chunk => {
          data += chunk;
          const newlineIdx = data.indexOf('\n');
          if (newlineIdx !== -1) {
            stream.destroy();
            resolve(data.slice(0, newlineIdx));
          }
        });
        stream.on('end', () => resolve(data));
      });
      const separator = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';

      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv({ separator }))
          .on('data', (data) => results.push(data))
          .on('end', resolve)
          .on('error', reject);
      });
      console.log('CSV Results:', results);
    } else {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = xlsx.utils.sheet_to_json(sheet);
      results.push(...json);
    }

    summary.totalAnalyzed = results.length;

    const updates = [];
    const creates = [];
    
    const mapCategory = (rawCat, productName) => {
      if (!rawCat && !productName) return 'Outros (Revisão Necessária)';
      const c = (rawCat || '').toLowerCase().trim();
      const p = (productName || '').toLowerCase().trim();
      if (c === 'medicamentos' || c === 'oficinais' || c.includes('remedio') || c.includes('pilula') || p.includes('mg ') || p.includes('ml ')) return 'Medicamentos';
      if (c.includes('higiene') || c.includes('bucal') || p.includes('desodorante') || p.includes('absorvente') || p.includes('pasta de dente')) return 'Higiene e Cuidados Pessoais';
      if (c.includes('beleza') || c.includes('perfumaria') || c.includes('maquiagem') || p.includes('esmalte') || p.includes('perfume')) return 'Beleza e Perfumaria';
      if (c.includes('pele') || c.includes('dermocosm') || p.includes('protetor solar') || p.includes('hidratante corporal')) return 'Cuidados com a Pele';
      if (c.includes('vitamina') || c.includes('suplemento') || p.includes('vitamina') || p.includes('whey')) return 'Vitaminas e Suplementos';
      if (c.includes('bebe') || c.includes('infantil') || c.includes('mamae') || p.includes('fralda') || p.includes('chupeta')) return 'Mamãe e Bebê';
      if (c.includes('aparelho') || c.includes('teste') || p.includes('medidor') || p.includes('teste de gravidez') || p.includes('termometro')) return 'Aparelhos e Testes';
      if (c.includes('socorros') || c.includes('curativo') || p.includes('band aid') || p.includes('esparadrapo') || p.includes('gaze')) return 'Primeiros Socorros';
      if (c.includes('cabelo') || p.includes('shampoo') || p.includes('condicionador')) return 'Cuidados com o Cabelo';
      return 'Outros (Revisão Necessária)';
    };

    const catMapByName = new Map();
    const catMapBySlug = new Map();
    const fullCategories = require('../database/sqlite').prepare('SELECT id, name, slug FROM categories').all();
    fullCategories.forEach(c => {
      catMapByName.set(c.name.toLowerCase(), c.id);
      catMapBySlug.set(c.slug, c.id);
    });

    for (const row of results) {
      const getVal = (keys) => {
        const key = Object.keys(row).find(k => {
          const cleanK = k.toLowerCase().replace(/[\uFEFF]/g, '').replace(/['"]/g, '').trim();
          return keys.includes(cleanK);
        });
        return key ? row[key] : null;
      };

      const nameRaw = getVal(['produto', 'nome', 'descricao', 'descrição', 'name']);
      const name = nameRaw ? nameRaw.toString().trim() : '';
      if (!name) {
        summary.invalidRow++;
        continue;
      }

      let barcode = getVal(['ean', 'cod_barras', 'codigo_barras', 'código de barras', 'código de barra', 'cod. barras', 'barcode']);
      const externalIdRaw = getVal(['cod_produto', 'código', 'cod', 'id']);
      const brandRaw = getVal(['marca', 'fabricante', 'laboratorio', 'laboratório', 'brand']);
      const brand = brandRaw ? brandRaw.toString().trim() : null;
      
      if (barcode) barcode = barcode.toString().trim();
      const extId = externalIdRaw ? externalIdRaw.toString().trim() : null;

      if (barcode && barcode !== '0') {
        if (!isValidBarcode(barcode)) {
          summary.invalidEan++;
        }
        if (seenBarcodes.has(barcode)) {
          summary.duplicateEan++;
          continue; 
        }
        if(isValidBarcode(barcode)) seenBarcodes.add(barcode);
      }

      let priceRaw = getVal(['preco', 'preço', 'valor', 'price', 'pvp', 'pmc']);
      let price = typeof priceRaw === 'number' ? priceRaw : parseFloat((priceRaw || '0').toString().replace(',', '.'));
      if (isNaN(price)) price = 0;

      let stockRaw = getVal(['estoque', 'qnt', 'quantidade', 'stock', 'qtd', 'estoque atual']);
      if (stockRaw === null || stockRaw === undefined || stockRaw.toString().trim() === '') {
        summary.invalidRow++;
        continue;
      }
      
      let stock = parseInt(stockRaw, 10);
      if (isNaN(stock) || stock < 0) {
        summary.invalidRow++;
        continue;
      }

      if (price === 0) summary.review++;

      let rawCategoryName = getVal(['categoria', 'category', 'grupo']);
      let mappedCategoryName = mapCategory(rawCategoryName, name);
      let categoryId = catMapByName.get(mappedCategoryName.toLowerCase()) || null;

      // Safe matching logic
      let candidates = [];
      if (barcode && isValidBarcode(barcode)) {
         candidates = byBarcode.get(barcode) || [];
      }
      if (candidates.length === 0 && extId && isValidExtId(extId)) {
         candidates = byExtId.get(extId) || [];
      }
      if (candidates.length === 0) {
         candidates = byName.get(normalizeName(name)) || [];
      }

      let existing = null;
      if (candidates.length === 1) {
        existing = candidates[0];
      } else if (candidates.length > 1) {
        summary.ambiguous++;
        // Mark all as processed to prevent unwanted deactivation
        candidates.forEach(c => processedIds.add(c.id));
        continue; // Skip automatic update, requires manual review
      }

      if (existing && existing.category_id && mappedCategoryName === 'Outros (Revisão Necessária)') {
         categoryId = existing.category_id;
      }

      if (existing) {
        processedIds.add(existing.id);
        let isChanged = false;
        
        const existingName = existing.name ? existing.name.toString().trim() : '';
        const priceChanged = Math.abs(price - existing.price) > 0.001;

        if (priceChanged) { summary.priceChanged++; isChanged = true; }
        if (name !== existingName) { summary.nameChanged++; isChanged = true; }
        if (categoryId !== existing.category_id) { summary.categoryChanged++; isChanged = true; }
        
        if (stock > existing.stock) { summary.stockIncreased++; isChanged = true; }
        else if (stock < existing.stock) { summary.stockDecreased++; isChanged = true; }
        
        const needsDeactivation = stock === 0 && existing.active === 1;
        const needsReactivation = stock > 0 && existing.stock === 0 && existing.active === 0;

        if (needsDeactivation || needsReactivation) isChanged = true;

        console.log('Update Check:', { existingName: existing.name, name, existingPrice: existing.price, price, existingStock: existing.stock, stock, isChanged });

        if (!isChanged) summary.unchanged++;

        if (!isPreview && isChanged) {
          updates.push({
            id: existing.id, name, categoryId, brand, price, stock,
            needsDeactivation, needsReactivation
          });
        }
      } else {
        summary.newProducts++;
        if (!isPreview) {
          // ensure we only save extId if it's valid
          const safeExtId = isValidExtId(extId) ? extId : null;
          const safeBarcode = isValidBarcode(barcode) ? barcode : null;
          creates.push({ name, barcode: safeBarcode, extId: safeExtId, categoryId, brand, price, stock });
        }
      }
    }

    const idsToDeactivate = [];
    if (deactivateMissing && summary.totalAnalyzed > 0) {
      fullProducts.forEach(p => {
        if (p.active === 1 && !processedIds.has(p.id)) {
          idsToDeactivate.push(p.id);
          summary.removed++;
        }
      });
    }

    if (!isPreview) {
      const db = require('../database/sqlite');
      
      const updateStmt = db.prepare(`
        UPDATE products 
        SET name = ?, category_id = ?, brand = ?, price = ?, stock = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);
      
      const reactivateStmt = db.prepare(`
        UPDATE products 
        SET active = 1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);

      const deactivateStmt = db.prepare(`
        UPDATE products 
        SET active = 0, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);

      const createStmt = db.prepare(`
        INSERT INTO products (name, barcode, external_id, category_id, brand, price, stock) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const applyChanges = db.transaction(() => {
        for (const u of updates) {
          updateStmt.run(u.name, u.categoryId, u.brand, u.price, u.stock, u.id);
          if (u.needsDeactivation) {
             deactivateStmt.run(u.id);
          } else if (u.needsReactivation) {
             reactivateStmt.run(u.id);
          }
        }
        for (const c of creates) {
          const info = createStmt.run(c.name, c.barcode, c.extId, c.categoryId, c.brand, c.price, c.stock);
          if (c.barcode && c.barcode.length > 8 && c.price > 0) {
            eansToFetch.push({ id: info.lastInsertRowid, barcode: c.barcode });
          }
        }
        for (const id of idsToDeactivate) {
          deactivateStmt.run(id);
        }
      });
      
      applyChanges();
    }

    if (!isPreview && eansToFetch.length > 0) {
      setTimeout(() => require('./DotCompanyService').processImagesForEans(eansToFetch), 1000);
    }

    return {
      message: isPreview ? 'Prévia inteligente gerada com sucesso' : 'Sincronização concluída com sucesso',
      summary: summary
    };
  }
}

module.exports = new ImportService();
