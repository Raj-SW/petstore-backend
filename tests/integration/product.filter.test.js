/**
 * Tests for Epic 5 — Pet Shop filter backend:
 * - case-insensitive category matching in GET /api/products
 * - GET /api/products/filter-options distinct options
 */
jest.mock('../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const Product = require('../../src/models/product.model');

async function makeAdmin() {
  const u = await User.create({
    name: 'Admin', email: `admin-${Date.now()}-${Math.random()}@x.com`,
    phoneNumber: '12345678', address: 'x', password: 'Password123*', role: 'admin',
  });
  return u._id;
}

describe('Pet Shop filter (Epic 5)', () => {
  let adminId;

  beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });
  afterAll(async () => { await mongoose.disconnect(); });

  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    adminId = await makeAdmin();
    await Product.create([
      {
        name: 'Dog Food', description: 'good food for dogs', price: 10, quantity: 5,
        categories: ['dogs'], colors: ['brown'], genders: ['Unisex'],
        images: [{ url: 'u', publicId: 'p1' }], isActive: true, createdBy: adminId,
      },
      {
        name: 'Cat Toy', description: 'fun toy for cats', price: 5, quantity: 5,
        categories: ['cats'], colors: ['blue'], genders: ['Female'],
        images: [{ url: 'u', publicId: 'p2' }], isActive: true, createdBy: adminId,
      },
    ]);
  });

  it('matches categories case-insensitively (Dogs -> dogs)', async () => {
    const res = await request(app).get('/api/products').query({ categories: 'Dogs' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Dog Food');
  });

  it('combines colors filter (case-sensitive values from real data)', async () => {
    const res = await request(app).get('/api/products').query({ colors: 'blue' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Cat Toy');
  });

  it('returns distinct filter options for active products', async () => {
    const res = await request(app).get('/api/products/filter-options');
    expect(res.status).toBe(200);
    expect([...res.body.data.categories].sort()).toEqual(['cats', 'dogs']);
    expect([...res.body.data.colors].sort()).toEqual(['blue', 'brown']);
    expect(res.body.data.genders).toEqual(expect.arrayContaining(['Female', 'Unisex']));
  });
});
