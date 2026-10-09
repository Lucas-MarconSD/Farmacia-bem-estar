const db = require('../database/sqlite');

class CategoryRepository {
  findAllActive() {
    return db.prepare('SELECT * FROM categories WHERE active = 1 ORDER BY name ASC').all();
  }

  findBySlug(slug) {
    return db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug);
  }

  findByNameIgnoreCase(name) {
    return db.prepare('SELECT id FROM categories WHERE name = ? COLLATE NOCASE').get(name);
  }

  create(name, slug) {
    return db.prepare('INSERT OR IGNORE INTO categories (name, slug) VALUES (?, ?)').run(name, slug);
  }
  
  getCategoryCounts() {
    return db.prepare(`
      SELECT c.name as name, COUNT(p.id) as count 
      FROM categories c 
      LEFT JOIN products p ON p.category_id = c.id 
      GROUP BY c.id
    `).all();
  }
}

module.exports = new CategoryRepository();
