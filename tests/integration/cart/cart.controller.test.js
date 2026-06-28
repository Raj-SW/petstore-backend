/**
 * Tests for Cart Controller
 * GET    /api/cart
 * POST   /api/cart
 * PATCH  /api/cart/:id
 * DELETE /api/cart/:id
 * DELETE /api/cart/clear
 */

jest.mock('../../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../../../src/app');
const User     = require('../../../src/models/user.model');
const Product  = require('../../../src/models/product.model');
const Cart     = require('../../../src/models/cart.model');

const makeUser = (overrides = {}) => ({
  name: 'Cart User',
  email: `cart-${Date.now()}-${Math.random()}@example.com`,
  phoneNumber: '12345678',
  address: '1 Cart Lane',
  password: 'Password123*',
  ...overrides,
});

const makeProduct = (createdBy, overrides = {}) => ({
  name: 'Test Product',
  description: 'A great product for testing purposes',
  price: 25,
  quantity: 20,
  categories: ['general'],
  images: [{ url: 'http://example.com/img.jpg', publicId: 'img-1' }],
  isActive: true,
  createdBy,
  ...overrides,
});

async function signupAndLogin(userData) {
  await request(app).post('/api/auth/signup').send(userData);
  const res = await request(app).post('/api/auth/login').send({
    email: userData.email,
    password: userData.password,
  });
  return res.body.data.accessToken;
}

describe('Cart Controller', () => {
  let token;
  let product;
  let adminUser;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    await Cart.deleteMany({});

    // Admin to satisfy Product.createdBy required field
    adminUser = await User.create(makeUser({ email: 'admin@example.com', role: 'admin' }));
    product   = await Product.create(makeProduct(adminUser._id));

    const userData = makeUser();
    token = await signupAndLogin(userData);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // ─── GET /api/cart ───────────────────────────────────────────────────────────

  describe('GET /api/cart', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/cart');
      expect(res.status).toBe(401);
    });

    it('returns an empty cart (auto-created) for a new user', async () => {
      const res = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
    });

    it('returns existing cart items', async () => {
      // Add an item first
      await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: product._id.toString(), quantity: 2 });

      const res = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
    });
  });

  // ─── POST /api/cart ──────────────────────────────────────────────────────────

  describe('POST /api/cart', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app)
        .post('/api/cart')
        .send({ productId: product._id.toString(), quantity: 1 });
      expect(res.status).toBe(401);
    });

    it('adds a product to the cart', async () => {
      const res = await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: product._id.toString(), quantity: 3 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].quantity).toBe(3);
    });

    it('accumulates quantity when the same product is added again', async () => {
      await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: product._id.toString(), quantity: 2 });

      await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: product._id.toString(), quantity: 3 });

      const res = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`);

      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].quantity).toBe(5);
    });

    it('stores the correct price from the DB (not from the client)', async () => {
      const res = await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: product._id.toString(), quantity: 1 });

      expect(res.body.data.items[0].price).toBe(product.price);
    });

    it('rejects missing productId with 400', async () => {
      const res = await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 1 });
      expect(res.status).toBe(400);
    });

    it('rejects zero or negative quantity with 400', async () => {
      const res = await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: product._id.toString(), quantity: 0 });
      expect(res.status).toBe(400);
    });
  });

  // ─── PATCH /api/cart/:id ─────────────────────────────────────────────────────

  describe('PATCH /api/cart/:id', () => {
    it('updates the quantity of an existing cart item', async () => {
      await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: product._id.toString(), quantity: 1 });

      const res = await request(app)
        .patch(`/api/cart/${product._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 5 });

      expect(res.status).toBe(200);
      expect(res.body.data.items[0].quantity).toBe(5);
    });

    it('returns 404 when the item is not in the cart', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/cart/${fakeId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 1 });

      expect(res.status).toBe(404);
    });

    it('rejects quantity exceeding stock with 400', async () => {
      await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: product._id.toString(), quantity: 1 });

      const res = await request(app)
        .patch(`/api/cart/${product._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 9999 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Insufficient stock/i);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app)
        .patch(`/api/cart/${product._id}`)
        .send({ quantity: 2 });
      expect(res.status).toBe(401);
    });
  });

  // ─── DELETE /api/cart/:id ────────────────────────────────────────────────────

  describe('DELETE /api/cart/:id', () => {
    it('removes an item from the cart', async () => {
      await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: product._id.toString(), quantity: 2 });

      const res = await request(app)
        .delete(`/api/cart/${product._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(0);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).delete(`/api/cart/${product._id}`);
      expect(res.status).toBe(401);
    });
  });

  // ─── DELETE /api/cart/clear ──────────────────────────────────────────────────

  describe('DELETE /api/cart/clear', () => {
    it('clears all items from the cart', async () => {
      // Add two different products first
      const product2 = await Product.create(makeProduct(adminUser._id, {
        name: 'Second Product',
        description: 'Another great product for testing purposes',
      }));

      await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: product._id.toString(), quantity: 1 });

      await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: product2._id.toString(), quantity: 2 });

      const res = await request(app)
        .delete('/api/cart/clear')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(0);
    });

    it('succeeds even when cart is already empty', async () => {
      const res = await request(app)
        .delete('/api/cart/clear')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).delete('/api/cart/clear');
      expect(res.status).toBe(401);
    });
  });
});
