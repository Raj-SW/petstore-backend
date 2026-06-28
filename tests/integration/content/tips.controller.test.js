/**
 * Tests for Tip Controller
 * GET    /api/tips             — public list (published only, filters, search, pagination)
 * GET    /api/tips/:idOrSlug   — public single by slug or id
 * GET    /api/tips/admin/all   — admin list incl. drafts
 * GET    /api/tips/admin/:id   — admin single incl. drafts
 * POST   /api/tips             — create (admin)
 * PATCH  /api/tips/:id         — update (admin)
 * DELETE /api/tips/:id         — delete (admin)
 */

jest.mock('../../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../../../src/app');
const User     = require('../../../src/models/user.model');
const PetCareTip = require('../../../src/models/petCareTip.model');

const makeUser = (overrides = {}) => ({
  name: 'Test User',
  email: `user-${Date.now()}-${Math.random()}@example.com`,
  phoneNumber: '12345678',
  address: '123 Test St',
  password: 'Password123*',
  ...overrides,
});

const makeTip = (createdBy, overrides = {}) => ({
  title: 'How to feed your dog',
  body: '<p>Feed your dog twice a day with a balanced diet rich in protein.</p>',
  animalType: 'dog',
  category: 'nutrition',
  difficulty: 'beginner',
  published: true,
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

describe('Tip Controller', () => {
  let adminUser;
  let adminToken;
  let customerToken;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await PetCareTip.deleteMany({});

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

  describe('GET /api/tips', () => {
    it('returns only published tips', async () => {
      await PetCareTip.create(makeTip(adminUser._id));
      await PetCareTip.create(makeTip(adminUser._id, { title: 'Draft tip', published: false }));

      const res = await request(app).get('/api/tips');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('How to feed your dog');
    });

    it('filters by animalType and category', async () => {
      await PetCareTip.create(makeTip(adminUser._id));
      await PetCareTip.create(makeTip(adminUser._id, {
        title: 'Cat grooming basics', animalType: 'cat', category: 'grooming',
      }));

      const res = await request(app).get('/api/tips?animalType=cat&category=grooming');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].animalType).toBe('cat');
    });

    it('filters featured tips', async () => {
      await PetCareTip.create(makeTip(adminUser._id, { title: 'Featured one', featured: true }));
      await PetCareTip.create(makeTip(adminUser._id, { title: 'Not featured' }));

      const res = await request(app).get('/api/tips?featured=true');
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].featured).toBe(true);
    });

    it('searches title and breed', async () => {
      await PetCareTip.create(makeTip(adminUser._id, { title: 'Golden retriever diet', breed: 'Golden Retriever' }));
      await PetCareTip.create(makeTip(adminUser._id, { title: 'Cat litter training', animalType: 'cat', category: 'training' }));

      const res = await request(app).get('/api/tips?search=golden');
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Golden retriever diet');
    });

    it('excludes a tip by id (for related tips)', async () => {
      const t1 = await PetCareTip.create(makeTip(adminUser._id));
      await PetCareTip.create(makeTip(adminUser._id, { title: 'Second dog tip' }));

      const res = await request(app).get(`/api/tips?exclude=${t1._id}`);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Second dog tip');
    });

    it('paginates with page and limit', async () => {
      for (let i = 1; i <= 7; i++) {
        await PetCareTip.create(makeTip(adminUser._id, { title: `Tip number ${i}` }));
      }
      const res = await request(app).get('/api/tips?page=2&limit=5');
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(7);
      expect(res.body.pages).toBe(2);
    });
  });

  describe('GET /api/tips/:idOrSlug', () => {
    it('returns a published tip by slug', async () => {
      const tip = await PetCareTip.create(makeTip(adminUser._id));
      const res = await request(app).get(`/api/tips/${tip.slug}`);
      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('How to feed your dog');
      expect(res.body.data.slug).toBe('how-to-feed-your-dog');
    });

    it('returns a published tip by id', async () => {
      const tip = await PetCareTip.create(makeTip(adminUser._id));
      const res = await request(app).get(`/api/tips/${tip._id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('How to feed your dog');
    });

    it('404s for a draft tip', async () => {
      const tip = await PetCareTip.create(makeTip(adminUser._id, { published: false }));
      const res = await request(app).get(`/api/tips/${tip._id}`);
      expect(res.status).toBe(404);
    });

    it('auto-computes readTime from body length', async () => {
      const words = Array.from({ length: 450 }, (_, i) => `word${i}`).join(' ');
      const tip = await PetCareTip.create(makeTip(adminUser._id, { body: `<p>${words}</p>` }));
      const res = await request(app).get(`/api/tips/${tip._id}`);
      expect(res.body.data.readTime).toBe(2); // 450 / 200 ≈ 2
    });
  });

  describe('admin endpoints', () => {
    it('GET /api/tips/admin/all returns drafts too (admin)', async () => {
      await PetCareTip.create(makeTip(adminUser._id));
      await PetCareTip.create(makeTip(adminUser._id, { title: 'Draft tip', published: false }));

      const res = await request(app)
        .get('/api/tips/admin/all')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('GET /api/tips/admin/all rejects non-admin', async () => {
      const res = await request(app)
        .get('/api/tips/admin/all')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /api/tips/admin/:id returns a draft (admin)', async () => {
      const tip = await PetCareTip.create(makeTip(adminUser._id, { published: false }));
      const res = await request(app)
        .get(`/api/tips/admin/${tip._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.published).toBe(false);
    });

    it('POST /api/tips creates a tip (admin)', async () => {
      const res = await request(app)
        .post('/api/tips')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'New cat tip',
          body: '<p>Brush your cat weekly to reduce shedding and hairballs.</p>',
          animalType: 'cat',
          category: 'grooming',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.slug).toBe('new-cat-tip');
      expect(res.body.data.published).toBe(false); // drafts by default
      expect(res.body.data.readTime).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/tips rejects unauthenticated', async () => {
      const res = await request(app).post('/api/tips').send(makeTip(adminUser._id));
      expect(res.status).toBe(401);
    });

    it('POST /api/tips rejects non-admin', async () => {
      const res = await request(app)
        .post('/api/tips')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ title: 'Nope', body: '<p>No.</p>', animalType: 'dog', category: 'health' });
      expect(res.status).toBe(403);
    });

    it('POST /api/tips validates required fields', async () => {
      const res = await request(app)
        .post('/api/tips')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Missing body' });
      expect(res.status).toBe(400);
    });

    it('POST /api/tips rejects invalid animalType', async () => {
      const res = await request(app)
        .post('/api/tips')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Bad animal', body: '<p>x</p>', animalType: 'dragon', category: 'health' });
      expect(res.status).toBe(400);
    });

    it('PATCH /api/tips/:id toggles published and featured', async () => {
      const tip = await PetCareTip.create(makeTip(adminUser._id, { published: false }));
      const res = await request(app)
        .patch(`/api/tips/${tip._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ published: true, featured: true });
      expect(res.status).toBe(200);
      expect(res.body.data.published).toBe(true);
      expect(res.body.data.featured).toBe(true);
    });

    it('PATCH /api/tips/:id recalculates readTime when body changes', async () => {
      const tip = await PetCareTip.create(makeTip(adminUser._id));
      const words = Array.from({ length: 650 }, (_, i) => `w${i}`).join(' ');
      const res = await request(app)
        .patch(`/api/tips/${tip._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: `<p>${words}</p>` });
      expect(res.body.data.readTime).toBe(3); // 650/200 ≈ 3
    });

    it('DELETE /api/tips/:id deletes (admin)', async () => {
      const tip = await PetCareTip.create(makeTip(adminUser._id));
      const res = await request(app)
        .delete(`/api/tips/${tip._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(await PetCareTip.countDocuments()).toBe(0);
    });

    it('PATCH 404s for missing tip', async () => {
      const res = await request(app)
        .patch(`/api/tips/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ published: true });
      expect(res.status).toBe(404);
    });
  });
});
