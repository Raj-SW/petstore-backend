/**
 * Tests for FAQ (admin-configurable) + Newsletter subscribe resources.
 */

jest.mock('../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Faq = require('../src/models/faq.model');
const NewsletterSubscriber = require('../src/models/newsletterSubscriber.model');

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

describe('FAQ + Newsletter', () => {
  let adminToken;
  let customerToken;

  beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });

  beforeEach(async () => {
    await User.deleteMany({});
    await Faq.deleteMany({});
    await NewsletterSubscriber.deleteMany({});
    await User.create(makeUser({ email: 'admin@test.com', role: 'admin' }));
    const a = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'Password123*' });
    adminToken = a.body.data.accessToken;
    customerToken = await loginAs(makeUser());
  });

  afterAll(async () => { await mongoose.connection.close(); });

  describe('FAQ', () => {
    it('GET /api/faqs returns active FAQs ordered (public)', async () => {
      await Faq.create({ question: 'Q2?', answer: 'A2', order: 2 });
      await Faq.create({ question: 'Q1?', answer: 'A1', order: 1 });
      await Faq.create({ question: 'Hidden?', answer: 'no', order: 0, active: false });

      const res = await request(app).get('/api/faqs');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].question).toBe('Q1?'); // ordered
    });

    it('admin can create / update / delete; non-admin blocked', async () => {
      // create
      const create = await request(app)
        .post('/api/faqs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ question: 'New?', answer: 'Yes indeed', order: 5 });
      expect(create.status).toBe(201);
      const id = create.body.data._id;

      // non-admin blocked
      expect((await request(app).post('/api/faqs').set('Authorization', `Bearer ${customerToken}`).send({ question: 'x?', answer: 'yy' })).status).toBe(403);

      // update
      const upd = await request(app)
        .patch(`/api/faqs/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: false });
      expect(upd.status).toBe(200);
      expect(upd.body.data.active).toBe(false);

      // delete
      const del = await request(app).delete(`/api/faqs/${id}`).set('Authorization', `Bearer ${adminToken}`);
      expect(del.status).toBe(200);
      expect(await Faq.countDocuments()).toBe(0);
    });

    it('rejects a FAQ missing an answer (400)', async () => {
      const res = await request(app)
        .post('/api/faqs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ question: 'Only a question?' });
      expect(res.status).toBe(400);
    });
  });

  describe('Newsletter', () => {
    it('POST /api/newsletter subscribes (201) and is idempotent', async () => {
      const r1 = await request(app).post('/api/newsletter').send({ email: 'fan@example.com' });
      expect(r1.status).toBe(201);
      const r2 = await request(app).post('/api/newsletter').send({ email: 'fan@example.com' });
      expect(r2.status).toBe(201);
      expect(await NewsletterSubscriber.countDocuments()).toBe(1); // no duplicate
    });

    it('rejects an invalid email (400)', async () => {
      const res = await request(app).post('/api/newsletter').send({ email: 'not-an-email' });
      expect(res.status).toBe(400);
    });

    it('admin can list subscribers; non-admin blocked', async () => {
      await request(app).post('/api/newsletter').send({ email: 'a@example.com' });
      expect((await request(app).get('/api/newsletter/admin/all')).status).toBe(401);
      expect((await request(app).get('/api/newsletter/admin/all').set('Authorization', `Bearer ${customerToken}`)).status).toBe(403);
      const ok = await request(app).get('/api/newsletter/admin/all').set('Authorization', `Bearer ${adminToken}`);
      expect(ok.status).toBe(200);
      expect(ok.body.data).toHaveLength(1);
    });
  });
});
