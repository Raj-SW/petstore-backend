const Review = require('../models/review.model');
const Order = require('../models/order.model');
const { AppError } = require('../middlewares/errorHandler');

// Create review
exports.createReview = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { rating, comment } = req.body;

    // Check if user has purchased the product
    const order = await Order.findOne({
      user: req.user.id,
      'items.product': productId,
      status: 'delivered',
    });

    if (!order) {
      return next(new AppError('You can only review products you have purchased', 403));
    }

    // Check if user has already reviewed this product
    const existingReview = await Review.findOne({
      user: req.user.id,
      product: productId,
    });

    if (existingReview) {
      return next(new AppError('You have already reviewed this product', 400));
    }

    // Create review (post-save hook on Review updates product rating automatically)
    const review = await Review.create({
      user: req.user.id,
      product: productId,
      rating,
      comment,
    });

    res.status(201).json({
      success: true,
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

// Get product reviews
exports.getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const reviews = await Review.find({ product: productId })
      .populate('user', 'name')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      data: reviews,
    });
  } catch (error) {
    next(error);
  }
};

// Update review
exports.updateReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    const review = await Review.findById(req.params.id);

    if (!review) {
      return next(new AppError('Review not found', 404));
    }

    // Check if user is authorized to update this review
    if (review.user.toString() !== req.user.id) {
      return next(new AppError('Not authorized to update this review', 403));
    }

    review.rating = rating;
    review.comment = comment;
    await review.save(); // post-save hook updates product rating automatically

    res.status(200).json({
      success: true,
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

// Delete review
exports.deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return next(new AppError('Review not found', 404));
    }

    // Check if user is authorized to delete this review
    if (review.user.toString() !== req.user.id) {
      return next(new AppError('Not authorized to delete this review', 403));
    }

    await review.deleteOne();

    res.status(200).json({
      success: true,
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
