const fs = require('fs');
const path = require('path');
const ProductRepository = require('../repositories/ProductRepository');

class ProductService {
  getProducts(query) {
    const { search, category, active, page = 1, limit = 50, sortField, sortOrder } = query;
    return ProductRepository.findPublicProducts(search, category, active, Number(page), Number(limit), sortField, sortOrder);
  }

  validateDuplicates(barcode, externalId, excludeId = null) {
    const b = (barcode || '').toString().trim() || null;
    const e = (externalId || '').toString().trim() || null;
    if (!b && !e) return;
    
    const existing = ProductRepository.findByBarcodeOrExtId(b, e);
    if (existing && existing.id !== Number(excludeId)) {
      if (existing.barcode === b) throw new Error('EAN já cadastrado em outro produto.');
      if (existing.external_id === e) throw new Error('Código Externo já cadastrado em outro produto.');
    }
  }

  createProduct(data) {
    if (!data.name || data.price === undefined || data.stock === undefined) {
      throw new Error('Nome, preço e estoque são obrigatórios.');
    }

    this.validateDuplicates(data.barcode, data.external_id);

    const categoryId = data.category_id || null;
    const info = ProductRepository.createManual({
      name: data.name,
      description: data.description || null,
      category_id: categoryId,
      price: parseFloat(data.price) || 0,
      old_price: data.old_price ? parseFloat(data.old_price) : null,
      stock: parseInt(data.stock, 10) || 0,
      active: data.active !== undefined ? (data.active ? 1 : 0) : 1,
      external_id: data.external_id || null,
      barcode: data.barcode || null,
      brand: data.brand || null,
      image_url: data.image_url || null
    });

    return { success: true, id: info.lastInsertRowid };
  }

  updateProduct(id, data) {
    const categoryId = data.category_id || null;

    this.validateDuplicates(data.barcode, data.external_id, id);

    ProductRepository.update(id, {
      name: data.name,
      description: data.description || null,
      category_id: categoryId,
      price: parseFloat(data.price) || 0,
      old_price: data.old_price ? parseFloat(data.old_price) : null,
      stock: parseInt(data.stock, 10) || 0,
      active: data.active ? 1 : 0,
      external_id: data.external_id || null,
      barcode: data.barcode || null,
      brand: data.brand || null
    });
    return { success: true };
  }

  deleteProduct(id) {
    try {
      this.removeImage(id);
    } catch (err) {
      // Ignore if no image exists
    }
    ProductRepository.delete(id);
    return { success: true };
  }

  updateImage(id, file, backendUrl) {
    const product = ProductRepository.findById(id);
    const oldImageUrl = product ? product.image_url : null;
    const imageUrl = `${backendUrl}/uploads/${path.basename(file.filename)}`;

    ProductRepository.updateImageUrl(id, imageUrl);

    if (oldImageUrl && oldImageUrl.includes('/uploads/')) {
      this.cleanupOldImage(oldImageUrl);
    }

    return imageUrl;
  }

  removeImage(id) {
    const product = ProductRepository.findById(id);
    if (!product || !product.image_url) {
      throw new Error('Produto não possui imagem.');
    }

    const oldImageUrl = product.image_url;
    ProductRepository.removeImageUrl(id);

    if (oldImageUrl.includes('/uploads/')) {
      this.cleanupOldImage(oldImageUrl);
    }
  }

  cleanupOldImage(oldImageUrl) {
    const parts = oldImageUrl.split('/');
    const oldFilename = path.basename(parts[parts.length - 1]);
    if (oldFilename) {
      const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
      const oldFilePath = path.join(uploadDir, oldFilename);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }
  }
}

module.exports = new ProductService();
