const Stripe = require('stripe');
const { AppError } = require('../middlewares/errorHandler');

// Lazy singleton. Stripe's constructor throws synchronously on a falsy key,
// so initializing at module load (`require('stripe')(process.env.KEY)`)
// crashed the ENTIRE API at boot whenever STRIPE_SECRET_KEY was unset —
// payments being misconfigured should 503 payment requests, not kill boot.
let client = null;

function getStripe() {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new AppError(
        'Stripe payments are unavailable: STRIPE_SECRET_KEY is not configured',
        503
      );
    }
    client = new Stripe(key);
  }
  return client;
}

module.exports = { getStripe };
