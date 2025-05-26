const express = require('express');
const { protect, restrictTo } = require('../middlewares/auth');
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
router.use(protect);
router.use(restrictTo('admin'));

// Dashboard routes
router.get('/dashboard', getDashboardStats);
router.get('/analytics/sales', validateAnalyticsPeriod, getSalesAnalytics);
router.get('/analytics/products', getProductAnalytics);
router.get('/analytics/users', getUserAnalytics);
router.get('/analytics/appointments', validateAnalyticsPeriod, getAppointmentAnalytics);

module.exports = router;
