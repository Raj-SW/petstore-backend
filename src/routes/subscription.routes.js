const express = require('express');
const { isAuthenticated, isAdmin } = require('../middlewares/auth.middleware');
const { verifyCronSecret } = require('../middlewares/cronAuth');
const {
  validateCreateSubscription,
  validateUpdateSubscription,
} = require('../validators/subscription.validator');
const {
  createSubscription,
  getMySubscriptions,
  updateSubscription,
  cancelSubscription,
  getSubscriptionsAdmin,
  updateSubscriptionAdmin,
  processDue,
} = require('../controllers/subscription.controller');

const router = express.Router();

// Cron runner — Bearer CRON_SECRET, registered before auth-guarded routes.
router.get('/process-due', verifyCronSecret, processDue);
router.post('/process-due', verifyCronSecret, processDue);

// Admin
router.get('/admin', isAuthenticated, isAdmin, getSubscriptionsAdmin);
router.patch('/admin/:id', isAuthenticated, isAdmin, updateSubscriptionAdmin);

// Customer
router.post('/', isAuthenticated, validateCreateSubscription, createSubscription);
router.get('/mine', isAuthenticated, getMySubscriptions);
router.patch('/:id', isAuthenticated, validateUpdateSubscription, updateSubscription);
router.delete('/:id', isAuthenticated, cancelSubscription);

module.exports = router;
