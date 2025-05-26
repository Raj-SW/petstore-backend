const express = require('express');
const { protect, restrictTo } = require('../middlewares/auth');
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

// Protected routes (Admin only)
router.use(protect, restrictTo('admin'));
router.post('/', validateProduct, createProduct);
router.put('/:id', validateProduct, updateProduct);
router.delete('/:id', deleteProduct);
router.post('/:id/images', upload.array('images', 5), uploadProductImages);
router.delete('/:id/images/:imageId', deleteProductImage);

module.exports = router;
