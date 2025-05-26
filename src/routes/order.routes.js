const express = require('express');
const { protect, restrictTo } = require('../middlewares/auth');
const {
  createOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
  updatePaymentStatus,
  cancelOrder,
  getMyOrders,
} = require('../controllers/order.controller');
const {
  validateCreateOrder,
  validateUpdateOrderStatus,
  validatePaymentStatus,
} = require('../validators/order.validator');

const router = express.Router();

// All order routes require authentication
router.use(protect);

// Customer routes
router.get('/my-orders', getMyOrders);
router.post('/', validateCreateOrder, createOrder);
router.get('/:id', getOrder);
router.patch('/:id/cancel', cancelOrder);

// Admin routes
router.use(restrictTo('admin'));
router.get('/', getOrders);
router.patch('/:id/status', validateUpdateOrderStatus, updateOrderStatus);
router.patch('/:id/payment', validatePaymentStatus, updatePaymentStatus);

module.exports = router; 