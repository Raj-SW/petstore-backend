const mongoose = require('mongoose');
const Faq = require('../models/faq.model');
const { AppError } = require('../middlewares/errorHandler');

// GET /api/faqs — public, active only, ordered
exports.getFaqs = async (req, res, next) => {
  try {
    const faqs = await Faq.find({ active: true }).sort({ order: 1, createdAt: 1 });
    return res.status(200).json({ success: true, count: faqs.length, data: faqs });
  } catch (err) {
    return next(err);
  }
};

// GET /api/faqs/admin/all — admin, all
exports.getFaqsAdmin = async (req, res, next) => {
  try {
    const faqs = await Faq.find().sort({ order: 1, createdAt: 1 });
    return res.status(200).json({ success: true, count: faqs.length, data: faqs });
  } catch (err) {
    return next(err);
  }
};

// POST /api/faqs — admin
exports.createFaq = async (req, res, next) => {
  try {
    const faq = await Faq.create(req.body);
    return res.status(201).json({ success: true, message: 'FAQ created', data: faq });
  } catch (err) {
    return next(err);
  }
};

// PATCH /api/faqs/:id — admin
exports.updateFaq = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return next(new AppError('Invalid FAQ id', 400));
    const faq = await Faq.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!faq) return next(new AppError('FAQ not found', 404));
    return res.status(200).json({ success: true, data: faq });
  } catch (err) {
    return next(err);
  }
};

// DELETE /api/faqs/:id — admin
exports.deleteFaq = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return next(new AppError('Invalid FAQ id', 400));
    const faq = await Faq.findByIdAndDelete(req.params.id);
    if (!faq) return next(new AppError('FAQ not found', 404));
    return res.status(200).json({ success: true, message: 'FAQ deleted' });
  } catch (err) {
    return next(err);
  }
};
