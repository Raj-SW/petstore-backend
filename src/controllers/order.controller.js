const Order = require('../models/order.model');
const Cart = require('../models/cart.model');
const Product = require('../models/product.model');
const { AppError } = require('../middlewares/errorHandler');
const { sendEmail } = require('../utils/email');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const logger = require('../utils/logger');

// Create new order
exports.createOrder = async (req, res, next) => {
  try {
    const { shippingAddress, paymentMethod, notes } = req.body;

    // Get user's cart
    const cart = await Cart.findOne({ user: req.user.id })
      .populate('items.product');

    if (!cart || cart.items.length === 0) {
      return next(new AppError('Cart is empty', 400));
    }

    // Check stock availability
    for (const item of cart.items) {
      const product = await Product.findById(item.product._id);
      if (product.stock < item.quantity) {
        return next(
          new AppError(`Insufficient stock for ${product.name}`, 400)
        );
      }
    }

    // Create order
    const order = await Order.create({
      user: req.user.id,
      items: cart.items.map((item) => ({
        product: item.product._id,
        quantity: item.quantity,
        price: item.price,
      })),
      totalItems: cart.totalItems,
      totalAmount: cart.totalAmount,
      discount: cart.discount,
      discountCode: cart.discountCode,
      shippingAddress,
      paymentMethod,
      notes,
    });

    // Update product stock
    for (const item of cart.items) {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { stock: -item.quantity },
      });
    }

    // Clear cart
    cart.items = [];
    cart.discount = 0;
    cart.discountCode = null;
    await cart.save();

    // Send order confirmation email
    await sendEmail({
      email: req.user.email,
      subject: 'Order Confirmation',
      template: 'order-confirmation',
      data: {
        name: req.user.name,
        orderId: order._id,
        totalAmount: order.totalAmount,
        items: order.items,
      },
    });

    res.status(201).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// Get all orders (admin only)
exports.getOrders = async (req, res, next) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email')
      .populate('items.product', 'name price images')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
};

// Get single order
exports.getOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.product', 'name images')
      .populate('user', 'name email');

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Check if user is authorized to view this order
    if (
      order.user._id.toString() !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      return next(new AppError('Not authorized to view this order', 403));
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// Get user's orders
exports.getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .populate('items.product', 'name images')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
};

// Update order status (admin only)
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status, trackingNumber, estimatedDelivery, notes } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Update order status
    order.status = status;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (estimatedDelivery) order.estimatedDelivery = estimatedDelivery;
    if (notes) order.notes = notes;

    await order.save();

    // Send status update email
    await sendEmail({
      email: order.user.email,
      subject: 'Order Status Update',
      template: 'order-status-update',
      data: {
        name: order.user.name,
        orderId: order._id,
        status,
        trackingNumber,
        estimatedDelivery,
      },
    });

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// Update payment status
exports.updatePaymentStatus = async (req, res, next) => {
  try {
    const { paymentStatus, transactionId, paymentDate } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Update payment status
    order.paymentStatus = paymentStatus;
    if (transactionId) {
      order.paymentDetails = {
        transactionId,
        paymentDate,
        amount: order.totalAmount,
      };
    }

    await order.save();

    // Send payment status update email
    await sendEmail({
      email: order.user.email,
      subject: 'Payment Status Update',
      template: 'payment-status-update',
      data: {
        name: order.user.name,
        orderId: order._id,
        paymentStatus,
        amount: order.totalAmount,
      },
    });

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// Cancel order
exports.cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Check if order can be cancelled
    if (!['pending', 'processing'].includes(order.status)) {
      return next(new AppError('Order cannot be cancelled', 400));
    }

    // Update order status
    order.status = 'cancelled';
    await order.save();

    // Restore product stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity },
      });
    }

    // Send cancellation email
    await sendEmail({
      email: order.user.email,
      subject: 'Order Cancelled',
      template: 'order-cancelled',
      data: {
        name: order.user.name,
        orderId: order._id,
      },
    });

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
}; 