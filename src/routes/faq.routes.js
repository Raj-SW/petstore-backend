const express = require('express');
const { isAuthenticated, isAdmin } = require('../middlewares/auth.middleware');
const { validateFaq, validateFaqUpdate } = require('../validators/faq.validator');
const {
  getFaqs,
  getFaqsAdmin,
  createFaq,
  updateFaq,
  deleteFaq,
} = require('../controllers/faq.controller');

const router = express.Router();

// Public
router.get('/', getFaqs);

// Admin
router.get('/admin/all', isAuthenticated, isAdmin, getFaqsAdmin);
router.post('/', isAuthenticated, isAdmin, validateFaq, createFaq);
router.patch('/:id', isAuthenticated, isAdmin, validateFaqUpdate, updateFaq);
router.delete('/:id', isAuthenticated, isAdmin, deleteFaq);

module.exports = router;
