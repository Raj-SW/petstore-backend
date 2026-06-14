const mongoose = require('mongoose');
const GalleryPost = require('../models/galleryPost.model');
const { AppError } = require('../middlewares/errorHandler');
const { uploadToCloudinary } = require('../utils/cloudinary');
const logger = require('../utils/logger');

// GET /api/gallery — public, published only
exports.getPosts = async (req, res, next) => {
  try {
    const {
      category, tag, featured, search,
      page = 1, limit = 12, sort = '-eventDate',
    } = req.query;

    const query = { published: true };
    if (category) query.category = category;
    if (tag) query.tags = tag.toLowerCase();
    if (featured !== undefined) query.featured = featured === 'true';
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.title = rx;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));

    const [posts, total] = await Promise.all([
      GalleryPost.find(query)
        .sort(sort)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      GalleryPost.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      count: posts.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
      data: posts,
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/gallery/admin/all — admin, includes drafts
exports.getPostsAdmin = async (req, res, next) => {
  try {
    const posts = await GalleryPost.find().sort('-createdAt');
    return res.status(200).json({ success: true, count: posts.length, data: posts });
  } catch (error) {
    return next(error);
  }
};

// GET /api/gallery/admin/:id — admin, single incl. draft
exports.getPostAdmin = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new AppError('Invalid post id', 400));
    }
    const post = await GalleryPost.findById(req.params.id);
    if (!post) return next(new AppError('Gallery post not found', 404));
    return res.status(200).json({ success: true, data: post });
  } catch (error) {
    return next(error);
  }
};

// GET /api/gallery/:idOrSlug — public, published only, with related posts
exports.getPost = async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;
    const query = mongoose.isValidObjectId(idOrSlug)
      ? { _id: idOrSlug }
      : { slug: idOrSlug.toLowerCase() };

    const post = await GalleryPost.findOne({ ...query, published: true });
    if (!post) return next(new AppError('Gallery post not found', 404));

    const related = await GalleryPost.find({
      published: true,
      category: post.category,
      _id: { $ne: post._id },
    })
      .sort('-eventDate')
      .limit(3);

    return res.status(200).json({ success: true, data: post, related });
  } catch (error) {
    return next(error);
  }
};

// POST /api/gallery — admin
exports.createPost = async (req, res, next) => {
  try {
    const post = await GalleryPost.create({ ...req.body, createdBy: req.user._id });
    logger.info(`Gallery post created by admin ${req.user._id}`, { postId: post._id, title: post.title });
    return res.status(201).json({ success: true, message: 'Gallery post created successfully', data: post });
  } catch (error) {
    if (error.code === 11000) {
      return next(new AppError('A gallery post with this title already exists', 409));
    }
    return next(error);
  }
};

// PATCH /api/gallery/:id — admin
// Uses doc.set + save (not findByIdAndUpdate) so slug/excerpt/tags pre-save hooks run.
exports.updatePost = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new AppError('Invalid post id', 400));
    }
    const post = await GalleryPost.findById(req.params.id);
    if (!post) return next(new AppError('Gallery post not found', 404));

    post.set(req.body);
    await post.save();

    logger.info(`Gallery post updated by admin ${req.user._id}`, { postId: post._id });
    return res.status(200).json({ success: true, message: 'Gallery post updated successfully', data: post });
  } catch (error) {
    if (error.code === 11000) {
      return next(new AppError('A gallery post with this title already exists', 409));
    }
    return next(error);
  }
};

// DELETE /api/gallery/:id — admin
exports.deletePost = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new AppError('Invalid post id', 400));
    }
    const post = await GalleryPost.findByIdAndDelete(req.params.id);
    if (!post) return next(new AppError('Gallery post not found', 404));
    logger.info(`Gallery post deleted by admin ${req.user._id}`, { postId: post._id });
    return res.status(200).json({ success: true, message: 'Gallery post deleted successfully' });
  } catch (error) {
    return next(error);
  }
};

// POST /api/gallery/upload-image — admin, single image -> Cloudinary URL
exports.uploadImage = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('No image uploaded', 400));
    const result = await uploadToCloudinary(req.file, 'gallery');
    return res.status(200).json({ success: true, data: { url: result.url } });
  } catch (error) {
    return next(error);
  }
};
