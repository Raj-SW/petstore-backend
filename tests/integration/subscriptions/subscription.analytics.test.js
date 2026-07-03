/**
 * Tests for Epic 12 — subscription analytics service (demand prediction).
 */
jest.mock('../../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const mongoose = require('mongoose');
const Subscription = require('../../../src/models/subscription.model');
const Product = require('../../../src/models/product.model');
const {
  runsInHorizon, predictDemand, productCoverage,
} = require('../../../src/services/subscription.analytics.service');

const addr = { street: 's', city: 'c', state: 'st', country: 'co', zipCode: 'z' };
const soon = () => new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);

describe('Subscription analytics (Epic 12)', () => {
  let userId;

  beforeEach(async () => {
    await Subscription.deleteMany({});
    await Product.deleteMany({});
    userId = new mongoose.Types.ObjectId();
  });

  it('runsInHorizon counts weekly runs within the window', () => {
    const now = new Date();
    const sub = { nextRunAt: new Date(now.getTime() + 86400000), intervalUnit: 'week', intervalCount: 1 };
    expect(runsInHorizon(sub, 30, now)).toBe(5); // days 1, 8, 15, 22, 29
  });

  it('predicts demand vs stock and flags restock', async () => {
    const product = await Product.create({
      name: 'Dog Food', description: 'good food for dogs', price: 10, quantity: 3,
      categories: ['dogs'], images: [{ url: 'u', publicId: 'p' }], createdBy: userId,
    });
    await Subscription.create({
      user: userId, items: [{ product: product._id, quantity: 2 }],
      shippingAddress: addr, paymentMethod: 'stripe', intervalUnit: 'week', intervalCount: 1,
      status: 'active', nextRunAt: soon(), source: 'product',
    });
    const res = await predictDemand({ horizonDays: 30 });
    expect(res.totalActiveSubscriptions).toBe(1);
    const row = res.rows.find((r) => String(r.productId) === String(product._id));
    expect(row.projectedDemand).toBe(10); // 2 x 5 runs
    expect(row.currentStock).toBe(3);
    expect(row.shortfall).toBe(7);
    expect(row.restockNeeded).toBe(true);
    expect(res.productsAtRisk).toBe(1);
  });

  it('excludes paused subscriptions', async () => {
    const product = await Product.create({
      name: 'X', description: 'desc for product x', price: 5, quantity: 100,
      categories: ['dogs'], images: [{ url: 'u', publicId: 'p' }], createdBy: userId,
    });
    await Subscription.create({
      user: userId, items: [{ product: product._id, quantity: 1 }],
      shippingAddress: addr, paymentMethod: 'stripe', intervalUnit: 'week', intervalCount: 1,
      status: 'paused', nextRunAt: soon(), source: 'product',
    });
    const res = await predictDemand({ horizonDays: 30 });
    expect(res.rows).toHaveLength(0);
  });

  it('productCoverage maps active subs per product', async () => {
    const product = await Product.create({
      name: 'Y', description: 'desc for product y', price: 5, quantity: 10,
      categories: ['dogs'], images: [{ url: 'u', publicId: 'p' }], createdBy: userId,
    });
    await Subscription.create({
      user: userId, items: [{ product: product._id, quantity: 4 }],
      shippingAddress: addr, paymentMethod: 'stripe', intervalUnit: 'week', intervalCount: 1,
      status: 'active', nextRunAt: soon(), source: 'product',
    });
    const cov = await productCoverage();
    expect(cov[String(product._id)]).toEqual({ activeSubs: 1, unitsPerCycle: 4 });
  });
});
