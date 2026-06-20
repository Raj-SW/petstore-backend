const express = require('express');
const { isAuthenticated, isAdmin } = require('../middlewares/auth.middleware');
const { subscribe, getSubscribersAdmin } = require('../controllers/newsletter.controller');

const router = express.Router();

// Public
router.post('/', subscribe);

// Admin
router.get('/admin/all', isAuthenticated, isAdmin, getSubscribersAdmin);

module.exports = router;
