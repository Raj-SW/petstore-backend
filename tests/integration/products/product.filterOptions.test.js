/**
 * Integration tests for GET /api/products/filter-options
 *
 * Covers:
 *  - returns distinct categories, colors, genders, optionNames from active products
 *  - excludes values from inactive products
 *  - deduplicates values that appear on multiple products
 *  - returns empty arrays when no products exist
 *  - optionNames pulled from options sub-array (matrix products)
 *  - does not require authentication
 */
jest.mock('../../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request  = require('supertest');
const app      = require('../../../src/app');
const User     = require('../../../src/models/user.model');
const Product  = require('../../../src/models/product.model');

const ENDPOINT = '/api/products/filter-options';

async function makeAdmin() {
  return User.create({
    name: 'Admin',
    email: `admin-fo-${Date.now()}-${Math.random()}@x.com`,
    phoneNumber: '12345678',
    address: 'x',
    password: 'Password123*',
    role: 'admin',
  });
}

let seq = 0;
const baseProduct = (overrides, adminId) => ({
  name: `Product ${++seq}`,
  description: 'A description long enough',
  price: 10,
  quantity: 5,
  images: [{ url: 'https://img.test/x.jpg', publicId: `p${seq}` }],
  isActive: true,
  createdBy: adminId,
  categories: [],
  colors: [],
  genders: [],
  ...overrides,
});

describe('GET /api/products/filter-options', () => {
  let adminId;

  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    adminId = (await makeAdmin())._id;
  });

  // ── Shape ────────────────────────────────────────────────────────────────────

  it('returns 200 with the expected shape', async () => {
    const res = await request(app).get(ENDPOINT);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      categories: expect.any(Array),
      colors:     expect.any(Array),
      genders:    expect.any(Array),
      optionNames: expect.any(Array),
    });
  });

  it('does not require authentication', async () => {
    const res = await request(app).get(ENDPOINT);
    expect(res.status).toBe(200);
  });

  // ── Empty catalog ─────────────────────────────────────────────────────────────

  it('returns empty arrays when no products exist', async () => {
    const res = await request(app).get(ENDPOINT);
    expect(res.body.data.categories).toHaveLength(0);
    expect(res.body.data.colors).toHaveLength(0);
    expect(res.body.data.genders).toHaveLength(0);
    expect(res.body.data.optionNames).toHaveLength(0);
  });

  // ── Active-only ───────────────────────────────────────────────────────────────

  it('only includes values from active products', async () => {
    await Product.create([
      baseProduct({ categories: ['dogs'], isActive: true  }, adminId),
      baseProduct({ categories: ['cats'], isActive: false }, adminId),
    ]);
    const res = await request(app).get(ENDPOINT);
    expect(res.body.data.categories).toContain('dogs');
    expect(res.body.data.categories).not.toContain('cats');
  });

  // ── Deduplication ─────────────────────────────────────────────────────────────

  it('deduplicates values that appear on multiple products', async () => {
    await Product.create([
      baseProduct({ categories: ['dogs'], colors: ['red']  }, adminId),
      baseProduct({ categories: ['dogs'], colors: ['blue'] }, adminId),
    ]);
    const res = await request(app).get(ENDPOINT);
    const dogCount = res.body.data.categories.filter((c) => c === 'dogs').length;
    expect(dogCount).toBe(1);
  });

  // ── Multi-value fields per product ────────────────────────────────────────────

  it('collects all values from a product with multiple categories', async () => {
    await Product.create(
      baseProduct({ categories: ['dogs', 'cats', 'fish'] }, adminId)
    );
    const res = await request(app).get(ENDPOINT);
    expect(res.body.data.categories).toEqual(expect.arrayContaining(['dogs', 'cats', 'fish']));
  });

  it('returns distinct colors and genders across products', async () => {
    await Product.create([
      baseProduct({ colors: ['red', 'blue'], genders: ['Male']   }, adminId),
      baseProduct({ colors: ['blue', 'green'], genders: ['Female'] }, adminId),
    ]);
    const res = await request(app).get(ENDPOINT);
    expect([...res.body.data.colors].sort()).toEqual(['blue', 'green', 'red']);
    expect(res.body.data.genders).toEqual(expect.arrayContaining(['Male', 'Female']));
    expect(res.body.data.genders.filter((g) => g === 'Male').length).toBe(1);
  });

  // ── optionNames (matrix products) ─────────────────────────────────────────────

  it('returns distinct option axis names from matrix products', async () => {
    await Product.create([
      baseProduct({
        options: [
          { name: 'Weight', values: ['5kg', '10kg'] },
          { name: 'Flavour', values: ['Vanilla'] },
        ],
      }, adminId),
      baseProduct({
        options: [{ name: 'Weight', values: ['1kg'] }], // Weight appears again
      }, adminId),
    ]);
    const res = await request(app).get(ENDPOINT);
    expect(res.body.data.optionNames).toEqual(expect.arrayContaining(['Weight', 'Flavour']));
    expect(res.body.data.optionNames.filter((n) => n === 'Weight').length).toBe(1);
  });

  it('excludes optionNames from inactive matrix products', async () => {
    await Product.create(
      baseProduct({
        isActive: false,
        options: [{ name: 'Colour', values: ['Red'] }],
      }, adminId)
    );
    const res = await request(app).get(ENDPOINT);
    expect(res.body.data.optionNames).not.toContain('Colour');
  });

  // ── Mixed products (matrix + simple) ─────────────────────────────────────────

  it('handles a catalog with both simple and matrix products', async () => {
    await Product.create([
      baseProduct({ categories: ['dogs'], colors: ['brown'] }, adminId),
      baseProduct({
        categories: ['cats'],
        options: [{ name: 'Size', values: ['S', 'M'] }],
      }, adminId),
    ]);
    const res = await request(app).get(ENDPOINT);
    expect(res.body.data.categories).toEqual(expect.arrayContaining(['dogs', 'cats']));
    expect(res.body.data.optionNames).toContain('Size');
  });
});
