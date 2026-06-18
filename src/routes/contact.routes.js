const express = require('express');
const { isAuthenticated, isAdmin } = require('../middlewares/auth.middleware');
const {
  submitContact,
  getContacts,
  updateContactStatus,
  deleteContact,
  replyToContact,
} = require('../controllers/contact.controller');

const router = express.Router();

// Public
router.post('/', submitContact);

// Admin
router.get('/admin/all', isAuthenticated, isAdmin, getContacts);
router.patch('/:id', isAuthenticated, isAdmin, updateContactStatus);
router.post('/:id/reply', isAuthenticated, isAdmin, replyToContact);
router.delete('/:id', isAuthenticated, isAdmin, deleteContact);

module.exports = router;
