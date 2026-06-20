const express = require('express');
const { isAuthenticated, isAdmin } = require('../middlewares/auth.middleware');
const { validateAnnouncement } = require('../validators/announcement.validator');
const {
  createAnnouncement,
  getAnnouncements,
  unsubscribe,
} = require('../controllers/announcement.controller');

const router = express.Router();

// Public unsubscribe — registered before auth-guarded routes
router.get('/unsubscribe', unsubscribe);

// Admin
router.post('/', isAuthenticated, isAdmin, validateAnnouncement, createAnnouncement);
router.get('/', isAuthenticated, isAdmin, getAnnouncements);

module.exports = router;
