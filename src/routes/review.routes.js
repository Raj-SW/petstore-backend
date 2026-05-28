const express = require('express');
const { isAuthenticated } = require('../middlewares/auth.middleware');
const {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
} = require('../controllers/review.controller');
const { validateReview } = require('../validators/review.validator');

const router = express.Router();

// All review routes require authentication

router.post('/:productId', isAuthenticated, validateReview, createReview);
router.get('/product/:productId', getProductReviews);
router.patch('/:id', isAuthenticated, validateReview, updateReview);
router.delete('/:id', isAuthenticated, deleteReview);

module.exports = router;
