/**
 * Discounts / On-Sale — Product sale virtuals, validator, and checkout charging.
 */
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
const Cart = require('../../src/models/cart.model');
const Order = require('../../src/models/order.model');

const makeUser = (o = {}) => ({
  name: 'Test User', email: `u-${Date.now()}-${Math.random()}@x.com`,
  phoneNumber: '12345678', address: '1 St', password: 'Password123*', ...o,
});

const baseProduct = (o = {}) => ({
  name: 'Dog Food', description: 'A good product description here.',
  price: 100, quantity: 50, categories: ['food'],
  images: [{ url: 'http://x/img.jpg', publicId: 'p1' }], isActive: true, ...o,
});

// For direct Product.create() (model requires createdBy; the API sets it from req.user
// and Joi would reject it in the request body, so it's only added here for direct creates).
const dbProduct = (o = {}) => ({ ...baseProduct(o), createdBy: new mongoose.Types.ObjectId() });

async function adminToken() {
  const data = makeUser({ email: `admin-${Date.now()}@x.com`, role: 'admin' });
  await User.create(data);
  const res = await request(app).post('/api/auth/login').send({ email: data.email, password: data.password });
  return res.body.data.accessToken;
}
async function customer() {
  const data = makeUser({ email: `cust-${Date.now()}@x.com` });
  await User.create(data);
  const res = await request(app).post('/api/auth/login').send({ email: data.email, password: data.password });
  return { token: res.body.data.accessToken, user: await User.findOne({ email: data.email }) };
}

describe('Product sale virtuals', () => {
  beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });
  beforeEach(async () => { await Product.deleteMany({}); });
  afterAll(async () => { await mongoose.connection.close(); });

  it('salePrice: percent computes price*(1-pct/100), rounded to 2dp', async () => {
    const p = await Product.create(dbProduct({ onSale: true, discountType: 'percent', discountValue: 20 }));
    expect(p.salePrice).toBe(80);
    expect(p.isOnSaleNow).toBe(true);
    expect(p.effectivePrice).toBe(80);
    expect(p.discountPercentLabel).toBe(20);
  });

  it('salePrice: amount uses the absolute value', async () => {
    const p = await Product.create(dbProduct({ onSale: true, discountType: 'amount', discountValue: 75 }));
    expect(p.salePrice).toBe(75);
    expect(p.isOnSaleNow).toBe(true);
    expect(p.effectivePrice).toBe(75);
    expect(p.discountPercentLabel).toBe(25); // (100-75)/100
  });

  it('isOnSaleNow false when onSale is off → effectivePrice = price', async () => {
    const p = await Product.create(dbProduct({ onSale: false, discountType: 'percent', discountValue: 20 }));
    expect(p.isOnSaleNow).toBe(false);
    expect(p.effectivePrice).toBe(100);
    expect(p.discountPercentLabel).toBe(0);
  });

  it('isOnSaleNow false before the window starts', async () => {
    const p = await Product.create(dbProduct({
      onSale: true, discountType: 'percent', discountValue: 20,
      saleStartsAt: new Date(Date.now() + 60 * 60 * 1000),
    }));
    expect(p.isOnSaleNow).toBe(false);
    expect(p.effectivePrice).toBe(100);
  });

  it('isOnSaleNow false after the window ends', async () => {
    const p = await Product.create(dbProduct({
      onSale: true, discountType: 'percent', discountValue: 20,
      saleEndsAt: new Date(Date.now() - 60 * 60 * 1000),
    }));
    expect(p.isOnSaleNow).toBe(false);
    expect(p.effectivePrice).toBe(100);
  });

  it('isOnSaleNow true inside the window', async () => {
    const p = await Product.create(dbProduct({
      onSale: true, discountType: 'percent', discountValue: 10,
      saleStartsAt: new Date(Date.now() - 1000), saleEndsAt: new Date(Date.now() + 60 * 60 * 1000),
    }));
    expect(p.isOnSaleNow).toBe(true);
    expect(p.effectivePrice).toBe(90);
  });

  it('serializes virtuals to JSON', async () => {
    const p = await Product.create(dbProduct({ onSale: true, discountType: 'percent', discountValue: 20 }));
    const json = p.toJSON();
    expect(json.salePrice).toBe(80);
    expect(json.isOnSaleNow).toBe(true);
    expect(json.effectivePrice).toBe(80);
    expect(json.discountPercentLabel).toBe(20);
  });
});

describe('Sale validation on create', () => {
  let token;
  beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });
  beforeEach(async () => { await User.deleteMany({}); await Product.deleteMany({}); token = await adminToken(); });
  afterAll(async () => { await mongoose.connection.close(); });

  // The create endpoint needs a multipart body with at least one image file.
  // Send fields via .field() and attach a dummy image (Cloudinary is mocked).
  const post = (body) => {
    const req = request(app).post('/api/products').set('Authorization', `Bearer ${token}`);
    Object.entries(body).forEach(([k, v]) => {
      if (k === 'images') return;
      if (Array.isArray(v)) v.forEach((item) => req.field(k, String(item)));
      else if (v instanceof Date) req.field(k, v.toISOString());
      else req.field(k, String(v));
    });
    return req.attach('images', Buffer.from('img'), 'x.jpg');
  };

  it('rejects percent > 100', async () => {
    const res = await post(baseProduct({ onSale: true, discountType: 'percent', discountValue: 150 }));
    expect(res.status).toBe(400);
  });
  it('rejects amount >= price', async () => {
    const res = await post(baseProduct({ onSale: true, discountType: 'amount', discountValue: 100 }));
    expect(res.status).toBe(400);
  });
  it('rejects onSale with zero value', async () => {
    const res = await post(baseProduct({ onSale: true, discountType: 'percent', discountValue: 0 }));
    expect(res.status).toBe(400);
  });
  it('rejects saleEndsAt before saleStartsAt', async () => {
    const res = await post(baseProduct({
      onSale: true, discountType: 'percent', discountValue: 10,
      saleStartsAt: new Date(Date.now() + 2000).toISOString(),
      saleEndsAt: new Date(Date.now() + 1000).toISOString(),
    }));
    expect(res.status).toBe(400);
  });
  it('accepts a valid percent sale', async () => {
    const res = await post(baseProduct({ onSale: true, discountType: 'percent', discountValue: 25 }));
    expect(res.status).toBe(201);
    expect(res.body.data.discountValue).toBe(25);
    expect(res.body.data.effectivePrice).toBe(75);
  });
});

describe('Checkout charges effectivePrice', () => {
  let token; let user;
  beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });
  beforeEach(async () => {
    await User.deleteMany({}); await Product.deleteMany({}); await Cart.deleteMany({}); await Order.deleteMany({});
    const c = await customer(); token = c.token; user = c.user;
  });
  afterAll(async () => { await mongoose.connection.close(); });

  async function checkout(product) {
    await Cart.create({ user: user._id, items: [{ product: product._id, quantity: 2, price: product.price }] });
    return request(app).post('/api/orders').set('Authorization', `Bearer ${token}`).send({
      shippingAddress: { street: '1 St', city: 'C', state: 'S', country: 'X', zipCode: '111' },
      paymentMethod: 'stripe',
    });
  }

  it('charges the sale price when on sale', async () => {
    const p = await Product.create(dbProduct({ onSale: true, discountType: 'percent', discountValue: 20 }));
    const res = await checkout(p);
    expect(res.status).toBe(201);
    expect(res.body.data.totalAmount).toBe(160); // 80 * 2
    expect(res.body.data.items[0].price).toBe(80);
  });

  it('charges the full price when the sale is off', async () => {
    const p = await Product.create(dbProduct({ onSale: false, discountType: 'percent', discountValue: 20 }));
    const res = await checkout(p);
    expect(res.status).toBe(201);
    expect(res.body.data.totalAmount).toBe(200); // 100 * 2
  });
});
