const ProductService = require('../services/ProductService');
const env = require('../config/env');

class ProductController {
  getProducts(req, res) {
    try {
      const result = ProductService.getProducts(req.query);
      res.json(result);
    } catch (err) {
      console.error('Error fetching products:', err);
      res.status(500).json({ error: 'Erro interno do servidor.' });
    }
  }

  createProduct(req, res) {
    try {
      const result = ProductService.createProduct(req.body);
      res.status(201).json(result);
    } catch(err) {
      console.error('Error creating product:', err);
      if (err.message && (err.message.includes('EAN') || err.message.includes('Código Externo') || err.message.includes('obrigatórios'))) {
        return res.status(400).json({ error: err.message });
      }
      res.status(500).json({ error: 'Erro interno do servidor.' });
    }
  }

  updateProduct(req, res) {
    const { id } = req.params;
    try {
      ProductService.updateProduct(id, req.body);
      res.json({ success: true });
    } catch(err) {
      console.error('Error updating product:', err);
      if (err.message && (err.message.includes('EAN') || err.message.includes('Código Externo'))) {
        return res.status(400).json({ error: err.message });
      }
      res.status(500).json({ error: 'Erro interno do servidor.' });
    }
  }

  deleteProduct(req, res) {
    const { id } = req.params;
    try {
      ProductService.deleteProduct(id);
      res.json({ success: true });
    } catch(err) {
      console.error('Error deleting product:', err);
      res.status(500).json({ error: 'Erro interno do servidor ao deletar produto.' });
    }
  }

  uploadImage(req, res) {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem enviada ou formato inválido.' });

    try {
      const imageUrl = ProductService.updateImage(id, req.file, env.BACKEND_URL);
      res.json({ success: true, image_url: imageUrl });
    } catch(err) {
      console.error('Error saving image:', err);
      if (req.file) ProductService.cleanupOldImage(req.file.filename);
      res.status(500).json({ error: 'Erro interno do servidor ao salvar a imagem no banco.' });
    }
  }

  removeImage(req, res) {
    const { id } = req.params;
    try {
      ProductService.removeImage(id);
      res.json({ success: true });
    } catch(err) {
      console.error('Error removing image:', err);
      res.status(500).json({ error: 'Erro interno do servidor ao remover a imagem.' });
    }
  }
}

module.exports = new ProductController();
