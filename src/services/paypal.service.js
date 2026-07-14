const {
  Client,
  Environment,
  OrdersController,
  PaymentsController,
  CheckoutPaymentIntent,
} = require('@paypal/paypal-server-sdk');
const https = require('node:https');
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

// Order amounts are stored in MUR, which PayPal does not support as a
// transaction currency. Amounts must be converted to USD at an explicitly
// configured rate — charging the raw MUR number as USD was a ~40x overcharge.
function murToUsd(amountMur) {
  const rate = Number(process.env.PAYPAL_MUR_TO_USD_RATE); // MUR per 1 USD
  if (!rate || rate <= 0) {
    throw new AppError(
      'PayPal payments are unavailable: PAYPAL_MUR_TO_USD_RATE is not configured',
      503
    );
  }
  return (amountMur / rate).toFixed(2);
}

class PayPalService {
  // Create PayPal order
  static async createOrder(order) {
    // Configuration errors must surface as-is, not be masked as a 500
    const usdValue = murToUsd(order.finalAmount);
    try {
      const response = await ordersController.createOrder({
        body: {
          intent: CheckoutPaymentIntent.Capture,
          purchaseUnits: [
            {
              referenceId: order._id.toString(),
              // Total only — no per-item breakdown. Converting each MUR line
              // item separately accumulates rounding drift that PayPal's
              // strict breakdown validation (sum must equal total) rejects.
              amount: {
                currencyCode: 'USD',
                value: usdValue,
              },
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

      // Full refund of the original capture: omitting the amount refunds
      // exactly what was captured, in the captured currency — immune to the
      // MUR→USD rate having moved between order time and refund time.
      const response = await paymentsController.refundCapturedPayment({
        captureId: order.paymentDetails.transactionId,
        body: {},
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
