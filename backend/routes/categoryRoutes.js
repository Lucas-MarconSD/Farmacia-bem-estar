const express = require('express');
const router = express.Router();
const CategoryController = require('../controllers/CategoryController');

// Public route
router.get('/', CategoryController.getCategories);

module.exports = router;
