/**
 * Tests for the ImageManager immediate-upload contract (Epic 6b FE/BE).
 *
 * The admin form uploads images to /upload-image first, then submits the final,
 * ordered refs as `imageRefs` (JSON) — no file attachments on the save request.
 * The backend uses those refs directly and diffs stored-vs-incoming publicIds to
 * clean up removed Cloudinary assets. Variant images travel inside `variants`.
 */
jest.mock('../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const mockDelete = jest.fn().mockResolvedValue(undefined);
jest.mock('../src/utils/cloudinary', () => ({
  validateImageFile: jest.fn(),
  uploadToCloudinary: jest.fn().mockResolvedValue({ url: 'https://c/x.jpg', publicId: 'products/x' }),
  uploadMultipleToCloudinary: jest.fn().mockResolvedValue([
    { url: 'https://c/new.jpg', publicId: 'products/new' },
  ]),
  deleteMultipleFromCloudinary: (...args) => mockDelete(...args),
}));

jest.mock('../src/middlewares/upload', () => {
  const multer = require('multer');
  return { upload: multer({ storage: multer.memoryStorage() }) };
});

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Product = require('../src/models/product.model');

describe('Product image-refs contract (Epic 6b ImageManager)', () => {
  let adminId;
  let adminToken;

  beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });
  afterAll(async () => { await mongoose.disconnect(); });

  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    mockDelete.mockClear();
    const admin = await User.create({
      name: 'A', email: `a-${Date.now()}-${Math.random()}@x.com`,
      phoneNumber: '12345678', address: 'x', password: 'Password123*', role: 'admin',
    });
    adminId = admin._id;
    adminToken = admin.generateAuthToken();
  });

  it('creates a product from imageRefs without any file upload', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('name', 'Premium Leash')
      .field('description', 'A strong leash for big dogs')
      .field('price', '40')
      .field('quantity', '10')
      .field('categories', 'dogs')
      .field('imageRefs', JSON.stringify([
        { url: 'https://c/a.jpg', publicId: 'products/a' },
        { url: 'https://c/b.jpg', publicId: 'products/b' },
      ]));

    expect(res.status).toBe(201);
    expect(res.body.data.images).toHaveLength(2);
    expect(res.body.data.images[0].publicId).toBe('products/a');
  });

  it('rejects create when imageRefs is empty and no files', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('name', 'No Image')
      .field('description', 'Has no image at all here')
      .field('price', '40')
      .field('quantity', '10')
      .field('categories', 'dogs')
      .field('imageRefs', JSON.stringify([]));

    expect(res.status).toBe(400);
  });

  it('replaces images on update and deletes the removed publicId', async () => {
    const p = await Product.create({
      name: 'Bed', description: 'A cozy pet bed for cats', price: 50, quantity: 5,
      categories: ['cats'], createdBy: adminId,
      images: [
        { url: 'https://c/old1.jpg', publicId: 'products/old1' },
        { url: 'https://c/old2.jpg', publicId: 'products/old2' },
      ],
    });

    const res = await request(app)
      .patch(`/api/products/${p._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('imageRefs', JSON.stringify([
        { url: 'https://c/old2.jpg', publicId: 'products/old2' },
      ]));

    expect(res.status).toBe(200);
    expect(res.body.data.images).toHaveLength(1);
    expect(res.body.data.images[0].publicId).toBe('products/old2');
    expect(mockDelete).toHaveBeenCalledWith(['products/old1']);
  });

  it('persists variant images and cleans up removed variant image publicIds on update', async () => {
    const p = await Product.create({
      name: 'Food', description: 'Tasty food for all dogs', categories: ['dogs'],
      images: [{ url: 'https://c/p.jpg', publicId: 'products/p' }], createdBy: adminId,
      variants: [{ label: '1kg', price: 300, quantity: 5, images: [{ url: 'https://c/v1.jpg', publicId: 'products/v1' }] }],
    });

    const res = await request(app)
      .patch(`/api/products/${p._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('imageRefs', JSON.stringify([{ url: 'https://c/p.jpg', publicId: 'products/p' }]))
      .field('variants', JSON.stringify([
        { label: '1kg', price: 300, quantity: 5, images: [{ url: 'https://c/v2.jpg', publicId: 'products/v2' }] },
      ]));

    expect(res.status).toBe(200);
    const fresh = await Product.findById(p._id);
    expect(fresh.variants[0].images[0].publicId).toBe('products/v2');
    expect(mockDelete).toHaveBeenCalledWith(expect.arrayContaining(['products/v1']));
  });
});
