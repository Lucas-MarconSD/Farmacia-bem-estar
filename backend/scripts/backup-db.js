/**
 * Backup consistente do banco SQLite (farmacia.db).
 *
 * Usa a API de backup online do SQLite (via better-sqlite3), que é segura
 * mesmo com o servidor rodando e o banco aberto — ao contrário de copiar o
 * arquivo diretamente. Após gerar a cópia, valida a integridade e compara a
 * contagem de registros com o banco original.
 *
 * Uso: npm run backup   (ou: node scripts/backup-db.js)
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'farmacia.db');
const BACKUP_DIR = path.join(ROOT, 'backups');
const TABLES = ['products', 'categories', 'users'];

const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
const DEST = path.join(BACKUP_DIR, `farmacia_${stamp}.db`);

const countRows = (db) =>
  Object.fromEntries(TABLES.map((t) => [t, db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c]));

async function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Banco não encontrado: ${SOURCE}`);
  }
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const source = new Database(SOURCE, { readonly: true, fileMustExist: true });
  const sourceCounts = countRows(source);
  await source.backup(DEST);
  source.close();

  const copy = new Database(DEST, { readonly: true, fileMustExist: true });
  const integrity = copy.pragma('integrity_check', { simple: true });
  const copyCounts = countRows(copy);
  copy.close();

  const countsMatch = TABLES.every((t) => sourceCounts[t] === copyCounts[t]);

  console.log(`Backup criado: ${DEST}`);
  console.log(`Tamanho: ${fs.statSync(DEST).size} bytes`);
  console.log(`Integridade: ${integrity}`);
  console.log('Registros (original -> backup):');
  TABLES.forEach((t) => console.log(`  ${t}: ${sourceCounts[t]} -> ${copyCounts[t]}`));

  if (integrity !== 'ok' || !countsMatch) {
    throw new Error('Backup inválido: integridade ou contagem divergente.');
  }
  console.log('Backup validado com sucesso.');
}

main().catch((err) => {
  console.error('Falha no backup:', err.message);
  process.exit(1);
});
