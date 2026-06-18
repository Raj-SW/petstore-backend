/**
 * Tests for Sale Announcement Controller
 * POST   /api/announcements                  — admin create + send
 * GET    /api/announcements                  — admin history
 * GET    /api/announcements/unsubscribe       — public, flips emailPreferences.sales
 */

jest.mock('../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Product = require('../src/models/product.model');
const SaleAnnouncement = require('../src/models/saleAnnouncement.model');
const { sendEmail } = require('../src/utils/email');
const { makeUnsubscribeToken } = require('../src/utils/unsubscribeToken');

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

async function makeProduct(adminId, over = {}) {
  return Product.create({
    name: `Dog Food ${Math.random()}`,
    description: 'Premium kibble',
    price: 1000,
    quantity: 10,
    categories: ['food'],
    images: [{ url: 'https://cdn.example.com/p.jpg', publicId: 'products/p' }],
    onSale: true,
    discountType: 'percent',
    discountValue: 20,
    createdBy: adminId,
    ...over,
  });
}

describe('Sale Announcement Controller', () => {
  let adminUser;
  let adminToken;
  let customerToken;

  beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });

  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    await SaleAnnouncement.deleteMany({});
    sendEmail.mockClear();

    adminUser = await User.create(makeUser({ email: 'admin@test.com', role: 'admin' }));
    const a = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'Password123*' });
    adminToken = a.body.data.accessToken;
    customerToken = await loginAs(makeUser());
  });

  afterAll(async () => { await mongoose.connection.close(); });

  describe('POST /api/announcements', () => {
    it('sends to opted-in customers only and records counts (201)', async () => {
      // two customers in, one opted out
      await User.create(makeUser({ email: 'in1@test.com', role: 'customer' }));
      await User.create(makeUser({ email: 'in2@test.com', role: 'customer' }));
      await User.create(makeUser({ email: 'out@test.com', role: 'customer', emailPreferences: { sales: false } }));
      const product = await makeProduct(adminUser._id);

      // Ignore the auth (welcome/login) emails fired during beforeEach setup —
      // count only the announcement sends.
      sendEmail.mockClear();

      const res = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subject: 'Big Dog Food Sale', message: 'Save now', productIds: [product._id.toString()] });

      expect(res.status).toBe(201);
      // audience = in1, in2, + the customer created in beforeEach (opted in by default) = 3; out excluded
      expect(res.body.data.audienceCount).toBe(3);
      expect(res.body.data.sentCount).toBe(3);
      expect(sendEmail).toHaveBeenCalledTimes(3);
      expect(await SaleAnnouncement.countDocuments()).toBe(1);
    });

    it('defaults source to composer and accepts inline', async () => {
      const product = await makeProduct(adminUser._id);
      const res = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subject: 'Sale', productIds: [product._id.toString()], source: 'inline' });
      expect(res.status).toBe(201);
      expect(res.body.data.source).toBe('inline');
    });

    it('400 when no valid products', async () => {
      const res = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subject: 'Sale', productIds: [new mongoose.Types.ObjectId().toString()] });
      expect(res.status).toBe(400);
    });

    it('400 when subject missing', async () => {
      const product = await makeProduct(adminUser._id);
      const res = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ productIds: [product._id.toString()] });
      expect(res.status).toBe(400);
    });

    it('400 when productIds empty', async () => {
      const res = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subject: 'Sale', productIds: [] });
      expect(res.status).toBe(400);
    });

    it('rejects non-admin (403) and unauthenticated (401)', async () => {
      const product = await makeProduct(adminUser._id);
      const body = { subject: 'Sale', productIds: [product._id.toString()] };
      expect((await request(app).post('/api/announcements').send(body)).status).toBe(401);
      expect((await request(app).post('/api/announcements').set('Authorization', `Bearer ${customerToken}`).send(body)).status).toBe(403);
    });
  });

  describe('GET /api/announcements', () => {
    it('returns history newest-first (admin only)', async () => {
      const product = await makeProduct(adminUser._id);
      await SaleAnnouncement.create({ subject: 'Old', products: [product._id], source: 'composer', createdBy: adminUser._id });
      await SaleAnnouncement.create({ subject: 'New', products: [product._id], source: 'composer', createdBy: adminUser._id });

      expect((await request(app).get('/api/announcements')).status).toBe(401);
      const res = await request(app).get('/api/announcements').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data[0].subject).toBe('New');
    });
  });

  describe('GET /api/announcements/unsubscribe', () => {
    it('flips emailPreferences.sales to false for a valid token', async () => {
      const u = await User.create(makeUser({ email: 'sub@test.com', role: 'customer' }));
      const token = makeUnsubscribeToken(u._id);
      const res = await request(app).get(`/api/announcements/unsubscribe?token=${token}`);
      expect(res.status).toBe(200);
      const fresh = await User.findById(u._id);
      expect(fresh.emailPreferences.sales).toBe(false);
    });

    it('handles an invalid token gracefully (400)', async () => {
      const res = await request(app).get('/api/announcements/unsubscribe?token=garbage');
      expect(res.status).toBe(400);
    });
  });
});
