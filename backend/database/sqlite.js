const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.TEST_DB || process.env.DB_PATH || path.join(__dirname, '..', 'farmacia.db');
const db = new Database(dbPath, { verbose: null }); // Disable verbose in production or if requested

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    active BOOLEAN DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT,
    barcode TEXT,
    name TEXT NOT NULL,
    description TEXT,
    category_id INTEGER,
    brand TEXT,
    price REAL DEFAULT 0,
    old_price REAL,
    stock INTEGER DEFAULT 0,
    image_url TEXT,
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories (id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'admin'
  );
`);

module.exports = db;
