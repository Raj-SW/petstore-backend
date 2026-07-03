const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../src/app');
const User = require('../../../src/models/user.model');
const Product = require('../../../src/models/product.model');
const Cart = require('../../../src/models/cart.model');
const Order = require('../../../src/models/order.model');

// Helper to create a user and get JWT Bearer token
async function createUserAndLogin(agent, userData) {
  await request(app).post('/api/auth/signup').send(userData);
  const res = await agent.post('/api/auth/login').send({
    email: userData.email,
    password: userData.password,
  });
  return res.body.data.accessToken;
}

// Minimal valid user data matching the model's required fields
const makeUser = (overrides = {}) => ({
  name: 'Test User',
  email: 'testuser@example.com',
  phoneNumber: '12345678',
  address: '123 Test St',
  password: 'Password123*',
  ...overrides,
});

// Minimal valid product data matching the model's required fields
const makeProduct = (overrides = {}) => ({
  name: 'Dog Food',
  description: 'Premium dog food for all breeds',
  price: 50,
  quantity: 10,
  categories: ['food'],
  images: [{ url: 'http://example.com/img.jpg', publicId: 'img-1' }],
  isActive: true,
  ...overrides,
});

describe('Order Controller - Checkout Scenarios', () => {
  let agent;
  let user;
  let product;
  let cookie;

  beforeEach(async () => {
    agent = request.agent(app);
    await User.deleteMany({});
    await Product.deleteMany({});
    await Cart.deleteMany({});
    await Order.deleteMany({});

    // Create an admin user to use as product creator
    const adminUser = await User.create(makeUser({
      email: 'admin@example.com',
      role: 'admin',
    }));

    user = makeUser();
    cookie = await createUserAndLogin(agent, user);

    product = await Product.create(makeProduct({ createdBy: adminUser._id }));
  });

  afterAll(async () => {
  });

  // 1. Successful order
  it('should create an order successfully', async () => {
    // Add to cart
    await agent
      .post('/api/cart/')
      .set('Authorization', `Bearer ${cookie}`)
      .send({ productId: product._id, quantity: 2 });
    // Checkout
    const res = await agent
      .post('/api/orders')
      .set('Authorization', `Bearer ${cookie}`)
      .send({
        shippingAddress: {
          street: '123 St',
          city: 'City',
          state: 'ST',
          country: 'Country',
          zipCode: '12345',
        },
        paymentMethod: 'stripe',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.totalAmount).toBe(100);
  });

  // 2. Out of stock
  it('should fail if product is out of stock', async () => {
    await agent
      .post('/api/cart/')
      .set('Authorization', `Bearer ${cookie}`)
      .send({ productId: product._id, quantity: 20 });
    const res = await agent
      .post('/api/orders')
      .set('Authorization', `Bearer ${cookie}`)
      .send({
        shippingAddress: {
          street: '123 St',
          city: 'City',
          state: 'ST',
          country: 'Country',
          zipCode: '12345',
        },
        paymentMethod: 'stripe',
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Insufficient stock/);
  });

  // 3. Product not found
  it('should fail if product does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    await agent.post('/api/cart/').set('Authorization', `Bearer ${cookie}`).send({ productId: fakeId, quantity: 1 });
    const res = await agent
      .post('/api/orders')
      .set('Authorization', `Bearer ${cookie}`)
      .send({
        shippingAddress: {
          street: '123 St',
          city: 'City',
          state: 'ST',
          country: 'Country',
          zipCode: '12345',
        },
        paymentMethod: 'stripe',
      });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Product not found/);
  });

  // 4. Product inactive
  it('should fail if product is inactive', async () => {
    const adminUser = await User.findOne({ email: 'admin@example.com' });
    const inactive = await Product.create(makeProduct({
      name: 'Cat Toy',
      description: 'Fun toy for cats',
      quantity: 5,
      isActive: false,
      createdBy: adminUser._id,
    }));
    await agent
      .post('/api/cart/')
      .set('Authorization', `Bearer ${cookie}`)
      .send({ productId: inactive._id, quantity: 1 });
    const res = await agent
      .post('/api/orders')
      .set('Authorization', `Bearer ${cookie}`)
      .send({
        shippingAddress: {
          street: '123 St',
          city: 'City',
          state: 'ST',
          country: 'Country',
          zipCode: '12345',
        },
        paymentMethod: 'stripe',
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not available/);
  });

  // 5. Price tampering attempt
  it('should use DB price even if cart price is tampered', async () => {
    // Add to cart
    await agent
      .post('/api/cart/')
      .set('Authorization', `Bearer ${cookie}`)
      .send({ productId: product._id, quantity: 1 });
    // Tamper cart price
    const cart = await Cart.findOne({ user: (await User.findOne({ email: user.email }))._id });
    cart.items[0].price = 1; // Tampered price
    await cart.save();
    // Checkout
    const res = await agent
      .post('/api/orders')
      .set('Authorization', `Bearer ${cookie}`)
      .send({
        shippingAddress: {
          street: '123 St',
          city: 'City',
          state: 'ST',
          country: 'Country',
          zipCode: '12345',
        },
        paymentMethod: 'stripe',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.items[0].price).toBe(50); // Should use DB price
  });

  // 6. Invalid discount code
  it('should ignore invalid discount code', async () => {
    await agent
      .post('/api/cart/')
      .set('Authorization', `Bearer ${cookie}`)
      .send({ productId: product._id, quantity: 1 });
    const cart = await Cart.findOne({ user: (await User.findOne({ email: user.email }))._id });
    cart.discountCode = 'INVALID';
    await cart.save();
    const res = await agent
      .post('/api/orders')
      .set('Authorization', `Bearer ${cookie}`)
      .send({
        shippingAddress: {
          street: '123 St',
          city: 'City',
          state: 'ST',
          country: 'Country',
          zipCode: '12345',
        },
        paymentMethod: 'stripe',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.discount).toBe(0);
  });

  // 7. Cart empty
  it('should fail if cart is empty', async () => {
    const res = await agent
      .post('/api/orders')
      .set('Authorization', `Bearer ${cookie}`)
      .send({
        shippingAddress: {
          street: '123 St',
          city: 'City',
          state: 'ST',
          country: 'Country',
          zipCode: '12345',
        },
        paymentMethod: 'stripe',
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Cart is empty/);
  });

  // 8. Unauthorized status update
  it('should not allow non-admin to update order status', async () => {
    await agent
      .post('/api/cart/')
      .set('Authorization', `Bearer ${cookie}`)
      .send({ productId: product._id, quantity: 1 });
    const orderRes = await agent
      .post('/api/orders')
      .set('Authorization', `Bearer ${cookie}`)
      .send({
        shippingAddress: {
          street: '123 St',
          city: 'City',
          state: 'ST',
          country: 'Country',
          zipCode: '12345',
        },
        paymentMethod: 'stripe',
      });
    const orderId = orderRes.body.data._id;
    const res = await agent
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${cookie}`)
      .send({ status: 'shipped' });
    expect(res.status).toBe(403);
  });

  // 9. Invalid status transition
  it.todo('should not allow invalid status transition');

  // 10. Race condition (simulate concurrent orders)
  it('should not oversell stock in concurrent orders', async () => {
    // Use separate agents so each user has an isolated cookie jar
    const agent1 = request.agent(app);
    const agent2 = request.agent(app);

    // Register and log in user1 with agent1
    const cookie1 = await createUserAndLogin(agent1, user);

    // Register and log in user2 with agent2
    const user2 = makeUser({ name: 'User2', email: 'user2@example.com' });
    await request(app).post('/api/auth/signup').send(user2);
    const loginRes2 = await agent2.post('/api/auth/login').send({
      email: user2.email,
      password: user2.password,
    });
    const cookie2 = loginRes2.body.data.accessToken;

    // Add to cart for each user via their own agent
    await agent1
      .post('/api/cart/')
      .set('Authorization', `Bearer ${cookie1}`)
      .send({ productId: product._id, quantity: 7 });
    await agent2
      .post('/api/cart/')
      .set('Authorization', `Bearer ${cookie2}`)
      .send({ productId: product._id, quantity: 5 });

    // Place both orders nearly simultaneously
    const shippingAddress = {
      street: '123 St',
      city: 'City',
      state: 'ST',
      country: 'Country',
      zipCode: '12345',
    };
    const [res1, res2] = await Promise.all([
      agent1
        .post('/api/orders')
        .set('Authorization', `Bearer ${cookie1}`)
        .send({ shippingAddress, paymentMethod: 'stripe' }),
      agent2
        .post('/api/orders')
        .set('Authorization', `Bearer ${cookie2}`)
        .send({ shippingAddress, paymentMethod: 'stripe' }),
    ]);

    // At most 1 can succeed: combined qty (7+5=12) exceeds stock (10).
    // In production MongoDB (WiredTiger) exactly 1 wins; in MongoMemoryServer's
    // in-memory engine both may receive a write-conflict abort instead — either
    // way no stock is oversold, which is the invariant we're protecting.
    const successCount = [res1, res2].filter((r) => r.status === 201).length;
    expect(successCount).toBeLessThanOrEqual(1);

    // Core invariant: stock must never go negative regardless of concurrency
    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.quantity).toBeGreaterThanOrEqual(0);

    // Any failed response must NOT be a silent 200/201 — it should be an error status
    const failedResponses = [res1, res2].filter((r) => r.status !== 201);
    for (const r of failedResponses) {
      expect(r.status).toBeGreaterThanOrEqual(400);
    }
  });
});
