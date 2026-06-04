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

const {
  getInventory,
  getLowStock,
  getMovements,
  restockProduct,
  adjustStock,
} = require('../controllers/inventory.controller');

const {
  getInvoices,
  getInvoice,
  downloadInvoicePDF,
  generateInvoiceForOrder,
} = require('../controllers/invoice.controller');

const {
  getTransactions,
  getTransaction,
} = require('../controllers/transaction.controller');

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

// Inventory management routes
// NOTE: /inventory/low-stock must be registered before /inventory/:id to avoid route shadowing
router.get('/inventory',                   getInventory);
router.get('/inventory/low-stock',         getLowStock);
router.get('/inventory/:id/movements',     getMovements);
router.patch('/inventory/:id/restock',     restockProduct);
router.patch('/inventory/:id/adjust',      adjustStock);

// Invoice routes — generate/:orderId MUST be before /:id
router.get('/invoices',                        getInvoices);
router.post('/invoices/generate/:orderId',     generateInvoiceForOrder);
router.get('/invoices/:id',                    getInvoice);
router.get('/invoices/:id/pdf',                downloadInvoicePDF);

// Transaction routes
router.get('/transactions',       getTransactions);
router.get('/transactions/:id',   getTransaction);

module.exports = router;
