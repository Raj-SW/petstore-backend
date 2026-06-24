jest.mock('../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Product = require('../src/models/product.model');
const Subscription = require('../src/models/subscription.model');

const ADDRESS = { street: '1 A St', city: 'Town', state: 'X', country: 'MU', zipCode: '000' };
const uniqEmail = (p) => `${p}-${Date.now()}-${Math.random()}@x.com`;

describe('Subscription enriched detail (Epic 12)', () => {
  let admin, adminToken, customer, customerToken, product, sub;

  beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });
  afterAll(async () => { await mongoose.disconnect(); });

  beforeEach(async () => {
    await User.deleteMany({}); await Product.deleteMany({}); await Subscription.deleteMany({});

    admin = await User.create({
      name: 'Admin', email: uniqEmail('admin'), phoneNumber: '12345678',
      address: 'x', password: 'Password123*', role: 'admin',
    });
    adminToken = admin.generateAuthToken();

    customer = await User.create({
      name: 'Cust', email: uniqEmail('cust'), phoneNumber: '12345678',
      address: 'x', password: 'Password123*',
    });
    customerToken = customer.generateAuthToken();

    product = await Product.create({
      name: 'Dog Food', description: 'premium kibble food', price: 300, quantity: 50,
      categories: ['food'], createdBy: admin._id,
      images: [{ url: 'https://cdn/x.jpg', publicId: 'products/x' }],
    });

    sub = await Subscription.create({
      user: customer._id, items: [{ product: product._id, quantity: 2 }], shippingAddress: ADDRESS,
      paymentMethod: 'stripe', intervalUnit: 'week', intervalCount: 2, discountPercent: 10,
      status: 'active', nextRunAt: new Date(Date.now() + 5 * 86400000), source: 'product',
    });
  });

  it('GET /mine returns enriched list with perCycleTotal + cadenceLabel', async () => {
    const res = await request(app).get('/api/subscriptions/mine').set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data[0].perCycleTotal).toBe(540); // 300 × 2 × 0.9
    expect(res.body.data[0].cadenceLabel).toBe('every 2 weeks');
  });

  it('GET /mine/:id enforces ownership and returns enriched detail', async () => {
    const ok = await request(app).get(`/api/subscriptions/mine/${sub._id}`).set('Authorization', `Bearer ${customerToken}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.savings).toBe(60);

    const other = await User.create({
      name: 'Other', email: uniqEmail('other'), phoneNumber: '12345678', address: 'x', password: 'Password123*',
    });
    const denied = await request(app).get(`/api/subscriptions/mine/${sub._id}`).set('Authorization', `Bearer ${other.generateAuthToken()}`);
    expect(denied.status).toBe(404);
  });

  it('GET /admin/:id returns enriched detail for admins', async () => {
    const res = await request(app).get(`/api/subscriptions/admin/${sub._id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.perCycleTotal).toBe(540);
    expect(res.body.data.user.email).toBe(customer.email);
  });
});
