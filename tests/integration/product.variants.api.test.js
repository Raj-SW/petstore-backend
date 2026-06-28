jest.mock('../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../src/utils/cloudinary', () => ({
  uploadMultipleToCloudinary: jest.fn().mockResolvedValue([{ url: 'http://img/1.jpg', publicId: 'products/1' }]),
  deleteMultipleFromCloudinary: jest.fn().mockResolvedValue(undefined),
  validateImageFile: jest.fn(),
}));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const Product = require('../../src/models/product.model');

async function adminToken() {
  const email = `admin-${Date.now()}-${Math.random()}@test.com`;
  await User.create({ name: 'Admin', email, phoneNumber: '12345678', address: 'x', password: 'Password123*', role: 'admin' });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Password123*' });
  return res.body.data.accessToken;
}

describe('Product variants API', () => {
  let token;
  beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });
  beforeEach(async () => { await Product.deleteMany({}); await User.deleteMany({}); token = await adminToken(); });
  afterAll(async () => { await mongoose.connection.close(); });

  it('creates a product with variants and derives price/quantity', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .field('name', 'Dog Food')
      .field('description', 'Premium kibble for dogs')
      .field('categories', 'food')
      .field('variants', JSON.stringify([
        { label: '1kg', price: 300, quantity: 5 },
        { label: '5kg', price: 1200, quantity: 8 },
      ]))
      .attach('images', Buffer.from('img'), 'x.jpg');
    expect(res.status).toBe(201);
    expect(res.body.data.price).toBe(300);
    expect(res.body.data.quantity).toBe(13);
    expect(res.body.data.variants).toHaveLength(2);
  });

  it('rejects a product with neither variants nor price/quantity', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .field('name', 'No Price')
      .field('description', 'Missing price and quantity here')
      .field('categories', 'food')
      .attach('images', Buffer.from('img'), 'x.jpg');
    expect(res.status).toBe(400);
  });
});
