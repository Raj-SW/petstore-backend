const mongoose = require('mongoose');
const Advert = require('../models/advert.model');
const { AppError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

// GET /api/adverts — public, active only
exports.getAdverts = async (req, res, next) => {
  try {
    const query = { active: true };
    if (req.query.placement) query.placement = req.query.placement;
    const adverts = await Advert.find(query).sort('-createdAt');
    return res.status(200).json({ success: true, count: adverts.length, data: adverts });
  } catch (error) {
    return next(error);
  }
};

// GET /api/adverts/admin/all — admin, includes inactive
exports.getAdvertsAdmin = async (req, res, next) => {
  try {
    const adverts = await Advert.find().sort('-createdAt');
    return res.status(200).json({ success: true, count: adverts.length, data: adverts });
  } catch (error) {
    return next(error);
  }
};

// POST /api/adverts — admin
exports.createAdvert = async (req, res, next) => {
  try {
    const advert = await Advert.create({ ...req.body, createdBy: req.user._id });
    logger.info(`Advert created by admin ${req.user._id}`, { advertId: advert._id });
    return res.status(201).json({ success: true, message: 'Advert created successfully', data: advert });
  } catch (error) {
    return next(error);
  }
};

// PATCH /api/adverts/:id — admin
exports.updateAdvert = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new AppError('Invalid advert id', 400));
    }
    const advert = await Advert.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!advert) return next(new AppError('Advert not found', 404));
    logger.info(`Advert updated by admin ${req.user._id}`, { advertId: advert._id });
    return res.status(200).json({ success: true, message: 'Advert updated successfully', data: advert });
  } catch (error) {
    return next(error);
  }
};

// DELETE /api/adverts/:id — admin
exports.deleteAdvert = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new AppError('Invalid advert id', 400));
    }
    const advert = await Advert.findByIdAndDelete(req.params.id);
    if (!advert) return next(new AppError('Advert not found', 404));
    logger.info(`Advert deleted by admin ${req.user._id}`, { advertId: advert._id });
    return res.status(200).json({ success: true, message: 'Advert deleted successfully' });
  } catch (error) {
    return next(error);
  }
};
