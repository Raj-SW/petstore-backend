const express = require('express');
const { isAuthenticated, isAdmin } = require('../middlewares/auth.middleware');
const { validateAnalyticsPeriod } = require('../validators/admin.validator');
const {
  getDashboardStats,
  getSalesAnalytics,
  getProductAnalytics,
  getUserAnalytics,
  getAppointmentAnalytics,
} = require('../controllers/admin.controller');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(isAuthenticated);
router.use(isAdmin);

// Dashboard routes
router.get('/dashboard', getDashboardStats);
router.get('/analytics/sales', validateAnalyticsPeriod, getSalesAnalytics);
router.get('/analytics/products', getProductAnalytics);
router.get('/analytics/users', getUserAnalytics);
router.get('/analytics/appointments', validateAnalyticsPeriod, getAppointmentAnalytics);

module.exports = router;
