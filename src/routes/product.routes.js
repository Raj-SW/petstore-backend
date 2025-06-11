const express = require('express');
const { isAuthenticated, isAdmin } = require('../middlewares/auth.middleware');
const {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  uploadProductImages,
  deleteProductImage,
} = require('../controllers/product.controller');
const { validateProduct } = require('../validators/product.validator');
const { upload } = require('../middlewares/upload');

const router = express.Router();

// Public routes
router.get('/', getProducts);
router.get('/:id', getProduct);

// Admin-only routes
router.use(isAuthenticated, isAdmin);
router.post('/', validateProduct, createProduct);
router.patch('/:id', validateProduct, updateProduct);
router.delete('/:id', deleteProduct);
router.post('/:id/images', upload.array('images'), uploadProductImages);
router.delete('/:id/images/:imageId', deleteProductImage);

module.exports = router;
