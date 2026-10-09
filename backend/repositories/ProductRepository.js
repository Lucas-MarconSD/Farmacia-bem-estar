const db = require('../database/sqlite');

class ProductRepository {
  findPublicProducts(search, category, active, page = 1, limit = 50, sortField = 'name', sortOrder = 'asc') {
    let query = `
      SELECT p.*, c.name as categoryName 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE 1=1
    `;
    const params = [];

    if (active !== 'false') {
      query += ' AND p.active = 1';
    }

    if (search) {
      query += ' AND (p.name LIKE ? OR p.description LIKE ? OR p.barcode LIKE ? OR p.external_id LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (category && category !== 'todos') {
      query += ' AND c.slug = ?';
      params.push(category);
    }

    // Count Total
    const countQuery = `SELECT COUNT(*) as total FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE 1=1 ${query.split('WHERE 1=1')[1]}`;
    const totalRow = db.prepare(countQuery).get(...params);
    const total = totalRow.total;

    // Sorting definition mapping (prevent SQL injection)
    const validSortFields = {
      'name': 'p.name',
      'price': 'p.price',
      'stock': 'p.stock',
      'status': 'p.active',
      'category': 'categoryName',
      'id': 'p.id'
    };
    const orderBy = validSortFields[sortField] || 'p.name';
    const orderDir = sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    // Pagination
    query += ` ORDER BY ${orderBy} ${orderDir} LIMIT ? OFFSET ?`;
    const offset = (page - 1) * limit;
    params.push(limit, offset);

    const data = db.prepare(query).all(...params);

    return { data, total, totalPages: Math.ceil(total / limit) };
  }

  findById(id) {
    return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  }

  update(id, data) {
    return db.prepare(`
      UPDATE products 
      SET name = ?, description = ?, category_id = ?, price = ?, old_price = ?, stock = ?, active = ?, external_id = ?, barcode = ?, brand = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(data.name, data.description, data.category_id, data.price, data.old_price, data.stock, data.active, data.external_id, data.barcode, data.brand, id);
  }

  updateImageUrl(id, imageUrl) {
    return db.prepare('UPDATE products SET image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(imageUrl, id);
  }

  removeImageUrl(id) {
    return db.prepare('UPDATE products SET image_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  }

  delete(id) {
    return db.prepare('DELETE FROM products WHERE id = ?').run(id);
  }

  findByBarcode(barcode) {
    return db.prepare('SELECT id, external_id FROM products WHERE barcode = ?').get(barcode);
  }

  findByBarcodeOrExtId(barcode, externalId) {
    const conditions = [];
    const params = [];
    if (barcode) {
      conditions.push('barcode = ?');
      params.push(barcode);
    }
    if (externalId) {
      conditions.push('external_id = ?');
      params.push(externalId);
    }
    if (conditions.length === 0) return null;
    return db.prepare(`SELECT id, barcode, external_id FROM products WHERE ${conditions.join(' OR ')}`).get(...params);
  }

  create(name, barcode, externalId, categoryId, brand, price, stock) {
    return db.prepare(`
      INSERT INTO products (name, barcode, external_id, category_id, brand, price, stock) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, barcode, externalId, categoryId, brand, price, stock);
  }

  createManual(data) {
    return db.prepare(`
      INSERT INTO products (name, description, category_id, price, old_price, stock, active, external_id, barcode, brand, image_url) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.name, data.description, data.category_id, data.price, data.old_price, 
      data.stock, data.active, data.external_id, data.barcode, data.brand, data.image_url
    );
  }

  updateFromImport(id, name, categoryId, brand, price, stock) {
    return db.prepare(`
      UPDATE products 
      SET name = ?, category_id = ?, brand = ?, price = ?, stock = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(name, categoryId, brand, price, stock, id);
  }

  findAllLightweight() {
    return db.prepare('SELECT id, barcode, external_id, price, stock, active FROM products').all();
  }

  updateStockAndPrice(id, price, stock) {
    return db.prepare(`
      UPDATE products 
      SET price = ?, stock = ?, active = 1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(price, stock, id);
  }

  deactivate(id) {
    return db.prepare('UPDATE products SET active = 0, stock = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  }
}

module.exports = new ProductRepository();
