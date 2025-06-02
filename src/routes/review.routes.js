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

router.post('/', validateReview, createReview);
router.get('/product/:productId', getProductReviews);
router.patch('/:id', validateReview, updateReview);
router.delete('/:id', deleteReview);

module.exports = router;
