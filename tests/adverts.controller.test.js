/**
 * Tests for Advert Controller
 * GET    /api/adverts            — public list (active only, placement filter)
 * GET    /api/adverts/admin/all  — admin list incl. inactive
 * POST   /api/adverts            — create (admin)
 * PATCH  /api/adverts/:id        — update (admin)
 * DELETE /api/adverts/:id        — delete (admin)
 */

jest.mock('../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../src/app');
const User     = require('../src/models/user.model');
const Advert   = require('../src/models/advert.model');

const makeUser = (overrides = {}) => ({
  name: 'Test User',
  email: `user-${Date.now()}-${Math.random()}@example.com`,
  phoneNumber: '12345678',
  address: '123 Test St',
  password: 'Password123*',
  ...overrides,
});

const makeAdvert = (createdBy, overrides = {}) => ({
  title: 'Royal Canin 20% off',
  link: 'https://example.com/promo',
  placement: 'banner',
  active: true,
  createdBy,
  ...overrides,
});

async function loginAs(userData) {
  await request(app).post('/api/auth/signup').send(userData);
  const res = await request(app).post('/api/auth/login').send({
    email: userData.email, password: userData.password,
  });
  return res.body.data.accessToken;
}

describe('Advert Controller', () => {
  let adminUser;
  let adminToken;
  let customerToken;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Advert.deleteMany({});

    adminUser = await User.create(makeUser({ email: 'admin@test.com', role: 'admin' }));
    const adminLoginRes = await request(app).post('/api/auth/login').send({
      email: 'admin@test.com', password: 'Password123*',
    });
    adminToken = adminLoginRes.body.data.accessToken;
    customerToken = await loginAs(makeUser());
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('GET /api/adverts', () => {
    it('returns only active adverts', async () => {
      await Advert.create(makeAdvert(adminUser._id));
      await Advert.create(makeAdvert(adminUser._id, { title: 'Inactive ad', active: false }));

      const res = await request(app).get('/api/adverts');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Royal Canin 20% off');
    });

    it('filters by placement', async () => {
      await Advert.create(makeAdvert(adminUser._id));
      await Advert.create(makeAdvert(adminUser._id, { title: 'Grid ad', placement: 'sponsored' }));

      const res = await request(app).get('/api/adverts?placement=sponsored');
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].placement).toBe('sponsored');
    });
  });

  describe('admin endpoints', () => {
    it('GET /api/adverts/admin/all returns inactive too', async () => {
      await Advert.create(makeAdvert(adminUser._id));
      await Advert.create(makeAdvert(adminUser._id, { title: 'Inactive ad', active: false }));

      const res = await request(app)
        .get('/api/adverts/admin/all')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('POST creates an advert (admin)', async () => {
      const res = await request(app)
        .post('/api/adverts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'VitaPet supplements',
          link: 'https://vitapet.example.com',
          placement: 'sponsored',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.active).toBe(true);
    });

    it('POST allows relative internal links', async () => {
      const res = await request(app)
        .post('/api/adverts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Shop promo', link: '/petshop', placement: 'banner' });
      expect(res.status).toBe(201);
      expect(res.body.data.link).toBe('/petshop');
    });

    it('POST rejects invalid placement', async () => {
      const res = await request(app)
        .post('/api/adverts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Bad', link: 'https://x.com', placement: 'popup' });
      expect(res.status).toBe(400);
    });

    it('POST rejects non-admin', async () => {
      const res = await request(app)
        .post('/api/adverts')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(makeAdvert(adminUser._id));
      expect(res.status).toBe(403);
    });

    it('PATCH toggles active', async () => {
      const ad = await Advert.create(makeAdvert(adminUser._id));
      const res = await request(app)
        .patch(`/api/adverts/${ad._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: false });
      expect(res.status).toBe(200);
      expect(res.body.data.active).toBe(false);
    });

    it('DELETE removes an advert', async () => {
      const ad = await Advert.create(makeAdvert(adminUser._id));
      const res = await request(app)
        .delete(`/api/adverts/${ad._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(await Advert.countDocuments()).toBe(0);
    });
  });
});
