const express = require('express');
const { isAuthenticated, isAdmin } = require('../middlewares/auth.middleware');
const { validateAnalyticsPeriod } = require('../validators/admin.validator');
const {
  getDashboardStats,
  getSalesAnalytics,
  getProductAnalytics,
  getUserAnalytics,
  getAppointmentAnalytics,
  listUsers,
  updateUserRole,
  toggleUserStatus,
  deleteUser,
  getAllAppointments,
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

// User management routes
router.get('/users', listUsers);
router.patch('/users/:id/role', updateUserRole);
router.patch('/users/:id/status', toggleUserStatus);
router.delete('/users/:id', deleteUser);

// Appointment management routes (admin gets all appointments)
router.get('/appointments', getAllAppointments);

module.exports = router;
