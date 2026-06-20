# Recurring Orders (Subscriptions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let customers auto-reorder products (per-product or whole-cart) on a custom interval; a daily Vercel Cron generates a discounted pending order per due subscription and emails a pay-now link.

**Architecture:** New `Subscription` resource + a shared `order.service.js#buildOrder` (extracted from `createOrder`) reused by both manual checkout and the subscription runner. A secured `process-due` endpoint (Vercel Cron, `Authorization: Bearer ${CRON_SECRET}`) reserves stock, applies the subscription discount, and advances `nextRunAt`. Auto-charge is deferred; orders are created `pending` and paid via the existing flow.

**Tech Stack:** Express + Mongoose + Joi + Jest/supertest (backend); React 18 + Vite + Vitest (frontend). Email via existing Resend SMTP `sendEmail` + Handlebars. No new npm packages.

**⚠️ Repo layout:** `backend/` and `frontend/` are **separate git repos**. Commit backend changes inside `backend/`, frontend inside `frontend/`. Never `git add` across the boundary.

**Spec:** `backend/docs/superpowers/specs/2026-06-14-recurring-orders-design.md`

---

## File Structure

**Backend (`backend/`)**

| File | Responsibility |
|---|---|
| `src/models/subscription.model.js` | Subscription schema |
| `src/models/order.model.js` (modify) | Add `source: manual\|subscription` |
| `src/services/order.service.js` | `buildOrder()` — shared order/stock builder |
| `src/controllers/order.controller.js` (modify) | `createOrder` delegates to `buildOrder` |
| `src/validators/subscription.validator.js` | Joi create/update (min-interval guard) |
| `src/middlewares/cronAuth.js` | `verifyCronSecret` (Bearer) |
| `src/controllers/subscription.controller.js` | CRUD + `processDue` runner |
| `src/routes/subscription.routes.js` | Router wiring + guards |
| `src/app.js` (modify) | Mount `/api/subscriptions` |
| `vercel.json` (modify) | Daily cron entry |
| `src/templates/subscription-reorder.html` | Reorder email |
| `tests/subscription.controller.test.js` | API + runner tests |

**Frontend (`frontend/`)**

| File | Responsibility |
|---|---|
| `src/Services/api/subscriptionsApi.js` | API calls |
| `src/Pages/Subscriptions/MySubscriptions.jsx` + `.css` | Customer manage page |
| `src/Pages/Subscriptions/MySubscriptions.test.jsx` | Smoke test |
| `src/Components/Subscriptions/SubscribeWidget.jsx` + `.css` | Subscribe & Save on product page |
| `src/Pages/IndividualProductItemPage/IndividualProductItemPage.jsx` (modify) | Mount the widget |
| `src/Pages/Admin/Subscriptions/AdminSubscriptions.jsx` + `.css` | Admin manage page |
| `src/main.jsx` (modify) | Routes `/my-subscriptions`, `/admin/subscriptions` |
| `src/Components/Admin/AdminLayout.jsx` (modify) | Sidebar item |
| Checkout page (modify, located in Task 12) | "Make recurring" toggle |

---

## Phase 1 — Backend

### Task 1: Failing subscription API + runner tests

**Files:**
- Create: `backend/tests/subscription.controller.test.js`

- [ ] **Step 1: Write the failing test file**

```js
/**
 * Tests for Subscription Controller
 * POST   /api/subscriptions             — customer create
 * GET    /api/subscriptions/mine        — customer list
 * PATCH  /api/subscriptions/:id         — customer manage (pause/skip/edit)
 * DELETE /api/subscriptions/:id         — customer cancel
 * GET    /api/subscriptions/process-due — cron runner (Bearer secret)
 */

process.env.CRON_SECRET = 'test-cron-secret';
process.env.SUBSCRIPTION_DISCOUNT_PERCENT = '10';

jest.mock('../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Product = require('../src/models/product.model');
const Order = require('../src/models/order.model');
const Subscription = require('../src/models/subscription.model');

const makeUser = (overrides = {}) => ({
  name: 'Test User',
  email: `user-${Date.now()}-${Math.random()}@example.com`,
  phoneNumber: '12345678',
  address: '123 Test St',
  password: 'Password123*',
  ...overrides,
});

async function loginAs(userData) {
  await request(app).post('/api/auth/signup').send(userData);
  const res = await request(app).post('/api/auth/login').send({ email: userData.email, password: userData.password });
  return res.body.data.accessToken;
}

const ADDRESS = { street: '1 A St', city: 'Town', state: 'X', country: 'MU', zipCode: '000' };

async function makeProduct(adminId, over = {}) {
  return Product.create({
    name: `Dog Food ${Math.random()}`,
    description: 'Premium kibble',
    price: 1000,
    quantity: 100,
    categories: ['food'],
    images: [{ url: 'https://cdn.example.com/p.jpg', publicId: 'products/p' }],
    createdBy: adminId,
    ...over,
  });
}

const createBody = (productId, over = {}) => ({
  items: [{ product: productId.toString(), quantity: 2 }],
  shippingAddress: ADDRESS,
  paymentMethod: 'stripe',
  intervalUnit: 'week',
  intervalCount: 2,
  source: 'product',
  ...over,
});

describe('Subscription Controller', () => {
  let admin;
  let customerToken;
  let customerId;

  beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });

  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    await Subscription.deleteMany({});
    admin = await User.create(makeUser({ email: 'admin@test.com', role: 'admin' }));
    const cu = makeUser();
    customerToken = await loginAs(cu);
    customerId = (await User.findOne({ email: cu.email }))._id;
  });

  afterAll(async () => { await mongoose.connection.close(); });

  describe('POST /api/subscriptions', () => {
    it('creates a subscription and sets nextRunAt in the future (201)', async () => {
      const product = await makeProduct(admin._id);
      const res = await request(app)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(createBody(product._id));
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('active');
      expect(new Date(res.body.data.nextRunAt).getTime()).toBeGreaterThan(Date.now());
      expect(res.body.data.discountPercent).toBe(10);
    });

    it('rejects an interval below the 7-day minimum (400)', async () => {
      const product = await makeProduct(admin._id);
      const res = await request(app)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(createBody(product._id, { intervalUnit: 'day', intervalCount: 3 }));
      expect(res.status).toBe(400);
    });

    it('rejects unauthenticated (401)', async () => {
      const product = await makeProduct(admin._id);
      const res = await request(app).post('/api/subscriptions').send(createBody(product._id));
      expect(res.status).toBe(401);
    });
  });

  describe('customer management', () => {
    it('lists only the caller\'s subscriptions', async () => {
      const product = await makeProduct(admin._id);
      await Subscription.create({
        user: customerId, items: [{ product: product._id, quantity: 1 }], shippingAddress: ADDRESS,
        paymentMethod: 'stripe', intervalUnit: 'week', intervalCount: 2, discountPercent: 10,
        nextRunAt: new Date(Date.now() + 1e9), source: 'product',
      });
      await Subscription.create({
        user: admin._id, items: [{ product: product._id, quantity: 1 }], shippingAddress: ADDRESS,
        paymentMethod: 'stripe', intervalUnit: 'week', intervalCount: 2, discountPercent: 10,
        nextRunAt: new Date(Date.now() + 1e9), source: 'product',
      });
      const res = await request(app).get('/api/subscriptions/mine').set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('pauses and cancels own subscription; 404 on another user\'s', async () => {
      const product = await makeProduct(admin._id);
      const mine = await Subscription.create({
        user: customerId, items: [{ product: product._id, quantity: 1 }], shippingAddress: ADDRESS,
        paymentMethod: 'stripe', intervalUnit: 'week', intervalCount: 2, discountPercent: 10,
        nextRunAt: new Date(Date.now() + 1e9), source: 'product',
      });
      const theirs = await Subscription.create({
        user: admin._id, items: [{ product: product._id, quantity: 1 }], shippingAddress: ADDRESS,
        paymentMethod: 'stripe', intervalUnit: 'week', intervalCount: 2, discountPercent: 10,
        nextRunAt: new Date(Date.now() + 1e9), source: 'product',
      });

      const pause = await request(app).patch(`/api/subscriptions/${mine._id}`)
        .set('Authorization', `Bearer ${customerToken}`).send({ status: 'paused' });
      expect(pause.status).toBe(200);
      expect(pause.body.data.status).toBe('paused');

      const forbidden = await request(app).patch(`/api/subscriptions/${theirs._id}`)
        .set('Authorization', `Bearer ${customerToken}`).send({ status: 'paused' });
      expect(forbidden.status).toBe(404);

      const del = await request(app).delete(`/api/subscriptions/${mine._id}`)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(del.status).toBe(200);
      expect((await Subscription.findById(mine._id)).status).toBe('cancelled');
    });
  });

  describe('GET /api/subscriptions/process-due', () => {
    const past = () => new Date(Date.now() - 1000);

    it('rejects without the cron secret (401)', async () => {
      const res = await request(app).get('/api/subscriptions/process-due');
      expect(res.status).toBe(401);
    });

    it('generates a discounted pending order for a due subscription and advances nextRunAt', async () => {
      const product = await makeProduct(admin._id, { price: 1000, quantity: 100 });
      const sub = await Subscription.create({
        user: customerId, items: [{ product: product._id, quantity: 2 }], shippingAddress: ADDRESS,
        paymentMethod: 'stripe', intervalUnit: 'week', intervalCount: 2, discountPercent: 10,
        nextRunAt: past(), source: 'product',
      });

      const res = await request(app).get('/api/subscriptions/process-due')
        .set('Authorization', 'Bearer test-cron-secret');
      expect(res.status).toBe(200);
      expect(res.body.processed).toBe(1);

      const orders = await Order.find({ user: customerId });
      expect(orders).toHaveLength(1);
      expect(orders[0].totalAmount).toBe(2000);      // 2 × 1000
      expect(orders[0].discount).toBe(200);          // 10% of 2000
      expect(orders[0].source).toBe('subscription');
      expect(orders[0].paymentStatus).toBe('pending');

      const fresh = await Subscription.findById(sub._id);
      expect(fresh.createdOrders).toHaveLength(1);
      expect(new Date(fresh.nextRunAt).getTime()).toBeGreaterThan(Date.now());

      const freshProduct = await Product.findById(product._id);
      expect(freshProduct.quantity).toBe(98);        // stock reserved
    });

    it('skips paused and not-yet-due subscriptions', async () => {
      const product = await makeProduct(admin._id);
      await Subscription.create({
        user: customerId, items: [{ product: product._id, quantity: 1 }], shippingAddress: ADDRESS,
        paymentMethod: 'stripe', intervalUnit: 'week', intervalCount: 2, discountPercent: 10,
        nextRunAt: past(), status: 'paused', source: 'product',
      });
      await Subscription.create({
        user: customerId, items: [{ product: product._id, quantity: 1 }], shippingAddress: ADDRESS,
        paymentMethod: 'stripe', intervalUnit: 'week', intervalCount: 2, discountPercent: 10,
        nextRunAt: new Date(Date.now() + 1e9), source: 'product',
      });
      const res = await request(app).get('/api/subscriptions/process-due')
        .set('Authorization', 'Bearer test-cron-secret');
      expect(res.status).toBe(200);
      expect(res.body.processed).toBe(0);
      expect(await Order.countDocuments()).toBe(0);
    });

    it('skips a due subscription whose product is out of stock but still advances nextRunAt', async () => {
      const product = await makeProduct(admin._id, { quantity: 1 });
      const sub = await Subscription.create({
        user: customerId, items: [{ product: product._id, quantity: 5 }], shippingAddress: ADDRESS,
        paymentMethod: 'stripe', intervalUnit: 'week', intervalCount: 2, discountPercent: 10,
        nextRunAt: past(), source: 'product',
      });
      const res = await request(app).get('/api/subscriptions/process-due')
        .set('Authorization', 'Bearer test-cron-secret');
      expect(res.status).toBe(200);
      expect(res.body.skipped).toBe(1);
      expect(await Order.countDocuments()).toBe(0);
      const fresh = await Subscription.findById(sub._id);
      expect(new Date(fresh.nextRunAt).getTime()).toBeGreaterThan(Date.now());
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run (from `backend/`): `npx jest tests/subscription.controller.test.js --runInBand`
Expected: FAIL — `Cannot find module '../src/models/subscription.model'`.

*(No commit yet — commit lands green in Task 8.)*

---

### Task 2: Subscription model

**Files:**
- Create: `backend/src/models/subscription.model.js`

- [ ] **Step 1: Write the model**

```js
const mongoose = require('mongoose');

const subscriptionItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: [1, 'Quantity cannot be less than 1'] },
}, { _id: false });

const subscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: {
      type: [subscriptionItemSchema],
      validate: { validator: (a) => a.length > 0, message: 'A subscription needs at least one item' },
    },
    shippingAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      country: { type: String, required: true },
      zipCode: { type: String, required: true },
    },
    paymentMethod: {
      type: String,
      enum: ['credit_card', 'paypal', 'stripe'],
      required: true,
    },
    intervalUnit: { type: String, enum: ['day', 'week'], required: true },
    intervalCount: { type: Number, required: true, min: 1 },
    discountPercent: { type: Number, min: 0, max: 100, default: 0 },
    status: { type: String, enum: ['active', 'paused', 'cancelled'], default: 'active' },
    nextRunAt: { type: Date, required: true },
    lastRunAt: { type: Date },
    source: { type: String, enum: ['product', 'checkout'], required: true },
    createdOrders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
  },
  { timestamps: true }
);

subscriptionSchema.index({ user: 1 });
subscriptionSchema.index({ status: 1, nextRunAt: 1 });

module.exports = mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
```

---

### Task 3: Order `source` field + shared `buildOrder` service + refactor `createOrder`

**Files:**
- Modify: `backend/src/models/order.model.js`
- Create: `backend/src/services/order.service.js`
- Modify: `backend/src/controllers/order.controller.js`

- [ ] **Step 1: Add `source` to the Order schema**

In `backend/src/models/order.model.js`, add this field right after the `notes: String,` line (inside the schema, ~line 85):

```js
    source: {
      type: String,
      enum: ['manual', 'subscription'],
      default: 'manual',
    },
```

- [ ] **Step 2: Create the shared order builder**

Create `backend/src/services/order.service.js`:

```js
const Order = require('../models/order.model');
const Product = require('../models/product.model');
const StockMovement = require('../models/stockMovement.model');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Build an order from an explicit item list, reserving stock and logging
 * stock movements, within the provided mongoose session. The CALLER owns the
 * transaction (commit/abort) and any cart clearing / emails.
 *
 * @param {Object}  opts
 * @param {ObjectId} opts.userId
 * @param {Array}   opts.items            [{ product, quantity }]
 * @param {Object}  opts.shippingAddress
 * @param {String}  opts.paymentMethod
 * @param {String}  [opts.notes]
 * @param {Number}  [opts.discountPercent] 0-100, applied to the computed subtotal
 * @param {String}  [opts.discountCode]
 * @param {String}  [opts.source]          'manual' | 'subscription'
 * @param {ClientSession} opts.session
 * @returns {Promise<Order>} the created order document
 */
async function buildOrder({
  userId, items, shippingAddress, paymentMethod, notes = '',
  discountPercent = 0, discountCode = null, source = 'manual', session,
}) {
  let totalItems = 0;
  let totalAmount = 0;
  const orderItems = [];

  for (const item of items) {
    // eslint-disable-next-line no-await-in-loop
    const product = await Product.findById(item.product).session(session);
    if (!product) throw new AppError('Product not found', 404);
    if (!product.isActive) throw new AppError(`Product ${product.name} is not available`, 400);
    if (product.quantity != null && product.quantity > 0 && product.quantity < item.quantity) {
      throw new AppError(`Insufficient stock for ${product.name}`, 400);
    }
    const price = product.effectivePrice;
    totalItems += item.quantity;
    totalAmount += price * item.quantity;
    orderItems.push({ product: product._id, quantity: item.quantity, price });
  }

  const discount = Math.floor(totalAmount * (Number(discountPercent) || 0) / 100);

  const [order] = await Order.create([{
    user: userId,
    items: orderItems,
    totalItems,
    totalAmount,
    discount,
    discountCode,
    shippingAddress,
    paymentMethod,
    notes,
    source,
  }], { session });

  const movements = [];
  for (const item of orderItems) {
    // eslint-disable-next-line no-await-in-loop
    const prod = await Product.findById(item.product).lean().session(session);
    const prevQty = prod
      ? (prod.quantity !== undefined && prod.quantity !== null ? prod.quantity : (prod.stock ?? 0))
      : 0;
    const newQty = Math.max(0, prevQty - item.quantity);
    const stockField = (prod && prod.quantity !== undefined && prod.quantity !== null) ? 'quantity' : 'stock';
    // eslint-disable-next-line no-await-in-loop
    await Product.findByIdAndUpdate(item.product, { $inc: { [stockField]: -item.quantity } }, { session });
    movements.push({
      product: item.product, type: 'order', delta: -item.quantity,
      prevQty, newQty, createdBy: userId, orderId: order._id,
    });
  }
  if (movements.length) await StockMovement.insertMany(movements, { session });

  return order;
}

module.exports = { buildOrder };
```

- [ ] **Step 3: Refactor `createOrder` to delegate to `buildOrder`**

In `backend/src/controllers/order.controller.js`:

(a) Add to the requires block (after line 11 `const InvoiceService = ...`):

```js
const { buildOrder } = require('../services/order.service');
```

(b) Replace the entire body of `createOrder` from the `// Prepare order items` section through the order creation + stock movement loop — i.e. replace lines 28–129 (everything from `// Prepare order items and recalculate totals` down to and including the `if (orderMovements.length > 0) { await StockMovement.insertMany(orderMovements, { session }); }` block) with:

```js
    // Map the cart's discount code to a percent (existing placeholder behavior)
    let discountPercent = 0;
    let discountCode = null;
    if (cart.discountCode === 'SUMMER10') {
      discountPercent = 10;
      discountCode = 'SUMMER10';
    } else if (cart.discountCode) {
      logger.warn(`Invalid discount code: ${cart.discountCode}`);
    }

    // Build the order (validates products, reserves stock, logs movements)
    const order = await buildOrder({
      userId: req.user.id,
      items: cart.items.map((i) => ({ product: i.product, quantity: i.quantity })),
      shippingAddress,
      paymentMethod,
      notes,
      discountPercent,
      discountCode,
      source: 'manual',
      session,
    });
```

(c) The code after that block clears the cart, commits, logs, emails, and responds. It currently references `order[0]` (because the old code used `Order.create([...])`). `buildOrder` returns a single document, so update those references: change `order[0]._id` → `order._id`, `order[0].totalAmount` → `order.totalAmount`, `order[0].items` → `order.items`, and `order[0].toObject()` → `order.toObject()`. Also the `logger.info('Order created', { ... order: order[0]._id, items: logDetails })` line: `logDetails` no longer exists — replace with `order: order._id, items: order.items`.

The resulting tail of the `try` block should read:

```js
    // Clear cart
    cart.items = [];
    cart.discount = 0;
    cart.discountCode = null;
    await cart.save({ session });

    await session.commitTransaction();
    session.endSession();

    logger.info('Order created', { user: req.user.id, order: order._id, items: order.items });

    // Send order confirmation email — non-critical, never fail the order if email fails
    try {
      await sendEmail({
        email: req.user.email,
        subject: 'Order Confirmation',
        template: 'order-confirmation',
        data: {
          name: req.user.name,
          orderId: order._id,
          totalAmount: order.totalAmount,
          items: order.items,
        },
      });
    } catch (emailErr) {
      logger.warn('Order confirmation email failed (non-fatal)', { error: emailErr.message });
    }

    const sanitizedOrder = order.toObject();
    delete sanitizedOrder.paymentDetails;

    res.status(201).json({
      success: true,
      data: sanitizedOrder,
    });
```

- [ ] **Step 4: Run the order regression suite**

Run: `npx jest tests/order.controller.test.js --runInBand`
Expected: PASS — behavior unchanged by the extraction.

---

### Task 4: Subscription validator

**Files:**
- Create: `backend/src/validators/subscription.validator.js`

- [ ] **Step 1: Write the validator**

```js
const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const addressSchema = Joi.object({
  street: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  country: Joi.string().required(),
  zipCode: Joi.string().required(),
});

// Combined minimum interval: 7 days.
const minDaysOk = (unit, count) => (unit === 'day' ? count : count * 7) >= 7;

const validateCreateSubscription = (req, res, next) => {
  const schema = Joi.object({
    items: Joi.array().items(Joi.object({
      product: Joi.string().hex().length(24).required(),
      quantity: Joi.number().integer().min(1).required(),
    })).min(1).required(),
    shippingAddress: addressSchema.required(),
    paymentMethod: Joi.string().valid('credit_card', 'paypal', 'stripe').required(),
    intervalUnit: Joi.string().valid('day', 'week').required(),
    intervalCount: Joi.number().integer().min(1).required(),
    source: Joi.string().valid('product', 'checkout').required(),
  });

  const { error, value } = schema.validate(req.body, { stripUnknown: true });
  if (error) return next(new AppError(error.details[0].message, 400));
  if (!minDaysOk(value.intervalUnit, value.intervalCount)) {
    return next(new AppError('Minimum interval is 7 days', 400));
  }
  req.body = value;
  next();
};

const validateUpdateSubscription = (req, res, next) => {
  const schema = Joi.object({
    status: Joi.string().valid('active', 'paused', 'cancelled'),
    intervalUnit: Joi.string().valid('day', 'week'),
    intervalCount: Joi.number().integer().min(1),
    nextRunAt: Joi.date(),
    items: Joi.array().items(Joi.object({
      product: Joi.string().hex().length(24).required(),
      quantity: Joi.number().integer().min(1).required(),
    })).min(1),
    discountPercent: Joi.number().min(0).max(100),
    action: Joi.string().valid('skip'),
  }).min(1);

  const { error, value } = schema.validate(req.body, { stripUnknown: true });
  if (error) return next(new AppError(error.details[0].message, 400));
  if (value.intervalUnit && value.intervalCount && !minDaysOk(value.intervalUnit, value.intervalCount)) {
    return next(new AppError('Minimum interval is 7 days', 400));
  }
  req.body = value;
  next();
};

module.exports = { validateCreateSubscription, validateUpdateSubscription };
```

---

### Task 5: Cron-secret middleware

**Files:**
- Create: `backend/src/middlewares/cronAuth.js`

- [ ] **Step 1: Write the middleware**

```js
const { AppError } = require('./errorHandler');

// Validates the Vercel Cron Authorization header (Bearer <CRON_SECRET>).
const verifyCronSecret = (req, res, next) => {
  const auth = req.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return next(new AppError('Unauthorized', 401));
  }
  return next();
};

module.exports = { verifyCronSecret };
```

---

### Task 6: Reorder email template

**Files:**
- Create: `backend/src/templates/subscription-reorder.html`

- [ ] **Step 1: Write the Handlebars template**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your VitalPaws reorder is ready</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f4; }
    .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 8px; overflow: hidden; }
    .header { background: #2c7a4b; padding: 32px 24px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 22px; }
    .content { padding: 28px 24px; }
    .content p { margin: 0 0 16px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    td { padding: 8px 0; border-bottom: 1px solid #eee; font-size: 14px; }
    .right { text-align: right; }
    .total { font-weight: bold; }
    .btn { display: inline-block; margin: 12px 0; padding: 12px 28px; background: #2c7a4b; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; }
    .footer { background: #f8f9fa; text-align: center; padding: 20px 24px; font-size: 12px; color: #888; }
    .footer a { color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🐾 Your reorder is ready</h1>
    </div>
    <div class="content">
      <p>Hi <strong>{{name}}</strong>,</p>
      <p>Your recurring order has been prepared. Review it and complete payment to confirm.</p>
      <table>
        {{#each items}}
        <tr>
          <td>{{this.name}} × {{this.quantity}}</td>
          <td class="right">{{this.lineLabel}}</td>
        </tr>
        {{/each}}
        {{#if discountLabel}}
        <tr><td>Subscription discount</td><td class="right">−{{discountLabel}}</td></tr>
        {{/if}}
        <tr><td class="total">Total</td><td class="right total">{{totalLabel}}</td></tr>
      </table>
      <a href="{{payUrl}}" class="btn">Pay now</a>
    </div>
    <div class="footer">
      <p>© 2026 VitalPaws &middot; <a href="{{manageUrl}}">Manage your subscriptions</a></p>
    </div>
  </div>
</body>
</html>
```

---

### Task 7: Subscription controller (CRUD + runner)

**Files:**
- Create: `backend/src/controllers/subscription.controller.js`

- [ ] **Step 1: Write the controller**

```js
const mongoose = require('mongoose');
const Subscription = require('../models/subscription.model');
const Product = require('../models/product.model');
const { buildOrder } = require('../services/order.service');
const { AppError } = require('../middlewares/errorHandler');
const { sendEmail } = require('../utils/email');
const logger = require('../utils/logger');

const DEFAULT_DISCOUNT = parseInt(process.env.SUBSCRIPTION_DISCOUNT_PERCENT || '10', 10);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const addInterval = (date, unit, count) => {
  const d = new Date(date);
  d.setDate(d.getDate() + (unit === 'day' ? count : count * 7));
  return d;
};

const formatMUR = (amount) => `Rs ${Number(amount || 0).toLocaleString('en-US')}`;

// POST /api/subscriptions — customer
exports.createSubscription = async (req, res, next) => {
  try {
    const { items, shippingAddress, paymentMethod, intervalUnit, intervalCount, source } = req.body;
    const nextRunAt = addInterval(new Date(), intervalUnit, intervalCount);
    const subscription = await Subscription.create({
      user: req.user.id,
      items,
      shippingAddress,
      paymentMethod,
      intervalUnit,
      intervalCount,
      discountPercent: DEFAULT_DISCOUNT,
      nextRunAt,
      source,
    });
    return res.status(201).json({ success: true, message: 'Subscription created', data: subscription });
  } catch (error) {
    return next(error);
  }
};

// GET /api/subscriptions/mine — customer
exports.getMySubscriptions = async (req, res, next) => {
  try {
    const subs = await Subscription.find({ user: req.user.id, status: { $ne: 'cancelled' } })
      .sort('-createdAt')
      .populate('items.product', 'name images price');
    return res.status(200).json({ success: true, count: subs.length, data: subs });
  } catch (error) {
    return next(error);
  }
};

// PATCH /api/subscriptions/:id — customer (owner)
exports.updateSubscription = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return next(new AppError('Invalid id', 400));
    const sub = await Subscription.findOne({ _id: req.params.id, user: req.user.id });
    if (!sub) return next(new AppError('Subscription not found', 404));

    const { action, ...fields } = req.body;
    if (action === 'skip') {
      sub.nextRunAt = addInterval(sub.nextRunAt, sub.intervalUnit, sub.intervalCount);
    }
    Object.assign(sub, fields);
    await sub.save();
    return res.status(200).json({ success: true, data: sub });
  } catch (error) {
    return next(error);
  }
};

// DELETE /api/subscriptions/:id — customer (owner), soft cancel
exports.cancelSubscription = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return next(new AppError('Invalid id', 400));
    const sub = await Subscription.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { status: 'cancelled' },
      { new: true }
    );
    if (!sub) return next(new AppError('Subscription not found', 404));
    return res.status(200).json({ success: true, message: 'Subscription cancelled', data: sub });
  } catch (error) {
    return next(error);
  }
};

// GET /api/subscriptions/admin/all — admin
exports.getSubscriptionsAdmin = async (req, res, next) => {
  try {
    const subs = await Subscription.find()
      .sort('-createdAt')
      .populate('user', 'name email')
      .populate('items.product', 'name');
    return res.status(200).json({ success: true, count: subs.length, data: subs });
  } catch (error) {
    return next(error);
  }
};

// PATCH /api/subscriptions/admin/:id — admin
exports.updateSubscriptionAdmin = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return next(new AppError('Invalid id', 400));
    const sub = await Subscription.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!sub) return next(new AppError('Subscription not found', 404));
    return res.status(200).json({ success: true, data: sub });
  } catch (error) {
    return next(error);
  }
};

// GET/POST /api/subscriptions/process-due — cron (Bearer secret)
exports.processDue = async (req, res, next) => {
  try {
    const now = new Date();
    const due = await Subscription.find({ status: 'active', nextRunAt: { $lte: now } });
    let processed = 0;
    let failed = 0;
    let skipped = 0;

    for (const sub of due) {
      // eslint-disable-next-line no-await-in-loop
      const session = await Subscription.startSession();
      session.startTransaction();
      try {
        // Can every item be fulfilled (active + enough stock)?
        let canFulfill = true;
        for (const it of sub.items) {
          // eslint-disable-next-line no-await-in-loop
          const p = await Product.findById(it.product).session(session);
          if (!p || !p.isActive
            || (p.quantity != null && p.quantity > 0 && p.quantity < it.quantity)) {
            canFulfill = false;
            break;
          }
        }

        if (!canFulfill) {
          await session.abortTransaction();
          session.endSession();
          sub.lastRunAt = now;
          sub.nextRunAt = addInterval(sub.nextRunAt, sub.intervalUnit, sub.intervalCount);
          // eslint-disable-next-line no-await-in-loop
          await sub.save();
          skipped += 1;
          continue;
        }

        // eslint-disable-next-line no-await-in-loop
        const order = await buildOrder({
          userId: sub.user,
          items: sub.items.map((i) => ({ product: i.product, quantity: i.quantity })),
          shippingAddress: sub.shippingAddress,
          paymentMethod: sub.paymentMethod,
          discountPercent: sub.discountPercent,
          discountCode: 'SUBSCRIPTION',
          source: 'subscription',
          session,
        });

        sub.createdOrders.push(order._id);
        sub.lastRunAt = now;
        sub.nextRunAt = addInterval(sub.nextRunAt, sub.intervalUnit, sub.intervalCount);
        // eslint-disable-next-line no-await-in-loop
        await sub.save({ session });
        await session.commitTransaction();
        session.endSession();
        processed += 1;

        // Email pay-now link (non-fatal)
        try {
          // eslint-disable-next-line no-await-in-loop
          const populated = await order.populate('items.product', 'name');
          const items = populated.items.map((i) => ({
            name: i.product?.name || 'Item',
            quantity: i.quantity,
            lineLabel: formatMUR(i.price * i.quantity),
          }));
          // eslint-disable-next-line no-await-in-loop
          const user = await mongoose.model('User').findById(sub.user).select('name email');
          // eslint-disable-next-line no-await-in-loop
          await sendEmail({
            to: user.email,
            subject: 'Your VitalPaws reorder is ready',
            template: 'subscription-reorder',
            data: {
              name: user.name,
              items,
              discountLabel: order.discount ? formatMUR(order.discount) : null,
              totalLabel: formatMUR(order.totalAmount - order.discount),
              payUrl: `${FRONTEND_URL}/payment/${order._id}`,
              manageUrl: `${FRONTEND_URL}/my-subscriptions`,
            },
          });
        } catch (mailErr) {
          logger.warn('Reorder email failed (non-fatal)', { subscriptionId: sub._id, error: mailErr.message });
        }
      } catch (err) {
        await session.abortTransaction();
        session.endSession();
        failed += 1;
        logger.warn('Subscription run failed (non-fatal)', { subscriptionId: sub._id, error: err.message });
      }
    }

    logger.info('Subscription run complete', { processed, failed, skipped });
    return res.status(200).json({ success: true, processed, failed, skipped });
  } catch (error) {
    return next(error);
  }
};
```

---

### Task 8: Routes + app.js + vercel.json → green + commit

**Files:**
- Create: `backend/src/routes/subscription.routes.js`
- Modify: `backend/src/app.js`
- Modify: `backend/vercel.json`

- [ ] **Step 1: Write the router**

```js
const express = require('express');
const { isAuthenticated, isAdmin } = require('../middlewares/auth.middleware');
const { verifyCronSecret } = require('../middlewares/cronAuth');
const {
  validateCreateSubscription,
  validateUpdateSubscription,
} = require('../validators/subscription.validator');
const {
  createSubscription,
  getMySubscriptions,
  updateSubscription,
  cancelSubscription,
  getSubscriptionsAdmin,
  updateSubscriptionAdmin,
  processDue,
} = require('../controllers/subscription.controller');

const router = express.Router();

// Cron (Bearer secret, no user auth) — registered before auth-guarded routes
router.get('/process-due', verifyCronSecret, processDue);
router.post('/process-due', verifyCronSecret, processDue);

// Admin
router.get('/admin/all', isAuthenticated, isAdmin, getSubscriptionsAdmin);
router.patch('/admin/:id', isAuthenticated, isAdmin, updateSubscriptionAdmin);

// Customer
router.post('/', isAuthenticated, validateCreateSubscription, createSubscription);
router.get('/mine', isAuthenticated, getMySubscriptions);
router.patch('/:id', isAuthenticated, validateUpdateSubscription, updateSubscription);
router.delete('/:id', isAuthenticated, cancelSubscription);

module.exports = router;
```

- [ ] **Step 2: Wire into app.js**

(a) Add import after `const announcementRoutes = require('./routes/announcement.routes');`:

```js
const subscriptionRoutes = require('./routes/subscription.routes');
```

(b) Add mount after `app.use('/api/announcements', announcementRoutes);`:

```js
app.use('/api/subscriptions', subscriptionRoutes);
```

- [ ] **Step 3: Add the cron to vercel.json**

Read `backend/vercel.json`. Add a top-level `"crons"` array (merge with existing keys — do not remove `builds`/`routes`/etc.):

```json
"crons": [
  { "path": "/api/subscriptions/process-due", "schedule": "0 6 * * *" }
]
```

If a `crons` key already exists, append the entry to it.

- [ ] **Step 4: Run the subscription tests to green**

Run: `npx jest tests/subscription.controller.test.js --runInBand`
Expected: PASS — all tests green.

- [ ] **Step 5: Run regression suites**

Run: `npx jest tests/order.controller.test.js tests/product.controller.test.js --runInBand`
Expected: PASS — no regressions from the `buildOrder` extraction.

- [ ] **Step 6: Commit (inside `backend/`)**

```bash
cd backend
git add src/models/subscription.model.js src/models/order.model.js src/services/order.service.js src/controllers/order.controller.js src/controllers/subscription.controller.js src/validators/subscription.validator.js src/middlewares/cronAuth.js src/routes/subscription.routes.js src/templates/subscription-reorder.html src/app.js vercel.json tests/subscription.controller.test.js
git commit -m "feat: recurring orders (subscriptions) — model, runner, cron, shared order builder, tests"
```

---

## Phase 2 — Frontend

### Task 9: subscriptionsApi service

**Files:**
- Create: `frontend/src/Services/api/subscriptionsApi.js`

- [ ] **Step 1: Write subscriptionsApi.js**

```js
import { api } from "../../core/api/apiClient";

const subscriptionsApi = {
  create: async (payload) => {
    const response = await api.post("/subscriptions", payload);
    return response.data;
  },
  getMine: async () => {
    const response = await api.get("/subscriptions/mine");
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.patch(`/subscriptions/${id}`, data);
    return response.data;
  },
  cancel: async (id) => {
    const response = await api.delete(`/subscriptions/${id}`);
    return response.data;
  },
  // Admin
  getAllAdmin: async () => {
    const response = await api.get("/subscriptions/admin/all");
    return response.data;
  },
  updateAdmin: async (id, data) => {
    const response = await api.patch(`/subscriptions/admin/${id}`, data);
    return response.data;
  },
};

export default subscriptionsApi;
```

- [ ] **Step 2: Commit (inside `frontend/`)**

```bash
cd frontend
git add src/Services/api/subscriptionsApi.js
git commit -m "feat: subscriptionsApi service"
```

---

### Task 10: My Subscriptions page + route + nav entry

**Files:**
- Create: `frontend/src/Pages/Subscriptions/MySubscriptions.jsx`
- Create: `frontend/src/Pages/Subscriptions/MySubscriptions.css`
- Create: `frontend/src/Pages/Subscriptions/MySubscriptions.test.jsx`
- Modify: `frontend/src/main.jsx`

- [ ] **Step 1: Write the failing smoke test**

```jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../../Services/api/subscriptionsApi", () => ({
  default: {
    getMine: vi.fn().mockResolvedValue({
      data: [{
        _id: "s1", status: "active", intervalUnit: "week", intervalCount: 2,
        nextRunAt: new Date(Date.now() + 86400000).toISOString(), discountPercent: 10,
        items: [{ product: { _id: "p1", name: "Dog Food" }, quantity: 2 }],
      }],
    }),
    update: vi.fn().mockResolvedValue({ data: {} }),
    cancel: vi.fn().mockResolvedValue({ data: {} }),
  },
}));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ addToast: vi.fn() }) }));
vi.mock("../../context/CurrencyContext", () => ({ useCurrency: () => ({ formatPrice: (n) => `Rs ${n}` }) }));

import subscriptionsApi from "../../Services/api/subscriptionsApi";
import MySubscriptions from "./MySubscriptions";

describe("MySubscriptions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the customer's subscriptions", async () => {
    render(<MySubscriptions />);
    await waitFor(() => expect(screen.getByText("Dog Food")).toBeInTheDocument());
    expect(screen.getByText(/every 2 week/i)).toBeInTheDocument();
  });

  it("pauses a subscription", async () => {
    render(<MySubscriptions />);
    await waitFor(() => expect(screen.getByText("Dog Food")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /pause/i }));
    await waitFor(() => expect(subscriptionsApi.update).toHaveBeenCalledWith("s1", { status: "paused" }));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run (from `frontend/`): `npx vitest run src/Pages/Subscriptions/MySubscriptions.test.jsx`
Expected: FAIL — cannot resolve `./MySubscriptions`.

- [ ] **Step 3: Write MySubscriptions.jsx**

```jsx
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FiPause, FiPlay, FiSkipForward, FiX } from "react-icons/fi";
import subscriptionsApi from "../../Services/api/subscriptionsApi";
import { useToast } from "../../context/ToastContext";
import "./MySubscriptions.css";

const intervalLabel = (unit, count) => `Every ${count} ${unit}${count > 1 ? "s" : ""}`;

const MySubscriptions = () => {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => { fetchSubs(); }, []);

  const fetchSubs = async () => {
    try {
      setLoading(true);
      const res = await subscriptionsApi.getMine();
      setSubs(res.data || []);
    } catch {
      addToast("Failed to load subscriptions", "error");
    } finally {
      setLoading(false);
    }
  };

  const act = async (id, data, msg) => {
    try {
      await subscriptionsApi.update(id, data);
      addToast(msg, "success");
      fetchSubs();
    } catch {
      addToast("Action failed", "error");
    }
  };

  const cancel = async (id) => {
    try {
      await subscriptionsApi.cancel(id);
      addToast("Subscription cancelled", "success");
      fetchSubs();
    } catch {
      addToast("Failed to cancel", "error");
    }
  };

  return (
    <motion.div
      className="ms-page"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h1 className="ms-title">My Subscriptions</h1>
      {loading && <p className="ms-empty">Loading…</p>}
      {!loading && subs.length === 0 && (
        <p className="ms-empty">You have no active subscriptions yet.</p>
      )}

      <div className="ms-list">
        {subs.map((s) => (
          <div key={s._id} className={`ms-card ms-${s.status}`}>
            <div className="ms-card-head">
              <span className={`ms-status ms-status-${s.status}`}>{s.status}</span>
              <span className="ms-interval">{intervalLabel(s.intervalUnit, s.intervalCount)}</span>
            </div>
            <ul className="ms-items">
              {s.items.map((it, i) => (
                <li key={i}>
                  {(it.product?.name) || "Item"} × {it.quantity}
                </li>
              ))}
            </ul>
            <p className="ms-next">
              Next order: {s.nextRunAt ? new Date(s.nextRunAt).toLocaleDateString() : "—"}
              {s.discountPercent ? ` · ${s.discountPercent}% off` : ""}
            </p>
            <div className="ms-actions">
              {s.status === "active" ? (
                <button onClick={() => act(s._id, { status: "paused" }, "Paused")}>
                  <FiPause /> Pause
                </button>
              ) : s.status === "paused" ? (
                <button onClick={() => act(s._id, { status: "active" }, "Resumed")}>
                  <FiPlay /> Resume
                </button>
              ) : null}
              <button onClick={() => act(s._id, { action: "skip" }, "Skipped next order")}>
                <FiSkipForward /> Skip next
              </button>
              <button className="ms-cancel" onClick={() => cancel(s._id)}>
                <FiX /> Cancel
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default MySubscriptions;
```

- [ ] **Step 4: Write MySubscriptions.css**

```css
.ms-page { max-width: 820px; margin: 0 auto; padding: 32px 20px; }
.ms-title { font-size: 26px; margin-bottom: 20px; }
.ms-empty { color: #6f6e68; }
.ms-list { display: flex; flex-direction: column; gap: 16px; }
.ms-card { border: 1px solid #e8e4dc; border-radius: 12px; padding: 16px 18px; background: #fff; }
.ms-card.ms-paused { opacity: 0.7; }
.ms-card.ms-cancelled { display: none; }
.ms-card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.ms-status { text-transform: capitalize; font-size: 12px; font-weight: 600; padding: 2px 10px; border-radius: 8px; }
.ms-status-active { background: #e1f5ee; color: #1d9e75; }
.ms-status-paused { background: #faeeda; color: #ba7517; }
.ms-interval { font-weight: 600; color: #2c2c2a; }
.ms-items { margin: 0 0 8px; padding-left: 18px; color: #444; }
.ms-next { font-size: 13px; color: #6f6e68; margin: 0 0 12px; }
.ms-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.ms-actions button {
  display: inline-flex; align-items: center; gap: 5px;
  border: 1px solid #d8d4cc; background: #faf9f6; border-radius: 8px;
  padding: 6px 12px; font-size: 13px; cursor: pointer;
}
.ms-actions .ms-cancel { color: #c0392b; border-color: #e7c3bd; }
```

- [ ] **Step 5: Run the test to green**

Run: `npx vitest run src/Pages/Subscriptions/MySubscriptions.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Add the route in main.jsx**

In `frontend/src/main.jsx`:

(a) Add the import with the other page imports:

```jsx
import MySubscriptions from "./Pages/Subscriptions/MySubscriptions";
```

(b) The customer page must be behind auth. Find an existing `ProtectedRoute`-wrapped route (e.g. the `my-orders` / `profile` route) and add a sibling route using the SAME wrapper pattern that file uses. Identify the exact pattern with:

`grep -n "my-orders\|ProtectedRoute\|profile" src/main.jsx`

Then add a route with path `my-subscriptions` rendering `<MySubscriptions />`, wrapped exactly like the neighboring protected route found above.

- [ ] **Step 7: Add a nav entry point**

Find where the navbar links to "My Orders" / "Profile" for logged-in customers:

`grep -rn "my-orders\|My Orders\|Profile" src/Components/NavigationBar`

Add a "My Subscriptions" link to `/my-subscriptions` alongside it, matching the existing link markup in that file.

- [ ] **Step 8: Build**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 9: Commit (inside `frontend/`)**

```bash
cd frontend
git add src/Pages/Subscriptions/ src/main.jsx src/Components/NavigationBar
git commit -m "feat: My Subscriptions page + route + nav entry"
```

---

### Task 11: Subscribe & Save widget on the product page

**Files:**
- Create: `frontend/src/Components/Subscriptions/SubscribeWidget.jsx`
- Create: `frontend/src/Components/Subscriptions/SubscribeWidget.css`
- Modify: `frontend/src/Pages/IndividualProductItemPage/IndividualProductItemPage.jsx`

- [ ] **Step 1: Write SubscribeWidget.jsx**

```jsx
import { useState } from "react";
import { FiRepeat } from "react-icons/fi";
import subscriptionsApi from "../../Services/api/subscriptionsApi";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import "./SubscribeWidget.css";

const DISCOUNT = Number(import.meta.env.VITE_SUBSCRIPTION_DISCOUNT_PERCENT) || 10;

const SubscribeWidget = ({ product, quantity = 1 }) => {
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState("week");
  const [count, setCount] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();
  const { addToast } = useToast();

  const minOk = (unit === "day" ? count : count * 7) >= 7;

  const subscribe = async () => {
    if (!user) {
      addToast("Please log in to subscribe", "error");
      return;
    }
    if (!minOk) {
      addToast("Minimum interval is 7 days", "error");
      return;
    }
    const addr = user.address
      ? { street: user.address, city: "-", state: "-", country: "-", zipCode: "-" }
      : { street: "-", city: "-", state: "-", country: "-", zipCode: "-" };
    try {
      setSubmitting(true);
      await subscriptionsApi.create({
        items: [{ product: product._id, quantity }],
        shippingAddress: addr,
        paymentMethod: "stripe",
        intervalUnit: unit,
        intervalCount: Number(count),
        source: "product",
      });
      addToast("Subscribed! Manage it under My Subscriptions.", "success");
      setOpen(false);
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to subscribe", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sw-box">
      <button className="sw-toggle" onClick={() => setOpen((o) => !o)}>
        <FiRepeat /> Subscribe &amp; Save {DISCOUNT}%
      </button>
      {open && (
        <div className="sw-panel">
          <p className="sw-line">Auto-reorder this item and save {DISCOUNT}% every time.</p>
          <div className="sw-row">
            <span>Every</span>
            <input
              type="number"
              min="1"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="sw-count"
            />
            <select value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="day">day(s)</option>
              <option value="week">week(s)</option>
            </select>
          </div>
          {!minOk && <p className="sw-warn">Minimum interval is 7 days.</p>}
          <button className="sw-confirm" disabled={submitting || !minOk} onClick={subscribe}>
            {submitting ? "Subscribing…" : "Subscribe"}
          </button>
        </div>
      )}
    </div>
  );
};

export default SubscribeWidget;
```

- [ ] **Step 2: Write SubscribeWidget.css**

```css
.sw-box { margin: 14px 0; }
.sw-toggle {
  display: inline-flex; align-items: center; gap: 8px;
  border: 1px dashed #1d9e75; background: #f0f8f3; color: #1d7a5a;
  border-radius: 10px; padding: 10px 16px; font-weight: 600; cursor: pointer;
}
.sw-panel {
  margin-top: 10px; border: 1px solid #e8e4dc; border-radius: 10px;
  padding: 14px; background: #fff;
}
.sw-line { margin: 0 0 10px; font-size: 14px; color: #444; }
.sw-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.sw-count { width: 64px; padding: 6px 8px; border: 1px solid #d8d4cc; border-radius: 6px; }
.sw-row select { padding: 6px 8px; border: 1px solid #d8d4cc; border-radius: 6px; }
.sw-warn { color: #c0392b; font-size: 12px; margin: 0 0 8px; }
.sw-confirm {
  background: #1d9e75; color: #fff; border: none; border-radius: 8px;
  padding: 8px 18px; font-weight: 600; cursor: pointer;
}
.sw-confirm:disabled { opacity: 0.6; cursor: not-allowed; }
```

- [ ] **Step 3: Mount the widget on the product page**

Identify the add-to-cart area and the product object + selected quantity variable names:

`grep -n "addToCart\|quantity\|product\b\|Add to Cart\|export default" src/Pages/IndividualProductItemPage/IndividualProductItemPage.jsx`

Add the import at the top:

```jsx
import SubscribeWidget from "../../Components/Subscriptions/SubscribeWidget";
```

Render it just below the Add-to-Cart button, passing the page's product object and the selected quantity (use the actual variable names found above):

```jsx
<SubscribeWidget product={product} quantity={quantity} />
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 5: Commit (inside `frontend/`)**

```bash
cd frontend
git add src/Components/Subscriptions/ src/Pages/IndividualProductItemPage/IndividualProductItemPage.jsx
git commit -m "feat: Subscribe & Save widget on the product page"
```

---

### Task 12: "Make this order recurring" toggle at checkout

**Files:**
- Modify: the checkout page (locate in Step 1)

- [ ] **Step 1: Locate the checkout page and its successful-order handler**

```
grep -rln "createOrder\|ordersApi\|place order\|Checkout\|shippingAddress" src/Pages
```

Identify the checkout component, the cart items it has access to, the `shippingAddress` + `paymentMethod` it submits, and the point right after the order is created successfully (before redirecting to payment).

- [ ] **Step 2: Add the toggle state + checkbox**

Add near the checkout component's other `useState`:

```jsx
const [makeRecurring, setMakeRecurring] = useState(false);
const [recurUnit, setRecurUnit] = useState("week");
const [recurCount, setRecurCount] = useState(4);
```

Add the import:

```jsx
import subscriptionsApi from "../../Services/api/subscriptionsApi";
```

Render this near the order summary / place-order button (adapt class names to the page):

```jsx
<label style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "10px" }}>
  <input
    type="checkbox"
    checked={makeRecurring}
    onChange={(e) => setMakeRecurring(e.target.checked)}
  />
  <span>Make this a recurring order</span>
</label>
{makeRecurring && (
  <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "6px" }}>
    <span>Every</span>
    <input type="number" min="1" value={recurCount}
      onChange={(e) => setRecurCount(e.target.value)} style={{ width: "64px" }} />
    <select value={recurUnit} onChange={(e) => setRecurUnit(e.target.value)}>
      <option value="day">day(s)</option>
      <option value="week">week(s)</option>
    </select>
  </div>
)}
```

- [ ] **Step 3: Create the subscription after a successful checkout**

Right after the order is successfully created (using the same `shippingAddress`, `paymentMethod`, and cart items the checkout already built), add:

```jsx
if (makeRecurring) {
  try {
    await subscriptionsApi.create({
      items: cartItems.map((i) => ({ product: i.product?._id || i.product, quantity: i.quantity })),
      shippingAddress,
      paymentMethod,
      intervalUnit: recurUnit,
      intervalCount: Number(recurCount),
      source: "checkout",
    });
  } catch {
    // non-fatal: the order still succeeded
  }
}
```

(Adapt `cartItems`, `shippingAddress`, `paymentMethod` to the checkout page's actual variable names from Step 1.)

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 5: Commit (inside `frontend/`)**

```bash
cd frontend
git add -A
git commit -m "feat: make-this-order-recurring toggle at checkout"
```

---

### Task 13: Admin Subscriptions page + route + sidebar

**Files:**
- Create: `frontend/src/Pages/Admin/Subscriptions/AdminSubscriptions.jsx`
- Create: `frontend/src/Pages/Admin/Subscriptions/AdminSubscriptions.css`
- Modify: `frontend/src/main.jsx`
- Modify: `frontend/src/Components/Admin/AdminLayout.jsx`

- [ ] **Step 1: Write AdminSubscriptions.jsx**

```jsx
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { FiRepeat, FiPlay, FiPause, FiXCircle } from "react-icons/fi";
import DataTable from "../../../Components/Admin/DataTable/DataTable";
import subscriptionsApi from "../../../Services/api/subscriptionsApi";
import { useToast } from "../../../context/ToastContext";
import "../Tips/AdminTips.css";
import "./AdminSubscriptions.css";

const AdminSubscriptions = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const res = await subscriptionsApi.getAllAdmin();
      setItems(res.data || []);
    } catch {
      addToast("Failed to load subscriptions", "error");
    } finally {
      setLoading(false);
    }
  };

  const setStatus = async (item, status) => {
    try {
      await subscriptionsApi.updateAdmin(item._id, { status });
      addToast(`Subscription ${status}`, "success");
      fetchAll();
    } catch {
      addToast("Update failed", "error");
    }
  };

  const stats = useMemo(() => ({
    total: items.length,
    active: items.filter((s) => s.status === "active").length,
    paused: items.filter((s) => s.status === "paused").length,
  }), [items]);

  const columns = [
    {
      header: "Customer",
      accessor: "user",
      render: (value) => value?.name || "—",
    },
    {
      header: "Items",
      accessor: "items",
      sortable: false,
      render: (value) => <span className="at-pill">{Array.isArray(value) ? value.length : 0}</span>,
    },
    {
      header: "Interval",
      accessor: "intervalCount",
      sortable: false,
      render: (value, item) => `${value} ${item.intervalUnit}${value > 1 ? "s" : ""}`,
    },
    {
      header: "Next run",
      accessor: "nextRunAt",
      render: (value) => (value ? new Date(value).toLocaleDateString() : "—"),
    },
    {
      header: "Orders",
      accessor: "createdOrders",
      sortable: false,
      render: (value) => (Array.isArray(value) ? value.length : 0),
    },
    {
      header: "Status",
      accessor: "status",
      render: (value, item) => (
        <span className="aps-actions">
          <span className={`at-status ${value === "active" ? "published" : "draft"}`}>{value}</span>
          {value === "active" && (
            <button title="Pause" onClick={(e) => { e.stopPropagation(); setStatus(item, "paused"); }}><FiPause /></button>
          )}
          {value === "paused" && (
            <button title="Resume" onClick={(e) => { e.stopPropagation(); setStatus(item, "active"); }}><FiPlay /></button>
          )}
          {value !== "cancelled" && (
            <button title="Cancel" onClick={(e) => { e.stopPropagation(); setStatus(item, "cancelled"); }}><FiXCircle /></button>
          )}
        </span>
      ),
    },
  ];

  return (
    <motion.div
      className="admin-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Subscriptions</h1>
          <p className="admin-page-subtitle">Recurring orders across all customers.</p>
        </div>
      </div>

      {!loading && (
        <div className="at-stats">
          <div className="at-stat-card"><FiRepeat size={18} /><div><p className="at-stat-value">{stats.total}</p><p className="at-stat-label">Total</p></div></div>
          <div className="at-stat-card"><FiPlay size={18} /><div><p className="at-stat-value">{stats.active}</p><p className="at-stat-label">Active</p></div></div>
          <div className="at-stat-card"><FiPause size={18} /><div><p className="at-stat-value">{stats.paused}</p><p className="at-stat-label">Paused</p></div></div>
        </div>
      )}

      <DataTable data={items} columns={columns} loading={loading} />
    </motion.div>
  );
};

export default AdminSubscriptions;
```

- [ ] **Step 2: Write AdminSubscriptions.css**

```css
.aps-actions { display: inline-flex; align-items: center; gap: 6px; }
.aps-actions button {
  border: 1px solid #d8d4cc; background: #faf9f6; border-radius: 6px;
  padding: 3px 7px; cursor: pointer; display: inline-flex; align-items: center;
}
```

- [ ] **Step 3: Add the route in main.jsx**

(a) Import with the other admin imports:

```jsx
import AdminSubscriptions from "./Pages/Admin/Subscriptions/AdminSubscriptions";
```

(b) Add the admin route after the `announcements` route added in the Sale Announcements work (or after `feedback` if not present):

```jsx
      {
        path: "subscriptions",
        element: <AdminSubscriptions />,
      },
```

- [ ] **Step 4: Add the sidebar item in AdminLayout.jsx**

Add `FiRepeat` to the `react-icons/fi` import block, then add this `menuItems` entry after the "Announcements" item (or after "Orders" if Announcements isn't present):

```jsx
    {
      title: "Subscriptions",
      path: "/admin/subscriptions",
      icon: <FiRepeat className="menu-icon" />,
    },
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 6: Commit (inside `frontend/`)**

```bash
cd frontend
git add src/Pages/Admin/Subscriptions/ src/main.jsx src/Components/Admin/AdminLayout.jsx
git commit -m "feat: admin subscriptions page + route + sidebar"
```

---

### Task 14: Final verification

- [ ] **Step 1: Frontend tests + build**

Run (from `frontend/`):
```bash
npx vitest run
npm run build
```
Expected: all tests pass, build clean.

- [ ] **Step 2: Backend subscription + regression suites**

Run (from `backend/`):
```bash
npx jest tests/subscription.controller.test.js tests/order.controller.test.js tests/product.controller.test.js --runInBand
```
Expected: all pass.

- [ ] **Step 3: Live smoke (optional, needs backend dev server + CRON_SECRET set)**

```bash
# customer creates a subscription (replace TOKEN + PRODUCT_ID)
curl -X POST http://localhost:5000/api/subscriptions \
  -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"items":[{"product":"PRODUCT_ID","quantity":1}],"shippingAddress":{"street":"a","city":"b","state":"c","country":"d","zipCode":"e"},"paymentMethod":"stripe","intervalUnit":"week","intervalCount":1,"source":"product"}'
# trigger the runner
curl http://localhost:5000/api/subscriptions/process-due -H "Authorization: Bearer $CRON_SECRET"
```

---

## Self-Review

**Spec coverage:**
- Subscribe per-product + whole-cart → Task 11 (widget, `source: product`), Task 12 (checkout toggle, `source: checkout`) ✅
- Custom interval + min guard → model (Task 2), validator (Task 4), widget/checkout (11/12) ✅
- Auto-create pending order + discount + reserve stock → `buildOrder` (Task 3) + runner (Task 7) ✅
- Vercel Cron + secured endpoint → Task 5 (middleware), Task 8 (routes + vercel.json) ✅
- Subscription discount via env, snapshot per sub → controller `DEFAULT_DISCOUNT` (Task 7), model field (Task 2) ✅
- Customer manage (pause/resume/skip/cancel) → Task 7 endpoints + Task 10 page ✅
- Admin manage → Task 7 admin endpoints + Task 13 page ✅
- Reorder email → Task 6 template + Task 7 send ✅
- Order `source` tag → Task 3 Step 1 ✅
- Out-of-stock skip + advance nextRunAt → Task 7 runner + Task 1 test ✅
- Tests (create/min-interval/ownership/runner/skip/cron-guard/regression) → Task 1 + Task 8 ✅

**Placeholder scan:** Tasks 10 (Steps 6–7), 11 (Step 3), 12, 13 (Step 3) adapt to existing-file variable/route names via a grep-first step — code blocks are complete; only surrounding identifiers are matched to the real files. Intentional (editing existing code), not missing logic.

**Type/name consistency:** `buildOrder({ ..., discountPercent, discountCode, source, session })` defined in Task 3, called identically in Task 3 (createOrder) and Task 7 (runner) ✅. `addInterval(date, unit, count)` defined and used within Task 7 ✅. `Subscription` fields (`intervalUnit/intervalCount/nextRunAt/discountPercent/status/source/createdOrders`) consistent across model (T2), validator (T4), controller (T7), tests (T1), frontend (T9–T13) ✅. Endpoint paths `/api/subscriptions[...]` consistent across routes (T8), api (T9), tests (T1) ✅. Cron auth `Authorization: Bearer ${CRON_SECRET}` consistent across middleware (T5), routes (T8), tests (T1) ✅.
