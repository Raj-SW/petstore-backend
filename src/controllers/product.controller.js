const Product = require('../models/product');
const Category = require('../models/category.model');
const { AppError } = require('../middlewares/errorHandler');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');
const logger = require('../utils/logger');

// Create new product
exports.createProduct = async (req, res, next) => {
  try {
    const { category } = req.body;

    // Check if category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return next(new AppError('Category not found', 404));
    }

    // Create product
    const product = await Product.create({
      ...req.body,
      createdBy: req.user.id,
    });

    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// Get all products with filtering, sorting, and pagination
exports.getProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = '-createdAt',
      category,
      minPrice,
      maxPrice,
      search,
    } = req.query;

    // Build query
    const query = {};

    if (category) query.category = category;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Execute query
    const products = await Product.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // Get total count for pagination
    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get single product
exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name')
      .populate('reviews');

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// Update product
exports.updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Check if category exists if it's being updated
    if (req.body.category) {
      const categoryExists = await Category.findById(req.body.category);
      if (!categoryExists) {
        return next(new AppError('Category not found', 404));
      }
    }

    // Update product
    Object.assign(product, req.body);
    await product.save();

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// Delete product
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Delete product images from Cloudinary
    if (product.images && product.images.length > 0) {
      await Promise.all(product.images.map((image) => deleteFromCloudinary(image.publicId)));
    }

    // Soft delete by setting isActive to false
    product.isActive = false;
    await product.save();

    res.status(200).json({
      success: true,
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

// Upload product images
exports.uploadProductImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return next(new AppError('Please upload at least one image', 400));
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return next(new AppError('No product found with that ID', 404));
    }

    // Add new images to product
    const newImages = req.files.map((file) => file.filename);
    product.images = [...product.images, ...newImages];
    await product.save();

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// Delete product image
exports.deleteProductImage = async (req, res, next) => {
  try {
    const { productId, imageId } = req.params;
    const product = await Product.findById(productId);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    const image = product.images.id(imageId);
    if (!image) {
      return next(new AppError('Image not found', 404));
    }

    // Delete image from Cloudinary
    await deleteFromCloudinary(image.publicId);

    // Remove image from product
    product.images.pull(imageId);
    await product.save();

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};
