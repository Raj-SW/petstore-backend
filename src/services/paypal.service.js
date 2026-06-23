const {
  Client,
  Environment,
  OrdersController,
  PaymentsController,
  CheckoutPaymentIntent,
} = require('@paypal/paypal-server-sdk');
const https = require('https');
const { AppError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');
const { frontendUrl } = require('../config/urls');

// Configure PayPal client
const paypalClient = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: process.env.PAYPAL_CLIENT_ID || '',
    oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
  },
  environment:
    process.env.NODE_ENV === 'production'
      ? Environment.Production
      : Environment.Sandbox,
});

const ordersController = new OrdersController(paypalClient);
const paymentsController = new PaymentsController(paypalClient);

class PayPalService {
  // Create PayPal order
  static async createOrder(order) {
    try {
      const response = await ordersController.createOrder({
        body: {
          intent: CheckoutPaymentIntent.Capture,
          purchaseUnits: [
            {
              referenceId: order._id.toString(),
              amount: {
                currencyCode: 'USD',
                value: order.finalAmount.toString(),
                breakdown: {
                  itemTotal: {
                    currencyCode: 'USD',
                    value: order.totalAmount.toString(),
                  },
                  discount: {
                    currencyCode: 'USD',
                    value: order.discount.toString(),
                  },
                },
              },
              items: order.items.map((item) => ({
                name: item.product.name,
                unitAmount: {
                  currencyCode: 'USD',
                  value: item.price.toString(),
                },
                quantity: item.quantity.toString(),
              })),
            },
          ],
          applicationContext: {
            brandName: 'PetStore',
            landingPage: 'NO_PREFERENCE',
            userAction: 'PAY_NOW',
            returnUrl: frontendUrl('payment/success'),
            cancelUrl: frontendUrl('payment/cancel'),
          },
        },
        prefer: 'return=representation',
      });

      const result = response.result;
      return {
        orderId: result.id,
        links: result.links,
      };
    } catch (error) {
      logger.error('Error creating PayPal order:', error);
      throw new AppError('Error creating PayPal order', 500);
    }
  }

  // Capture PayPal payment
  static async capturePayment(orderId) {
    try {
      const response = await ordersController.captureOrder({
        id: orderId,
      });

      const result = response.result;
      if (result.status === 'COMPLETED') {
        return {
          status: 'completed',
          transactionId: result.id,
          paymentDate: new Date(),
          amount: result.purchaseUnits[0].payments.captures[0].amount.value,
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

      const response = await paymentsController.refundCapturedPayment({
        captureId: order.paymentDetails.transactionId,
        body: {
          amount: {
            currencyCode: 'USD',
            value: order.finalAmount.toString(),
          },
        },
      });

      const result = response.result;
      return {
        status: 'refunded',
        transactionId: result.id,
        refundDate: new Date(),
        amount: result.amount.value,
      };
    } catch (error) {
      logger.error('Error processing PayPal refund:', error);
      throw new AppError('Error processing refund', 500);
    }
  }

  // Verify PayPal webhook signature via PayPal REST API
  static async verifyWebhook(headers, body) {
    try {
      const webhookId = process.env.PAYPAL_WEBHOOK_ID;
      const credentials = Buffer.from(
        `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
      ).toString('base64');

      const baseUrl =
        process.env.NODE_ENV === 'production'
          ? 'api.paypal.com'
          : 'api.sandbox.paypal.com';

      const payload = JSON.stringify({
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: webhookId,
        webhook_event: typeof body === 'string' ? JSON.parse(body) : body,
      });

      return new Promise((resolve) => {
        const options = {
          hostname: baseUrl,
          path: '/v1/notifications/verify-webhook-signature',
          method: 'POST',
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed.verification_status === 'SUCCESS');
            } catch {
              resolve(false);
            }
          });
        });

        req.on('error', (err) => {
          logger.error('Error verifying PayPal webhook:', err);
          resolve(false);
        });

        req.write(payload);
        req.end();
      });
    } catch (error) {
      logger.error('Error verifying PayPal webhook:', error);
      return false;
    }
  }
}

module.exports = PayPalService;
