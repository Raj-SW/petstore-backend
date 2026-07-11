/**
 * Tests for the vetRecommended flag (homepage "Vet Recommended This Month" section):
 * - GET /api/products?vetRecommended=true filters correctly
 * - flag is settable via create/update and defaults to false
 */
jest.mock('../../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request = require('supertest');
const app = require('../../../src/app');
const User = require('../../../src/models/user.model');
const Product = require('../../../src/models/product.model');

async function makeAdmin() {
  const u = await User.create({
    name: 'Admin', email: `admin-vr-${Date.now()}-${Math.random()}@x.com`,
    phoneNumber: '12345678', address: 'x', password: 'Password123*', role: 'admin',
  });
  return u;
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
  ...overrides,
});

describe('vetRecommended flag', () => {
  let admin;

  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    admin = await makeAdmin();
  });

  it('defaults to false when not specified', async () => {
    const p = await Product.create(baseProduct({}, admin._id));
    expect(p.vetRecommended).toBe(false);
  });

  it('filters GET /api/products by vetRecommended=true', async () => {
    await Product.create([
      baseProduct({ vetRecommended: true }, admin._id),
      baseProduct({ vetRecommended: false }, admin._id),
    ]);
    const res = await request(app).get('/api/products').query({ vetRecommended: 'true' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].vetRecommended).toBe(true);
  });

  it('excludes inactive products even when vetRecommended is true', async () => {
    await Product.create(
      baseProduct({ vetRecommended: true, isActive: false }, admin._id)
    );
    const res = await request(app).get('/api/products').query({ vetRecommended: 'true' });
    expect(res.body.data).toHaveLength(0);
  });

  it('does not filter by vetRecommended when the param is absent', async () => {
    await Product.create([
      baseProduct({ vetRecommended: true }, admin._id),
      baseProduct({ vetRecommended: false }, admin._id),
    ]);
    const res = await request(app).get('/api/products');
    expect(res.body.data).toHaveLength(2);
  });
});
