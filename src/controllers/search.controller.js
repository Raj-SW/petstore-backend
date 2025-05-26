const Product = require('../models/product.model');
const { AppError } = require('../middlewares/errorHandler');

exports.searchProducts = async (req, res, next) => {
  try {
    const {
      query,
      category,
      minPrice,
      maxPrice,
      rating,
      sort,
      page = 1,
      limit = 10,
    } = req.query;

    // Build search query
    const searchQuery = {};

    // Text search
    if (query) {
      searchQuery.$or = [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
      ];
    }

    // Category filter
    if (category) {
      searchQuery.category = category;
    }

    // Price range filter
    if (minPrice || maxPrice) {
      searchQuery.price = {};
      if (minPrice) searchQuery.price.$gte = Number(minPrice);
      if (maxPrice) searchQuery.price.$lte = Number(maxPrice);
    }

    // Rating filter
    if (rating) {
      searchQuery.rating = { $gte: Number(rating) };
    }

    // Build sort object
    let sortQuery = {};
    if (sort) {
      const sortFields = sort.split(',');
      sortFields.forEach(field => {
        const order = field.startsWith('-') ? -1 : 1;
        const fieldName = field.startsWith('-') ? field.slice(1) : field;
        sortQuery[fieldName] = order;
      });
    } else {
      sortQuery = { createdAt: -1 };
    }

    // Execute search with pagination
    const skip = (page - 1) * limit;
    const products = await Product.find(searchQuery)
      .sort(sortQuery)
      .skip(skip)
      .limit(Number(limit))
      .populate('category', 'name');

    // Get total count for pagination
    const total = await Product.countDocuments(searchQuery);

    res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / limit),
          limit: Number(limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getSuggestions = async (req, res, next) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    const suggestions = await Product.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
      ],
    })
      .select('name category')
      .populate('category', 'name')
      .limit(5);

    res.status(200).json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    next(error);
  }
}; 