const express = require('express');
const { protect } = require('../middlewares/auth');
const {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  applyDiscount,
  clearCart,
} = require('../controllers/cart.controller');
const {
  validateAddToCart,
  validateUpdateCartItem,
  validateApplyDiscount,
} = require('../validators/cart.validator');

const router = express.Router();

// All cart routes require authentication
router.use(protect);

router.get('/', getCart);
router.post('/', validateAddToCart, addToCart);
router.patch('/:id', validateUpdateCartItem, updateCartItem);
router.delete('/:id', removeCartItem);
router.post('/apply-discount', validateApplyDiscount, applyDiscount);
router.delete('/clear', clearCart);

module.exports = router;
