const fs = require('fs');
const csv = require('csv-parser');
const db = require('./database/sqlite');

const createSlug = (str) => {
  return str.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
};

const parseCurrency = (str) => {
  if (!str) return 0;
  return parseFloat(str.replace('R$', '').replace(/\\./g, '').replace(',', '.').trim()) || 0;
};

const importData = () => {
  const results = [];
  let imported = 0, updated = 0, ignored = 0, review = 0;
  const categoryCounts = {};

  fs.createReadStream('C:\\\\Users\\\\Usuario\\\\Downloads\\\\farmacia.csv')
    .pipe(csv({ separator: ';' }))
    .on('data', (data) => results.push(data))
    .on('end', () => {
      
      const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (name, slug) VALUES (?, ?)');
      const getCategory = db.prepare('SELECT id FROM categories WHERE slug = ?');
      const getProductByBarcode = db.prepare("SELECT id FROM products WHERE barcode = ? AND barcode IS NOT NULL AND barcode NOT LIKE '%E+%'");
      const getProductByName = db.prepare('SELECT id FROM products WHERE name = ?');
      const updateProduct = db.prepare('UPDATE products SET price = ?, stock = ?, category_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      const insertProduct = db.prepare(`
        INSERT INTO products (name, barcode, external_id, category_id, brand, price, stock) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const transaction = db.transaction((rows) => {
        for (const row of rows) {
          const name = row['Produto'] ? row['Produto'].trim() : '';
          if (!name) {
            ignored++;
            continue;
          }

          let categoryName = row['Categoria'] ? row['Categoria'].trim() : 'Outros';
          if (!categoryName) categoryName = 'Outros';
          const categorySlug = createSlug(categoryName);
          
          insertCategory.run(categoryName, categorySlug);
          const categoryObj = getCategory.get(categorySlug);
          const categoryId = categoryObj ? categoryObj.id : null;

          if (!categoryCounts[categoryName]) categoryCounts[categoryName] = 0;
          categoryCounts[categoryName]++;

          const rawBarcode = row['EAN / GTIN'] ? row['EAN / GTIN'].trim() : null;
          const rawCode = row['Código'] ? row['Código'].trim() : null;
          
          const barcode = (rawBarcode && !rawBarcode.includes('E+')) ? rawBarcode : null;
          const externalId = (rawCode && !rawCode.includes('E+')) ? rawCode : null;

          const price = parseCurrency(row['Preço']);
          if (price <= 0) review++;

          const stock = parseInt(row['Estoque Atual']) || 0;
          const brand = row['Marca'] ? row['Marca'].trim() : null;

          let existingProduct = null;
          if (barcode) {
            existingProduct = getProductByBarcode.get(barcode);
          }
          if (!existingProduct) {
            existingProduct = getProductByName.get(name);
          }

          if (existingProduct) {
            updateProduct.run(price, stock, categoryId, existingProduct.id);
            updated++;
          } else {
            insertProduct.run(name, barcode, externalId, categoryId, brand, price, stock);
            imported++;
          }
        }
      });

      try {
        transaction(results);
        console.log('Importação concluída');
        console.log(`${results.length} produtos analisados`);
        console.log(`${imported} importados`);
        console.log(`${updated} atualizados`);
        console.log(`${ignored} ignorados`);
        console.log(`${review} precisam de revisão (preço zero/ausente)`);
        console.log('Categorias:', categoryCounts);
      } catch (err) {
        console.error('Erro na importação:', err);
      }
    });
};

importData();
