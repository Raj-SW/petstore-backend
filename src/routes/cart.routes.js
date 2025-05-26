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
router.post('/items', validateAddToCart, addToCart);
router.patch('/items/:productId', validateUpdateCartItem, updateCartItem);
router.delete('/items/:productId', removeCartItem);
router.post('/discount', validateApplyDiscount, applyDiscount);
router.delete('/', clearCart);

module.exports = router; 