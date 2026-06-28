const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../src/app');
const User = require('../../../src/models/user.model');
const Product = require('../../../src/models/product.model');
const Cart = require('../../../src/models/cart.model');

async function loginNew() {
  const email = `c-${Date.now()}-${Math.random()}@t.com`;
  await request(app).post('/api/auth/signup').send({ name: 'C', email, phoneNumber: '12345678', address: 'x', password: 'Password123*' });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Password123*' });
  return res.body.data.accessToken;
}

describe('Cart variants', () => {
  let token; let admin; let product;
  beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });
  beforeEach(async () => {
    await User.deleteMany({}); await Product.deleteMany({}); await Cart.deleteMany({});
    admin = await User.create({ name: 'A', email: 'a@t.com', phoneNumber: '12345678', address: 'x', password: 'Password123*', role: 'admin' });
    product = await Product.create({
      name: 'Dog Food', description: 'Premium kibble dogs', categories: ['food'], createdBy: admin._id,
      images: [{ url: 'https://cdn/x.jpg', publicId: 'products/x' }],
      variants: [{ label: '1kg', price: 300, quantity: 5 }, { label: '5kg', price: 1200, quantity: 8 }],
    });
    token = await loginNew();
  });
  afterAll(async () => { await mongoose.connection.close(); });

  it('adds two variants of the same product as separate lines, priced per variant', async () => {
    const v1 = product.variants[0]._id.toString();
    const v2 = product.variants[1]._id.toString();
    await request(app).post('/api/cart').set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString(), variantId: v1, quantity: 1 });
    const res = await request(app).post('/api/cart').set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString(), variantId: v2, quantity: 2 });
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    const line5kg = res.body.data.items.find((i) => i.variantLabel === '5kg');
    expect(line5kg.price).toBe(1200);
  });

  it('rejects adding a variant product without a variantId (400)', async () => {
    const res = await request(app).post('/api/cart').set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString(), quantity: 1 });
    expect(res.status).toBe(400);
  });
});
