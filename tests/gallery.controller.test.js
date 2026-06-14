/**
 * Tests for Gallery Controller
 * GET    /api/gallery               — public list (published only, filters)
 * GET    /api/gallery/:idOrSlug     — public single (published) + related
 * GET    /api/gallery/admin/all     — admin list incl. drafts
 * POST   /api/gallery               — create (admin)
 * PATCH  /api/gallery/:id           — update (admin)
 * DELETE /api/gallery/:id           — delete (admin)
 * POST   /api/gallery/upload-image  — admin image upload (Cloudinary mocked)
 */

jest.mock('../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../src/utils/cloudinary', () => ({
  uploadToCloudinary: jest.fn().mockResolvedValue({ url: 'https://cdn.example.com/img.jpg', publicId: 'gallery/img' }),
}));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/user.model');
const GalleryPost = require('../src/models/galleryPost.model');

const makeUser = (overrides = {}) => ({
  name: 'Test User',
  email: `user-${Date.now()}-${Math.random()}@example.com`,
  phoneNumber: '12345678',
  address: '123 Test St',
  password: 'Password123*',
  ...overrides,
});

const makePost = (createdBy, overrides = {}) => ({
  title: 'Mauritius Pet Expo 2026',
  body: '<p>We brought the whole crew to the biggest pet event of the year.</p>',
  category: 'event',
  eventDate: new Date('2026-03-12'),
  location: 'Pailles',
  published: true,
  createdBy,
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

describe('Gallery Controller', () => {
  let adminUser;
  let adminToken;
  let customerToken;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await GalleryPost.deleteMany({});

    adminUser = await User.create(makeUser({ email: 'admin@test.com', role: 'admin' }));
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

  describe('GET /api/gallery', () => {
    it('returns only published posts', async () => {
      await GalleryPost.create(makePost(adminUser._id));
      await GalleryPost.create(makePost(adminUser._id, { title: 'Draft post', published: false }));

      const res = await request(app).get('/api/gallery');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Mauritius Pet Expo 2026');
    });

    it('filters by category', async () => {
      await GalleryPost.create(makePost(adminUser._id));
      await GalleryPost.create(makePost(adminUser._id, { title: 'Award night', category: 'award' }));

      const res = await request(app).get('/api/gallery?category=award');
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].category).toBe('award');
    });

    it('searches by title', async () => {
      await GalleryPost.create(makePost(adminUser._id));
      await GalleryPost.create(makePost(adminUser._id, { title: 'Beach Cleanup', category: 'community' }));

      const res = await request(app).get('/api/gallery?search=cleanup');
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Beach Cleanup');
    });

    it('derives slug and excerpt on create', async () => {
      await GalleryPost.create(makePost(adminUser._id));
      const res = await request(app).get('/api/gallery');
      expect(res.body.data[0].slug).toBe('mauritius-pet-expo-2026');
      expect(res.body.data[0].excerpt.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/gallery/:idOrSlug', () => {
    it('returns a published post by slug with related posts', async () => {
      await GalleryPost.create(makePost(adminUser._id));
      await GalleryPost.create(makePost(adminUser._id, { title: 'Adoption Drive', category: 'event' }));

      const res = await request(app).get('/api/gallery/mauritius-pet-expo-2026');
      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Mauritius Pet Expo 2026');
      expect(Array.isArray(res.body.related)).toBe(true);
      expect(res.body.related).toHaveLength(1);
    });

    it('404s for a draft or unknown slug', async () => {
      await GalleryPost.create(makePost(adminUser._id, { title: 'Hidden', published: false }));
      const draft = await request(app).get('/api/gallery/hidden');
      expect(draft.status).toBe(404);
      const unknown = await request(app).get('/api/gallery/does-not-exist');
      expect(unknown.status).toBe(404);
    });
  });

  describe('admin endpoints', () => {
    it('GET /api/gallery/admin/all returns drafts too', async () => {
      await GalleryPost.create(makePost(adminUser._id));
      await GalleryPost.create(makePost(adminUser._id, { title: 'Draft', published: false }));

      const res = await request(app)
        .get('/api/gallery/admin/all')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('POST creates a post (admin) and normalises tags', async () => {
      const res = await request(app)
        .post('/api/gallery')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Charity Walk 2026',
          body: '<p>Walking for paws.</p>',
          category: 'community',
          eventDate: '2026-04-01',
          tags: [' Charity ', 'charity', 'Walk'],
        });
      expect(res.status).toBe(201);
      expect(res.body.data.slug).toBe('charity-walk-2026');
      expect(res.body.data.tags).toEqual(['charity', 'walk']);
    });

    it('POST rejects an invalid category', async () => {
      const res = await request(app)
        .post('/api/gallery')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Bad', body: '<p>x</p>', category: 'nope', eventDate: '2026-01-01' });
      expect(res.status).toBe(400);
    });

    it('POST rejects missing token (401)', async () => {
      const res = await request(app).post('/api/gallery').send(makePost(adminUser._id));
      expect(res.status).toBe(401);
    });

    it('POST rejects non-admin (403)', async () => {
      const res = await request(app)
        .post('/api/gallery')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(makePost(adminUser._id));
      expect(res.status).toBe(403);
    });

    it('PATCH updates and re-runs the slug hook', async () => {
      const post = await GalleryPost.create(makePost(adminUser._id));
      const res = await request(app)
        .patch(`/api/gallery/${post._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Renamed Event 2026' });
      expect(res.status).toBe(200);
      expect(res.body.data.slug).toBe('renamed-event-2026');
    });

    it('DELETE removes a post', async () => {
      const post = await GalleryPost.create(makePost(adminUser._id));
      const res = await request(app)
        .delete(`/api/gallery/${post._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(await GalleryPost.countDocuments()).toBe(0);
    });

    it('POST /upload-image returns a Cloudinary url', async () => {
      const res = await request(app)
        .post('/api/gallery/upload-image')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('image', Buffer.from('fake-image-bytes'), 'photo.jpg');
      expect(res.status).toBe(200);
      expect(res.body.data.url).toBe('https://cdn.example.com/img.jpg');
    });
  });
});
