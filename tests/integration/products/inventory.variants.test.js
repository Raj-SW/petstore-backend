/**
 * Tests for Epic 14 — variant-aware inventory management.
 */
jest.mock('../../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../src/app');
const User = require('../../../src/models/user.model');
const Product = require('../../../src/models/product.model');
const StockMovement = require('../../../src/models/stockMovement.model');

describe('Variant-aware inventory (Epic 14)', () => {
  let adminToken;
  let adminId;

  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    await StockMovement.deleteMany({});
    const admin = await User.create({
      name: 'Admin', email: `admin-${Date.now()}-${Math.random()}@x.com`,
      phoneNumber: '12345678', address: 'x', password: 'Password123*', role: 'admin',
    });
    adminId = admin._id;
    adminToken = admin.generateAuthToken();
  });

  const auth = (r) => r.set('Authorization', `Bearer ${adminToken}`);

  const makeVariantProduct = () => Product.create({
    name: 'Dog Food', description: 'good food for dogs', categories: ['dogs'],
    images: [{ url: 'u', publicId: 'p' }], createdBy: adminId,
    variants: [
      { label: '1kg', price: 300, quantity: 5 },
      { label: '3kg', price: 800, quantity: 2 },
    ],
  });

  const makeSimpleProduct = () => Product.create({
    name: 'Cat Toy', description: 'fun toy for cats', price: 10, quantity: 4,
    categories: ['cats'], images: [{ url: 'u', publicId: 'p2' }], createdBy: adminId,
  });

  it('expands variant products to per-variant inventory rows', async () => {
    await makeVariantProduct();
    const res = await auth(request(app).get('/api/admin/inventory'));
    expect(res.status).toBe(200);
    const variantRows = res.body.data.filter((r) => r.hasVariants);
    expect(variantRows).toHaveLength(2);
    expect(variantRows.map((r) => r.variantLabel).sort()).toEqual(['1kg', '3kg']);
  });

  it('restocks a specific variant and recomputes the product roll-up', async () => {
    const p = await makeVariantProduct();
    const v1 = p.variants[0];
    const res = await auth(
      request(app).patch(`/api/admin/inventory/${p._id}/restock`).send({ units: 10, variantId: v1._id })
    );
    expect(res.status).toBe(200);
    expect(res.body.data.newQty).toBe(15);

    const updated = await Product.findById(p._id);
    expect(updated.variants.id(v1._id).quantity).toBe(15);
    expect(updated.quantity).toBe(17); // 15 + 2 roll-up
    expect(updated.price).toBe(300); // min variant price

    const mv = await StockMovement.findOne({ product: p._id });
    expect(String(mv.variantId)).toBe(String(v1._id));
    expect(mv.variantLabel).toBe('1kg');
  });

  it('rejects restocking a variant product without a variantId (400)', async () => {
    const p = await makeVariantProduct();
    const res = await auth(request(app).patch(`/api/admin/inventory/${p._id}/restock`).send({ units: 5 }));
    expect(res.status).toBe(400);
  });

  it('adjusts a specific variant quantity', async () => {
    const p = await makeVariantProduct();
    const v2 = p.variants[1];
    const res = await auth(
      request(app).patch(`/api/admin/inventory/${p._id}/adjust`).send({ newQuantity: 0, variantId: v2._id, note: 'damaged' })
    );
    expect(res.status).toBe(200);
    const updated = await Product.findById(p._id);
    expect(updated.variants.id(v2._id).quantity).toBe(0);
    expect(updated.quantity).toBe(5); // 5 + 0
  });

  it('keeps product-level restock working for non-variant products', async () => {
    const p = await makeSimpleProduct();
    const res = await auth(request(app).patch(`/api/admin/inventory/${p._id}/restock`).send({ units: 6 }));
    expect(res.status).toBe(200);
    const updated = await Product.findById(p._id);
    expect(updated.quantity).toBe(10);
    const mv = await StockMovement.findOne({ product: p._id });
    expect(mv.variantId).toBeNull();
  });
});
