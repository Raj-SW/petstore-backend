const express = require('express');
const { isAuthenticated } = require('../middlewares/auth.middleware');
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
router.use(isAuthenticated);

// Customer routes
router.get('/my-orders', getMyOrders);
router.post('/', validateCreateOrder, createOrder);
router.get('/:id', getOrder);
router.patch('/:id/cancel', cancelOrder);

// Admin routes
router.get('/', getOrders);
router.patch('/:id/status', validateUpdateOrderStatus, updateOrderStatus);
router.patch('/:id/payment', validatePaymentStatus, updatePaymentStatus);

module.exports = router;
