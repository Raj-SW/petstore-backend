const mongoose = require('mongoose');
const PetCareTip = require('../models/petCareTip.model');
const { AppError } = require('../middlewares/errorHandler');
const { uploadToCloudinary, deleteMultipleFromCloudinary } = require('../utils/cloudinary');
const { coerceCoverImage, collectImagePublicIds } = require('../utils/contentImages');
const logger = require('../utils/logger');
const { toSafeString, escapeRegExp } = require('../utils/sanitize');

// GET /api/tips — public, published only
exports.getTips = async (req, res, next) => {
  try {
    const {
      animalType, category, difficulty, featured,
      search, exclude, page = 1, limit = 12, sort = '-createdAt',
    } = req.query;

    const query = { published: true };
    const safeAnimalType = toSafeString(animalType);
    const safeCategory = toSafeString(category);
    const safeDifficulty = toSafeString(difficulty);
    if (safeAnimalType) query.animalType = safeAnimalType;
    if (safeCategory) query.category = safeCategory;
    if (safeDifficulty) query.difficulty = safeDifficulty;
    if (featured !== undefined) query.featured = featured === 'true';
    if (exclude && mongoose.isValidObjectId(exclude)) query._id = { $ne: String(exclude) };
    if (search) {
      const rx = new RegExp(escapeRegExp(search), 'i');
      query.$or = [{ title: rx }, { breed: rx }];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));

    const [tips, total] = await Promise.all([
      PetCareTip.find(query)
        .sort(sort)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      PetCareTip.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      count: tips.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
      data: tips,
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/tips/admin/all — admin, includes drafts
exports.getTipsAdmin = async (req, res, next) => {
  try {
    const tips = await PetCareTip.find().sort('-createdAt');
    return res.status(200).json({ success: true, count: tips.length, data: tips });
  } catch (error) {
    return next(error);
  }
};

// GET /api/tips/admin/:id — admin, single incl. draft
exports.getTipAdmin = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new AppError('Invalid tip id', 400));
    }
    const tip = await PetCareTip.findById(req.params.id);
    if (!tip) return next(new AppError('Tip not found', 404));
    return res.status(200).json({ success: true, data: tip });
  } catch (error) {
    return next(error);
  }
};

// GET /api/tips/:idOrSlug — public, published only
exports.getTip = async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;
    const query = mongoose.isValidObjectId(idOrSlug)
      ? { _id: idOrSlug }
      : { slug: idOrSlug.toLowerCase() };

    const tip = await PetCareTip.findOne({ ...query, published: true });
    if (!tip) return next(new AppError('Tip not found', 404));
    return res.status(200).json({ success: true, data: tip });
  } catch (error) {
    return next(error);
  }
};

// POST /api/tips — admin
exports.createTip = async (req, res, next) => {
  try {
    const payload = { ...req.body, createdBy: req.user._id };
    const cover = coerceCoverImage(req.body.coverImage);
    if (cover !== undefined) payload.coverImage = cover;
    const tip = await PetCareTip.create(payload);
    logger.info(`Tip created by admin ${req.user._id}`, { tipId: tip._id, title: tip.title });
    return res.status(201).json({ success: true, message: 'Tip created successfully', data: tip });
  } catch (error) {
    if (error.code === 11000) {
      return next(new AppError('A tip with this title already exists', 409));
    }
    return next(error);
  }
};

// PATCH /api/tips/:id — admin
// Uses doc.set + save (not findByIdAndUpdate) so slug/readTime pre-save hooks run.
exports.updateTip = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new AppError('Invalid tip id', 400));
    }
    const tip = await PetCareTip.findById(req.params.id);
    if (!tip) return next(new AppError('Tip not found', 404));

    // Diff cover + section image refs to clean up removed Cloudinary assets.
    const oldIds = new Set(collectImagePublicIds(tip));
    const update = { ...req.body };
    const cover = coerceCoverImage(req.body.coverImage);
    if (cover !== undefined) update.coverImage = cover;

    tip.set(update);
    await tip.save();

    const newIds = new Set(collectImagePublicIds(tip));
    const removed = [...oldIds].filter((id) => id && !newIds.has(id));
    if (removed.length) {
      try { await deleteMultipleFromCloudinary(removed); } catch (e) { logger.warn('Tip image cleanup failed (non-fatal)', { error: e.message }); }
    }

    logger.info(`Tip updated by admin ${req.user._id}`, { tipId: tip._id });
    return res.status(200).json({ success: true, message: 'Tip updated successfully', data: tip });
  } catch (error) {
    if (error.code === 11000) {
      return next(new AppError('A tip with this title already exists', 409));
    }
    return next(error);
  }
};

// POST /api/tips/upload-image — admin, single image -> { url, publicId }
exports.uploadImage = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('No image uploaded', 400));
    const result = await uploadToCloudinary(req.file, 'tips');
    return res.status(200).json({ success: true, data: { url: result.url, publicId: result.publicId } });
  } catch (error) {
    return next(error);
  }
};

// DELETE /api/tips/:id — admin
exports.deleteTip = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new AppError('Invalid tip id', 400));
    }
    const tip = await PetCareTip.findByIdAndDelete(req.params.id);
    if (!tip) return next(new AppError('Tip not found', 404));
    logger.info(`Tip deleted by admin ${req.user._id}`, { tipId: tip._id });
    return res.status(200).json({ success: true, message: 'Tip deleted successfully' });
  } catch (error) {
    return next(error);
  }
};
