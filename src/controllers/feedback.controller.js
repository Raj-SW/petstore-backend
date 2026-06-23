const mongoose = require('mongoose');
const Feedback = require('../models/feedback.model');
const { AppError } = require('../middlewares/errorHandler');
const { uploadMultipleToCloudinary } = require('../utils/cloudinary');
const logger = require('../utils/logger');

// POST /api/feedback — public (multipart: up to 3 photos)
exports.submitFeedback = async (req, res, next) => {
  try {
    let photos = [];
    if (req.files && req.files.length) {
      const results = await uploadMultipleToCloudinary(req.files.slice(0, 3), 'feedback');
      photos = results.map((r) => ({ url: r.url, publicId: r.publicId }));
    }
    const feedback = await Feedback.create({ ...req.body, photos, approved: false });
    logger.info('Feedback submitted', { feedbackId: feedback._id });
    return res.status(201).json({
      success: true,
      message: "Thanks! Your feedback will appear once it's approved.",
      data: { _id: feedback._id },
    });
  } catch (error) {
    return next(error);
  }
};

// POST /api/feedback/upload-image — admin, single image -> { url, publicId }
exports.uploadFeedbackImage = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('No image file provided', 400));
    const [result] = await uploadMultipleToCloudinary([req.file], 'feedback');
    return res.status(200).json({ success: true, data: { url: result.url, publicId: result.publicId } });
  } catch (error) {
    return next(error);
  }
};

// GET /api/feedback — public, approved only
exports.getFeedback = async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const feedback = await Feedback.find({ approved: true }).sort('-createdAt').limit(limit);
    return res.status(200).json({ success: true, count: feedback.length, data: feedback });
  } catch (error) {
    return next(error);
  }
};

// GET /api/feedback/admin/all — admin, all
exports.getFeedbackAdmin = async (req, res, next) => {
  try {
    const feedback = await Feedback.find().sort('-createdAt');
    return res.status(200).json({ success: true, count: feedback.length, data: feedback });
  } catch (error) {
    return next(error);
  }
};

// PATCH /api/feedback/:id — admin (approve/update)
exports.updateFeedback = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new AppError('Invalid feedback id', 400));
    }
    // Restrict writable fields (no mass-assignment from req.body)
    const ALLOWED = ['name', 'role', 'rating', 'message', 'approved', 'photos'];
    const updates = {};
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const feedback = await Feedback.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!feedback) return next(new AppError('Feedback not found', 404));
    return res.status(200).json({ success: true, data: feedback });
  } catch (error) {
    return next(error);
  }
};

// DELETE /api/feedback/:id — admin
exports.deleteFeedback = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new AppError('Invalid feedback id', 400));
    }
    const feedback = await Feedback.findByIdAndDelete(req.params.id);
    if (!feedback) return next(new AppError('Feedback not found', 404));
    return res.status(200).json({ success: true, message: 'Feedback deleted' });
  } catch (error) {
    return next(error);
  }
};
