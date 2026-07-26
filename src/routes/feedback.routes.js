const express = require('express');
const { isAuthenticated, isAdmin } = require('../middlewares/auth.middleware');
const { upload } = require('../middlewares/upload');
const { validateFeedback, validateFeedbackAdmin } = require('../validators/feedback.validator');
const {
  submitFeedback,
  getFeedback,
  getFeedbackAdmin,
  updateFeedback,
  deleteFeedback,
  uploadFeedbackImage,
  createFeedbackAdmin,
  getFeedbackStats,
} = require('../controllers/feedback.controller');

const router = express.Router();

// Public
router.post('/', upload.array('photos', 3), validateFeedback, submitFeedback);
router.get('/stats', getFeedbackStats);
router.get('/', getFeedback);

// Admin
router.post('/admin', isAuthenticated, isAdmin, validateFeedbackAdmin, createFeedbackAdmin);
router.post('/upload-image', isAuthenticated, isAdmin, upload.single('image'), uploadFeedbackImage);
router.get('/admin/all', isAuthenticated, isAdmin, getFeedbackAdmin);
router.patch('/:id', isAuthenticated, isAdmin, updateFeedback);
router.delete('/:id', isAuthenticated, isAdmin, deleteFeedback);

module.exports = router;
