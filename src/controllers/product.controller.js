const mongoose = require('mongoose');
const Product = require('../models/product.model');
const { AppError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');
const {
  uploadMultipleToCloudinary,
  deleteMultipleFromCloudinary,
  validateImageFile,
} = require('../utils/cloudinary');
const { deriveProductFromVariants } = require('../utils/productVariants');

// Create new product (Admin only)
exports.createProduct = async (req, res, next) => {
  let uploadedImages = [];
  try {
    // Check if images are provided
    if (!req.files || req.files.length === 0) {
      return next(new AppError('At least one product image is required', 400));
    }

    // Validate all image files
    req.files.forEach((file) => {
      validateImageFile(file);
    });

    // Upload images to Cloudinary
    uploadedImages = await uploadMultipleToCloudinary(req.files, 'products');

    // Parse sections JSON string from FormData
    if (req.body.sections && typeof req.body.sections === 'string') {
      try {
        req.body.sections = JSON.parse(req.body.sections);
      } catch {
        req.body.sections = [];
      }
    }

    // Parse variants JSON string from FormData
    if (req.body.variants && typeof req.body.variants === 'string') {
      try {
        req.body.variants = JSON.parse(req.body.variants);
      } catch {
        req.body.variants = [];
      }
    }

    // Create product data
    const productData = {
      ...req.body,
      images: uploadedImages,
      createdBy: req.user._id,
    };

    // Create product in database
    const product = await Product.create(productData);

    logger.info(`Product created successfully by admin ${req.user._id}`, {
      productId: product._id,
      productName: product.name,
    });

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product,
    });
  } catch (error) {
    // If product creation fails after image upload, clean up uploaded images
    if (req.files && error.message !== 'At least one product image is required') {
      try {
        const publicIds = uploadedImages?.map((img) => img.publicId) || [];
        await deleteMultipleFromCloudinary(publicIds);
      } catch (cleanupError) {
        logger.error('Failed to cleanup uploaded images:', cleanupError);
      }
    }
    return next(error);
  }
};

// Get all products with filtering, sorting, and pagination
exports.getProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = '-createdAt',
      categories,
      minPrice,
      maxPrice,
      colors,
      genders,
      search,
      isActive = true,
      isFeatured,
    } = req.query;

    // Build query
    const query = { isActive };

    // Filter by featured flag when explicitly requested
    if (isFeatured !== undefined) {
      query.isFeatured = isFeatured === 'true' || isFeatured === true;
    }

    if (categories) {
      const categoryArray = Array.isArray(categories) ? categories : [categories];
      // Case-insensitive exact match so a "Dogs" filter matches stored "dogs"
      const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.categories = { $in: categoryArray.map((c) => new RegExp(`^${escapeRegex(c)}$`, 'i')) };
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice && Number.isFinite(Number(maxPrice))) query.price.$lte = Number(maxPrice);
    }

    if (colors) {
      const colorArray = Array.isArray(colors) ? colors : [colors];
      query.colors = { $in: colorArray };
    }

    if (genders) {
      const genderArray = Array.isArray(genders) ? genders : [genders];
      query.genders = { $in: genderArray };
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { categories: { $regex: search, $options: 'i' } },
      ];
    }

    // Execute query
    const products = await Product.find(query)
      .populate('createdBy', 'name email')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // Get total count for pagination
    const total = await Product.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: products,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Get single product
exports.getProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate if id is provided
    if (!id) {
      return next(new AppError('Product ID is required', 400));
    }

    // Validate if id is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid product ID format', 400));
    }

    const product = await Product.findById(id).populate('createdBy', 'name email');

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    return res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    return next(error);
  }
};

// Update product (Admin only)
exports.updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Parse sections JSON string from FormData
    if (req.body.sections && typeof req.body.sections === 'string') {
      try {
        req.body.sections = JSON.parse(req.body.sections);
      } catch {
        req.body.sections = [];
      }
    }

    // Parse variants JSON string from FormData
    if (req.body.variants && typeof req.body.variants === 'string') {
      try {
        req.body.variants = JSON.parse(req.body.variants);
      } catch {
        req.body.variants = [];
      }
    }

    const { keepImages: keepImagesStr, ...updateData } = req.body;

    // findByIdAndUpdate skips the pre('validate') derive hook, so derive here.
    if (Array.isArray(updateData.variants) && updateData.variants.length > 0) {
      const derived = deriveProductFromVariants(updateData.variants);
      updateData.price = derived.price;
      updateData.quantity = derived.quantity;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid product ID format', 400));
    }

    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return next(new AppError('Product not found', 404));
    }

    let updatedImages = existingProduct.images;

    // keepImages is always sent from the edit form — process image changes
    if (keepImagesStr !== undefined) {
      const keepImages = JSON.parse(keepImagesStr); // [{url, publicId}]

      // Delete images that were removed by the admin
      const keepPublicIds = new Set(keepImages.map((img) => img.publicId).filter(Boolean));
      const removedPublicIds = existingProduct.images
        .map((img) => img.publicId)
        .filter((pid) => pid && !keepPublicIds.has(pid));

      if (removedPublicIds.length > 0) {
        await deleteMultipleFromCloudinary(removedPublicIds);
      }

      // Upload any new files and append to kept images
      let newlyUploaded = [];
      if (req.files && req.files.length > 0) {
        req.files.forEach((file) => validateImageFile(file));
        newlyUploaded = await uploadMultipleToCloudinary(req.files, 'products');
      }

      updatedImages = [...keepImages, ...newlyUploaded];
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { ...updateData, images: updatedImages },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    logger.info(`Product updated successfully by admin ${req.user._id}`, {
      productId: updatedProduct._id,
      productName: updatedProduct.name,
    });

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: updatedProduct,
    });
  } catch (error) {
    return next(error);
  }
};

// Delete product (Admin only)
exports.deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate if id is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid product ID format', 400));
    }

    // Find product to get image public IDs
    const product = await Product.findById(id);
    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Delete images from Cloudinary
    const publicIds = product.images.map((img) => img.publicId);
    await deleteMultipleFromCloudinary(publicIds);

    // Delete product from database
    await Product.findByIdAndDelete(id);

    logger.info(`Product deleted successfully by admin ${req.user._id}`, {
      productId: id,
      productName: product.name,
    });

    return res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      data: null,
    });
  } catch (error) {
    return next(error);
  }
};

// Bulk actions on multiple products (Admin only)
exports.bulkAction = async (req, res, next) => {
  try {
    const { action, ids, options } = req.body;

    if (action === 'delete') {
      const products = await Product.find({ _id: { $in: ids } });
      const publicIds = products
        .flatMap((p) => p.images.map((img) => img.publicId))
        .filter(Boolean);
      try {
        await deleteMultipleFromCloudinary(publicIds);
      } catch (cleanupErr) {
        logger.error('Bulk delete: Cloudinary cleanup failed (non-fatal)', { error: cleanupErr.message });
      }
      const result = await Product.deleteMany({ _id: { $in: ids } });
      logger.info(`Bulk delete by admin ${req.user._id}`, { deleted: result.deletedCount });
      return res.status(200).json({
        success: true,
        message: `${result.deletedCount} product(s) deleted`,
        data: { requested: ids.length, deleted: result.deletedCount },
      });
    }

    const updateMap = {
      activate: { isActive: true },
      deactivate: { isActive: false },
      feature: { isFeatured: true },
      unfeature: { isFeatured: false },
      clearSale: {
        onSale: false, discountValue: 0, saleStartsAt: null, saleEndsAt: null,
      },
    };

    let update;
    if (action === 'sale') {
      update = {
        onSale: true,
        discountType: options.discountType,
        discountValue: options.discountValue,
        saleStartsAt: options.saleStartsAt || null,
        saleEndsAt: options.saleEndsAt || null,
      };
    } else {
      update = updateMap[action];
    }

    const result = await Product.updateMany({ _id: { $in: ids } }, { $set: update });
    logger.info(`Bulk ${action} by admin ${req.user._id}`, { modified: result.modifiedCount });
    return res.status(200).json({
      success: true,
      message: `${result.modifiedCount} product(s) updated`,
      data: {
        requested: ids.length,
        matched: result.matchedCount,
        modified: result.modifiedCount,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Get products by category (for the existing ProductService)
exports.getProductsByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const { isFeatured, limit } = req.query;

    if (!category) {
      return next(new AppError('Category is required', 400));
    }

    const regex = new RegExp(category, 'i');
    const filter = {
      categories: { $elemMatch: { $regex: regex } },
      isActive: true,
    };

    if (isFeatured !== undefined) {
      filter.isFeatured = isFeatured === 'true';
    }

    let query = Product.find(filter).populate('createdBy', 'name email');
    if (limit) query = query.limit(Number(limit));

    const products = await query;

    return res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    return next(error);
  }
};

// Get distinct filter options (categories/colors/genders) across active products.
// Drives the Pet Shop side-panel so its options match the stored values.
exports.getFilterOptions = async (req, res, next) => {
  try {
    const [categories, colors, genders] = await Promise.all([
      Product.distinct('categories', { isActive: true }),
      Product.distinct('colors', { isActive: true }),
      Product.distinct('genders', { isActive: true }),
    ]);
    return res.status(200).json({
      success: true,
      data: {
        categories: categories.filter(Boolean).sort(),
        colors: colors.filter(Boolean).sort(),
        genders: genders.filter(Boolean).sort(),
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Admin: Get product analytics
exports.getProductAnalytics = async (req, res, next) => {
  try {
    const totalProducts = await Product.countDocuments({ isActive: true });
    const lowStockProducts = await Product.countDocuments({
      quantity: { $lt: 10 },
      isActive: true,
    });
    const outOfStockProducts = await Product.countDocuments({ quantity: 0, isActive: true });

    const categoryStats = await Product.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$categories' },
      {
        $group: {
          _id: '$categories',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          averagePrice: { $avg: '$price' },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const priceRangeStats = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $lt: ['$price', 10] }, then: 'Under $10' },
                { case: { $lt: ['$price', 25] }, then: '$10 - $25' },
                { case: { $lt: ['$price', 50] }, then: '$25 - $50' },
                { case: { $lt: ['$price', 100] }, then: '$50 - $100' },
              ],
              default: 'Over $100',
            },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalProducts,
          lowStockProducts,
          outOfStockProducts,
        },
        categoryStats,
        priceRangeStats,
      },
    });
  } catch (error) {
    next(error);
  }
};
