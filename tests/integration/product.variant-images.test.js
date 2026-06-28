/**
 * Tests for Epic 6b — product image upload endpoint + variant images.
 */
jest.mock('../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../src/utils/cloudinary', () => ({
  uploadToCloudinary: jest.fn().mockResolvedValue({ url: 'https://c/v.jpg', publicId: 'products/v' }),
  uploadMultipleToCloudinary: jest.fn(),
  deleteMultipleFromCloudinary: jest.fn().mockResolvedValue(undefined),
  validateImageFile: jest.fn(),
}));
jest.mock('../../src/middlewares/upload', () => {
  const multer = require('multer');
  return { upload: multer({ storage: multer.memoryStorage() }) };
});

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const Product = require('../../src/models/product.model');

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe('Product variant images + upload (Epic 6b)', () => {
  let adminToken;
  let adminId;

  beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });
  afterAll(async () => { await mongoose.disconnect(); });

  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    const admin = await User.create({
      name: 'A', email: `a-${Date.now()}-${Math.random()}@x.com`,
      phoneNumber: '12345678', address: 'x', password: 'Password123*', role: 'admin',
    });
    adminId = admin._id;
    adminToken = admin.generateAuthToken();
  });

  it('upload-image returns { url, publicId }', async () => {
    const res = await request(app).post('/api/products/upload-image')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', TINY_PNG, 'v.png');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ url: 'https://c/v.jpg', publicId: 'products/v' });
  });

  it('rejects an upload with no file (400)', async () => {
    const res = await request(app).post('/api/products/upload-image')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('persists variant images on the product', async () => {
    const p = await Product.create({
      name: 'Dog Food', description: 'good food for dogs', categories: ['dogs'],
      images: [{ url: 'u', publicId: 'p' }], createdBy: adminId,
      variants: [{ label: '1kg', price: 300, quantity: 5, images: [{ url: 'u1', publicId: 'pv1' }] }],
    });
    const fresh = await Product.findById(p._id);
    expect(fresh.variants[0].images).toHaveLength(1);
    expect(fresh.variants[0].images[0].publicId).toBe('pv1');
  });

  it('rejects more than 6 images on a variant', async () => {
    const imgs = Array.from({ length: 7 }, (_, i) => ({ url: `u${i}`, publicId: `pv${i}` }));
    await expect(Product.create({
      name: 'X', description: 'desc for product x', categories: ['dogs'],
      images: [{ url: 'u', publicId: 'p' }], createdBy: adminId,
      variants: [{ label: '1kg', price: 300, quantity: 5, images: imgs }],
    })).rejects.toThrow();
  });
});
