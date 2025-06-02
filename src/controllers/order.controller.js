const Order = require('../models/order.model');
const Cart = require('../models/cart.model');
const Product = require('../models/product.model');
const { AppError } = require('../middlewares/errorHandler');
const { sendEmail } = require('../utils/email');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const logger = require('../utils/logger');

// Create new order
exports.createOrder = async (req, res, next) => {
  const session = await Order.startSession();
  session.startTransaction();
  try {
    const { shippingAddress, paymentMethod, notes } = req.body;

    // Get user's cart
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart || cart.items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('Cart is empty', 400));
    }

    // Prepare order items and recalculate totals
    let totalItems = 0;
    let totalAmount = 0;
    let orderItems = [];
    let logDetails = [];

    for (const item of cart.items) {
      const product = await Product.findById(item.product).session(session);
      if (!product) {
        await session.abortTransaction();
        session.endSession();
        logger.warn(`Product not found: ${item.product}`);
        return next(new AppError('Product not found', 404));
      }
      if (!product.isActive) {
        await session.abortTransaction();
        session.endSession();
        logger.warn(`Inactive product: ${product._id}`);
        return next(new AppError(`Product ${product.title} is not available`, 400));
      }
      if (product.stock < item.quantity) {
        await session.abortTransaction();
        session.endSession();
        logger.warn(`Insufficient stock for product: ${product._id}`);
        return next(new AppError(`Insufficient stock for ${product.title}`, 400));
      }
      // Use current price from DB
      const price = product.price;
      totalItems += item.quantity;
      totalAmount += price * item.quantity;
      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        price,
      });
      logDetails.push({ product: product._id, quantity: item.quantity, price });
    }

    // Real discount validation (placeholder: always 0)
    // TODO: Replace with real discount logic
    let discount = 0;
    let discountCode = null;
    if (cart.discountCode) {
      // Example: check if code is "SUMMER10" and not expired
      if (cart.discountCode === 'SUMMER10') {
        discount = Math.floor(totalAmount * 0.1); // 10% off
        discountCode = 'SUMMER10';
      } else {
        logger.warn(`Invalid discount code: ${cart.discountCode}`);
        // Optionally, return error or ignore
      }
    }

    // Create order
    const order = await Order.create(
      [
        {
          user: req.user.id,
          items: orderItems,
          totalItems,
          totalAmount,
          discount,
          discountCode,
          shippingAddress,
          paymentMethod,
          notes,
        },
      ],
      { session }
    );

    // Update product stock
    for (const item of orderItems) {
      await Product.findByIdAndUpdate(
        item.product,
        {
          $inc: { stock: -item.quantity },
        },
        { session }
      );
    }

    // Clear cart
    cart.items = [];
    cart.discount = 0;
    cart.discountCode = null;
    await cart.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Log order creation
    logger.info('Order created', { user: req.user.id, order: order[0]._id, items: logDetails });

    // Send order confirmation email
    await sendEmail({
      email: req.user.email,
      subject: 'Order Confirmation',
      template: 'order-confirmation',
      data: {
        name: req.user.name,
        orderId: order[0]._id,
        totalAmount: order[0].totalAmount,
        items: order[0].items,
      },
    });

    // Sanitize response
    const sanitizedOrder = order[0].toObject();
    delete sanitizedOrder.paymentDetails;

    res.status(201).json({
      success: true,
      data: sanitizedOrder,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error('Order creation failed', { error });
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
    if (order.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
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
