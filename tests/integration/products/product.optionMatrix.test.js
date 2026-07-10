/**
 * Option-matrix products: axes + per-combination variants (spec 2026-07-10).
 */
jest.mock('../../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../../src/utils/cloudinary', () => ({
  uploadMultipleToCloudinary: jest.fn().mockResolvedValue([{ url: 'http://img/1.jpg', publicId: 'products/1' }]),
  deleteMultipleFromCloudinary: jest.fn().mockResolvedValue(undefined),
  validateImageFile: jest.fn(),
}));

const request = require('supertest');
const app = require('../../../src/app');
const User = require('../../../src/models/user.model');
const Product = require('../../../src/models/product.model');

async function tokenFor(role) {
  const email = `${role}-${Date.now()}-${Math.random()}@test.com`;
  await User.create({ name: 'U', email, phoneNumber: '12345678', address: 'x', password: 'Password123*', role });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Password123*' });
  return res.body.data.accessToken;
}

const OPTS = [
  { name: 'Weight', values: ['5kg', '10kg'] },
  { name: 'Flavour', values: ['Chicken', 'Beef'] },
];
const VARIANTS = [
  { label: 'x', optionValues: { Weight: '5kg', Flavour: 'Chicken' }, price: 100, quantity: 3, images: [] },
  { label: 'x', optionValues: { Weight: '10kg', Flavour: 'Beef' }, price: 180, quantity: 2, images: [] },
];

const createMatrixProduct = (token, { name = 'Matrix Rice', options = OPTS, variants = VARIANTS } = {}) =>
  request(app)
    .post('/api/products')
    .set('Authorization', `Bearer ${token}`)
    .field('name', name)
    .field('description', 'A very nice bag of rice for pets')
    .field('categories', 'general')
    .field('options', JSON.stringify(options))
    .field('variants', JSON.stringify(variants))
    .attach('images', Buffer.from('img'), 'x.jpg');

describe('option matrix products', () => {
  // No deleteMany here: all files share one in-memory DB, so cross-file wipes
  // are the known integration flake. This suite only uses unique emails/ids.
  let token;
  beforeEach(async () => {
    token = await tokenFor('admin');
  });

  it('creates a matrix product with derived labels and roll-up', async () => {
    const res = await createMatrixProduct(token);
    expect(res.status).toBe(201);
    expect(res.body.data.variants[0].label).toBe('5kg · Chicken');
    expect(res.body.data.price).toBe(100);
    expect(res.body.data.quantity).toBe(5);
  });

  it('rejects a duplicate combination with 400', async () => {
    const res = await createMatrixProduct(token, {
      name: 'Bad Matrix',
      variants: [VARIANTS[0], VARIANTS[0]],
    });
    expect(res.status).toBe(400);
  });

  it('rejects a value not listed on the axis with 400 on PATCH', async () => {
    const created = await createMatrixProduct(token);
    expect(created.status).toBe(201); // surface create failures with their status
    const res = await request(app)
      .patch(`/api/products/${created.body.data._id}`)
      .set('Authorization', `Bearer ${token}`)
      .field('variants', JSON.stringify([
        { label: 'x', optionValues: { Weight: '7kg', Flavour: 'Chicken' }, price: 90, quantity: 1, images: [] },
      ]));
    expect(res.status).toBe(400);
  });

  it('updates axes via PATCH: new value + new combination accepted', async () => {
    const created = await createMatrixProduct(token);
    const newOpts = [
      { name: 'Weight', values: ['5kg', '10kg', '15kg'] },
      { name: 'Flavour', values: ['Chicken', 'Beef'] },
    ];
    const res = await request(app)
      .patch(`/api/products/${created.body.data._id}`)
      .set('Authorization', `Bearer ${token}`)
      .field('options', JSON.stringify(newOpts))
      .field('variants', JSON.stringify([
        ...VARIANTS,
        { label: 'x', optionValues: { Weight: '15kg', Flavour: 'Beef' }, price: 250, quantity: 7, images: [] },
      ]))
      .field('imageRefs', JSON.stringify([{ url: 'http://img/1.jpg', publicId: 'products/1' }]));
    expect(res.status).toBe(200);
    const db = await Product.findById(created.body.data._id);
    expect(db.variants).toHaveLength(3);
    expect(db.variants[2].label).toBe('15kg · Beef');
    expect(db.price).toBe(100);
    expect(db.quantity).toBe(12);
  });

  it('filter-options includes optionNames', async () => {
    await createMatrixProduct(token);
    const res = await request(app).get('/api/products/filter-options');
    expect(res.status).toBe(200);
    expect(res.body.data.optionNames).toEqual(expect.arrayContaining(['Weight', 'Flavour']));
  });

  it('add-to-cart works with a matrix variantId (downstream compat)', async () => {
    const created = await createMatrixProduct(token);
    expect(created.status).toBe(201);
    const product = created.body.data;
    const variant = product.variants.find((v) => v.label === '5kg · Chicken');
    const customerToken = await tokenFor('customer');

    const res = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: product._id, quantity: 1, variantId: variant._id });
    expect([200, 201]).toContain(res.status);
    const line = res.body.data.items[0];
    expect(String(line.variantId)).toBe(String(variant._id));
    expect(line.price).toBe(100);
  });
});
