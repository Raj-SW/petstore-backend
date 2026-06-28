/**
 * Tests for Epic 6 — POST /api/products/bulk admin bulk actions.
 */
jest.mock('../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../src/utils/cloudinary', () => ({
  uploadMultipleToCloudinary: jest.fn(),
  deleteMultipleFromCloudinary: jest.fn().mockResolvedValue(undefined),
  validateImageFile: jest.fn(),
}));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const Product = require('../../src/models/product.model');
const cloudinary = require('../../src/utils/cloudinary');

describe('POST /api/products/bulk (Epic 6)', () => {
  let adminToken;
  let adminId;
  let customerToken;

  beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });
  afterAll(async () => { await mongoose.disconnect(); });

  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    jest.clearAllMocks();
    cloudinary.deleteMultipleFromCloudinary.mockResolvedValue(undefined);
    const admin = await User.create({
      name: 'A', email: `a-${Date.now()}-${Math.random()}@x.com`,
      phoneNumber: '12345678', address: 'x', password: 'Password123*', role: 'admin',
    });
    adminId = admin._id;
    adminToken = admin.generateAuthToken();
    const cust = await User.create({
      name: 'C', email: `c-${Date.now()}-${Math.random()}@x.com`,
      phoneNumber: '12345678', address: 'x', password: 'Password123*', role: 'customer',
    });
    customerToken = cust.generateAuthToken();
  });

  const seed = (overrides = {}) => Product.create({
    name: `P ${Math.random()}`, description: 'a quality product for pets', price: 30, quantity: 15,
    categories: ['dogs'], images: [{ url: 'u', publicId: `img-${Math.random()}` }],
    isActive: true, isFeatured: false, createdBy: adminId, ...overrides,
  });
  const bulk = (body, token = adminToken) =>
    request(app).post('/api/products/bulk').set('Authorization', `Bearer ${token}`).send(body);

  it('rejects an unknown action (400)', async () => {
    const p = await seed();
    expect((await bulk({ action: 'frob', ids: [p._id.toString()] })).status).toBe(400);
  });
  it('rejects empty ids (400)', async () => {
    expect((await bulk({ action: 'activate', ids: [] })).status).toBe(400);
  });
  it('rejects an invalid ObjectId (400)', async () => {
    expect((await bulk({ action: 'activate', ids: ['nope'] })).status).toBe(400);
  });
  it('rejects sale without options (400)', async () => {
    const p = await seed();
    expect((await bulk({ action: 'sale', ids: [p._id.toString()] })).status).toBe(400);
  });
  it('rejects percent > 100 (400)', async () => {
    const p = await seed();
    expect((await bulk({ action: 'sale', ids: [p._id.toString()], options: { discountType: 'percent', discountValue: 150 } })).status).toBe(400);
  });
  it('rejects a non-admin (403)', async () => {
    const p = await seed();
    expect((await bulk({ action: 'activate', ids: [p._id.toString()] }, customerToken)).status).toBe(403);
  });

  it('deactivates multiple products', async () => {
    const a = await seed({ isActive: true });
    const b = await seed({ isActive: true });
    const res = await bulk({ action: 'deactivate', ids: [a._id.toString(), b._id.toString()] });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ requested: 2, matched: 2, modified: 2 });
    expect((await Product.findById(a._id)).isActive).toBe(false);
  });
  it('features a product', async () => {
    const a = await seed({ isFeatured: false });
    await bulk({ action: 'feature', ids: [a._id.toString()] });
    expect((await Product.findById(a._id)).isFeatured).toBe(true);
  });
  it('puts products on sale (percent + dates)', async () => {
    const a = await seed({ price: 100 });
    const res = await bulk({
      action: 'sale', ids: [a._id.toString()],
      options: { discountType: 'percent', discountValue: 25, saleStartsAt: '2026-01-01', saleEndsAt: '2030-01-01' },
    });
    expect(res.status).toBe(200);
    const u = await Product.findById(a._id);
    expect(u.onSale).toBe(true);
    expect(u.discountValue).toBe(25);
    expect(u.isOnSaleNow).toBe(true);
    expect(u.effectivePrice).toBe(75);
  });
  it('clears a sale', async () => {
    const a = await seed({
      price: 100, onSale: true, discountType: 'percent', discountValue: 25,
    });
    await bulk({ action: 'clearSale', ids: [a._id.toString()] });
    const u = await Product.findById(a._id);
    expect(u.onSale).toBe(false);
    expect(u.discountValue).toBe(0);
  });
  it('deletes products and removes their Cloudinary images', async () => {
    const a = await seed({ images: [{ url: 'u', publicId: 'pid-a' }] });
    const b = await seed({ images: [{ url: 'u', publicId: 'pid-b' }] });
    const res = await bulk({ action: 'delete', ids: [a._id.toString(), b._id.toString()] });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ requested: 2, deleted: 2 });
    expect(await Product.countDocuments()).toBe(0);
    const arg = cloudinary.deleteMultipleFromCloudinary.mock.calls[0][0];
    expect([...arg].sort()).toEqual(['pid-a', 'pid-b']);
  });
});
