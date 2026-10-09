const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const { URL } = require('url');

// Configurações e Variáveis de Ambiente
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = 'product-images';
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
const EXECUTE_MODE = process.argv.includes('--execute');

if (EXECUTE_MODE && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) {
  console.error("ERRO: As variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias no modo '--execute'.");
  process.exit(1);
}

let supabase = null;
if (EXECUTE_MODE) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

const dbPath = path.join(__dirname, '..', 'farmacia.db');
if (!fs.existsSync(dbPath)) {
  console.error("ERRO: Banco de dados SQLite não encontrado em", dbPath);
  process.exit(1);
}
const db = new Database(dbPath, { readonly: true });

function getContentType(ext) {
  switch(ext.toLowerCase()) {
    case '.png': return 'image/png';
    case '.webp': return 'image/webp';
    case '.jpeg':
    case '.jpg': return 'image/jpeg';
    default: return 'application/octet-stream';
  }
}

// Verifica se uma string é uma URL de fato (e se é remota ou local)
function isLocalUrlOrPath(imageString) {
  if (!imageString) return false;
  try {
    const parsed = new URL(imageString);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch (err) {
    // Se falhar no parsing da URL, assumimos que é um path relativo (ex: /uploads/img.jpg)
    return true;
  }
}

async function runMigration() {
  console.log("==========================================");
  console.log("   MIGRAÇÃO SQLITE -> SUPABASE (FASE 2)   ");
  console.log("==========================================");
  console.log(`Modo de Execução: ${EXECUTE_MODE ? 'GRAVAÇÃO REAL NO SUPABASE' : 'LEITURA E VALIDAÇÃO (DRY RUN)'}`);
  
  const categories = db.prepare('SELECT * FROM categories').all();
  const products = db.prepare('SELECT * FROM products').all();

  console.log(`\n[SQLite] Lidos ${categories.length} categorias e ${products.length} produtos.`);

  const validCategoryIds = new Set(categories.map(c => c.id));
  
  const validCategories = categories.map(c => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    active: c.active === 1
  }));

  const invalidProducts = [];
  const validProducts = [];
  let productsWithImages = 0;

  for (const p of products) {
    let isValid = true;
    let rejectReason = '';

    // 1. Validação de Nome
    if (!p.name || String(p.name).trim() === '') {
      isValid = false; rejectReason = 'Nome vazio';
    }

    // 2. Validação de Preço (não pode ser nulo, branco, NaN, ou negativo)
    let parsedPrice = null;
    if (p.price === null || p.price === undefined || String(p.price).trim() === '') {
      isValid = false; rejectReason = 'Preço vazio/nulo';
    } else {
      const priceNum = Number(p.price);
      if (isNaN(priceNum)) {
        isValid = false; rejectReason = 'Preço não numérico';
      } else if (priceNum < 0) {
        isValid = false; rejectReason = 'Preço negativo';
      } else {
        parsedPrice = priceNum.toFixed(2);
      }
    }

    // 3. Validação de Old Price
    let parsedOldPrice = null;
    if (p.old_price !== null && p.old_price !== undefined && String(p.old_price).trim() !== '') {
      const oldPriceNum = Number(p.old_price);
      if (isNaN(oldPriceNum) || oldPriceNum < 0) {
        isValid = false; rejectReason = 'Preço antigo inválido';
      } else {
        parsedOldPrice = oldPriceNum.toFixed(2);
      }
    }

    // 4. Validação de Estoque
    let parsedStock = 0;
    if (p.stock !== null && p.stock !== undefined && String(p.stock).trim() !== '') {
      const stockNum = parseInt(p.stock, 10);
      if (isNaN(stockNum) || stockNum < 0) {
        isValid = false; rejectReason = 'Estoque inválido';
      } else {
        parsedStock = stockNum;
      }
    }

    // 5. Validação de Categoria (FK)
    if (p.category_id !== null && p.category_id !== undefined) {
      if (!validCategoryIds.has(p.category_id)) {
        isValid = false; rejectReason = 'Categoria referenciada não existe';
      }
    }

    if (!isValid) {
      invalidProducts.push({ id: p.id, name: p.name, reason: rejectReason });
      continue;
    }

    // 6. Tratamento de Imagens
    let localImagePath = null;
    let hasValidImage = false;
    let finalImageUrl = p.image_url; 

    if (p.image_url && isLocalUrlOrPath(p.image_url)) {
      const fileName = path.basename(p.image_url);
      localImagePath = path.join(UPLOAD_DIR, fileName);
      if (fs.existsSync(localImagePath)) {
        hasValidImage = true;
        productsWithImages++;
        finalImageUrl = null; // Será preenchido com a URL pública após o upload
      } else {
        // Arquivo não existe fisicamente. Limpa a URL local quebrada.
        finalImageUrl = null; 
      }
    } else if (p.image_url && !isLocalUrlOrPath(p.image_url)) {
      hasValidImage = false; // URL externa legítima
    }

    validProducts.push({
      id: p.id,
      external_id: p.external_id,
      barcode: p.barcode ? String(p.barcode).trim() : null,
      name: p.name.trim(),
      description: p.description ? String(p.description).trim() : null,
      category_id: p.category_id,
      brand: p.brand ? String(p.brand).trim() : null,
      price: parsedPrice,
      old_price: parsedOldPrice,
      stock: parsedStock,
      image_url: finalImageUrl, 
      active: p.active === 1,
      _localImagePath: hasValidImage ? localImagePath : null
    });
  }

  console.log("\n--- Relatório de Validação ---");
  console.log(`Lidos do SQLite: ${products.length}`);
  console.log(`Rejeitados (Inválidos): ${invalidProducts.length}`);
  console.log(`Aprovados para Migração: ${validProducts.length}`);
  console.log(`Produtos com Imagens Locais Físicas Encontradas: ${productsWithImages}`);

  if (invalidProducts.length > 0) {
    console.warn(`\n⚠ AVISO CRÍTICO: ${invalidProducts.length} produtos falharam na validação.`);
    console.warn("Amostra dos rejeitados:");
    console.warn(invalidProducts.slice(0, 10));
    
    if (EXECUTE_MODE) {
      console.error("\n🛑 EXECUÇÃO BLOQUEADA: Existem produtos inválidos. Corrija os dados no SQLite ou ajuste as regras antes de gravar na nuvem.");
      process.exit(1);
    }
  }

  if (!EXECUTE_MODE) {
    console.log("\n[AÇÃO NECESSÁRIA] Validação concluída. Nenhum dado foi gravado na nuvem.");
    console.log("Para executar a migração real, certifique-se de que não há rejeições e rode com a flag: node scripts/migrate_to_supabase.js --execute");
    process.exit(0);
  }

  console.log("\n--- INICIANDO GRAVAÇÃO NO SUPABASE ---");

  console.log("1/3 Gravando Categorias...");
  const { error: catError } = await supabase.from('categories').upsert(validCategories, { onConflict: 'id' });
  if (catError) {
    console.error("❌ Erro fatal ao inserir categorias:", catError.message);
    process.exit(1);
  }
  console.log("✓ Categorias inseridas.");

  console.log("2/3 Processando Imagens e Produtos...");
  let uploadedImagesCount = 0;
  let errorCount = 0;
  let productsSuccessfullyInserted = 0;

  const BATCH_SIZE = 50;
  for (let i = 0; i < validProducts.length; i += BATCH_SIZE) {
    const batch = validProducts.slice(i, i + BATCH_SIZE);
    const readyToInsertBatch = [];

    for (const p of batch) {
      let finalImageUrl = p.image_url;

      if (p._localImagePath) {
        const ext = path.extname(p._localImagePath);
        const contentType = getContentType(ext);
        // Caminho determinístico e à prova de colisão: product-[id].[ext]
        const storageFileName = `product-${p.id}${ext}`;
        
        try {
          const fileBuffer = fs.readFileSync(p._localImagePath);
          const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(storageFileName, fileBuffer, {
              upsert: true,
              contentType: contentType 
            });

          if (uploadError) {
            console.error(`\n❌ Falha no upload da imagem ${storageFileName} (Produto ID: ${p.id}):`, uploadError.message);
            errorCount++;
            finalImageUrl = null; // Falhou, não salva caminho local quebrado
          } else {
            const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storageFileName);
            finalImageUrl = publicUrlData.publicUrl;
            uploadedImagesCount++;
          }
        } catch (err) {
          console.error(`\n❌ Erro ao ler imagem local ${p._localImagePath}:`, err.message);
          errorCount++;
          finalImageUrl = null;
        }
      }

      const { _localImagePath, ...dbProduct } = p;
      dbProduct.image_url = finalImageUrl;
      readyToInsertBatch.push(dbProduct);
    }

    const { error: prodError } = await supabase.from('products').upsert(readyToInsertBatch, { onConflict: 'id' });
    if (prodError) {
      console.error(`\n❌ Erro ao inserir lote (índice ${i}):`, prodError.message);
      errorCount++;
    } else {
      productsSuccessfullyInserted += readyToInsertBatch.length;
    }

    process.stdout.write(`\rProgresso: ${Math.min(i + BATCH_SIZE, validProducts.length)} / ${validProducts.length} produtos tentados...`);
  }

  console.log(`\n\n--- RESUMO DA GRAVAÇÃO ---`);
  console.log(`Registros Lidos: ${products.length}`);
  console.log(`Registros Rejeitados: ${invalidProducts.length}`);
  console.log(`Registros Tentados (Válidos): ${validProducts.length}`);
  console.log(`✓ Produtos EFETIVAMENTE GRAVADOS: ${productsSuccessfullyInserted}`);
  console.log(`✓ Imagens enviadas para nuvem com sucesso: ${uploadedImagesCount}`);
  
  if (errorCount > 0) {
    console.error(`\n🛑 MIGRAÇÃO FINALIZADA COM ${errorCount} ERROS DE LOTE/IMAGEM. Verifique os logs.`);
    console.log("Nota: O script pode ser rodado novamente de forma segura. IDs salvos não serão duplicados.");
    process.exit(1);
  } else {
    console.log("\n🚀 MIGRAÇÃO CONCLUÍDA COM SUCESSO TOTAL!");
    console.log("\n[ATENÇÃO POSTGRESQL] Como forçamos a inserção de IDs primários (upsert), a sequência SERIAL/IDENTITY do banco desincronizou.");
    console.log("Para criar novos produtos no futuro, você PRECISA executar isso no SQL Editor do Supabase:");
    console.log("SELECT setval(pg_get_serial_sequence('categories', 'id'), coalesce(max(id), 0) + 1, false) FROM categories;");
    console.log("SELECT setval(pg_get_serial_sequence('products', 'id'), coalesce(max(id), 0) + 1, false) FROM products;");
  }
}

runMigration().catch(err => {
  console.error("Erro fatal não tratado:", err);
  process.exit(1);
});
