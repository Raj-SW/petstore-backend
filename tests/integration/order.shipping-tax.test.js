/**
 * Epic 11 — buildOrder computes shipping + tax from StoreSettings and snapshots
 * each item's original price.
 */
const mongoose = require('mongoose');
const Product = require('../../src/models/product.model');
const User = require('../../src/models/user.model');
const Order = require('../../src/models/order.model');
const StoreSettings = require('../../src/models/storeSettings.model');
const { buildOrder } = require('../../src/services/order.service');

const ADDR = { street: '1 A St', city: 'Town', state: 'X', country: 'MU', zipCode: '000' };

async function setSettings(patch) {
  await StoreSettings.findOneAndUpdate(
    { key: 'singleton' },
    { $set: patch, $setOnInsert: { key: 'singleton' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function place(items) {
  const session = await mongoose.startSession();
  let order;
  await session.withTransaction(async () => {
    order = await buildOrder({
      userId, items, shippingAddress: ADDR, paymentMethod: 'stripe', session,
    });
  });
  session.endSession();
  return Order.findById(order._id);
}

let userId;
let product;

describe('buildOrder shipping + tax + original price (Epic 11)', () => {
  beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });
  afterAll(async () => { await mongoose.connection.close(); });

  beforeEach(async () => {
    await Product.deleteMany({}); await User.deleteMany({}); await Order.deleteMany({}); await StoreSettings.deleteMany({});
    const u = await User.create({ name: 'U', email: `u-${Date.now()}-${Math.random()}@t.com`, phoneNumber: '12345678', address: 'x', password: 'Password123*' });
    userId = u._id;
    product = await Product.create({
      name: 'Dog Food', description: 'Premium kibble dogs', categories: ['food'], createdBy: userId,
      images: [{ url: 'https://cdn/x.jpg', publicId: 'products/x' }],
      price: 1000, quantity: 50,
    });
  });

  it('charges flat shipping under the free-shipping threshold', async () => {
    await setSettings({ shippingFlatFee: 150, freeShippingThreshold: 5000, taxRatePercent: 0, taxInclusive: false });
    const order = await place([{ product: product._id, quantity: 1 }]); // base 1000 < 5000
    expect(order.shippingFee).toBe(150);
    expect(order.grandTotal).toBe(1150);
  });

  it('gives free shipping at/over the threshold', async () => {
    await setSettings({ shippingFlatFee: 150, freeShippingThreshold: 2000, taxRatePercent: 0, taxInclusive: false });
    const order = await place([{ product: product._id, quantity: 3 }]); // base 3000 >= 2000
    expect(order.shippingFee).toBe(0);
    expect(order.grandTotal).toBe(3000);
  });

  it('inclusive tax is extracted without changing the grand total', async () => {
    await setSettings({ shippingFlatFee: 0, freeShippingThreshold: 0, taxRatePercent: 15, taxInclusive: true });
    const order = await place([{ product: product._id, quantity: 1 }]); // base 1000
    // VAT already inside the price: 1000 - 1000/1.15 = 130.43...
    expect(order.tax).toBeCloseTo(1000 - 1000 / 1.15, 2);
    expect(order.taxInclusive).toBe(true);
    expect(order.grandTotal).toBe(1000); // unchanged by inclusive tax
  });

  it('exclusive tax is added on top of the base', async () => {
    await setSettings({ shippingFlatFee: 0, freeShippingThreshold: 0, taxRatePercent: 10, taxInclusive: false });
    const order = await place([{ product: product._id, quantity: 1 }]); // base 1000
    expect(order.tax).toBeCloseTo(100, 2);
    expect(order.grandTotal).toBeCloseTo(1100, 2);
  });

  it('snapshots each item original price', async () => {
    await setSettings({ shippingFlatFee: 0, freeShippingThreshold: 0, taxRatePercent: 0, taxInclusive: false });
    const order = await place([{ product: product._id, quantity: 2 }]);
    expect(order.items[0].originalPrice).toBe(1000);
  });
});
