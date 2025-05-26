/*
const paypal = require('@paypal/paypal-server-sdk');
const { AppError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

// Configure PayPal environment
const environment =
  process.env.NODE_ENV === 'production'
    ? new paypal.core.LiveEnvironment(
        process.env.PAYPAL_CLIENT_ID,
        process.env.PAYPAL_CLIENT_SECRET
      )
    : new paypal.core.SandboxEnvironment(
        process.env.PAYPAL_CLIENT_ID,
        process.env.PAYPAL_CLIENT_SECRET
      );

const client = new paypal.core.PayPalHttpClient(environment);

class PayPalService {
  // Create PayPal order
  static async createOrder(order) {
    try {
      const request = new paypal.orders.OrdersCreateRequest();
      request.prefer('return=representation');
      request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: order._id.toString(),
            amount: {
              currency_code: 'USD',
              value: order.finalAmount.toString(),
              breakdown: {
                item_total: {
                  currency_code: 'USD',
                  value: order.totalAmount.toString(),
                },
                discount: {
                  currency_code: 'USD',
                  value: order.discount.toString(),
                },
              },
            },
            items: order.items.map((item) => ({
              name: item.product.name,
              unit_amount: {
                currency_code: 'USD',
                value: item.price.toString(),
              },
              quantity: item.quantity.toString(),
            })),
          },
        ],
        application_context: {
          brand_name: 'PetStore',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
          return_url: `${process.env.FRONTEND_URL}/payment/success`,
          cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
        },
      });

      const response = await client.execute(request);
      return {
        orderId: response.result.id,
        links: response.result.links,
      };
    } catch (error) {
      logger.error('Error creating PayPal order:', error);
      throw new AppError('Error creating PayPal order', 500);
    }
  }

  // Capture PayPal payment
  static async capturePayment(orderId) {
    try {
      const request = new paypal.orders.OrdersCaptureRequest(orderId);
      const response = await client.execute(request);

      if (response.result.status === 'COMPLETED') {
        return {
          status: 'completed',
          transactionId: response.result.id,
          paymentDate: new Date(),
          amount: response.result.purchase_units[0].amount.value,
        };
      } else {
        throw new AppError('Payment capture failed', 400);
      }
    } catch (error) {
      logger.error('Error capturing PayPal payment:', error);
      throw new AppError('Error capturing payment', 500);
    }
  }

  // Process PayPal refund
  static async processRefund(order) {
    try {
      if (!order.paymentDetails?.transactionId) {
        throw new AppError('No payment transaction found for refund', 400);
      }

      const request = new paypal.payments.RefundsPostRequest();
      request.requestBody({
        amount: {
          currency_code: 'USD',
          value: order.finalAmount.toString(),
        },
        capture_id: order.paymentDetails.transactionId,
      });

      const response = await client.execute(request);

      return {
        status: 'refunded',
        transactionId: response.result.id,
        refundDate: new Date(),
        amount: response.result.amount.value,
      };
    } catch (error) {
      logger.error('Error processing PayPal refund:', error);
      throw new AppError('Error processing refund', 500);
    }
  }

  // Verify PayPal webhook signature
  static async verifyWebhook(headers, body) {
    try {
      const webhookId = process.env.PAYPAL_WEBHOOK_ID;
      const request = new paypal.notifications.WebhooksVerifySignatureRequest();
      request.requestBody({
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: webhookId,
        webhook_event: body,
      });

      const response = await client.execute(request);
      return response.result.verification_status === 'SUCCESS';
    } catch (error) {
      logger.error('Error verifying PayPal webhook:', error);
      return false;
    }
  }
}

module.exports = PayPalService;
*/
