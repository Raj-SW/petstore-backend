/**
 * Tests for Feedback Controller
 * POST   /api/feedback            — public submit (stored unapproved)
 * GET    /api/feedback            — public list (approved only)
 * GET    /api/feedback/admin/all  — admin list (all)
 * PATCH  /api/feedback/:id        — admin approve/update
 * DELETE /api/feedback/:id        — admin delete
 */

jest.mock('../../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../../src/utils/cloudinary', () => ({
  uploadMultipleToCloudinary: jest.fn().mockResolvedValue([{ url: 'https://cdn.example.com/f.jpg', publicId: 'feedback/f' }]),
}));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../src/app');
const User = require('../../../src/models/user.model');
const Feedback = require('../../../src/models/feedback.model');

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

describe('Feedback Controller', () => {
  let adminToken;
  let customerToken;

  beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });

  beforeEach(async () => {
    await User.deleteMany({});
    await Feedback.deleteMany({});
    await User.create(makeUser({ email: 'admin@test.com', role: 'admin' }));
    const a = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'Password123*' });
    adminToken = a.body.data.accessToken;
    customerToken = await loginAs(makeUser());
  });

  afterAll(async () => { await mongoose.connection.close(); });

  const submit = (over = {}) =>
    request(app).post('/api/feedback').send({ name: 'Jane', rating: 5, message: 'Wonderful clinic and staff', ...over });

  describe('POST /api/feedback', () => {
    it('stores a public submission as unapproved (201)', async () => {
      const res = await submit();
      expect(res.status).toBe(201);
      expect(await Feedback.countDocuments({ approved: false })).toBe(1);
    });

    it('rejects an invalid rating (400)', async () => {
      expect((await submit({ rating: 9 })).status).toBe(400);
    });

    it('rejects a missing message (400)', async () => {
      const res = await request(app).post('/api/feedback').send({ name: 'Jane', rating: 5 });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/feedback', () => {
    it('returns only approved feedback', async () => {
      await Feedback.create({ name: 'Amy', rating: 5, message: 'Approved one', approved: true });
      await Feedback.create({ name: 'Ben', rating: 4, message: 'Pending one', approved: false });
      const res = await request(app).get('/api/feedback');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('Amy');
    });
  });

  describe('admin endpoints', () => {
    it('GET /admin/all requires admin (401/403/200) and returns all', async () => {
      await Feedback.create({ name: 'Amy', rating: 5, message: 'Pending one' });
      expect((await request(app).get('/api/feedback/admin/all')).status).toBe(401);
      expect((await request(app).get('/api/feedback/admin/all').set('Authorization', `Bearer ${customerToken}`)).status).toBe(403);
      const ok = await request(app).get('/api/feedback/admin/all').set('Authorization', `Bearer ${adminToken}`);
      expect(ok.status).toBe(200);
      expect(ok.body.data).toHaveLength(1);
    });

    it('PATCH approves a feedback', async () => {
      const fb = await Feedback.create({ name: 'Amy', rating: 5, message: 'Pending one' });
      const res = await request(app)
        .patch(`/api/feedback/${fb._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ approved: true });
      expect(res.status).toBe(200);
      expect(res.body.data.approved).toBe(true);
    });

    it('DELETE removes a feedback', async () => {
      const fb = await Feedback.create({ name: 'Amy', rating: 5, message: 'Pending one' });
      const res = await request(app).delete(`/api/feedback/${fb._id}`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(await Feedback.countDocuments()).toBe(0);
    });
  });
});
