/**
 * Tests for Contact Controller
 * POST   /api/contact            — public submit
 * GET    /api/contact/admin/all  — admin list (paginated + stats)
 * PATCH  /api/contact/:id        — admin update status
 * DELETE /api/contact/:id        — admin delete
 */

jest.mock('../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const Contact = require('../../src/models/contact.model');

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
  const res = await request(app).post('/api/auth/login').send({
    email: userData.email,
    password: userData.password,
  });
  return res.body.data.accessToken;
}

describe('Contact Controller', () => {
  let adminToken;
  let customerToken;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Contact.deleteMany({});
    await User.create(makeUser({ email: 'admin@test.com', role: 'admin' }));
    const adminLoginRes = await request(app).post('/api/auth/login').send({
      email: 'admin@test.com',
      password: 'Password123*',
    });
    adminToken = adminLoginRes.body.data.accessToken;
    customerToken = await loginAs(makeUser());
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  const submit = () =>
    request(app).post('/api/contact').send({
      name: 'Jane Doe',
      email: 'jane@example.com',
      message: 'A urinary tract infection question about my cat.',
    });

  describe('POST /api/contact', () => {
    it('accepts a public submission (201) and stores it as new', async () => {
      const res = await submit();
      expect(res.status).toBe(201);
      expect(await Contact.countDocuments({ status: 'new' })).toBe(1);
    });

    it('rejects a submission missing fields (400)', async () => {
      const res = await request(app).post('/api/contact').send({ name: 'X' });
      expect(res.status).toBe(400);
    });
  });

  describe('admin endpoints', () => {
    it('GET /admin/all requires admin (401 / 403 / 200)', async () => {
      await submit();
      expect((await request(app).get('/api/contact/admin/all')).status).toBe(401);
      expect((await request(app).get('/api/contact/admin/all').set('Authorization', `Bearer ${customerToken}`)).status).toBe(403);
      const ok = await request(app).get('/api/contact/admin/all').set('Authorization', `Bearer ${adminToken}`);
      expect(ok.status).toBe(200);
      expect(ok.body.data).toHaveLength(1);
    });

    it('PATCH sets the status to read', async () => {
      await submit();
      const c = await Contact.findOne();
      const res = await request(app)
        .patch(`/api/contact/${c._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'read' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('read');
    });

    it('PATCH rejects an invalid status (400)', async () => {
      await submit();
      const c = await Contact.findOne();
      const res = await request(app)
        .patch(`/api/contact/${c._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'bogus' });
      expect(res.status).toBe(400);
    });

    it('DELETE removes a contact', async () => {
      await submit();
      const c = await Contact.findOne();
      const res = await request(app)
        .delete(`/api/contact/${c._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(await Contact.countDocuments()).toBe(0);
    });
  });
});
