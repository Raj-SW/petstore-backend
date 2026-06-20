const mongoose = require('mongoose');
const Product = require('../src/models/product.model');
const User = require('../src/models/user.model');
const Order = require('../src/models/order.model');
const { buildOrder } = require('../src/services/order.service');

const ADDR = { street: '1 A St', city: 'Town', state: 'X', country: 'MU', zipCode: '000' };

describe('buildOrder with variants', () => {
  let userId; let product;
  beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });
  beforeEach(async () => {
    await Product.deleteMany({}); await User.deleteMany({}); await Order.deleteMany({});
    const u = await User.create({ name: 'U', email: `u-${Date.now()}@t.com`, phoneNumber: '12345678', address: 'x', password: 'Password123*' });
    userId = u._id;
    product = await Product.create({
      name: 'Dog Food', description: 'Premium kibble dogs', categories: ['food'], createdBy: userId,
      images: [{ url: 'https://cdn/x.jpg', publicId: 'products/x' }],
      variants: [{ label: '1kg', price: 300, quantity: 5 }, { label: '5kg', price: 1200, quantity: 8 }],
    });
  });
  afterAll(async () => { await mongoose.connection.close(); });

  it('prices from the chosen variant and reserves only that variant stock', async () => {
    const v5 = product.variants[1]._id;
    const session = await mongoose.startSession();
    let order;
    await session.withTransaction(async () => {
      order = await buildOrder({
        userId, items: [{ product: product._id, variantId: v5, quantity: 2 }],
        shippingAddress: ADDR, paymentMethod: 'stripe', session,
      });
    });
    session.endSession();

    expect(order.totalAmount).toBe(2400);
    expect(order.items[0].variantLabel).toBe('5kg');

    const fresh = await Product.findById(product._id);
    expect(fresh.variants.id(v5).quantity).toBe(6);                       // 8 - 2
    expect(fresh.variants.id(product.variants[0]._id).quantity).toBe(5);  // 1kg untouched
  });
});
