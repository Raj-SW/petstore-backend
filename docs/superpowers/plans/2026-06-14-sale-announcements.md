# Sale Announcements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins email registered customers about product sales — via a quick inline "notify" checkbox on the product form and a dedicated multi-product composer — with a persisted campaign history and customer opt-out/unsubscribe.

**Architecture:** A new `SaleAnnouncement` resource (model + validator + controller + routes) on the backend, one Handlebars email template, an `emailPreferences.sales` flag on the User, and a public tokenized unsubscribe endpoint. Both triggers call the same `POST /api/announcements` endpoint. Frontend adds an admin composer page, an inline checkbox, and a profile toggle.

**Tech Stack:** Express + Mongoose + Joi + Jest/supertest (backend); React 18 + Vite + framer-motion + Vitest (frontend). Email via existing Resend SMTP `sendEmail` + Handlebars. No new npm packages.

**⚠️ Repo layout:** `backend/` and `frontend/` are **separate git repos**. Backend tasks commit inside `backend/`, frontend tasks inside `frontend/`. Never `git add` across repo boundaries.

**Spec:** `backend/docs/superpowers/specs/2026-06-14-sale-announcements-design.md`

---

## File Structure

**Backend (`backend/`)**

| File | Responsibility |
|---|---|
| `src/models/saleAnnouncement.model.js` | Announcement schema (subject, message, products, counts, source) |
| `src/models/user.model.js` (modify) | Add `emailPreferences.sales` flag |
| `src/controllers/user.controller.js` (modify) | Accept `emailPreferences` in `updateProfile` |
| `src/validators/announcement.validator.js` | Joi validation for create |
| `src/utils/unsubscribeToken.js` | Sign/verify the unsubscribe JWT |
| `src/controllers/announcement.controller.js` | Create+send, list history, public unsubscribe |
| `src/routes/announcement.routes.js` | Router wiring + auth guards |
| `src/app.js` (modify) | Mount `/api/announcements` |
| `src/templates/sale-announcement.html` | Handlebars email template |
| `tests/announcement.controller.test.js` | API tests |

**Frontend (`frontend/`)**

| File | Responsibility |
|---|---|
| `src/Services/api/announcementsApi.js` | `createAnnouncement`, `getAnnouncements` |
| `src/Pages/Admin/Announcements/AdminAnnouncements.jsx` + `.css` | Composer + history table |
| `src/Pages/Admin/Announcements/AdminAnnouncements.test.jsx` | Composer smoke test |
| `src/main.jsx` (modify) | Admin route `announcements` |
| `src/Components/Admin/AdminLayout.jsx` (modify) | Sidebar item |
| `src/Pages/Admin/Products/AdminProductForm.jsx` (modify) | Inline "notify customers" checkbox |
| `src/Pages/UserProfile/...` (modify) | "Sale & promo emails" toggle |

---

## Phase 1 — Backend

### Task 1: Failing API tests for announcements

**Files:**
- Create: `backend/tests/announcement.controller.test.js`

- [ ] **Step 1: Write the failing test file**

```js
/**
 * Tests for Sale Announcement Controller
 * POST   /api/announcements                  — admin create + send
 * GET    /api/announcements                  — admin history
 * GET    /api/announcements/unsubscribe       — public, flips emailPreferences.sales
 */

jest.mock('../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Product = require('../src/models/product.model');
const SaleAnnouncement = require('../src/models/saleAnnouncement.model');
const { sendEmail } = require('../src/utils/email');
const { makeUnsubscribeToken } = require('../src/utils/unsubscribeToken');

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

async function makeProduct(adminId, over = {}) {
  return Product.create({
    name: `Dog Food ${Math.random()}`,
    description: 'Premium kibble',
    price: 1000,
    quantity: 10,
    categories: ['food'],
    images: [{ url: 'https://cdn.example.com/p.jpg', publicId: 'products/p' }],
    onSale: true,
    discountType: 'percent',
    discountValue: 20,
    createdBy: adminId,
    ...over,
  });
}

describe('Sale Announcement Controller', () => {
  let adminUser;
  let adminToken;
  let customerToken;

  beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });

  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    await SaleAnnouncement.deleteMany({});
    sendEmail.mockClear();

    adminUser = await User.create(makeUser({ email: 'admin@test.com', role: 'admin' }));
    const a = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'Password123*' });
    adminToken = a.body.data.accessToken;
    customerToken = await loginAs(makeUser());
  });

  afterAll(async () => { await mongoose.connection.close(); });

  describe('POST /api/announcements', () => {
    it('sends to opted-in customers only and records counts (201)', async () => {
      // two customers in, one opted out
      await User.create(makeUser({ email: 'in1@test.com', role: 'customer' }));
      await User.create(makeUser({ email: 'in2@test.com', role: 'customer' }));
      await User.create(makeUser({ email: 'out@test.com', role: 'customer', emailPreferences: { sales: false } }));
      const product = await makeProduct(adminUser._id);

      const res = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subject: 'Big Dog Food Sale', message: 'Save now', productIds: [product._id.toString()] });

      expect(res.status).toBe(201);
      // audience = in1, in2, + the customer created in beforeEach (opted in by default) = 3; out excluded
      expect(res.body.data.audienceCount).toBe(3);
      expect(res.body.data.sentCount).toBe(3);
      expect(sendEmail).toHaveBeenCalledTimes(3);
      expect(await SaleAnnouncement.countDocuments()).toBe(1);
    });

    it('defaults source to composer and accepts inline', async () => {
      const product = await makeProduct(adminUser._id);
      const res = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subject: 'Sale', productIds: [product._id.toString()], source: 'inline' });
      expect(res.status).toBe(201);
      expect(res.body.data.source).toBe('inline');
    });

    it('400 when no valid products', async () => {
      const res = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subject: 'Sale', productIds: [new mongoose.Types.ObjectId().toString()] });
      expect(res.status).toBe(400);
    });

    it('400 when subject missing', async () => {
      const product = await makeProduct(adminUser._id);
      const res = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ productIds: [product._id.toString()] });
      expect(res.status).toBe(400);
    });

    it('400 when productIds empty', async () => {
      const res = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subject: 'Sale', productIds: [] });
      expect(res.status).toBe(400);
    });

    it('rejects non-admin (403) and unauthenticated (401)', async () => {
      const product = await makeProduct(adminUser._id);
      const body = { subject: 'Sale', productIds: [product._id.toString()] };
      expect((await request(app).post('/api/announcements').send(body)).status).toBe(401);
      expect((await request(app).post('/api/announcements').set('Authorization', `Bearer ${customerToken}`).send(body)).status).toBe(403);
    });
  });

  describe('GET /api/announcements', () => {
    it('returns history newest-first (admin only)', async () => {
      const product = await makeProduct(adminUser._id);
      await SaleAnnouncement.create({ subject: 'Old', products: [product._id], source: 'composer', createdBy: adminUser._id });
      await SaleAnnouncement.create({ subject: 'New', products: [product._id], source: 'composer', createdBy: adminUser._id });

      expect((await request(app).get('/api/announcements')).status).toBe(401);
      const res = await request(app).get('/api/announcements').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data[0].subject).toBe('New');
    });
  });

  describe('GET /api/announcements/unsubscribe', () => {
    it('flips emailPreferences.sales to false for a valid token', async () => {
      const u = await User.create(makeUser({ email: 'sub@test.com', role: 'customer' }));
      const token = makeUnsubscribeToken(u._id);
      const res = await request(app).get(`/api/announcements/unsubscribe?token=${token}`);
      expect(res.status).toBe(200);
      const fresh = await User.findById(u._id);
      expect(fresh.emailPreferences.sales).toBe(false);
    });

    it('handles an invalid token gracefully (400)', async () => {
      const res = await request(app).get('/api/announcements/unsubscribe?token=garbage');
      expect(res.status).toBe(400);
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run (from `backend/`): `npx jest tests/announcement.controller.test.js --runInBand`
Expected: FAIL — `Cannot find module '../src/models/saleAnnouncement.model'` (and `../src/utils/unsubscribeToken`).

*(No commit yet — commit lands green in Task 8.)*

---

### Task 2: SaleAnnouncement model

**Files:**
- Create: `backend/src/models/saleAnnouncement.model.js`

- [ ] **Step 1: Write the model**

```js
const mongoose = require('mongoose');

const saleAnnouncementSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      minlength: [2, 'Subject must be at least 2 characters'],
      maxlength: [150, 'Subject cannot exceed 150 characters'],
    },
    message: {
      type: String,
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
      default: '',
    },
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
      },
    ],
    audienceCount: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    source: {
      type: String,
      enum: { values: ['inline', 'composer'], message: 'Invalid source' },
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sentAt: { type: Date },
  },
  { timestamps: true }
);

saleAnnouncementSchema.index({ createdAt: -1 });

module.exports =
  mongoose.models.SaleAnnouncement || mongoose.model('SaleAnnouncement', saleAnnouncementSchema);
```

---

### Task 3: User emailPreferences field + updateProfile support

**Files:**
- Modify: `backend/src/models/user.model.js`
- Modify: `backend/src/controllers/user.controller.js`

- [ ] **Step 1: Add the field to the User schema**

In `backend/src/models/user.model.js`, add this block immediately after the `profileImage` field (after its closing `},` near line 51):

```js
    emailPreferences: {
      sales: { type: Boolean, default: true },
    },
```

- [ ] **Step 2: Accept `emailPreferences` in `updateProfile`**

In `backend/src/controllers/user.controller.js`, replace the body of `updateProfile` (the destructure + the `findByIdAndUpdate` block, ~lines 26-51) with:

```js
    const {
      name, email, phoneNumber, address, emailPreferences,
    } = req.body;

    // Don't allow password updates through this route
    if (req.body.password) {
      return next(
        new AppError('This route is not for password updates. Please use /change-password', 400),
      );
    }

    // Check if email is already taken by another user
    if (email) {
      const existingUser = await User.findOne({ email, _id: { $ne: req.user.id } });
      if (existingUser) {
        return next(new AppError('Email is already in use', 400));
      }
    }

    const update = {
      name, email, phoneNumber, address,
    };
    if (emailPreferences && typeof emailPreferences.sales === 'boolean') {
      update['emailPreferences.sales'] = emailPreferences.sales;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      update,
      { new: true, runValidators: true },
    ).select('-password');
```

(Mongoose ignores `undefined` paths in the update object, so partial updates still work.)

---

### Task 4: Unsubscribe token util

**Files:**
- Create: `backend/src/utils/unsubscribeToken.js`

- [ ] **Step 1: Write the util**

```js
const jwt = require('jsonwebtoken');

const PURPOSE = 'unsubscribe-sales';

// Long-lived, single-purpose token embedded in sale emails.
exports.makeUnsubscribeToken = (userId) =>
  jwt.sign({ id: userId.toString(), purpose: PURPOSE }, process.env.JWT_SECRET, {
    expiresIn: '180d',
  });

// Returns the userId string, or null if the token is invalid/expired/wrong-purpose.
exports.verifyUnsubscribeToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose !== PURPOSE) return null;
    return decoded.id;
  } catch {
    return null;
  }
};
```

---

### Task 5: Announcement validator

**Files:**
- Create: `backend/src/validators/announcement.validator.js`

- [ ] **Step 1: Write the validator**

```js
const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const validateAnnouncement = (req, res, next) => {
  const schema = Joi.object({
    subject: Joi.string().min(2).max(150).trim().required().messages({
      'string.min': 'Subject must be at least 2 characters',
      'string.empty': 'Subject is required',
      'any.required': 'Subject is required',
    }),
    message: Joi.string().max(1000).trim().allow(''),
    productIds: Joi.array().items(Joi.string().hex().length(24)).min(1).required().messages({
      'array.min': 'Select at least one product',
      'any.required': 'Select at least one product',
    }),
    source: Joi.string().valid('inline', 'composer'),
  });

  const { error, value } = schema.validate(req.body, { stripUnknown: true });
  if (error) return next(new AppError(error.details[0].message, 400));
  req.body = value;
  next();
};

module.exports = { validateAnnouncement };
```

---

### Task 6: Email template

**Files:**
- Create: `backend/src/templates/sale-announcement.html`

- [ ] **Step 1: Write the Handlebars template**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>{{subject}}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f4; }
    .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 8px; overflow: hidden; }
    .header { background: #2c7a4b; padding: 32px 24px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 24px; }
    .content { padding: 28px 24px; }
    .content p { margin: 0 0 16px; }
    .product { border: 1px solid #eee; border-radius: 8px; padding: 12px; margin-bottom: 14px; }
    .product img { width: 100%; max-height: 200px; object-fit: cover; border-radius: 6px; }
    .product-name { font-weight: bold; font-size: 16px; margin: 10px 0 4px; }
    .price-was { color: #999; text-decoration: line-through; margin-right: 8px; }
    .price-now { color: #c0392b; font-weight: bold; font-size: 16px; }
    .badge { display: inline-block; background: #c0392b; color: #fff; font-size: 12px; padding: 2px 8px; border-radius: 4px; margin-left: 8px; }
    .btn { display: inline-block; margin: 20px 0 8px; padding: 12px 28px; background: #2c7a4b; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; }
    .footer { background: #f8f9fa; text-align: center; padding: 20px 24px; font-size: 12px; color: #888; }
    .footer a { color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🐾 {{subject}}</h1>
    </div>
    <div class="content">
      <p>Hi <strong>{{name}}</strong>,</p>
      {{#if message}}<p>{{message}}</p>{{/if}}
      {{#each products}}
      <div class="product">
        {{#if this.image}}<img src="{{this.image}}" alt="{{this.name}}">{{/if}}
        <div class="product-name">{{this.name}}</div>
        <div>
          {{#if this.salePriceLabel}}
            <span class="price-was">{{this.priceLabel}}</span>
            <span class="price-now">{{this.salePriceLabel}}</span>
            {{#if this.discountLabel}}<span class="badge">{{this.discountLabel}}</span>{{/if}}
          {{else}}
            <span class="price-now">{{this.priceLabel}}</span>
          {{/if}}
        </div>
      </div>
      {{/each}}
      <a href="{{shopUrl}}" class="btn">Shop the sale</a>
    </div>
    <div class="footer">
      <p>© 2026 VitalPaws &middot; You're receiving this because you have sale emails enabled.</p>
      <p><a href="{{unsubscribeUrl}}">Unsubscribe from sale emails</a></p>
    </div>
  </div>
</body>
</html>
```

---

### Task 7: Announcement controller

**Files:**
- Create: `backend/src/controllers/announcement.controller.js`

- [ ] **Step 1: Write the controller**

```js
const SaleAnnouncement = require('../models/saleAnnouncement.model');
const Product = require('../models/product.model');
const User = require('../models/user.model');
const { AppError } = require('../middlewares/errorHandler');
const { sendEmail } = require('../utils/email');
const { makeUnsubscribeToken, verifyUnsubscribeToken } = require('../utils/unsubscribeToken');
const logger = require('../utils/logger');

const MAX_RECIPIENTS = parseInt(process.env.ANNOUNCEMENT_MAX_RECIPIENTS || '500', 10);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const API_PUBLIC_URL = process.env.API_PUBLIC_URL || 'http://localhost:5000/api';

const formatMUR = (amount) => `Rs ${Number(amount || 0).toLocaleString('en-US')}`;

// Build per-email product rows (Handlebars can't compute, so precompute here).
function buildProductRows(products) {
  return products.map((p) => {
    const onSale = p.isOnSaleNow;
    return {
      name: p.name,
      image: p.images && p.images[0] ? p.images[0].url : '',
      priceLabel: formatMUR(p.price),
      salePriceLabel: onSale ? formatMUR(p.salePrice) : null,
      discountLabel: onSale ? `${p.discountPercentLabel}% OFF` : null,
    };
  });
}

// POST /api/announcements — admin
exports.createAnnouncement = async (req, res, next) => {
  try {
    const {
      subject, message = '', productIds, source = 'composer',
    } = req.body;

    const products = await Product.find({ _id: { $in: productIds } });
    if (!products.length) {
      return next(new AppError('No valid products found for this announcement', 400));
    }

    const recipients = await User.find({
      role: 'customer',
      'emailPreferences.sales': { $ne: false },
    }).select('name email');

    const audienceCount = recipients.length;
    const capped = recipients.slice(0, MAX_RECIPIENTS);
    const rows = buildProductRows(products);

    let sentCount = 0;
    let failedCount = 0;

    // Sequential send — Resend SMTP is one-recipient-per-call. Per-recipient
    // failures are non-fatal so one bad address never aborts the batch.
    for (const user of capped) {
      try {
        const unsubscribeUrl = `${API_PUBLIC_URL}/announcements/unsubscribe?token=${makeUnsubscribeToken(user._id)}`;
        // eslint-disable-next-line no-await-in-loop
        await sendEmail({
          to: user.email,
          subject,
          template: 'sale-announcement',
          data: {
            name: user.name,
            subject,
            message,
            products: rows,
            shopUrl: `${FRONTEND_URL}/petshop`,
            unsubscribeUrl,
          },
        });
        sentCount += 1;
      } catch (err) {
        failedCount += 1;
        logger.warn('Announcement email failed (non-fatal)', { userId: user._id, error: err.message });
      }
    }

    const announcement = await SaleAnnouncement.create({
      subject,
      message,
      products: products.map((p) => p._id),
      audienceCount,
      sentCount,
      failedCount,
      source,
      createdBy: req.user._id,
      sentAt: new Date(),
    });

    const note = audienceCount > MAX_RECIPIENTS
      ? `Sent to the first ${MAX_RECIPIENTS} of ${audienceCount} subscribers (cap).`
      : `Sent to ${sentCount} of ${audienceCount} subscribers.`;

    logger.info(`Sale announcement sent by admin ${req.user._id}`, { announcementId: announcement._id, sentCount, failedCount });
    return res.status(201).json({ success: true, message: note, data: announcement });
  } catch (error) {
    return next(error);
  }
};

// GET /api/announcements — admin history
exports.getAnnouncements = async (req, res, next) => {
  try {
    const announcements = await SaleAnnouncement.find()
      .sort('-createdAt')
      .populate('products', 'name');
    return res.status(200).json({ success: true, count: announcements.length, data: announcements });
  } catch (error) {
    return next(error);
  }
};

// GET /api/announcements/unsubscribe?token= — public, no auth
exports.unsubscribe = async (req, res) => {
  const page = (status, heading, sub = '') =>
    res.status(status).send(
      `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>`
      + `<body style="font-family:Arial,sans-serif;text-align:center;padding:60px 20px;color:#333">`
      + `<h2>${heading}</h2>${sub ? `<p>${sub}</p>` : ''}</body></html>`
    );
  try {
    const { token } = req.query;
    if (!token) return page(400, 'Invalid unsubscribe link.');
    const userId = verifyUnsubscribeToken(token);
    if (!userId) return page(400, 'This unsubscribe link is invalid or has expired.');
    await User.findByIdAndUpdate(userId, { 'emailPreferences.sales': false });
    return page(200, 'You have been unsubscribed from sale emails.', 'You can re-enable them anytime in your VitalPaws profile.');
  } catch {
    return page(400, 'Something went wrong. Please try again later.');
  }
};
```

---

### Task 8: Routes + app.js wiring → green + commit

**Files:**
- Create: `backend/src/routes/announcement.routes.js`
- Modify: `backend/src/app.js`

- [ ] **Step 1: Write the router**

```js
const express = require('express');
const { isAuthenticated, isAdmin } = require('../middlewares/auth.middleware');
const { validateAnnouncement } = require('../validators/announcement.validator');
const {
  createAnnouncement,
  getAnnouncements,
  unsubscribe,
} = require('../controllers/announcement.controller');

const router = express.Router();

// Public unsubscribe — registered before auth-guarded routes
router.get('/unsubscribe', unsubscribe);

// Admin
router.post('/', isAuthenticated, isAdmin, validateAnnouncement, createAnnouncement);
router.get('/', isAuthenticated, isAdmin, getAnnouncements);

module.exports = router;
```

- [ ] **Step 2: Wire into app.js**

In `backend/src/app.js`:

(a) Add to the route imports block, after `const feedbackRoutes = require('./routes/feedback.routes');` (~line 30):

```js
const announcementRoutes = require('./routes/announcement.routes');
```

(b) Add to the route mounts block, after `app.use('/api/feedback', feedbackRoutes);` (~line 150):

```js
app.use('/api/announcements', announcementRoutes);
```

- [ ] **Step 3: Run the announcement tests to green**

Run: `npx jest tests/announcement.controller.test.js --runInBand`
Expected: PASS — all tests green.

- [ ] **Step 4: Run related suites (no regressions)**

Run: `npx jest tests/product.controller.test.js tests/product.sale.test.js --runInBand`
Expected: PASS.

- [ ] **Step 5: Commit (inside `backend/`)**

```bash
cd backend
git add src/models/saleAnnouncement.model.js src/models/user.model.js src/controllers/user.controller.js src/validators/announcement.validator.js src/utils/unsubscribeToken.js src/controllers/announcement.controller.js src/routes/announcement.routes.js src/app.js src/templates/sale-announcement.html tests/announcement.controller.test.js
git commit -m "feat: sale announcements API (model, controller, routes, email template, unsubscribe) with tests"
```

---

## Phase 2 — Frontend

### Task 9: announcementsApi service

**Files:**
- Create: `frontend/src/Services/api/announcementsApi.js`

- [ ] **Step 1: Write announcementsApi.js**

```js
import { api } from "../../core/api/apiClient";

const announcementsApi = {
  // Admin: create + send an announcement
  // payload: { subject, message?, productIds: [], source?: 'inline' | 'composer' }
  createAnnouncement: async (payload) => {
    const response = await api.post("/announcements", payload);
    return response.data;
  },

  // Admin: campaign history
  getAnnouncements: async () => {
    const response = await api.get("/announcements");
    return response.data;
  },
};

export default announcementsApi;
```

- [ ] **Step 2: Commit (inside `frontend/`)**

```bash
cd frontend
git add src/Services/api/announcementsApi.js
git commit -m "feat: announcementsApi service"
```

---

### Task 10: Admin composer page + route + sidebar

**Files:**
- Create: `frontend/src/Pages/Admin/Announcements/AdminAnnouncements.jsx`
- Create: `frontend/src/Pages/Admin/Announcements/AdminAnnouncements.css`
- Create: `frontend/src/Pages/Admin/Announcements/AdminAnnouncements.test.jsx`
- Modify: `frontend/src/main.jsx`
- Modify: `frontend/src/Components/Admin/AdminLayout.jsx`

- [ ] **Step 1: Write the failing composer test**

```jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../../../Services/api/announcementsApi", () => ({
  default: {
    createAnnouncement: vi.fn().mockResolvedValue({ success: true, message: "Sent to 3 of 3 subscribers." }),
    getAnnouncements: vi.fn().mockResolvedValue({ data: [] }),
  },
}));
vi.mock("../../../Services/api/productsApi", () => ({
  default: {
    getProducts: vi.fn().mockResolvedValue({
      data: [{ _id: "p1", name: "Dog Food", price: 1000, onSale: true, salePrice: 800, images: [] }],
    }),
  },
}));
vi.mock("../../../context/ToastContext", () => ({ useToast: () => ({ addToast: vi.fn() }) }));
vi.mock("../../../context/CurrencyContext", () => ({ useCurrency: () => ({ formatPrice: (n) => `Rs ${n}` }) }));

import announcementsApi from "../../../Services/api/announcementsApi";
import AdminAnnouncements from "./AdminAnnouncements";

describe("AdminAnnouncements composer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires a subject and at least one product before sending", async () => {
    render(<AdminAnnouncements />);
    await waitFor(() => expect(screen.getByText("Dog Food")).toBeInTheDocument());
    // No subject, no product selected → send is disabled
    expect(screen.getByRole("button", { name: /send announcement/i })).toBeDisabled();
  });

  it("sends with subject + selected product", async () => {
    render(<AdminAnnouncements />);
    await waitFor(() => expect(screen.getByText("Dog Food")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/subject/i), { target: { value: "Big Sale" } });
    fireEvent.click(screen.getByLabelText(/select Dog Food/i));

    const send = screen.getByRole("button", { name: /send announcement/i });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    // confirm modal → confirm
    await waitFor(() => expect(screen.getByRole("button", { name: /^send$/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));

    await waitFor(() => expect(announcementsApi.createAnnouncement).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Big Sale", productIds: ["p1"], source: "composer" })
    ));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run (from `frontend/`): `npx vitest run src/Pages/Admin/Announcements/AdminAnnouncements.test.jsx`
Expected: FAIL — cannot resolve `./AdminAnnouncements`.

- [ ] **Step 3: Write AdminAnnouncements.jsx**

```jsx
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiMail, FiSend, FiTag, FiUsers } from "react-icons/fi";
import DataTable from "../../../Components/Admin/DataTable/DataTable";
import announcementsApi from "../../../Services/api/announcementsApi";
import productsApi from "../../../Services/api/productsApi";
import { useToast } from "../../../context/ToastContext";
import { useCurrency } from "../../../context/CurrencyContext";
import "../Tips/AdminTips.css";
import "./AdminAnnouncements.css";

const AdminAnnouncements = () => {
  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const { addToast } = useToast();
  const { formatPrice } = useCurrency();

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [prodRes, histRes] = await Promise.all([
        productsApi.getProducts({ limit: 200 }),
        announcementsApi.getAnnouncements(),
      ]);
      const list = Array.isArray(prodRes) ? prodRes : prodRes.data || prodRes.products || [];
      // Default the picker to on-sale products
      setProducts(list.filter((p) => p.onSale));
      setHistory(histRes.data || []);
    } catch {
      addToast("Failed to load products or history", "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleProduct = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const canSend = subject.trim().length >= 2 && selectedIds.length > 0 && !sending;

  const selectedProducts = useMemo(
    () => products.filter((p) => selectedIds.includes(p._id)),
    [products, selectedIds]
  );

  const doSend = async () => {
    try {
      setSending(true);
      const res = await announcementsApi.createAnnouncement({
        subject: subject.trim(),
        message: message.trim(),
        productIds: selectedIds,
        source: "composer",
      });
      addToast(res.message || "Announcement sent", "success");
      setSubject("");
      setMessage("");
      setSelectedIds([]);
      setConfirmOpen(false);
      fetchAll();
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to send announcement", "error");
    } finally {
      setSending(false);
    }
  };

  const columns = [
    { header: "Subject", accessor: "subject" },
    {
      header: "Products",
      accessor: "products",
      sortable: false,
      render: (value) => <span className="at-pill">{Array.isArray(value) ? value.length : 0}</span>,
    },
    {
      header: "Sent / Audience",
      accessor: "sentCount",
      sortable: false,
      render: (value, item) => `${value ?? 0} / ${item.audienceCount ?? 0}`,
    },
    { header: "Source", accessor: "source" },
    {
      header: "Date",
      accessor: "createdAt",
      render: (value) => (value ? new Date(value).toLocaleDateString() : "—"),
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
          <h1 className="admin-page-title">Sale Announcements</h1>
          <p className="admin-page-subtitle">
            Email registered customers about products on sale.
          </p>
        </div>
      </div>

      <div className="aa-composer">
        <input
          className="aa-input"
          placeholder="Email subject (e.g. Weekend Dog Food Sale)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <textarea
          className="aa-textarea"
          placeholder="Optional message shown above the products…"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <p className="aa-section-label">
          <FiTag /> On-sale products {products.length === 0 && !loading && "— none currently on sale"}
        </p>
        <div className="aa-product-grid">
          {products.map((p) => {
            const checked = selectedIds.includes(p._id);
            return (
              <label key={p._id} className={`aa-product ${checked ? "on" : ""}`}>
                <input
                  type="checkbox"
                  aria-label={`select ${p.name}`}
                  checked={checked}
                  onChange={() => toggleProduct(p._id)}
                />
                <span className="aa-product-name">{p.name}</span>
                <span className="aa-product-price">
                  {p.salePrice ? formatPrice(p.salePrice) : formatPrice(p.price)}
                </span>
              </label>
            );
          })}
        </div>

        <button
          className="at-btn-primary aa-send"
          disabled={!canSend}
          onClick={() => setConfirmOpen(true)}
        >
          <FiSend /> Send announcement
        </button>
      </div>

      <h2 className="aa-history-title">Past announcements</h2>
      <DataTable data={history} columns={columns} loading={loading} />

      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            className="admin-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmOpen(false)}
          >
            <motion.div
              className="admin-modal"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>
                <FiUsers /> Send to all subscribed customers?
              </h3>
              <p>
                &ldquo;{subject}&rdquo; featuring {selectedProducts.length} product
                {selectedProducts.length === 1 ? "" : "s"} will be emailed to every customer
                who has sale emails enabled.
              </p>
              <div className="admin-modal-actions">
                <button className="at-btn-secondary" onClick={() => setConfirmOpen(false)}>
                  Cancel
                </button>
                <button className="at-btn-primary" disabled={sending} onClick={doSend}>
                  Send
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AdminAnnouncements;
```

- [ ] **Step 4: Write AdminAnnouncements.css**

```css
.aa-composer {
  background: #fff;
  border: 1px solid #e8e4dc;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 28px;
}
.aa-input,
.aa-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d8d4cc;
  border-radius: 8px;
  font-size: 14px;
  margin-bottom: 12px;
  font-family: inherit;
}
.aa-section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 13px;
  color: #6f6e68;
  margin: 8px 0;
}
.aa-product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}
.aa-product {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #e8e4dc;
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
}
.aa-product.on {
  border-color: #2c7a4b;
  background: #f0f8f3;
}
.aa-product-name { flex: 1; font-size: 14px; }
.aa-product-price { font-weight: 600; color: #c0392b; font-size: 13px; }
.aa-send { display: inline-flex; align-items: center; gap: 6px; }
.aa-history-title { font-size: 18px; margin: 8px 0 12px; }
```

- [ ] **Step 5: Run the composer test to green**

Run: `npx vitest run src/Pages/Admin/Announcements/AdminAnnouncements.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Add the route in main.jsx**

In `frontend/src/main.jsx`:

(a) Add the import near the other admin imports (after `import AdminFeedback ...`, ~line 53):

```jsx
import AdminAnnouncements from "./Pages/Admin/Announcements/AdminAnnouncements";
```

(b) Add the route after the `feedback` admin route (after the block ending ~line 221):

```jsx
      {
        path: "announcements",
        element: <AdminAnnouncements />,
      },
```

- [ ] **Step 7: Add the sidebar item in AdminLayout.jsx**

In `frontend/src/Components/Admin/AdminLayout.jsx`, add this entry to `menuItems` immediately after the "Feedback" item (after its closing `},` ~line 78). `FiMail` is already imported (used by Contacts), so reuse it:

```jsx
    {
      title: "Announcements",
      path: "/admin/announcements",
      icon: <FiSend className="menu-icon" />,
    },
```

Then add `FiSend` to the `react-icons/fi` import list at the top of the file (it is not yet imported).

- [ ] **Step 8: Build**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 9: Commit (inside `frontend/`)**

```bash
cd frontend
git add src/Pages/Admin/Announcements/ src/main.jsx src/Components/Admin/AdminLayout.jsx
git commit -m "feat: admin sale-announcement composer page with history + route + sidebar"
```

---

### Task 11: Inline "notify customers" checkbox on the product form

**Files:**
- Modify: `frontend/src/Pages/Admin/Products/AdminProductForm.jsx`

The inline trigger reuses the same announcements endpoint — after a successful product save, if the product is on sale and the admin ticked "notify", fire a single-product announcement. No backend change.

- [ ] **Step 1: Inspect the form's submit handler and sale section**

Run: `grep -n "onSale\|handleSubmit\|navigate(\|updateProduct\|createProduct\|discountValue" src/Pages/Admin/Products/AdminProductForm.jsx`
Identify (a) the local state holding sale fields (`onSale`, `discountValue`), (b) the point right after the product is successfully saved (the `await productsApi.update/create` call returning the saved product), and (c) where to render a checkbox in the existing sale/discount section.

- [ ] **Step 2: Add notify state + checkbox**

Add to the component's state (near the other `useState` hooks):

```jsx
const [notifyOnSale, setNotifyOnSale] = useState(false);
```

Add the import at the top (alongside the other api imports):

```jsx
import announcementsApi from "../../../Services/api/announcementsApi";
```

Render this checkbox inside the existing sale/discount section, only meaningful when `onSale` is true (use the form's existing on-sale state variable name in the `disabled` / visibility check):

```jsx
{formData.onSale && (
  <label className="apf-notify-row" style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "8px" }}>
    <input
      type="checkbox"
      checked={notifyOnSale}
      onChange={(e) => setNotifyOnSale(e.target.checked)}
    />
    <span>Email subscribed customers about this sale</span>
  </label>
)}
```

(Replace `formData.onSale` with whatever the form actually uses for the on-sale flag, identified in Step 1.)

- [ ] **Step 3: Fire the announcement after a successful save**

Immediately after the product is successfully saved (the line that has the saved product response, before/around the success toast + navigate), add:

```jsx
// Inline sale notification — fire-and-forget; never block the save flow.
const savedProduct = response?.data?.data || response?.data; // saved product from the API response
const savedId = savedProduct?._id || productId; // productId = edit-mode id if present
if (notifyOnSale && savedId) {
  try {
    await announcementsApi.createAnnouncement({
      subject: `${savedProduct?.name || "A product"} is now on sale at VitalPaws`,
      productIds: [savedId],
      source: "inline",
    });
    addToast("Customers notified about this sale", "success");
  } catch {
    addToast("Saved, but the sale email could not be sent", "warning");
  }
}
```

(Adapt `response`, `addToast`, and the saved-product accessor to the names already used in this file, confirmed in Step 1.)

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 5: Commit (inside `frontend/`)**

```bash
cd frontend
git add src/Pages/Admin/Products/AdminProductForm.jsx
git commit -m "feat: inline 'notify customers' sale checkbox on the product form"
```

---

### Task 12: Profile "Sale & promo emails" toggle

**Files:**
- Modify the user profile page (locate in Step 1).

- [ ] **Step 1: Locate the profile page and its save path**

Run: `grep -rn "updateProfile\|update-profile\|UserProfile" src/Pages src/Components | grep -i profile`
Identify the profile component that calls `authApi.updateProfile` (or `usersApi`), and how it reads the current user (e.g. `useAuth()` / `AuthContext`, where `user.emailPreferences` will now be present).

- [ ] **Step 2: Add the toggle**

In the profile form, add a controlled checkbox bound to the user's current preference (default `true` when undefined):

```jsx
const [salesEmails, setSalesEmails] = useState(user?.emailPreferences?.sales !== false);
```

Render it in the profile/preferences section:

```jsx
<label style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "12px" }}>
  <input
    type="checkbox"
    checked={salesEmails}
    onChange={(e) => setSalesEmails(e.target.checked)}
  />
  <span>Receive sale &amp; promo emails</span>
</label>
```

- [ ] **Step 3: Persist on save**

Include the preference in the existing profile-save payload (the object passed to `updateProfile`):

```jsx
emailPreferences: { sales: salesEmails },
```

If the AuthContext caches the user, refresh it from the update response (follow the pattern already used by the profile save).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 5: Commit (inside `frontend/`)**

```bash
cd frontend
git add -A
git commit -m "feat: profile toggle for sale & promo emails"
```

---

### Task 13: Final verification

- [ ] **Step 1: Frontend tests + build**

Run (from `frontend/`):
```bash
npx vitest run
npm run build
```
Expected: all tests pass, build clean.

- [ ] **Step 2: Backend announcement + regression suites**

Run (from `backend/`):
```bash
npx jest tests/announcement.controller.test.js tests/product.controller.test.js tests/user.avatar.test.js --runInBand
```
Expected: all pass.

- [ ] **Step 3: Live smoke (optional, needs backend dev server + admin token + MONGODB_URI)**

```bash
# from backend/ with the dev server running on :5000
# 1. create an announcement (replace TOKEN + PRODUCT_ID)
curl -X POST http://localhost:5000/api/announcements \
  -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"subject":"Test Sale","productIds":["PRODUCT_ID"]}'
# → 201 with sent/audience counts
# 2. history
curl http://localhost:5000/api/announcements -H "Authorization: Bearer TOKEN"
```

---

## Self-Review

**Spec coverage:**
- Email channel via Resend `sendEmail` → Tasks 6, 7 ✅
- Two triggers (inline + composer) → Task 10 (composer), Task 11 (inline) ✅
- Audience = customers with `emailPreferences.sales !== false` + opt-out → Tasks 3, 7, 12 ✅
- Unsubscribe (public, tokenized) → Tasks 4, 7, 8 ✅
- Campaign history record → Tasks 2, 7, 10 ✅
- MUR price formatting in email → Task 7 (`formatMUR`) ✅
- Send cap for serverless → Task 7 (`ANNOUNCEMENT_MAX_RECIPIENTS`) ✅
- Admin-only guards + validation → Tasks 5, 8, Task 1 tests ✅
- Tests (backend audience/validation/guards/unsubscribe; frontend composer) → Tasks 1, 10 ✅

**Placeholder scan:** Tasks 11 and 12 modify existing files whose exact local variable names must be confirmed by the grep in their Step 1 (the form's on-sale flag and the profile save payload differ per file). The code blocks are complete; only the surrounding identifiers are adapted. This is intentional (editing unknown existing code), not a placeholder for missing logic.

**Type/name consistency:** `makeUnsubscribeToken` / `verifyUnsubscribeToken` (Task 4) used in Task 7 and Task 1 test ✅. `emailPreferences.sales` consistent across model (Task 3), controller query (Task 7), updateProfile (Task 3), profile toggle (Task 12) ✅. `source` enum `inline|composer` consistent across model (Task 2), validator (Task 5), composer (Task 10), inline (Task 11) ✅. Endpoint `/api/announcements` consistent across routes (Task 8), api service (Task 9), tests (Task 1) ✅.
