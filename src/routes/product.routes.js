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
  getFilterOptions,
  bulkAction,
} = require('../controllers/product.controller');
const { validateProduct, validateProductUpdate } = require('../validators/product.validator');
const { validateBulkAction } = require('../validators/bulkAction.validator');
const { upload } = require('../middlewares/upload');

const router = express.Router();

// Public routes
router.get('/', getProducts);
router.get('/category/:category', getProductsByCategory);
// Distinct filter options for the storefront side panel (before /:id to avoid shadowing)
router.get('/filter-options', getFilterOptions);

// Admin analytics (registered before /:id to prevent shadowing)
router.get('/analytics/overview', isAuthenticated, isAdmin, getProductAnalytics);

router.get('/:id', getProduct);

// Admin-only routes
router.use(isAuthenticated, isAdmin);

// Bulk actions on multiple products (Admin only)
router.post('/bulk', validateBulkAction, bulkAction);

// Product CRUD operations (Admin only)
router.post('/', upload.array('images', 10), validateProduct, createProduct);
router.patch('/:id', upload.array('images', 10), validateProductUpdate, updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;
