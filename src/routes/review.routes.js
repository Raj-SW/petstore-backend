const express = require('express');
const { protect } = require('../middlewares/auth');
const {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
} = require('../controllers/review.controller');
const { validateReview } = require('../validators/review.validator');

const router = express.Router();

// All review routes require authentication
router.use(protect);

router
  .route('/products/:productId/reviews')
  .get(getProductReviews)
  .post(validateReview, createReview);

router
  .route('/reviews/:id')
  .patch(validateReview, updateReview)
  .delete(deleteReview);

module.exports = router; 