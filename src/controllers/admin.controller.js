const mongoose = require('mongoose');
const Order = require('../models/order.model');
const Product = require('../models/product.model');
const User = require('../models/user.model');
const Appointment = require('../models/appointment.model');
const Cart = require('../models/cart.model');
const Pet = require('../models/pet.model');
const Review = require('../models/review.model');
const { AppError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');
const { getStartDate, getDateFormat } = require('../utils/dateUtils');

// Get dashboard statistics
exports.getDashboardStats = async (req, res, next) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get total sales
    const totalSales = await Order.aggregate([
      { $match: { paymentStatus: 'completed' } },
      { $group: { _id: null, total: { $sum: '$finalAmount' } } },
    ]);

    // Get today's sales
    const todaySales = await Order.aggregate([
      {
        $match: {
          paymentStatus: 'completed',
          createdAt: { $gte: startOfDay },
        },
      },
      { $group: { _id: null, total: { $sum: '$finalAmount' } } },
    ]);

    // Get monthly sales
    const monthlySales = await Order.aggregate([
      {
        $match: {
          paymentStatus: 'completed',
          createdAt: { $gte: startOfMonth },
        },
      },
      { $group: { _id: null, total: { $sum: '$finalAmount' } } },
    ]);

    // Get order statistics
    const orderStats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    // Get low stock products
    const lowStockProducts = await Product.find({ stock: { $lt: 10 } })
      .select('name stock price')
      .limit(5);

    // Get recent orders
    const recentOrders = await Order.find()
      .populate('user', 'name email')
      .sort('-createdAt')
      .limit(5);

    // Get upcoming appointments
    const upcomingAppointments = await Appointment.find({
      dateTime: { $gte: startOfDay },
      status: { $in: ['PENDING', 'CONFIRMED'] },
    })
      .populate('userId', 'name email')
      .populate('professionalId', 'name email')
      .sort('dateTime')
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        sales: {
          total: totalSales[0]?.total || 0,
          today: todaySales[0]?.total || 0,
          monthly: monthlySales[0]?.total || 0,
        },
        orders: {
          stats: orderStats,
          recent: recentOrders,
        },
        products: {
          lowStock: lowStockProducts,
        },
        appointments: {
          upcoming: upcomingAppointments,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get sales analytics
exports.getSalesAnalytics = async (req, res, next) => {
  try {
    const { period = 'monthly' } = req.query;
    const startDate = getStartDate(period);
    const dateFormat = getDateFormat(period);

    const salesData = await Order.aggregate([
      {
        $match: {
          paymentStatus: 'completed',
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: dateFormat,
              date: '$createdAt',
            },
          },
          total: { $sum: '$finalAmount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: salesData,
    });
  } catch (error) {
    next(error);
  }
};

// Get product analytics
exports.getProductAnalytics = async (req, res, next) => {
  try {
    const topProducts = await Order.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
    ]);

    const categoryStats = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalStock: { $sum: '$stock' },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        topProducts,
        categoryStats,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get user analytics
exports.getUserAnalytics = async (req, res, next) => {
  try {
    const userStats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
    ]);

    const customerStats = await Order.aggregate([
      {
        $group: {
          _id: '$user',
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$finalAmount' },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
    ]);

    res.status(200).json({
      success: true,
      data: {
        userStats,
        topCustomers: customerStats,
      },
    });
  } catch (error) {
    next(error);
  }
};

const VALID_ROLES = ['customer', 'veterinarian', 'groomer', 'trainer', 'petTaxi', 'admin'];

// List all users with pagination and optional role filter
exports.listUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const { role } = req.query;
    if (role && !VALID_ROLES.includes(role)) {
      return next(new AppError('Invalid role filter', 400));
    }

    const filter = {};
    if (role) {
      filter.role = role;
    }

    const sensitiveFields = '-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires';

    const [users, total] = await Promise.all([
      User.find(filter).select(sensitiveFields).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update a user's role
exports.updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid user ID format', 400));
    }

    // Prevent admin from demoting themselves
    if (req.user._id.toString() === id) {
      return next(new AppError('You cannot change your own role', 400));
    }

    if (!role || !VALID_ROLES.includes(role)) {
      return next(new AppError(`Role must be one of: ${VALID_ROLES.join(', ')}`, 400));
    }

    const user = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true, runValidators: true }
    ).select('-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires');

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// Delete a user and cascade-delete related data
exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid user ID format', 400));
    }

    // Prevent admin from deleting themselves
    if (req.user._id.toString() === id) {
      return next(new AppError('You cannot delete your own account', 400));
    }

    const user = await User.findById(id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Get affected product IDs before deleting reviews
    const userReviews = await Review.find({ user: id }).select('product');
    const affectedProductIds = [...new Set(userReviews.map((r) => r.product.toString()))];

    // Cascade deletes
    await Promise.all([
      Cart.deleteMany({ user: id }),
      Review.deleteMany({ user: id }),
      Pet.deleteMany({ owner: id }),
      Appointment.updateMany(
        { userId: id, status: { $in: ['PENDING', 'CONFIRMED'] } },
        { status: 'CANCELLED' }
      ),
      // Also cancel appointments where user is the professional
      Appointment.updateMany(
        { professionalId: id, status: { $in: ['PENDING', 'CONFIRMED'] } },
        { status: 'CANCELLED' }
      ),
      Order.deleteMany({ user: id }),
    ]);

    // Recalculate ratings for affected products
    for (const productId of affectedProductIds) {
      const remainingReviews = await Review.find({ product: productId });
      const avgRating =
        remainingReviews.length > 0
          ? remainingReviews.reduce((acc, r) => acc + r.rating, 0) / remainingReviews.length
          : 0;
      await Product.findByIdAndUpdate(productId, { rating: avgRating });
    }

    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Get appointment analytics
exports.getAppointmentAnalytics = async (req, res, next) => {
  try {
    const { period = 'monthly' } = req.query;
    const startDate = getStartDate(period);
    const dateFormat = getDateFormat(period);

    const appointmentStats = await Appointment.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: dateFormat,
              date: '$createdAt',
            },
          },
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] },
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const serviceProviderStats = await Appointment.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$professionalId',
          totalAppointments: { $sum: 1 },
          completedAppointments: {
            $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] },
          },
        },
      },
      { $sort: { totalAppointments: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'provider',
        },
      },
      { $unwind: '$provider' },
    ]);

    res.status(200).json({
      success: true,
      data: {
        appointmentStats,
        topProviders: serviceProviderStats,
      },
    });
  } catch (error) {
    next(error);
  }
};
