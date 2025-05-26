const Order = require('../models/order.model');
const Product = require('../models/product.model');
const User = require('../models/user.model');
const Appointment = require('../models/appointment.model');
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
      date: { $gte: startOfDay },
      status: { $in: ['pending', 'accepted'] },
    })
      .populate('user', 'name email')
      .populate('serviceProvider', 'name email')
      .sort('date')
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
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
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
          _id: '$serviceProvider',
          totalAppointments: { $sum: 1 },
          completedAppointments: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
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
