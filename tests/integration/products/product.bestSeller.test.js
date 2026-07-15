/**
 * Tests for the bestSeller flag (admin-settable, shown in public product responses):
 * - flag is settable via create and defaults to false
 * - appears in GET /api/products list responses
 */
jest.mock('../../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request = require('supertest');
const app = require('../../../src/app');
const User = require('../../../src/models/user.model');
const Product = require('../../../src/models/product.model');

async function makeAdmin() {
  const u = await User.create({
    name: 'Admin', email: `admin-bs-${Date.now()}-${Math.random()}@x.com`,
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

describe('bestSeller flag', () => {
  let admin;

  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    admin = await makeAdmin();
  });

  it('defaults to false when not specified', async () => {
    const p = await Product.create(baseProduct({}, admin._id));
    expect(p.bestSeller).toBe(false);
  });

  it('is settable via create and appears in GET /api/products', async () => {
    await Product.create(baseProduct({ bestSeller: true }, admin._id));
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    const p = res.body.data.find((x) => x.bestSeller === true);
    expect(p).toBeTruthy();
  });
});
