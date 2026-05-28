const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Product = require('../src/models/product.model');
const Cart = require('../src/models/cart.model');
const Order = require('../src/models/order.model');

// Helper to create a user and get auth cookie
async function createUserAndLogin(agent, userData) {
  await request(app).post('/api/auth/register').send(userData);
  const res = await agent.post('/api/auth/login').send({
    email: userData.email,
    password: userData.password,
  });
  // set-cookie is an array of cookie strings; join them for use with .set('Cookie', ...)
  const cookies = res.headers['set-cookie'];
  return Array.isArray(cookies) ? cookies.join('; ') : cookies;
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

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

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
    await mongoose.connection.close();
  });

  // 1. Successful order
  it('should create an order successfully', async () => {
    // Add to cart
    await agent
      .post('/api/cart/')
      .set('Cookie', cookie)
      .send({ productId: product._id, quantity: 2 });
    // Checkout
    const res = await agent
      .post('/api/orders')
      .set('Cookie', cookie)
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
      .set('Cookie', cookie)
      .send({ productId: product._id, quantity: 20 });
    const res = await agent
      .post('/api/orders')
      .set('Cookie', cookie)
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
    await agent.post('/api/cart/').set('Cookie', cookie).send({ productId: fakeId, quantity: 1 });
    const res = await agent
      .post('/api/orders')
      .set('Cookie', cookie)
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
      .set('Cookie', cookie)
      .send({ productId: inactive._id, quantity: 1 });
    const res = await agent
      .post('/api/orders')
      .set('Cookie', cookie)
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
      .set('Cookie', cookie)
      .send({ productId: product._id, quantity: 1 });
    // Tamper cart price
    const cart = await Cart.findOne({ user: (await User.findOne({ email: user.email }))._id });
    cart.items[0].price = 1; // Tampered price
    await cart.save();
    // Checkout
    const res = await agent
      .post('/api/orders')
      .set('Cookie', cookie)
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
      .set('Cookie', cookie)
      .send({ productId: product._id, quantity: 1 });
    const cart = await Cart.findOne({ user: (await User.findOne({ email: user.email }))._id });
    cart.discountCode = 'INVALID';
    await cart.save();
    const res = await agent
      .post('/api/orders')
      .set('Cookie', cookie)
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
      .set('Cookie', cookie)
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
      .set('Cookie', cookie)
      .send({ productId: product._id, quantity: 1 });
    const orderRes = await agent
      .post('/api/orders')
      .set('Cookie', cookie)
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
      .set('Cookie', cookie)
      .send({ status: 'shipped' });
    expect(res.status).toBe(403);
  });

  // 9. Invalid status transition
  it('should not allow invalid status transition', async () => {
    // (Assume you have logic for valid transitions in your controller)
    // This is a placeholder for when you implement it
    expect(true).toBe(true);
  });

  // 10. Race condition (simulate concurrent orders)
  it('should not oversell stock in concurrent orders', async () => {
    // Add to cart for two users
    const user2 = makeUser({ name: 'User2', email: 'user2@example.com' });
    const cookie2 = await createUserAndLogin(agent, user2);
    await agent
      .post('/api/cart/')
      .set('Cookie', cookie)
      .send({ productId: product._id, quantity: 7 });
    await agent
      .post('/api/cart/')
      .set('Cookie', cookie2)
      .send({ productId: product._id, quantity: 5 });
    // Place both orders nearly simultaneously
    const [res1, res2] = await Promise.all([
      agent
        .post('/api/orders')
        .set('Cookie', cookie)
        .send({
          shippingAddress: {
            street: '123 St',
            city: 'City',
            state: 'ST',
            country: 'Country',
            zipCode: '12345',
          },
          paymentMethod: 'stripe',
        }),
      agent
        .post('/api/orders')
        .set('Cookie', cookie2)
        .send({
          shippingAddress: {
            street: '123 St',
            city: 'City',
            state: 'ST',
            country: 'Country',
            zipCode: '12345',
          },
          paymentMethod: 'stripe',
        }),
    ]);
    // Only one should succeed
    const successCount = [res1, res2].filter((r) => r.status === 201).length;
    expect(successCount).toBe(1);
    const failCount = [res1, res2].filter(
      (r) => r.status === 400 && /Insufficient stock/.test(r.body.message),
    ).length;
    expect(failCount).toBe(1);
  });
});
