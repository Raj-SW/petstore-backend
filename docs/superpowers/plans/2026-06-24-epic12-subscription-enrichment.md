# Epic 12 — Subscription Enrichment & Detail Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Epic 12 by adding the shared server-side `enrichSubscription` (per-cycle total, savings, cadence, next-run-in-days, order history) and wiring the enriched admin + customer subscription detail views that the approved spec requires.

**Architecture:** A new `enrichSubscription(sub)` function in `subscription.analytics.service.js` computes variant- and sale-aware financials from fully-populated subscriptions (using the product `effectivePrice` virtual and `priceForVariant()` method). The existing list controllers (`getMySubscriptions`, `getSubscriptionsAdmin`) map through it, two new enriched single-detail endpoints (`GET /mine/:id`, `GET /admin/:id`) are added, and the product-analytics overview gains a subscriptions summary block. The frontend then surfaces the enriched fields in the admin detail drawer (plus status / due-soon filters) and in the customer My Subscriptions cards.

**Tech Stack:** Backend — Node/Express, Mongoose, Jest (run suites individually). Frontend — React (Vite), Vitest + React Testing Library, `useCurrency().formatPrice` for money, existing `DataTable` + admin CSS classes.

---

## Why this is "FE + a backend prerequisite"

Already shipped (verify before starting — do **not** rebuild):
- Admin demand forecast w/ horizon 30/60/90 + restock table — `frontend/src/Pages/Admin/Subscriptions/AdminSubscriptions.jsx`.
- Admin subscription list + pause/resume/cancel + view-items modal — same file.
- Product-list "Subscribed (N)" badge — `frontend/src/Pages/Admin/Products/AdminProducts.jsx:237` (consumes `getProductCoverage`).
- Basic My Subscriptions page (items, cadence, next run, manage actions) — `frontend/src/Pages/Subscriptions/MySubscriptions.jsx`.
- Analytics service: `runsInHorizon`, `predictDemand`, `productCoverage` — `backend/src/services/subscription.analytics.service.js`.

Missing (this plan):
- `enrichSubscription` (service) — **never built**, though the spec mandates it as the shared DRY source for financials.
- Enriched list responses + two enriched single-detail endpoints.
- Product-analytics overview subscriptions block.
- Admin detail drawer showing financials + order history; admin list status / due-soon filters.
- My Subscriptions financials (per-cycle total, savings), item image, order history.

**Pricing facts the implementation relies on (already in code):**
- `product.effectivePrice` — virtual, sale-aware (`product.model.js:196`).
- `product.priceForVariant(variantId)` — method, returns sale-aware variant price (`product.model.js:216`).
- These are Mongoose virtuals/methods — they do **not** survive `.lean()`. Enriched paths must populate the full product document (no field projection) and operate on the live doc before serialising.
- Order fields for history: `totalAmount`, `discount`, `status`, `createdAt` (`order.model.js`).

---

## File Structure

**Backend**
- **Modify** `src/services/subscription.analytics.service.js` — add + export `enrichSubscription(sub)`.
- **Create** `tests/subscription.enrich.test.js` — unit tests for `enrichSubscription`.
- **Modify** `src/controllers/subscription.controller.js` — import `enrichSubscription`; enrich `getMySubscriptions` + `getSubscriptionsAdmin`; add `getMySubscriptionDetail` + `getSubscriptionDetailAdmin`.
- **Modify** `src/routes/subscription.routes.js` — register `GET /admin/:id` and `GET /mine/:id`.
- **Create** `tests/subscription.detail.test.js` — endpoint tests for the two new GETs + enriched list shape.
- **Modify** `src/controllers/product.controller.js` — add `subscriptions` summary block to `getProductAnalytics`.
- **Create** `tests/product.analytics.subscriptions.test.js` — asserts the summary block.

**Frontend**
- **Modify** `src/Services/api/subscriptionsApi.js` — add `getMineOne(id)` + `getAdminOne(id)`.
- **Modify** `src/Pages/Admin/Subscriptions/AdminSubscriptions.jsx` — enriched detail drawer (fetch on open) + status / due-soon filters.
- **Modify** `src/Pages/Admin/Subscriptions/AdminSubscriptions.css` — drawer + filter styles.
- **Create** `src/Pages/Admin/Subscriptions/AdminSubscriptions.test.jsx` — enriched drawer + filters render.
- **Modify** `src/Pages/Subscriptions/MySubscriptions.jsx` — financials, item image, order history.
- **Modify** `src/Pages/Subscriptions/MySubscriptions.test.jsx` — assert new fields.
- **Modify** `src/Pages/Subscriptions/MySubscriptions.css` — financial + history styles.

**Memory**
- **Modify** `backend/.claude/memory/STATUS.md` and `backend/.claude/memory/SPECS-INDEX.md`.

---

## Enriched object contract (locked)

`enrichSubscription(sub)` returns the subscription as a plain object plus:
- `perCycleTotal` (integer Rs) — Σ `unitEffectivePrice × quantity`, then `× (1 − discountPercent/100)`, rounded. `unitEffectivePrice` = `product.priceForVariant(variantId)` when the item has a `variantId`, else `product.effectivePrice` (falls back to `product.price`).
- `savings` (integer Rs) — rounded pre-discount cycle subtotal minus `perCycleTotal`.
- `cadenceLabel` (string) — e.g. `"every 2 weeks"`, `"every 1 day"`.
- `nextRunInDays` (integer ≥ 0, or `null`) — whole days from now to `nextRunAt`.
- `orderHistory` (array) — from populated `createdOrders`, each `{ id, date, total, status }` where `total = totalAmount − discount`.

Items whose `product` is unpopulated (still an ObjectId/string) are skipped in the price sum. Frontend formats money with `useCurrency().formatPrice` (admin uses a local `Rs ${n}` helper to match existing admin pages).

---

# PART A — BACKEND (prerequisite)

### Task 1: `enrichSubscription` in the analytics service

**Files:**
- Modify: `backend/src/services/subscription.analytics.service.js`
- Test: `backend/tests/subscription.enrich.test.js`

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/subscription.enrich.test.js
const { enrichSubscription } = require('../src/services/subscription.analytics.service');

// Minimal product doubles exposing the same surface enrichSubscription uses.
function product({ effectivePrice, variantPrice }) {
  return {
    price: effectivePrice,
    effectivePrice,
    priceForVariant: () => variantPrice,
  };
}

describe('enrichSubscription', () => {
  const DAY = 24 * 60 * 60 * 1000;

  test('computes perCycleTotal and savings with discount (no variant)', () => {
    const sub = {
      intervalUnit: 'week', intervalCount: 2, discountPercent: 10,
      nextRunAt: new Date(Date.now() + 3 * DAY),
      items: [{ product: product({ effectivePrice: 300 }), quantity: 2 }],
      createdOrders: [],
    };
    const out = enrichSubscription(sub);
    expect(out.perCycleTotal).toBe(540); // 600 * 0.9
    expect(out.savings).toBe(60);
    expect(out.cadenceLabel).toBe('every 2 weeks');
    expect(out.nextRunInDays).toBe(3);
  });

  test('uses priceForVariant when item has a variantId', () => {
    const sub = {
      intervalUnit: 'day', intervalCount: 1, discountPercent: 0,
      nextRunAt: new Date(Date.now() + 1 * DAY),
      items: [{ product: product({ effectivePrice: 999, variantPrice: 100 }), variantId: 'v1', quantity: 3 }],
      createdOrders: [],
    };
    const out = enrichSubscription(sub);
    expect(out.perCycleTotal).toBe(300); // 100 * 3, no discount
    expect(out.savings).toBe(0);
    expect(out.cadenceLabel).toBe('every 1 day');
  });

  test('maps order history to {id,date,total,status}', () => {
    const when = new Date('2026-06-01T00:00:00Z');
    const sub = {
      intervalUnit: 'week', intervalCount: 1, discountPercent: 0,
      nextRunAt: null,
      items: [],
      createdOrders: [{ _id: 'o1', totalAmount: 500, discount: 50, status: 'paid', createdAt: when }],
    };
    const out = enrichSubscription(sub);
    expect(out.nextRunInDays).toBeNull();
    expect(out.orderHistory).toEqual([{ id: 'o1', date: when, total: 450, status: 'paid' }]);
  });

  test('skips unpopulated product items in the price sum', () => {
    const sub = {
      intervalUnit: 'day', intervalCount: 7, discountPercent: 10,
      nextRunAt: new Date(Date.now() + 7 * DAY),
      items: [{ product: 'someObjectId', quantity: 5 }],
      createdOrders: [],
    };
    const out = enrichSubscription(sub);
    expect(out.perCycleTotal).toBe(0);
    expect(out.savings).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/subscription.enrich.test.js`
Expected: FAIL — `enrichSubscription is not a function`.

- [ ] **Step 3: Implement `enrichSubscription`**

In `backend/src/services/subscription.analytics.service.js`, add this function above `module.exports` (it reuses the existing `DAY_MS` constant at the top of the file):

```js
/**
 * Enrich a subscription with computed financials + metadata.
 * `sub.items[].product` must be a populated full product document (so the
 * effectivePrice virtual / priceForVariant method work). `sub.createdOrders`
 * may be populated with { totalAmount, discount, status, createdAt }.
 */
function enrichSubscription(sub) {
  const base = typeof sub.toObject === 'function' ? sub.toObject({ virtuals: true }) : { ...sub };
  const discountPct = Number(sub.discountPercent) || 0;

  let preDiscountTotal = 0;
  for (const it of sub.items || []) {
    const p = it.product;
    if (!p || typeof p === 'string') continue; // unpopulated → skip
    let unit;
    if (it.variantId && typeof p.priceForVariant === 'function') {
      unit = p.priceForVariant(it.variantId);
    } else {
      unit = p.effectivePrice != null ? p.effectivePrice : p.price;
    }
    preDiscountTotal += (Number(unit) || 0) * (Number(it.quantity) || 0);
  }

  const preRounded = Math.round(preDiscountTotal);
  const perCycleTotal = Math.round(preDiscountTotal * (1 - discountPct / 100));
  const savings = preRounded - perCycleTotal;

  const count = Number(sub.intervalCount) || 1;
  const unitLabel = sub.intervalUnit === 'week' ? 'week' : 'day';
  const cadenceLabel = `every ${count} ${unitLabel}${count > 1 ? 's' : ''}`;

  let nextRunInDays = null;
  if (sub.nextRunAt) {
    nextRunInDays = Math.max(0, Math.ceil((new Date(sub.nextRunAt).getTime() - Date.now()) / DAY_MS));
  }

  const orderHistory = (Array.isArray(sub.createdOrders) ? sub.createdOrders : [])
    .filter((o) => o && typeof o === 'object' && o.totalAmount != null)
    .map((o) => ({
      id: o._id,
      date: o.createdAt,
      total: (Number(o.totalAmount) || 0) - (Number(o.discount) || 0),
      status: o.status,
    }));

  return { ...base, perCycleTotal, savings, cadenceLabel, nextRunInDays, orderHistory };
}
```

Then update the exports line at the bottom of the file:

```js
module.exports = { runsInHorizon, predictDemand, productCoverage, enrichSubscription };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest tests/subscription.enrich.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd backend
git add src/services/subscription.analytics.service.js tests/subscription.enrich.test.js
git commit -m "feat(subscriptions): add enrichSubscription (per-cycle total, savings, cadence, history)"
```

---

### Task 2: Enrich list controllers + add detail endpoints

**Files:**
- Modify: `backend/src/controllers/subscription.controller.js`
- Modify: `backend/src/routes/subscription.routes.js`
- Test: `backend/tests/subscription.detail.test.js`

- [ ] **Step 1: Write the failing test**

> **Harness:** Mirror the repo pattern (see `tests/storeSettings.test.js` / `tests/subscription.controller.test.js`): global `process.env.MONGODB_URI` provided by `tests/setup.js`, `jest.mock('../src/utils/email')`, tokens via `user.generateAuthToken()`. Do **not** use `MongoMemoryServer` or manual `jwt.sign` — they don't match this codebase.

```js
// backend/tests/subscription.detail.test.js
jest.mock('../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Product = require('../src/models/product.model');
const Subscription = require('../src/models/subscription.model');

const ADDRESS = { street: '1 A St', city: 'Town', state: 'X', country: 'MU', zipCode: '000' };
const uniqEmail = (p) => `${p}-${Date.now()}-${Math.random()}@x.com`;

describe('Subscription enriched detail (Epic 12)', () => {
  let admin, adminToken, customer, customerToken, product, sub;

  beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });
  afterAll(async () => { await mongoose.disconnect(); });

  beforeEach(async () => {
    await User.deleteMany({}); await Product.deleteMany({}); await Subscription.deleteMany({});

    admin = await User.create({
      name: 'Admin', email: uniqEmail('admin'), phoneNumber: '12345678',
      address: 'x', password: 'Password123*', role: 'admin',
    });
    adminToken = admin.generateAuthToken();

    customer = await User.create({
      name: 'Cust', email: uniqEmail('cust'), phoneNumber: '12345678',
      address: 'x', password: 'Password123*',
    });
    customerToken = customer.generateAuthToken();

    product = await Product.create({
      name: 'Dog Food', description: 'kibble', price: 300, quantity: 50,
      categories: ['food'], createdBy: admin._id,
      images: [{ url: 'https://cdn/x.jpg', publicId: 'products/x' }],
    });

    sub = await Subscription.create({
      user: customer._id, items: [{ product: product._id, quantity: 2 }], shippingAddress: ADDRESS,
      paymentMethod: 'stripe', intervalUnit: 'week', intervalCount: 2, discountPercent: 10,
      status: 'active', nextRunAt: new Date(Date.now() + 5 * 86400000), source: 'product',
    });
  });

  it('GET /mine returns enriched list with perCycleTotal + cadenceLabel', async () => {
    const res = await request(app).get('/api/subscriptions/mine').set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data[0].perCycleTotal).toBe(540); // 300 × 2 × 0.9
    expect(res.body.data[0].cadenceLabel).toBe('every 2 weeks');
  });

  it('GET /mine/:id enforces ownership and returns enriched detail', async () => {
    const ok = await request(app).get(`/api/subscriptions/mine/${sub._id}`).set('Authorization', `Bearer ${customerToken}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.savings).toBe(60);

    const other = await User.create({
      name: 'Other', email: uniqEmail('other'), phoneNumber: '12345678', address: 'x', password: 'Password123*',
    });
    const denied = await request(app).get(`/api/subscriptions/mine/${sub._id}`).set('Authorization', `Bearer ${other.generateAuthToken()}`);
    expect(denied.status).toBe(404);
  });

  it('GET /admin/:id returns enriched detail for admins', async () => {
    const res = await request(app).get(`/api/subscriptions/admin/${sub._id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.perCycleTotal).toBe(540);
    expect(res.body.data.user.email).toBe(customer.email);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/subscription.detail.test.js`
Expected: FAIL — `/mine/:id` and `/admin/:id` 404 (routes not registered) and list lacks `perCycleTotal`.

- [ ] **Step 3: Import `enrichSubscription` and update the controller**

In `backend/src/controllers/subscription.controller.js`, update the analytics-service import line:

```js
const { predictDemand, productCoverage, enrichSubscription } = require('../services/subscription.analytics.service');
```

Replace `getMySubscriptions` with:

```js
// GET /api/subscriptions/mine — caller's subscriptions (enriched)
exports.getMySubscriptions = async (req, res, next) => {
  try {
    const subscriptions = await Subscription.find({ user: req.user.id })
      .populate('items.product')
      .populate('createdOrders', 'totalAmount discount status createdAt')
      .sort('-createdAt');
    res.status(200).json({ status: 'success', data: subscriptions.map(enrichSubscription) });
  } catch (err) {
    next(err);
  }
};
```

Replace `getSubscriptionsAdmin` with:

```js
// GET /api/subscriptions/admin — admin list (all users, enriched)
exports.getSubscriptionsAdmin = async (req, res, next) => {
  try {
    const subscriptions = await Subscription.find()
      .populate('user', 'name email')
      .populate('items.product')
      .populate('createdOrders', 'totalAmount discount status createdAt')
      .sort('-createdAt');
    res.status(200).json({ status: 'success', data: subscriptions.map(enrichSubscription) });
  } catch (err) {
    next(err);
  }
};
```

Add these two new handlers (place after `getSubscriptionsAdmin`):

```js
// GET /api/subscriptions/mine/:id — owner enriched detail
exports.getMySubscriptionDetail = async (req, res, next) => {
  try {
    const sub = await Subscription.findOne({ _id: req.params.id, user: req.user.id })
      .populate('items.product')
      .populate('createdOrders', 'totalAmount discount status createdAt');
    if (!sub) return next(new AppError('Subscription not found', 404));
    res.status(200).json({ status: 'success', data: enrichSubscription(sub) });
  } catch (err) {
    next(err);
  }
};

// GET /api/subscriptions/admin/:id — admin enriched detail
exports.getSubscriptionDetailAdmin = async (req, res, next) => {
  try {
    const sub = await Subscription.findById(req.params.id)
      .populate('user', 'name email')
      .populate('items.product')
      .populate('createdOrders', 'totalAmount discount status createdAt');
    if (!sub) return next(new AppError('Subscription not found', 404));
    res.status(200).json({ status: 'success', data: enrichSubscription(sub) });
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 4: Register the routes**

In `backend/src/routes/subscription.routes.js`, add `getMySubscriptionDetail` and `getSubscriptionDetailAdmin` to the destructured imports from the controller.

Then in the Admin block, add the `GET /admin/:id` **before** the existing `PATCH /admin/:id` (and after the analytics / product-coverage routes so it does not shadow them):

```js
router.get('/admin/:id', isAuthenticated, isAdmin, getSubscriptionDetailAdmin);
```

In the Customer block, add `GET /mine/:id` immediately after the existing `GET /mine`:

```js
router.get('/mine/:id', isAuthenticated, getMySubscriptionDetail);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx jest tests/subscription.detail.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
cd backend
git add src/controllers/subscription.controller.js src/routes/subscription.routes.js tests/subscription.detail.test.js
git commit -m "feat(subscriptions): enrich list responses + add enriched detail endpoints"
```

---

### Task 3: Subscriptions summary block in product analytics overview

**Files:**
- Modify: `backend/src/controllers/product.controller.js`
- Test: `backend/tests/product.analytics.subscriptions.test.js`

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/product.analytics.subscriptions.test.js
jest.mock('../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Product = require('../src/models/product.model');
const Subscription = require('../src/models/subscription.model');

const ADDRESS = { street: '1 A St', city: 'Town', state: 'X', country: 'MU', zipCode: '000' };
const uniqEmail = (p) => `${p}-${Date.now()}-${Math.random()}@x.com`;

describe('Product analytics — subscriptions block (Epic 12)', () => {
  beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });
  afterAll(async () => { await mongoose.disconnect(); });
  beforeEach(async () => {
    await User.deleteMany({}); await Product.deleteMany({}); await Subscription.deleteMany({});
  });

  it('overview includes a subscriptions summary block', async () => {
    const admin = await User.create({
      name: 'Ad', email: uniqEmail('admin'), phoneNumber: '12345678', address: 'x', password: 'Password123*', role: 'admin',
    });
    const user = await User.create({
      name: 'C', email: uniqEmail('cust'), phoneNumber: '12345678', address: 'x', password: 'Password123*',
    });
    const p = await Product.create({
      name: 'Food', description: 'kibble', price: 100, quantity: 1, categories: ['food'], createdBy: admin._id,
      images: [{ url: 'https://cdn/x.jpg', publicId: 'products/x' }],
    });
    await Subscription.create({
      user: user._id, items: [{ product: p._id, quantity: 5 }], shippingAddress: ADDRESS,
      paymentMethod: 'stripe', intervalUnit: 'day', intervalCount: 1,
      discountPercent: 0, status: 'active', nextRunAt: new Date(Date.now() + 86400000), source: 'product',
    });

    const res = await request(app).get('/api/products/analytics/overview').set('Authorization', `Bearer ${admin.generateAuthToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.data.subscriptions).toBeDefined();
    expect(res.body.data.subscriptions.totalActiveSubscriptions).toBe(1);
    expect(res.body.data.subscriptions.productsWithSubscriptions).toBe(1);
    expect(res.body.data.subscriptions.productsNeedingRestock).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/product.analytics.subscriptions.test.js`
Expected: FAIL — `res.body.data.subscriptions` is undefined.

- [ ] **Step 3: Add the summary block**

In `backend/src/controllers/product.controller.js`, add this import near the top with the other requires:

```js
const { predictDemand, productCoverage } = require('../services/subscription.analytics.service');
```

In `getProductAnalytics` (currently at line ~489), just before the `res.status(200).json({...})` call, compute the block:

```js
    const demand = await predictDemand({});
    const coverage = await productCoverage();
    const subscriptions = {
      totalActiveSubscriptions: demand.totalActiveSubscriptions,
      productsWithSubscriptions: Object.keys(coverage).length,
      productsNeedingRestock: demand.productsAtRisk,
    };
```

Then add `subscriptions` to the returned `data` object:

```js
    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalProducts,
          lowStockProducts,
          outOfStockProducts,
        },
        categoryStats,
        priceRangeStats,
        subscriptions,
      },
    });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest tests/product.analytics.subscriptions.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Run the full backend subscription + product suites (no regressions)**

Run: `cd backend && npx jest tests/subscription.analytics.test.js tests/subscription.enrich.test.js tests/subscription.detail.test.js tests/product.analytics.subscriptions.test.js`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
cd backend
git add src/controllers/product.controller.js tests/product.analytics.subscriptions.test.js
git commit -m "feat(subscriptions): add subscriptions summary to product analytics overview"
```

---

# PART B — FRONTEND

### Task 4: API client methods for enriched detail

**Files:**
- Modify: `frontend/src/Services/api/subscriptionsApi.js`

- [ ] **Step 1: Add the two methods**

In `frontend/src/Services/api/subscriptionsApi.js`, add inside the `subscriptionsApi` object (after `getMine`):

```js
  getMineOne: async (id) => {
    const response = await api.get(`/subscriptions/mine/${id}`);
    return response.data;
  },
```

and after `getAllAdmin`:

```js
  getAdminOne: async (id) => {
    const response = await api.get(`/subscriptions/admin/${id}`);
    return response.data;
  },
```

- [ ] **Step 2: Build check**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd frontend
git add src/Services/api/subscriptionsApi.js
git commit -m "feat(subscriptions): add enriched detail API methods (getMineOne, getAdminOne)"
```

---

### Task 5: My Subscriptions — financials, image, order history

**Files:**
- Modify: `frontend/src/Pages/Subscriptions/MySubscriptions.jsx`
- Modify: `frontend/src/Pages/Subscriptions/MySubscriptions.test.jsx`
- Modify: `frontend/src/Pages/Subscriptions/MySubscriptions.css`

- [ ] **Step 1: Extend the test (TDD)**

Update the mock in `frontend/src/Pages/Subscriptions/MySubscriptions.test.jsx` so the fixture carries enriched fields, and add assertions. Replace the `getMine` mock return and add a test:

```jsx
    getMine: vi.fn().mockResolvedValue({
      data: [{
        _id: "s1", status: "active", intervalUnit: "week", intervalCount: 2,
        nextRunAt: new Date(Date.now() + 86400000).toISOString(), discountPercent: 10,
        perCycleTotal: 540, savings: 60, cadenceLabel: "every 2 weeks", nextRunInDays: 1,
        items: [{ product: { _id: "p1", name: "Dog Food", images: [{ url: "http://img/x.jpg" }] }, quantity: 2 }],
        orderHistory: [{ id: "o1", date: new Date("2026-06-01").toISOString(), total: 450, status: "paid" }],
      }],
    }),
```

Add this test inside the `describe`:

```jsx
  it("shows per-cycle total and savings", async () => {
    render(<MySubscriptions />);
    await waitFor(() => expect(screen.getByText("Dog Food")).toBeInTheDocument());
    expect(screen.getByText("Rs 540")).toBeInTheDocument();
    expect(screen.getByText(/save rs 60/i)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/Pages/Subscriptions/MySubscriptions.test.jsx`
Expected: FAIL — "Rs 540" / "save rs 60" not found.

- [ ] **Step 3: Implement the enriched card**

In `frontend/src/Pages/Subscriptions/MySubscriptions.jsx`:

Add the currency hook import near the top:

```jsx
import { useCurrency } from "../../context/CurrencyContext";
```

Inside the component, add the hook (next to the toast hook):

```jsx
  const { formatPrice } = useCurrency();
```

Replace the card body (the `<div key={s._id} ...>` block) with this version that adds image, financials, and order history. Keep the existing `act` / `cancel` handlers unchanged:

```jsx
          <div key={s._id} className={`ms-card ms-${s.status}`}>
            <div className="ms-card-head">
              <span className={`ms-status ms-status-${s.status}`}>{s.status}</span>
              <span className="ms-interval">{s.cadenceLabel || intervalLabel(s.intervalUnit, s.intervalCount)}</span>
            </div>
            <ul className="ms-items">
              {s.items.map((it, i) => (
                <li key={i} className="ms-item">
                  {it.product?.images?.[0]?.url && (
                    <img className="ms-item-img" src={it.product.images[0].url} alt="" />
                  )}
                  <span className="ms-item-name">{(it.product?.name) || "Item"}</span>
                  {it.variantLabel ? ` · ${it.variantLabel}` : ""} × {it.quantity}
                </li>
              ))}
            </ul>
            {s.perCycleTotal != null && (
              <p className="ms-pricing">
                <span className="ms-percycle">{formatPrice(s.perCycleTotal)}</span>
                <span className="ms-percycle-label"> / delivery</span>
                {s.savings > 0 && <span className="ms-savings">You save {formatPrice(s.savings)}</span>}
              </p>
            )}
            <p className="ms-next">
              Next order: {s.nextRunAt ? new Date(s.nextRunAt).toLocaleDateString() : "—"}
              {s.discountPercent ? ` · ${s.discountPercent}% off` : ""}
            </p>
            {Array.isArray(s.orderHistory) && s.orderHistory.length > 0 && (
              <details className="ms-history">
                <summary>Past orders ({s.orderHistory.length})</summary>
                <ul>
                  {s.orderHistory.map((o) => (
                    <li key={o.id}>
                      {new Date(o.date).toLocaleDateString()} · {formatPrice(o.total)} · {o.status}
                    </li>
                  ))}
                </ul>
              </details>
            )}
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
```

- [ ] **Step 4: Add styles**

Append to `frontend/src/Pages/Subscriptions/MySubscriptions.css`:

```css
.ms-item { display: flex; align-items: center; gap: 8px; }
.ms-item-img { width: 32px; height: 32px; border-radius: 6px; object-fit: cover; }
.ms-pricing { display: flex; align-items: baseline; gap: 8px; margin: 8px 0 4px; }
.ms-percycle { font-size: 18px; font-weight: 800; color: #1d9e75; }
.ms-percycle-label { color: #6b7b6b; font-size: 13px; }
.ms-savings { color: #0f6b48; font-size: 12px; font-weight: 600; }
.ms-history { margin: 6px 0; font-size: 13px; color: #4a544c; }
.ms-history summary { cursor: pointer; font-weight: 600; }
.ms-history ul { margin: 6px 0 0; padding-left: 16px; }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/Pages/Subscriptions/MySubscriptions.test.jsx`
Expected: PASS (all tests, including the new one).

- [ ] **Step 6: Commit**

```bash
cd frontend
git add src/Pages/Subscriptions/MySubscriptions.jsx src/Pages/Subscriptions/MySubscriptions.test.jsx src/Pages/Subscriptions/MySubscriptions.css
git commit -m "feat(subscriptions): enrich My Subscriptions with totals, savings, image, history"
```

---

### Task 6: Admin Subscriptions — enriched detail drawer + filters

**Files:**
- Modify: `frontend/src/Pages/Admin/Subscriptions/AdminSubscriptions.jsx`
- Modify: `frontend/src/Pages/Admin/Subscriptions/AdminSubscriptions.css`
- Test: `frontend/src/Pages/Admin/Subscriptions/AdminSubscriptions.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// frontend/src/Pages/Admin/Subscriptions/AdminSubscriptions.test.jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../../../Services/api/subscriptionsApi", () => ({
  default: {
    getAllAdmin: vi.fn().mockResolvedValue({
      data: [
        { _id: "s1", status: "active", intervalUnit: "week", intervalCount: 2,
          nextRunAt: new Date(Date.now() + 2 * 86400000).toISOString(),
          user: { name: "Alice" }, items: [{ quantity: 1 }], createdOrders: [],
          cadenceLabel: "every 2 weeks", perCycleTotal: 540, savings: 60, nextRunInDays: 2 },
        { _id: "s2", status: "paused", intervalUnit: "day", intervalCount: 10,
          nextRunAt: new Date(Date.now() + 40 * 86400000).toISOString(),
          user: { name: "Bob" }, items: [{ quantity: 1 }], createdOrders: [],
          cadenceLabel: "every 10 days", perCycleTotal: 200, savings: 0, nextRunInDays: 40 },
      ],
    }),
    getAnalytics: vi.fn().mockResolvedValue({ totalActiveSubscriptions: 1, productsAtRisk: 0, horizonDays: 30, rows: [] }),
    getAdminOne: vi.fn().mockResolvedValue({
      data: { _id: "s1", status: "active", intervalUnit: "week", intervalCount: 2,
        nextRunAt: new Date(Date.now() + 2 * 86400000).toISOString(), user: { name: "Alice" },
        cadenceLabel: "every 2 weeks", perCycleTotal: 540, savings: 60, nextRunInDays: 2,
        items: [{ product: { name: "Dog Food" }, variantLabel: null, quantity: 2 }],
        orderHistory: [{ id: "o1", date: new Date("2026-06-01").toISOString(), total: 450, status: "paid" }] },
    }),
    updateAdmin: vi.fn().mockResolvedValue({ data: {} }),
  },
}));
vi.mock("../../../context/ToastContext", () => ({ useToast: () => ({ addToast: vi.fn() }) }));

import subscriptionsApi from "../../../Services/api/subscriptionsApi";
import AdminSubscriptions from "./AdminSubscriptions";

describe("AdminSubscriptions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("filters the list by status", async () => {
    render(<AdminSubscriptions />);
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    expect(screen.getByText("Bob")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/filter status/i), { target: { value: "paused" } });
    await waitFor(() => expect(screen.queryByText("Alice")).not.toBeInTheDocument());
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("opens an enriched detail drawer with per-cycle total and history", async () => {
    render(<AdminSubscriptions />);
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    fireEvent.click(screen.getAllByTitle("View items")[0]);
    await waitFor(() => expect(subscriptionsApi.getAdminOne).toHaveBeenCalledWith("s1"));
    expect(await screen.findByText("Rs 540")).toBeInTheDocument();
    expect(screen.getByText(/save rs 60/i)).toBeInTheDocument();
    expect(screen.getByText(/past orders/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/Pages/Admin/Subscriptions/AdminSubscriptions.test.jsx`
Expected: FAIL — no status filter control; drawer does not call `getAdminOne` / show financials.

- [ ] **Step 3: Add a local money helper + filter state**

In `frontend/src/Pages/Admin/Subscriptions/AdminSubscriptions.jsx`, add a module-level helper above the component:

```jsx
const fmtRs = (n) => `Rs ${Math.round(Number(n) || 0).toLocaleString()}`;
```

Add filter + detail state inside the component (next to the existing `useState` calls):

```jsx
  const [statusFilter, setStatusFilter] = useState("all");
  const [dueSoon, setDueSoon] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
```

Add a derived filtered list (after the `stats` useMemo):

```jsx
  const filteredItems = useMemo(() => items.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (dueSoon && !(s.nextRunInDays != null && s.nextRunInDays <= 7)) return false;
    return true;
  }), [items, statusFilter, dueSoon]);
```

- [ ] **Step 4: Replace the view handler to fetch enriched detail**

Replace the `onClick={(e) => { e.stopPropagation(); setViewed(item); }}` in the "View items" button with a fetch:

```jsx
              <button title="View items" onClick={(e) => { e.stopPropagation(); openDetail(item._id); }}><FiEye /></button>
```

Add the `openDetail` function inside the component:

```jsx
  const openDetail = async (id) => {
    setDetailLoading(true);
    setDetail({ _id: id });
    try {
      const res = await subscriptionsApi.getAdminOne(id);
      setDetail(res.data);
    } catch {
      addToast("Failed to load subscription", "error");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };
```

- [ ] **Step 5: Render the filters + the enriched drawer**

Add the filter controls just above `<DataTable ... />`:

```jsx
      <div className="aps-filters">
        <label>
          Filter status&nbsp;
          <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label className="aps-duesoon">
          <input type="checkbox" checked={dueSoon} onChange={(e) => setDueSoon(e.target.checked)} />
          &nbsp;Due within 7 days
        </label>
      </div>
```

Change the `DataTable` to use the filtered list:

```jsx
      <DataTable data={filteredItems} columns={columns} loading={loading} />
```

Replace the entire existing `<AnimatePresence>{viewed && (...)}</AnimatePresence>` block with the enriched drawer:

```jsx
      <AnimatePresence>
        {detail && (
          <motion.div className="admin-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDetail(null)}>
            <motion.div className="admin-modal" initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <h3>Subscription — {detail.user?.name || "Customer"}</h3>
              {detailLoading && <p className="admin-page-subtitle">Loading…</p>}
              {!detailLoading && (
                <>
                  <p className="admin-page-subtitle" style={{ marginTop: 0 }}>
                    {detail.cadenceLabel || `${detail.intervalCount} ${detail.intervalUnit}`} · next run in {detail.nextRunInDays ?? "—"} day(s) · {detail.status}
                  </p>
                  {detail.perCycleTotal != null && (
                    <p className="aps-pricing">
                      <strong>{fmtRs(detail.perCycleTotal)}</strong> / delivery
                      {detail.savings > 0 && <span className="aps-savings"> · You save {fmtRs(detail.savings)}</span>}
                    </p>
                  )}
                  <table className="aps-demand-table">
                    <thead><tr><th>Product</th><th>Variant</th><th>Qty</th></tr></thead>
                    <tbody>
                      {(detail.items || []).map((it, i) => (
                        <tr key={i}>
                          <td>{it.product?.name || it.name || "Product"}</td>
                          <td>{it.variantLabel || "—"}</td>
                          <td>{it.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {Array.isArray(detail.orderHistory) && detail.orderHistory.length > 0 && (
                    <details className="aps-history" open>
                      <summary>Past orders ({detail.orderHistory.length})</summary>
                      <ul>
                        {detail.orderHistory.map((o) => (
                          <li key={o.id}>{new Date(o.date).toLocaleDateString()} · {fmtRs(o.total)} · {o.status}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              )}
              <div className="admin-modal-actions">
                <button className="at-btn-secondary" onClick={() => setDetail(null)}>Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
```

Remove the now-unused `viewed` / `setViewed` state declaration.

- [ ] **Step 6: Add styles**

Append to `frontend/src/Pages/Admin/Subscriptions/AdminSubscriptions.css`:

```css
.aps-filters { display: flex; align-items: center; gap: 18px; margin: 8px 0 14px; }
.aps-duesoon { display: inline-flex; align-items: center; font-size: 14px; }
.aps-pricing { margin: 4px 0 12px; font-size: 15px; }
.aps-pricing strong { color: #1d9e75; font-size: 18px; }
.aps-savings { color: #0f6b48; font-weight: 600; }
.aps-history { margin-top: 12px; font-size: 13px; }
.aps-history summary { cursor: pointer; font-weight: 600; }
.aps-history ul { margin: 6px 0 0; padding-left: 16px; }
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/Pages/Admin/Subscriptions/AdminSubscriptions.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 8: Full frontend suite + build (no regressions)**

Run: `cd frontend && npx vitest run`
Expected: all suites pass.
Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 9: Commit**

```bash
cd frontend
git add src/Pages/Admin/Subscriptions/AdminSubscriptions.jsx src/Pages/Admin/Subscriptions/AdminSubscriptions.css src/Pages/Admin/Subscriptions/AdminSubscriptions.test.jsx
git commit -m "feat(subscriptions): admin enriched detail drawer + status/due-soon filters"
```

---

### Task 7: Update memory

**Files:**
- Modify: `backend/.claude/memory/STATUS.md`
- Modify: `backend/.claude/memory/SPECS-INDEX.md`

- [ ] **Step 1: Move Epic 12 FE to Done in STATUS.md**

In `backend/.claude/memory/STATUS.md`, remove the `12 FE` row from the Remaining table and add to the Done table:

```markdown
| 12 FE | Subscription enrichment + detail views — `enrichSubscription` service (per-cycle total, savings, cadence, next-run-in-days, order history), enriched `/mine` + `/admin` lists, `/mine/:id` + `/admin/:id` detail endpoints, product-analytics subscriptions block, admin detail drawer + status/due-soon filters, My Subscriptions financials/image/history | BE + FE |
```

Add a Notes bullet:

```markdown
- **Epic 12 completed (2026-06-24)** — the FE label was a misnomer: it required building the shared server-side `enrichSubscription` (never built despite Epic 12 BE being marked done). Financials are server-side because the FE payload lacks variant/sale prices. Demand forecast, admin list, and "Subscribed (N)" badge were already shipped in the prior merge.
```

- [ ] **Step 2: Add the plan to SPECS-INDEX.md**

In `backend/.claude/memory/SPECS-INDEX.md` (or `backend/.claude/memory/SPECS-INDEX.md` Implementation Plans table — note the canonical specs index lives at `backend/.claude/memory/SPECS-INDEX.md` per CLAUDE.md), add a row to the Implementation Plans table:

```markdown
| Epic 12 — subscription enrichment & detail views | `docs/superpowers/plans/2026-06-24-epic12-subscription-enrichment.md` |
```

- [ ] **Step 3: Commit**

```bash
cd backend
git add .claude/memory/STATUS.md .claude/memory/SPECS-INDEX.md
git commit -m "chore(memory): mark Epic 12 complete; index enrichment plan"
```

---

## Self-Review Notes

- **Spec coverage:**
  - Shared `enrichSubscription` (perCycleTotal, savings, cadenceLabel, nextRunInDays, orderHistory) → Task 1. ✓
  - Enriched `/mine` + `/admin` lists, `GET /mine/:id` + `GET /admin/:id` → Task 2. ✓
  - Product-analytics overview subscriptions block → Task 3. ✓
  - Admin list/detail enriched + status + due-soon filters → Task 6. ✓
  - User My Subscriptions detail (items + variant + image, totals + savings, history, manage actions) → Task 5. ✓
  - Amounts via formatMUR/formatPrice (BE numbers, FE `formatPrice` / admin `fmtRs`) → Tasks 5–6. ✓
  - Variant-aware demand prediction + product-list flag → **already shipped** (verified), not re-done. ✓
  - Product-analytics overview *FE rendering* of the new block is **out of scope** here (BE block only); add as a follow-up if the admin product analytics page should surface it.
- **No placeholders:** every step has full code or exact commands.
- **Type consistency:** the enriched fields (`perCycleTotal`, `savings`, `cadenceLabel`, `nextRunInDays`, `orderHistory{id,date,total,status}`) are identical across BE (Task 1), API (Task 4), and both FE consumers (Tasks 5–6).
- **Risk — `.lean()`:** enriched controller paths populate full product docs (no projection) so `effectivePrice`/`priceForVariant` work. Do **not** add `.lean()` to those queries.
- **Route ordering:** `GET /admin/:id` is registered after `/admin/analytics` and `/admin/product-coverage` so it does not shadow them.
- **Test harness (verified):** Jest with `globalSetup: ./tests/setup.js` providing `process.env.MONGODB_URI`; tests do `mongoose.connect(process.env.MONGODB_URI)` in `beforeAll`, mock `../src/utils/email`, and mint tokens via `user.generateAuthToken()` (see `tests/storeSettings.test.js`, `tests/subscription.controller.test.js`). No `MongoMemoryServer`, no manual `jwt.sign`. `supertest` is available. Service-only tests (Task 1) need no DB.
```
