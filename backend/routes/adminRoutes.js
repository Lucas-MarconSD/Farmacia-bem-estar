const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth');
const uploadMiddleware = require('../middlewares/upload');

const ProductController = require('../controllers/ProductController');
const ImportController = require('../controllers/ImportController');
const DotCompanyController = require('../controllers/DotCompanyController');
const AuthController = require('../controllers/AuthController');

// All routes in this file require authentication
router.use(authMiddleware);

// Admin Product Routes
router.post('/change-password', AuthController.changePassword);
router.get('/products', ProductController.getProducts); // Reuse for admin search
router.post('/products', ProductController.createProduct);
router.put('/products/:id', ProductController.updateProduct);
router.delete('/products/:id', ProductController.deleteProduct);
router.post('/products/:id/image', uploadMiddleware.single('image'), ProductController.uploadImage);
router.delete('/products/:id/image', ProductController.removeImage);

// Import Route
router.post('/import', uploadMiddleware.single('file'), ImportController.importData);

// DotCompany Route
router.get('/dotcompany-test/:ean', DotCompanyController.testEan);

module.exports = router;
