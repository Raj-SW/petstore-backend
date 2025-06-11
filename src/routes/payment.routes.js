const express = require('express');
const { isAuthenticated } = require('../middlewares/auth.middleware');
const {
  initializePayment,
  confirmPayment,
  processRefund,
  handleWebhook,
} = require('../controllers/payment.controller');

const router = express.Router();

// Webhook routes (no auth required)
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), (req, res, next) => {
  req.params.paymentMethod = 'stripe';
  handleWebhook(req, res, next);
});

router.post('/webhook/paypal', express.json(), (req, res, next) => {
  req.params.paymentMethod = 'paypal';
  handleWebhook(req, res, next);
});

// Protected routes
router.use(isAuthenticated);

// Customer routes
router.post('/orders/:orderId/initialize', initializePayment);
router.post('/orders/:orderId/confirm', confirmPayment);

// Admin routes
router.post('/orders/:orderId/refund', processRefund);

module.exports = router;
