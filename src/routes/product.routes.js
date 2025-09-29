const express = require('express');
const { isAuthenticated, isAdmin } = require('../middlewares/auth.middleware');
const {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getProductsByCategory,
  getProductAnalytics,
} = require('../controllers/product.controller');
const { validateProduct, validateProductUpdate } = require('../validators/product.validator');
const { upload } = require('../middlewares/upload');

const router = express.Router();

// Public routes
router.get('/', getProducts);
router.get('/category/:category', getProductsByCategory);
router.get('/:id', getProduct);

// Admin-only routes
router.use(isAuthenticated, isAdmin);

// Product CRUD operations (Admin only)
router.post('/', upload.array('images', 10), validateProduct, createProduct);
router.patch('/:id', upload.array('images', 10), validateProductUpdate, updateProduct);
router.delete('/:id', deleteProduct);

// Admin analytics
router.get('/analytics/overview', getProductAnalytics);

module.exports = router;
