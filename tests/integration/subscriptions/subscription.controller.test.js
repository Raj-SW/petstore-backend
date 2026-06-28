/**
 * Tests for Subscription Controller
 * POST   /api/subscriptions             — customer create
 * GET    /api/subscriptions/mine        — customer list
 * PATCH  /api/subscriptions/:id         — customer manage (pause/skip/edit)
 * DELETE /api/subscriptions/:id         — customer cancel
 * GET    /api/subscriptions/process-due — cron runner (Bearer secret)
 */

process.env.CRON_SECRET = 'test-cron-secret';
process.env.SUBSCRIPTION_DISCOUNT_PERCENT = '10';

jest.mock('../../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../src/app');
const User = require('../../../src/models/user.model');
const Product = require('../../../src/models/product.model');
const Order = require('../../../src/models/order.model');
const Subscription = require('../../../src/models/subscription.model');

const makeUser = (overrides = {}) => ({
  name: 'Test User',
  email: `user-${Date.now()}-${Math.random()}@example.com`,
  phoneNumber: '12345678',
  address: '123 Test St',
  password: 'Password123*',
  ...overrides,
});

async function loginAs(userData) {
  await request(app).post('/api/auth/signup').send(userData);
  const res = await request(app).post('/api/auth/login').send({ email: userData.email, password: userData.password });
  return res.body.data.accessToken;
}

const ADDRESS = { street: '1 A St', city: 'Town', state: 'X', country: 'MU', zipCode: '000' };

async function makeProduct(adminId, over = {}) {
  return Product.create({
    name: `Dog Food ${Math.random()}`,
    description: 'Premium kibble',
    price: 1000,
    quantity: 100,
    categories: ['food'],
    images: [{ url: 'https://cdn.example.com/p.jpg', publicId: 'products/p' }],
    createdBy: adminId,
    ...over,
  });
}

const createBody = (productId, over = {}) => ({
  items: [{ product: productId.toString(), quantity: 2 }],
  shippingAddress: ADDRESS,
  paymentMethod: 'stripe',
  intervalUnit: 'week',
  intervalCount: 2,
  source: 'product',
  ...over,
});

describe('Subscription Controller', () => {
  let admin;
  let customerToken;
  let customerId;

  beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });

  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    await Subscription.deleteMany({});
    admin = await User.create(makeUser({ email: 'admin@test.com', role: 'admin' }));
    const cu = makeUser();
    customerToken = await loginAs(cu);
    customerId = (await User.findOne({ email: cu.email }))._id;
  });

  afterAll(async () => { await mongoose.connection.close(); });

  describe('POST /api/subscriptions', () => {
    it('creates a subscription and sets nextRunAt in the future (201)', async () => {
      const product = await makeProduct(admin._id);
      const res = await request(app)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(createBody(product._id));
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('active');
      expect(new Date(res.body.data.nextRunAt).getTime()).toBeGreaterThan(Date.now());
      expect(res.body.data.discountPercent).toBe(10);
    });

    it('rejects an interval below the 7-day minimum (400)', async () => {
      const product = await makeProduct(admin._id);
      const res = await request(app)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(createBody(product._id, { intervalUnit: 'day', intervalCount: 3 }));
      expect(res.status).toBe(400);
    });

    it('rejects unauthenticated (401)', async () => {
      const product = await makeProduct(admin._id);
      const res = await request(app).post('/api/subscriptions').send(createBody(product._id));
      expect(res.status).toBe(401);
    });
  });

  describe('customer management', () => {
    it('lists only the caller\'s subscriptions', async () => {
      const product = await makeProduct(admin._id);
      await Subscription.create({
        user: customerId, items: [{ product: product._id, quantity: 1 }], shippingAddress: ADDRESS,
        paymentMethod: 'stripe', intervalUnit: 'week', intervalCount: 2, discountPercent: 10,
        nextRunAt: new Date(Date.now() + 1e9), source: 'product',
      });
      await Subscription.create({
        user: admin._id, items: [{ product: product._id, quantity: 1 }], shippingAddress: ADDRESS,
        paymentMethod: 'stripe', intervalUnit: 'week', intervalCount: 2, discountPercent: 10,
        nextRunAt: new Date(Date.now() + 1e9), source: 'product',
      });
      const res = await request(app).get('/api/subscriptions/mine').set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('pauses and cancels own subscription; 404 on another user\'s', async () => {
      const product = await makeProduct(admin._id);
      const mine = await Subscription.create({
        user: customerId, items: [{ product: product._id, quantity: 1 }], shippingAddress: ADDRESS,
        paymentMethod: 'stripe', intervalUnit: 'week', intervalCount: 2, discountPercent: 10,
        nextRunAt: new Date(Date.now() + 1e9), source: 'product',
      });
      const theirs = await Subscription.create({
        user: admin._id, items: [{ product: product._id, quantity: 1 }], shippingAddress: ADDRESS,
        paymentMethod: 'stripe', intervalUnit: 'week', intervalCount: 2, discountPercent: 10,
        nextRunAt: new Date(Date.now() + 1e9), source: 'product',
      });

      const pause = await request(app).patch(`/api/subscriptions/${mine._id}`)
        .set('Authorization', `Bearer ${customerToken}`).send({ status: 'paused' });
      expect(pause.status).toBe(200);
      expect(pause.body.data.status).toBe('paused');

      const forbidden = await request(app).patch(`/api/subscriptions/${theirs._id}`)
        .set('Authorization', `Bearer ${customerToken}`).send({ status: 'paused' });
      expect(forbidden.status).toBe(404);

      const del = await request(app).delete(`/api/subscriptions/${mine._id}`)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(del.status).toBe(200);
      expect((await Subscription.findById(mine._id)).status).toBe('cancelled');
    });
  });

  describe('GET /api/subscriptions/process-due', () => {
    const past = () => new Date(Date.now() - 1000);

    it('rejects without the cron secret (401)', async () => {
      const res = await request(app).get('/api/subscriptions/process-due');
      expect(res.status).toBe(401);
    });

    it('generates a discounted pending order for a due subscription and advances nextRunAt', async () => {
      const product = await makeProduct(admin._id, { price: 1000, quantity: 100 });
      const sub = await Subscription.create({
        user: customerId, items: [{ product: product._id, quantity: 2 }], shippingAddress: ADDRESS,
        paymentMethod: 'stripe', intervalUnit: 'week', intervalCount: 2, discountPercent: 10,
        nextRunAt: past(), source: 'product',
      });

      const res = await request(app).get('/api/subscriptions/process-due')
        .set('Authorization', 'Bearer test-cron-secret');
      expect(res.status).toBe(200);
      expect(res.body.processed).toBe(1);

      const orders = await Order.find({ user: customerId });
      expect(orders).toHaveLength(1);
      expect(orders[0].totalAmount).toBe(2000);      // 2 × 1000
      expect(orders[0].discount).toBe(200);          // 10% of 2000
      expect(orders[0].source).toBe('subscription');
      expect(orders[0].paymentStatus).toBe('pending');

      const fresh = await Subscription.findById(sub._id);
      expect(fresh.createdOrders).toHaveLength(1);
      expect(new Date(fresh.nextRunAt).getTime()).toBeGreaterThan(Date.now());

      const freshProduct = await Product.findById(product._id);
      expect(freshProduct.quantity).toBe(98);        // stock reserved
    });

    it('skips paused and not-yet-due subscriptions', async () => {
      const product = await makeProduct(admin._id);
      await Subscription.create({
        user: customerId, items: [{ product: product._id, quantity: 1 }], shippingAddress: ADDRESS,
        paymentMethod: 'stripe', intervalUnit: 'week', intervalCount: 2, discountPercent: 10,
        nextRunAt: past(), status: 'paused', source: 'product',
      });
      await Subscription.create({
        user: customerId, items: [{ product: product._id, quantity: 1 }], shippingAddress: ADDRESS,
        paymentMethod: 'stripe', intervalUnit: 'week', intervalCount: 2, discountPercent: 10,
        nextRunAt: new Date(Date.now() + 1e9), source: 'product',
      });
      const res = await request(app).get('/api/subscriptions/process-due')
        .set('Authorization', 'Bearer test-cron-secret');
      expect(res.status).toBe(200);
      expect(res.body.processed).toBe(0);
      expect(await Order.countDocuments()).toBe(0);
    });

    it('skips a due subscription whose product is out of stock but still advances nextRunAt', async () => {
      const product = await makeProduct(admin._id, { quantity: 1 });
      const sub = await Subscription.create({
        user: customerId, items: [{ product: product._id, quantity: 5 }], shippingAddress: ADDRESS,
        paymentMethod: 'stripe', intervalUnit: 'week', intervalCount: 2, discountPercent: 10,
        nextRunAt: past(), source: 'product',
      });
      const res = await request(app).get('/api/subscriptions/process-due')
        .set('Authorization', 'Bearer test-cron-secret');
      expect(res.status).toBe(200);
      expect(res.body.skipped).toBe(1);
      expect(await Order.countDocuments()).toBe(0);
      const fresh = await Subscription.findById(sub._id);
      expect(new Date(fresh.nextRunAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('reorders the chosen variant for a due subscription', async () => {
      const product = await Product.create({
        name: 'Var Food', description: 'Premium kibble dogs', categories: ['food'], createdBy: admin._id,
        images: [{ url: 'https://cdn/x.jpg', publicId: 'products/x' }],
        variants: [{ label: '1kg', price: 300, quantity: 5 }, { label: '5kg', price: 1200, quantity: 8 }],
      });
      const v5 = product.variants[1]._id;
      const sub = await Subscription.create({
        user: customerId, items: [{ product: product._id, variantId: v5, variantLabel: '5kg', quantity: 1 }],
        shippingAddress: ADDRESS, paymentMethod: 'stripe', intervalUnit: 'week', intervalCount: 2,
        discountPercent: 0, nextRunAt: past(), source: 'product',
      });

      const res = await request(app).get('/api/subscriptions/process-due')
        .set('Authorization', 'Bearer test-cron-secret');
      expect(res.status).toBe(200);
      expect(res.body.processed).toBe(1);

      const orders = await Order.find({ user: customerId });
      expect(orders[0].items[0].variantLabel).toBe('5kg');
      expect(orders[0].totalAmount).toBe(1200);

      const fresh = await Product.findById(product._id);
      expect(fresh.variants.id(v5).quantity).toBe(7);
    });
  });
});
