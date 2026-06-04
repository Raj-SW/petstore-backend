const express = require('express');
const { isAuthenticated, isAdmin } = require('../middlewares/auth.middleware');
const {
  createOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
  updatePaymentStatus,
  cancelOrder,
  getMyOrders,
} = require('../controllers/order.controller');
const { getMyInvoice } = require('../controllers/invoice.controller');
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
router.get('/my-invoices/:id', getMyInvoice);
router.post('/', validateCreateOrder, createOrder);
router.get('/:id', getOrder);
router.patch('/:id/cancel', cancelOrder);

// Admin routes
router.get('/', isAdmin, getOrders);
router.patch('/:id/status', isAdmin, validateUpdateOrderStatus, updateOrderStatus);
router.patch('/:id/payment', isAdmin, validatePaymentStatus, updatePaymentStatus);

module.exports = router;
