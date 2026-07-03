jest.mock('../../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../src/app');
const User = require('../../../src/models/user.model');
const Product = require('../../../src/models/product.model');
const Subscription = require('../../../src/models/subscription.model');

const ADDRESS = { street: '1 A St', city: 'Town', state: 'X', country: 'MU', zipCode: '000' };
const uniqEmail = (p) => `${p}-${Date.now()}-${Math.random()}@x.com`;

describe('Product analytics — subscriptions block (Epic 12)', () => {
  beforeEach(async () => {
    await User.deleteMany({}); await Product.deleteMany({}); await Subscription.deleteMany({});
  });

  it('overview includes a subscriptions summary block', async () => {
    const admin = await User.create({
      name: 'Ad', email: uniqEmail('admin'), phoneNumber: '12345678', address: 'x', password: 'Password123*', role: 'admin',
    });
    const user = await User.create({
      name: 'C', email: uniqEmail('cust'), phoneNumber: '12345678', address: 'x', password: 'Password123*',
    });
    const p = await Product.create({
      name: 'Food', description: 'premium kibble food', price: 100, quantity: 1, categories: ['food'], createdBy: admin._id,
      images: [{ url: 'https://cdn/x.jpg', publicId: 'products/x' }],
    });
    await Subscription.create({
      user: user._id, items: [{ product: p._id, quantity: 5 }], shippingAddress: ADDRESS,
      paymentMethod: 'stripe', intervalUnit: 'day', intervalCount: 1,
      discountPercent: 0, status: 'active', nextRunAt: new Date(Date.now() + 86400000), source: 'product',
    });

    const res = await request(app).get('/api/products/analytics/overview').set('Authorization', `Bearer ${admin.generateAuthToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.data.subscriptions).toBeDefined();
    expect(res.body.data.subscriptions.totalActiveSubscriptions).toBe(1);
    expect(res.body.data.subscriptions.productsWithSubscriptions).toBe(1);
    expect(res.body.data.subscriptions.productsNeedingRestock).toBeGreaterThanOrEqual(1);
  });
});
