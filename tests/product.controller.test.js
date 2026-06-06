/**
 * Tests for Product Controller
 * GET  /api/products              — list with filters/pagination
 * GET  /api/products/:id          — single product
 * GET  /api/products/category/:c  — by category
 * POST /api/products              — create (admin, Cloudinary mocked)
 * PATCH /api/products/:id         — update (admin, Cloudinary mocked)
 * DELETE /api/products/:id        — delete (admin, Cloudinary mocked)
 */

jest.mock('../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

jest.mock('../src/utils/cloudinary', () => ({
  validateImageFile:          jest.fn(),
  uploadMultipleToCloudinary: jest.fn().mockResolvedValue([
    { url: 'https://res.cloudinary.com/test/products/prod1.jpg', publicId: 'products/prod1' },
  ]),
  deleteMultipleFromCloudinary: jest.fn().mockResolvedValue(undefined),
}));

// Use memory storage so file uploads work without writing to disk
jest.mock('../src/middlewares/upload', () => {
  const multer = require('multer');
  return { upload: multer({ storage: multer.memoryStorage() }) };
});

const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../src/app');
const User     = require('../src/models/user.model');
const Product  = require('../src/models/product.model');

// Minimal 1×1 PNG for multipart uploads
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const makeUser = (overrides = {}) => ({
  name: 'Test User',
  email: `user-${Date.now()}-${Math.random()}@example.com`,
  phoneNumber: '12345678',
  address: '123 Test St',
  password: 'Password123*',
  ...overrides,
});

const makeProduct = (createdBy, overrides = {}) => ({
  name: 'Dog Harness',
  description: 'A quality harness for dogs of all sizes',
  price: 30,
  quantity: 15,
  categories: ['dogs'],
  images: [{ url: 'http://example.com/img.jpg', publicId: 'img-1' }],
  isActive: true,
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

describe('Product Controller', () => {
  let adminUser;
  let adminToken;
  let customerToken;
  let product;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});

    // Admin — created directly so role can be 'admin'
    adminUser = await User.create(makeUser({ email: 'admin@test.com', role: 'admin' }));
    // Admin token: login via API (password is hashed by pre-save hook above)
    const adminLoginRes = await request(app).post('/api/auth/login').send({
      email: 'admin@test.com', password: 'Password123*',
    });
    adminToken = adminLoginRes.body.data.accessToken;

    // Customer — registered via signup
    const customerData = makeUser();
    customerToken = await loginAs(customerData);

    // Seed one active product
    product = await Product.create(makeProduct(adminUser._id));
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // ─── GET /api/products ───────────────────────────────────────────────────────

  describe('GET /api/products', () => {
    it('returns paginated product list with 200', async () => {
      const res = await request(app).get('/api/products');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toMatchObject({
        total: expect.any(Number),
        page:  expect.any(Number),
        pages: expect.any(Number),
      });
    });

    it('does not require authentication', async () => {
      const res = await request(app).get('/api/products');
      expect(res.status).toBe(200);
    });

    it('only returns active products by default', async () => {
      // Add an inactive product
      await Product.create(makeProduct(adminUser._id, {
        name: 'Inactive Collar',
        description: 'This collar is no longer available in stores',
        isActive: false,
      }));

      const res = await request(app).get('/api/products');
      expect(res.status).toBe(200);
      expect(res.body.data.every((p) => p.isActive !== false)).toBe(true);
    });

    it('respects the limit query param', async () => {
      // Seed extra products
      for (let i = 0; i < 5; i++) {
        await Product.create(makeProduct(adminUser._id, {
          name: `Product ${i}`,
          description: `Description for product number ${i} in the catalogue`,
        }));
      }

      const res = await request(app).get('/api/products?limit=2');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
    });

    it('filters by category', async () => {
      await Product.create(makeProduct(adminUser._id, {
        name: 'Cat Toy',
        description: 'A fun interactive toy designed for indoor cats',
        categories: ['cats'],
      }));

      const res = await request(app).get('/api/products?categories=cats');
      expect(res.status).toBe(200);
      expect(res.body.data.every((p) => p.categories.includes('cats'))).toBe(true);
    });

    it('filters by price range', async () => {
      await Product.create(makeProduct(adminUser._id, {
        name: 'Expensive Bed',
        description: 'A luxury memory foam bed for premium pet comfort',
        price: 200,
      }));

      const res = await request(app).get('/api/products?minPrice=100&maxPrice=300');
      expect(res.status).toBe(200);
      expect(res.body.data.every((p) => p.price >= 100 && p.price <= 300)).toBe(true);
    });
  });

  // ─── GET /api/products/:id ───────────────────────────────────────────────────

  describe('GET /api/products/:id', () => {
    it('returns a product with 200', async () => {
      const res = await request(app).get(`/api/products/${product._id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(product._id.toString());
    });

    it('returns 404 for a non-existent product', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app).get(`/api/products/${fakeId}`);
      expect(res.status).toBe(404);
    });

    it('returns 400 for a malformed product ID', async () => {
      const res = await request(app).get('/api/products/not-a-valid-id');
      expect(res.status).toBe(400);
    });
  });

  // ─── GET /api/products/category/:category ────────────────────────────────────

  describe('GET /api/products/category/:category', () => {
    it('returns products matching the category', async () => {
      const res = await request(app).get('/api/products/category/dogs');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty array for a category with no products', async () => {
      const res = await request(app).get('/api/products/category/fish');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  // ─── POST /api/products ──────────────────────────────────────────────────────

  describe('POST /api/products (admin only)', () => {
    it('creates a product and returns 201', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('name', 'New Leash')
        .field('description', 'A durable leash for large breed dogs on daily walks')
        .field('price', '19.99')
        .field('quantity', '50')
        .field('categories', 'dogs')
        .field('isActive', 'true')
        .field('isFeatured', 'false')
        .attach('images', TINY_PNG, { filename: 'leash.png', contentType: 'image/png' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('New Leash');
    });

    it('returns 403 when a customer tries to create a product', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${customerToken}`)
        .field('name', 'Sneaky Product')
        .field('description', 'A product a customer should not be able to create')
        .field('price', '10')
        .field('quantity', '5')
        .field('categories', 'general')
        .attach('images', TINY_PNG, { filename: 'img.png', contentType: 'image/png' });

      expect(res.status).toBe(403);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app)
        .post('/api/products')
        .field('name', 'Ghost Product')
        .field('description', 'A product with no authenticated user sending it')
        .field('price', '10')
        .field('quantity', '5')
        .field('categories', 'general')
        .attach('images', TINY_PNG, { filename: 'img.png', contentType: 'image/png' });

      expect(res.status).toBe(401);
    });

    it('returns 400 when no image is provided', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'No Image Product',
          description: 'A product submitted without any attached image file',
          price: 10,
          quantity: 5,
          categories: ['general'],
        });

      expect(res.status).toBe(400);
    });
  });

  // ─── PATCH /api/products/:id ─────────────────────────────────────────────────

  describe('PATCH /api/products/:id (admin only)', () => {
    it('updates a product and returns 200', async () => {
      const res = await request(app)
        .patch(`/api/products/${product._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('name', 'Updated Harness')
        .field('price', '35');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Harness');
      expect(res.body.data.price).toBe(35);
    });

    it('returns 403 when a customer tries to update', async () => {
      const res = await request(app)
        .patch(`/api/products/${product._id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .field('name', 'Hacked Name');

      expect(res.status).toBe(403);
    });

    it('returns 404 for a non-existent product', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/products/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('name', 'Ghost Update');

      expect(res.status).toBe(404);
    });
  });

  // ─── DELETE /api/products/:id ────────────────────────────────────────────────

  describe('DELETE /api/products/:id (admin only)', () => {
    it('deletes a product and returns 200', async () => {
      const res = await request(app)
        .delete(`/api/products/${product._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const deleted = await Product.findById(product._id);
      expect(deleted).toBeNull();
    });

    it('returns 403 when a customer tries to delete', async () => {
      const res = await request(app)
        .delete(`/api/products/${product._id}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it('returns 404 for a non-existent product', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/products/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });
});
