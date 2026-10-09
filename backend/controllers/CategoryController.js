const CategoryRepository = require('../repositories/CategoryRepository');

class CategoryController {
  getCategories(req, res) {
    try {
      const categories = CategoryRepository.findAllActive();
      res.json(categories);
    } catch (err) {
      console.error('Error fetching categories:', err);
      res.status(500).json({ error: 'Erro interno do servidor.' });
    }
  }
}

module.exports = new CategoryController();
