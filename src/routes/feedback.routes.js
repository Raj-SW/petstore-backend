const express = require('express');
const { isAuthenticated, isAdmin } = require('../middlewares/auth.middleware');
const { upload } = require('../middlewares/upload');
const { validateFeedback } = require('../validators/feedback.validator');
const {
  submitFeedback,
  getFeedback,
  getFeedbackAdmin,
  updateFeedback,
  deleteFeedback,
} = require('../controllers/feedback.controller');

const router = express.Router();

// Public
router.post('/', upload.array('photos', 3), validateFeedback, submitFeedback);
router.get('/', getFeedback);

// Admin
router.get('/admin/all', isAuthenticated, isAdmin, getFeedbackAdmin);
router.patch('/:id', isAuthenticated, isAdmin, updateFeedback);
router.delete('/:id', isAuthenticated, isAdmin, deleteFeedback);

module.exports = router;
