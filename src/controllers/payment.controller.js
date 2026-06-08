const PaymentService = require('../services/payment.service');
const PayPalService = require('../services/paypal.service');
const Order = require('../models/order.model');
const { AppError } = require('../middlewares/errorHandler');
const { sendEmail } = require('../utils/email');
const logger = require('../utils/logger');
const Invoice        = require('../models/invoice.model');
const Transaction    = require('../models/transaction.model');
const InvoiceService = require('../services/invoice.service');

// Initialize payment for an order
exports.initializePayment = async (req, res, next) => {
  try {
    const { paymentMethod } = req.body;
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Check if user is authorized
    if (order.user.toString() !== req.user.id) {
      return next(new AppError('Not authorized to access this order', 403));
    }

    // Check if order is already paid
    if (order.paymentStatus === 'completed') {
      return next(new AppError('Order is already paid', 400));
    }

    let paymentData;

    // Initialize payment based on method
    if (paymentMethod === 'stripe') {
      paymentData = await PaymentService.createPaymentIntent(order);
    } else if (paymentMethod === 'paypal') {
      paymentData = await PayPalService.createOrder(order);
    } else {
      return next(new AppError('Invalid payment method', 400));
    }

    res.status(200).json({
      success: true,
      data: {
        ...paymentData,
        orderId: order._id,
        paymentMethod,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Confirm payment
exports.confirmPayment = async (req, res, next) => {
  try {
    const { paymentIntentId, paymentMethod } = req.body;
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Check if user is authorized
    if (order.user.toString() !== req.user.id) {
      return next(new AppError('Not authorized to access this order', 403));
    }

    let paymentResult;

    // Confirm payment based on method
    if (paymentMethod === 'stripe') {
      paymentResult = await PaymentService.confirmPayment(paymentIntentId);
    } else if (paymentMethod === 'paypal') {
      paymentResult = await PayPalService.capturePayment(paymentIntentId);
    } else {
      return next(new AppError('Invalid payment method', 400));
    }

    if (paymentResult.status === 'completed') {
      // Update order payment status
      order.paymentStatus = 'completed';
      order.paymentDetails = {
        transactionId: paymentResult.transactionId,
        paymentDate: paymentResult.paymentDate,
        amount: order.finalAmount,
        paymentMethod,
      };
      await order.save();

      // Auto-generate invoice + log transaction for completed payment
      try {
        const existingInvoice = await Invoice.findOne({ order: order._id });
        if (!existingInvoice) {
          const invoice = await InvoiceService.generateInvoice(order._id, order.user);
          await Transaction.create({
            order:         order._id,
            invoice:       invoice._id,
            user:          order.user,
            type:          'payment',
            amount:        order.finalAmount,
            currency:      'MUR',
            paymentMethod,
            transactionId: paymentResult.transactionId,
            status:        'completed',
          });
        }
      } catch (invoiceErr) {
        logger.warn('Invoice generation failed (non-fatal)', { error: invoiceErr.message, orderId: order._id });
      }

      // Send payment confirmation email — non-critical
      try {
        await sendEmail({
          email: req.user.email,
          subject: 'Payment Confirmation',
          template: 'payment-confirmation',
          data: {
            name: req.user.name,
            orderId: order._id,
            amount: order.finalAmount,
            transactionId: paymentResult.transactionId,
            paymentMethod,
          },
        });
      } catch (emailErr) {
        logger.warn('Payment confirmation email failed (non-fatal)', { error: emailErr.message });
      }
    }

    res.status(200).json({
      success: true,
      data: paymentResult,
    });
  } catch (error) {
    next(error);
  }
};

// Process refund
exports.processRefund = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Check if order is eligible for refund
    if (order.paymentStatus !== 'completed') {
      return next(new AppError('Order is not eligible for refund', 400));
    }

    let refundResult;

    // Process refund based on payment method
    if (order.paymentDetails.paymentMethod === 'stripe') {
      refundResult = await PaymentService.processRefund(order);
    } else if (order.paymentDetails.paymentMethod === 'paypal') {
      refundResult = await PayPalService.processRefund(order);
    } else {
      return next(new AppError('Invalid payment method', 400));
    }

    // Update order status
    order.paymentStatus = 'refunded';
    order.status = 'cancelled';
    await order.save();

    // Mark invoice as refunded + log refund transaction
    try {
      const updatedInvoice = await Invoice.findOneAndUpdate(
        { order: order._id },
        { status: 'refunded' },
        { new: true },
      );
      if (!updatedInvoice) {
        logger.warn('Refund: no invoice found to mark as refunded', { orderId: order._id });
      }
      await Transaction.create({
        order:         order._id,
        user:          order.user,
        type:          'refund',
        amount:        order.finalAmount,
        currency:      'MUR',
        paymentMethod: order.paymentDetails?.paymentMethod,
        transactionId: refundResult.transactionId,
        status:        'completed',
      });
    } catch (txErr) {
      logger.warn('Refund transaction log failed (non-fatal)', { error: txErr.message, orderId: order._id });
    }

    // Send refund confirmation email — non-critical
    try {
      await sendEmail({
        email: req.user.email,
        subject: 'Refund Processed',
        template: 'refund-confirmation',
        data: {
          name: req.user.name,
          orderId: order._id,
          amount: order.finalAmount,
          refundId: refundResult.transactionId,
          paymentMethod: order.paymentDetails.paymentMethod,
        },
      });
    } catch (emailErr) {
      logger.warn('Refund confirmation email failed (non-fatal)', { error: emailErr.message });
    }

    res.status(200).json({
      success: true,
      data: refundResult,
    });
  } catch (error) {
    next(error);
  }
};

// Handle payment webhooks
exports.handleWebhook = async (req, res, next) => {
  try {
    const { paymentMethod } = req.params;
    let event;
    let result;

    if (paymentMethod === 'stripe') {
      const sig = req.headers['stripe-signature'];
      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET,
        );
        result = await PaymentService.handleWebhookEvent(event);
      } catch (err) {
        return next(new AppError('Stripe webhook signature verification failed', 400));
      }
    } else if (paymentMethod === 'paypal') {
      const isValid = await PayPalService.verifyWebhook(req.headers, req.body);
      if (!isValid) {
        return next(new AppError('PayPal webhook signature verification failed', 400));
      }
      event = req.body;
      result = {
        type: event.event_type,
        paymentIntentId: event.resource.id,
      };
    } else {
      return next(new AppError('Invalid payment method', 400));
    }

    if (result) {
      const order = await Order.findOne({
        'paymentDetails.transactionId': result.paymentIntentId,
      });

      if (order) {
        switch (result.type) {
        case 'payment_intent.succeeded':
        case 'PAYMENT.CAPTURE.COMPLETED':
          order.paymentStatus = 'completed';
          break;
        case 'payment_intent.payment_failed':
        case 'PAYMENT.CAPTURE.DENIED':
          order.paymentStatus = 'failed';
          break;
        case 'charge.refunded':
        case 'PAYMENT.REFUND.COMPLETED':
          order.paymentStatus = 'refunded';
          order.status = 'cancelled';
          break;
        }
        await order.save();
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
};
