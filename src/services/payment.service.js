/*
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { AppError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

class PaymentService {
  static async createPaymentIntent(order) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(order.finalAmount * 100), // Convert to cents
        currency: 'usd',
        metadata: {
          orderId: order._id.toString(),
          userId: order.user.toString()
        }
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      };
    } catch (error) {
      logger.error('Stripe payment intent creation failed:', error);
      throw new AppError('Payment initialization failed', 500);
    }
  }

  static async confirmPayment(paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status === 'succeeded') {
        return {
          status: 'completed',
          transactionId: paymentIntent.id,
          paymentDate: new Date(paymentIntent.created * 1000)
        };
      }

      throw new AppError('Payment not successful', 400);
    } catch (error) {
      logger.error('Stripe payment confirmation failed:', error);
      throw new AppError('Payment confirmation failed', 500);
    }
  }

  static async processRefund(order) {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: order.paymentDetails.transactionId,
        amount: Math.round(order.finalAmount * 100)
      });

      return {
        status: 'completed',
        transactionId: refund.id,
        refundDate: new Date(refund.created * 1000)
      };
    } catch (error) {
      logger.error('Stripe refund processing failed:', error);
      throw new AppError('Refund processing failed', 500);
    }
  }

  static async handleWebhookEvent(event) {
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          return {
            type: 'payment.succeeded',
            paymentIntentId: event.data.object.id
          };
        case 'payment_intent.payment_failed':
          return {
            type: 'payment.failed',
            paymentIntentId: event.data.object.id
          };
        default:
          return null;
      }
    } catch (error) {
      logger.error('Stripe webhook handling failed:', error);
      throw new AppError('Webhook handling failed', 500);
    }
  }
}

module.exports = PaymentService;
*/
