/**
 * Unit tests for lazy Stripe initialization (audit P1 #13).
 *
 * `require('stripe')(undefined)` throws synchronously, so the previous
 * top-level init in payment.service/payment.controller crashed the whole
 * API at boot when STRIPE_SECRET_KEY was unset. Requiring the modules must
 * be safe; only actually using Stripe without a key should fail (503).
 */
jest.mock('stripe', () =>
  jest.fn((key) => {
    if (!key) throw new Error('Stripe: no API key provided');
    return { key, paymentIntents: {}, refunds: {}, webhooks: {} };
  })
);

const ORIGINAL_KEY = process.env.STRIPE_SECRET_KEY;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = ORIGINAL_KEY;
  jest.resetModules();
});

describe('config/stripe — lazy initialization', () => {
  it('requiring the module (and payment.service) does NOT throw without a key', () => {
    delete process.env.STRIPE_SECRET_KEY;
    jest.isolateModules(() => {
      expect(() => require('./stripe')).not.toThrow();
      expect(() => require('../services/payment.service')).not.toThrow();
    });
  });

  it('getStripe() throws a clear 503 AppError when the key is unset', () => {
    delete process.env.STRIPE_SECRET_KEY;
    jest.isolateModules(() => {
      const { getStripe } = require('./stripe');
      expect(() => getStripe()).toThrow(/STRIPE_SECRET_KEY is not configured/);
      try {
        getStripe();
      } catch (err) {
        expect(err.statusCode).toBe(503);
      }
    });
  });

  it('returns a client when the key is configured, and caches it', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    jest.isolateModules(() => {
      const { getStripe } = require('./stripe');
      const first = getStripe();
      const second = getStripe();
      expect(first).toBeTruthy();
      expect(second).toBe(first); // singleton
      const Stripe = require('stripe');
      expect(Stripe).toHaveBeenCalledTimes(1);
      expect(Stripe).toHaveBeenCalledWith('sk_test_123');
    });
  });

  it('payment.service surfaces the 503 when used without a key', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    await new Promise((resolve, reject) => {
      jest.isolateModules(() => {
        const PaymentService = require('../services/payment.service');
        PaymentService.createPaymentIntent({ _id: 'o1', finalAmount: 100, user: 'u1' })
          .then(() => reject(new Error('should have thrown')))
          .catch((err) => {
            try {
              expect(err.statusCode).toBe(503);
              resolve();
            } catch (assertionErr) {
              reject(assertionErr);
            }
          });
      });
    });
  });
});
