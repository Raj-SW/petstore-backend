const Order = require('../models/order.model');
const Cart = require('../models/cart.model');
const Product = require('../models/product.model');
const StockMovement = require('../models/stockMovement.model');
const { AppError } = require('../middlewares/errorHandler');
const { sendEmail } = require('../utils/email');
const { sanitizeForLog } = require('../utils/sanitize');
const logger = require('../utils/logger');
const Invoice = require('../models/invoice.model');
const Transaction = require('../models/transaction.model');
const InvoiceService = require('../services/invoice.service');
const { buildOrder } = require('../services/order.service');

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

    // Map the cart's discount code to a percent (existing placeholder behavior)
    let discountPercent = 0;
    let discountCode = null;
    if (cart.discountCode === 'SUMMER10') {
      discountPercent = 10;
      discountCode = 'SUMMER10';
    } else if (cart.discountCode) {
      logger.warn(`Invalid discount code: ${sanitizeForLog(cart.discountCode)}`);
    }

    // Build the order (validates products, reserves stock, logs movements)
    const order = await buildOrder({
      userId: req.user.id,
      items: cart.items.map((i) => ({
        product: i.product, variantId: i.variantId || null, quantity: i.quantity,
      })),
      shippingAddress,
      paymentMethod,
      notes,
      discountPercent,
      discountCode,
      source: 'manual',
      session,
    });

    // Clear cart
    cart.items = [];
    cart.discount = 0;
    cart.discountCode = null;
    await cart.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Log order creation
    logger.info('Order created', { user: req.user.id, order: order._id, items: order.items });

    // Send order confirmation email — non-critical, never fail the order if email fails
    try {
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
    } catch (emailErr) {
      logger.warn('Order confirmation email failed (non-fatal)', { error: emailErr.message });
    }

    // Sanitize response
    const sanitizedOrder = order.toObject();
    delete sanitizedOrder.paymentDetails;

    return res.status(201).json({
      success: true,
      data: sanitizedOrder,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error('Order creation failed', { error });
    return next(error);
  }
};

// Get all orders (admin only)
exports.getOrders = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Number.parseInt(req.query.limit, 10) || 20);
    const skip = (page - 1) * limit;

    const total = await Order.countDocuments();
    const orders = await Order.find()
      .populate('user', 'name email')
      .populate('items.product', 'name price images')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return next(error);
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

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    return next(error);
  }
};

// Get user's orders
exports.getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .populate('items.product', 'name images')
      .sort('-createdAt');

    return res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    return next(error);
  }
};

// Update order status (admin only)
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const {
      status, trackingNumber, estimatedDelivery, notes,
    } = req.body;

    const order = await Order.findById(req.params.id).populate('user', 'name email');
    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Update order status
    order.status = status;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (estimatedDelivery) order.estimatedDelivery = estimatedDelivery;
    if (notes) order.notes = notes;

    await order.save();

    // Send status update email — non-critical
    try {
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
    } catch (emailErr) {
      logger.warn('Order status email failed (non-fatal)', { error: emailErr.message });
    }

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    return next(error);
  }
};

// Update payment status
exports.updatePaymentStatus = async (req, res, next) => {
  try {
    const { paymentStatus, transactionId, paymentDate } = req.body;

    const order = await Order.findById(req.params.id).populate('user', 'name email');
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

    // Auto-generate invoice when admin manually marks payment as completed
    if (paymentStatus === 'completed') {
      try {
        const existing = await Invoice.findOne({ order: order._id });
        if (!existing) {
          const orderOwnerId = order.user._id || order.user;
          const invoice = await InvoiceService.generateInvoice(order._id, orderOwnerId);
          await Transaction.create({
            order: order._id,
            invoice: invoice._id,
            user: order.user._id || order.user,
            type: 'payment',
            amount: order.finalAmount,
            currency: 'USD',
            paymentMethod: order.paymentDetails?.paymentMethod || order.paymentMethod,
            transactionId: transactionId || order.paymentDetails?.transactionId,
            status: 'completed',
          });
        }
      } catch (invoiceErr) {
        logger.warn('Invoice generation on admin status update failed (non-fatal)', { error: invoiceErr.message });
      }
    }

    // Send payment status update email — non-critical
    try {
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
    } catch (emailErr) {
      logger.warn('Payment status email failed (non-fatal)', { error: emailErr.message });
    }

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    return next(error);
  }
};

// Cancel order
exports.cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');
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

    // Restore product stock and log movements
    const cancelMovements = [];
    for (const item of order.items) {
      // Use .lean() so we get raw MongoDB fields including legacy `stock` field
      // eslint-disable-next-line no-await-in-loop -- sequential restore, mirrors order.service.js
      const prod = await Product.findById(item.product).lean();
      // Resolve quantity: prefer `quantity` field; fall back to legacy `stock`
      let prevQty;
      if (!prod) {
        prevQty = 0;
      } else if (prod.quantity != null) {
        prevQty = prod.quantity;
      } else {
        prevQty = prod.stock ?? 0;
      }
      const newQty = prevQty + item.quantity;
      // Restore the correct field (match whichever field was decremented)
      const stockField = prod?.quantity != null ? 'quantity' : 'stock';
      // eslint-disable-next-line no-await-in-loop -- sequential restore, mirrors order.service.js
      await Product.findByIdAndUpdate(item.product, {
        $inc: { [stockField]: item.quantity },
      });
      cancelMovements.push({
        product: item.product,
        type: 'cancellation',
        delta: item.quantity,
        prevQty,
        newQty,
        createdBy: req.user.id,
        orderId: order._id,
      });
    }
    if (cancelMovements.length > 0) {
      await StockMovement.insertMany(cancelMovements);
    }

    // Send cancellation email — non-critical
    try {
      await sendEmail({
        email: order.user.email,
        subject: 'Order Cancelled',
        template: 'order-cancelled',
        data: {
          name: order.user.name,
          orderId: order._id,
        },
      });
    } catch (emailErr) {
      logger.warn('Order cancellation email failed (non-fatal)', { error: emailErr.message });
    }

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    return next(error);
  }
};
