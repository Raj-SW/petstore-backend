<!-- Mirror copy for root-level discovery. Canonical: docs/superpowers/plans/2026-06-21-product-bulk-actions-and-image-ordering.md — keep both in sync. -->

# Product Bulk Actions + Image Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin bulk-action endpoint for products (activate/deactivate, feature/unfeature, sale/clearSale, delete) and let `updateProduct` honor an explicit image order manifest so admins can reorder images and set any image — including a new upload — as the primary (position 0).

**Architecture:** One new admin endpoint `POST /api/products/bulk` backed by a `validateBulkAction` Joi validator and a `bulkAction` controller (a single `updateMany` per non-delete action; fetch-images → Cloudinary cleanup → `deleteMany` for delete). For images, extend the existing `updateProduct` image-handling block with an optional `imageOrder` token manifest (`publicId` for existing, `"new:<idx>"` for the Nth uploaded file); when absent, behavior is unchanged. No schema changes — `images` array index remains the source of truth, position 0 = primary.

**Tech Stack:** Node.js, Express, Mongoose 7, Joi, Jest + Supertest, mongodb-memory-server, Cloudinary (mocked in tests).

**Spec:** `docs/superpowers/specs/2026-06-21-product-bulk-actions-and-image-ordering-design.md`

**Note on tests:** Run suites individually — the full `npm test` flakes under combined load. Command template:
`npx cross-env NODE_ENV=test jest --runInBand --forceExit <testfile>`

---

## File Structure

- **Create** `src/validators/bulkAction.validator.js` — `validateBulkAction` middleware.
- **Modify** `src/controllers/product.controller.js` — add `bulkAction` export; extend `updateProduct` image block with `imageOrder`.
- **Modify** `src/routes/product.routes.js` — wire `POST /bulk`; import `bulkAction` + `validateBulkAction`.
- **Modify** `src/validators/product.validator.js` — add `imageOrder` to the update schema.
- **Create** `tests/product.bulk.test.js` — bulk-action tests.
- **Create** `tests/product.images.test.js` — image-ordering tests.

---

## Task 1: Bulk-action validator

**Files:**
- Create: `src/validators/bulkAction.validator.js`
- Create: `tests/product.bulk.test.js` (validator-failure cases live here; shared with Task 2)

- [ ] **Step 1: Write the failing test**

Create `tests/product.bulk.test.js`:

```js
/**
 * Tests for POST /api/products/bulk — admin bulk actions.
 * Cloudinary mocked.
 */
jest.mock('../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

jest.mock('../src/utils/cloudinary', () => ({
  validateImageFile: jest.fn(),
  uploadMultipleToCloudinary: jest.fn().mockResolvedValue([
    { url: 'https://res.cloudinary.com/test/products/p.jpg', publicId: 'products/p' },
  ]),
  deleteMultipleFromCloudinary: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/middlewares/upload', () => {
  const multer = require('multer');
  return { upload: multer({ storage: multer.memoryStorage() }) };
});

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Product = require('../src/models/product.model');
const cloudinary = require('../src/utils/cloudinary');

const makeUser = (overrides = {}) => ({
  name: 'Test User',
  email: `user-${Date.now()}-${Math.random()}@example.com`,
  phoneNumber: '12345678',
  address: '123 Test St',
  password: 'Password123*',
  ...overrides,
});

async function loginAsAdmin() {
  const data = makeUser({ email: `admin-${Date.now()}-${Math.random()}@example.com` });
  await request(app).post('/api/auth/signup').send(data);
  await User.findOneAndUpdate({ email: data.email }, { role: 'admin' });
  const res = await request(app).post('/api/auth/login').send({ email: data.email, password: data.password });
  return res.body.data.accessToken;
}

async function loginAsCustomer() {
  const data = makeUser();
  await request(app).post('/api/auth/signup').send(data);
  const res = await request(app).post('/api/auth/login').send({ email: data.email, password: data.password });
  return res.body.data.accessToken;
}

async function seedProduct(createdBy, overrides = {}) {
  return Product.create({
    name: `Prod ${Math.random()}`,
    description: 'A quality product for pets of all sizes',
    price: 30,
    quantity: 15,
    categories: ['dogs'],
    images: [{ url: 'http://example.com/img.jpg', publicId: `img-${Math.random()}` }],
    isActive: true,
    isFeatured: false,
    createdBy,
    ...overrides,
  });
}

describe('POST /api/products/bulk', () => {
  let adminToken;
  let adminId;

  beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });
  afterAll(async () => { await mongoose.disconnect(); });

  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    jest.clearAllMocks();
    cloudinary.deleteMultipleFromCloudinary.mockResolvedValue(undefined);
    adminToken = await loginAsAdmin();
    adminId = (await User.findOne({ role: 'admin' }))._id;
  });

  describe('validation', () => {
    it('rejects an unknown action with 400', async () => {
      const p = await seedProduct(adminId);
      const res = await request(app)
        .post('/api/products/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'frobnicate', ids: [p._id.toString()] });
      expect(res.status).toBe(400);
    });

    it('rejects an empty ids array with 400', async () => {
      const res = await request(app)
        .post('/api/products/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'activate', ids: [] });
      expect(res.status).toBe(400);
    });

    it('rejects an invalid ObjectId with 400', async () => {
      const res = await request(app)
        .post('/api/products/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'activate', ids: ['not-an-id'] });
      expect(res.status).toBe(400);
    });

    it('rejects the sale action without options with 400', async () => {
      const p = await seedProduct(adminId);
      const res = await request(app)
        .post('/api/products/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'sale', ids: [p._id.toString()] });
      expect(res.status).toBe(400);
    });

    it('rejects a percent discount over 100 with 400', async () => {
      const p = await seedProduct(adminId);
      const res = await request(app)
        .post('/api/products/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'sale', ids: [p._id.toString()], options: { discountType: 'percent', discountValue: 150 } });
      expect(res.status).toBe(400);
    });

    it('rejects when sale end is before start with 400', async () => {
      const p = await seedProduct(adminId);
      const res = await request(app)
        .post('/api/products/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'sale',
          ids: [p._id.toString()],
          options: {
            discountType: 'percent', discountValue: 10,
            saleStartsAt: '2026-07-10', saleEndsAt: '2026-07-01',
          },
        });
      expect(res.status).toBe(400);
    });
  });

  describe('authorization', () => {
    it('rejects a non-admin with 403', async () => {
      const p = await seedProduct(adminId);
      const customerToken = await loginAsCustomer();
      const res = await request(app)
        .post('/api/products/bulk')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ action: 'activate', ids: [p._id.toString()] });
      expect(res.status).toBe(403);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/product.bulk.test.js`
Expected: FAIL — the `/api/products/bulk` route returns 404 (route not yet wired), so validation/authz assertions fail.

- [ ] **Step 3: Write the validator**

Create `src/validators/bulkAction.validator.js`:

```js
const Joi = require('joi');
const mongoose = require('mongoose');
const { AppError } = require('../middlewares/errorHandler');

const ACTIONS = ['activate', 'deactivate', 'feature', 'unfeature', 'sale', 'clearSale', 'delete'];

const validateBulkAction = (req, res, next) => {
  const schema = Joi.object({
    action: Joi.string().valid(...ACTIONS).required().messages({
      'any.only': `Action must be one of: ${ACTIONS.join(', ')}`,
      'any.required': 'Action is required',
    }),
    ids: Joi.array().items(Joi.string()).min(1).max(100).required().messages({
      'array.min': 'At least one product id is required',
      'array.max': 'Cannot act on more than 100 products at once',
      'any.required': 'Product ids are required',
    }),
    options: Joi.object({
      discountType: Joi.string().valid('percent', 'amount').required(),
      discountValue: Joi.number().greater(0).required(),
      saleStartsAt: Joi.date().allow('', null).optional(),
      saleEndsAt: Joi.date().allow('', null).optional(),
    }).optional(),
  });

  const { error, value } = schema.validate(req.body);
  if (error) return next(new AppError(error.details[0].message, 400));

  if (!value.ids.every((id) => mongoose.Types.ObjectId.isValid(id))) {
    return next(new AppError('One or more product IDs are invalid', 400));
  }

  if (value.action === 'sale') {
    if (!value.options) {
      return next(new AppError('Sale options are required for the sale action', 400));
    }
    const { discountType, discountValue, saleStartsAt, saleEndsAt } = value.options;
    if (discountType === 'percent' && (discountValue < 1 || discountValue > 100)) {
      return next(new AppError('Percentage discount must be between 1 and 100', 400));
    }
    if (saleStartsAt && saleEndsAt
        && new Date(saleEndsAt).getTime() <= new Date(saleStartsAt).getTime()) {
      return next(new AppError('Sale end date must be after the start date', 400));
    }
  }

  req.body = value;
  return next();
};

module.exports = { validateBulkAction };
```

- [ ] **Step 4: Wire the route (validator only, controller added in Task 2)**

This step alone won't pass yet — the controller is added in Task 2. Proceed to Task 2 before running. (Defer running until Task 2 Step 4.)

- [ ] **Step 5: (no commit yet — commit at end of Task 2)**

---

## Task 2: Bulk-action controller + route

**Files:**
- Modify: `src/controllers/product.controller.js` (add `bulkAction` export)
- Modify: `src/routes/product.routes.js`
- Test: `tests/product.bulk.test.js` (add behavior tests)

- [ ] **Step 1: Add behavior tests**

Append these `describe` blocks inside the top-level `describe('POST /api/products/bulk', ...)` in `tests/product.bulk.test.js`:

```js
  describe('field actions', () => {
    it('deactivates multiple products', async () => {
      const a = await seedProduct(adminId, { isActive: true });
      const b = await seedProduct(adminId, { isActive: true });
      const res = await request(app)
        .post('/api/products/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'deactivate', ids: [a._id.toString(), b._id.toString()] });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ requested: 2, matched: 2, modified: 2 });
      expect((await Product.findById(a._id)).isActive).toBe(false);
      expect((await Product.findById(b._id)).isActive).toBe(false);
    });

    it('features multiple products', async () => {
      const a = await seedProduct(adminId, { isFeatured: false });
      const res = await request(app)
        .post('/api/products/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'feature', ids: [a._id.toString()] });
      expect(res.status).toBe(200);
      expect((await Product.findById(a._id)).isFeatured).toBe(true);
    });

    it('puts products on sale with a percent discount + dates', async () => {
      const a = await seedProduct(adminId, { price: 100 });
      const res = await request(app)
        .post('/api/products/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'sale',
          ids: [a._id.toString()],
          options: { discountType: 'percent', discountValue: 25, saleStartsAt: '2026-01-01', saleEndsAt: '2030-01-01' },
        });
      expect(res.status).toBe(200);
      const updated = await Product.findById(a._id);
      expect(updated.onSale).toBe(true);
      expect(updated.discountType).toBe('percent');
      expect(updated.discountValue).toBe(25);
      expect(updated.isOnSaleNow).toBe(true);
      expect(updated.effectivePrice).toBe(75);
    });

    it('clears a sale', async () => {
      const a = await seedProduct(adminId, {
        price: 100, onSale: true, discountType: 'percent', discountValue: 25,
      });
      const res = await request(app)
        .post('/api/products/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'clearSale', ids: [a._id.toString()] });
      expect(res.status).toBe(200);
      const updated = await Product.findById(a._id);
      expect(updated.onSale).toBe(false);
      expect(updated.discountValue).toBe(0);
      expect(updated.saleStartsAt).toBeNull();
      expect(updated.saleEndsAt).toBeNull();
    });
  });

  describe('delete action', () => {
    it('deletes products and removes their Cloudinary images', async () => {
      const a = await seedProduct(adminId, { images: [{ url: 'u', publicId: 'pid-a' }] });
      const b = await seedProduct(adminId, { images: [{ url: 'u', publicId: 'pid-b' }] });
      const res = await request(app)
        .post('/api/products/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'delete', ids: [a._id.toString(), b._id.toString()] });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ requested: 2, deleted: 2 });
      expect(await Product.countDocuments()).toBe(0);
      const publicIdsArg = cloudinary.deleteMultipleFromCloudinary.mock.calls[0][0];
      expect(publicIdsArg.sort()).toEqual(['pid-a', 'pid-b']);
    });

    it('still deletes products when Cloudinary cleanup throws', async () => {
      cloudinary.deleteMultipleFromCloudinary.mockRejectedValueOnce(new Error('cloudinary down'));
      const a = await seedProduct(adminId);
      const res = await request(app)
        .post('/api/products/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'delete', ids: [a._id.toString()] });
      expect(res.status).toBe(200);
      expect(await Product.countDocuments()).toBe(0);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/product.bulk.test.js`
Expected: FAIL — route still 404 / `bulkAction` undefined.

- [ ] **Step 3: Add the `bulkAction` controller**

In `src/controllers/product.controller.js`, add this export (place after `deleteProduct`). The Cloudinary helpers are already imported at the top of the file.

```js
// Bulk actions on multiple products (Admin only)
exports.bulkAction = async (req, res, next) => {
  try {
    const { action, ids, options } = req.body;

    if (action === 'delete') {
      const products = await Product.find({ _id: { $in: ids } });
      const publicIds = products
        .flatMap((p) => p.images.map((img) => img.publicId))
        .filter(Boolean);
      try {
        await deleteMultipleFromCloudinary(publicIds);
      } catch (cleanupErr) {
        logger.error('Bulk delete: Cloudinary cleanup failed (non-fatal)', { error: cleanupErr.message });
      }
      const result = await Product.deleteMany({ _id: { $in: ids } });
      logger.info(`Bulk delete by admin ${req.user._id}`, { deleted: result.deletedCount });
      return res.status(200).json({
        success: true,
        message: `${result.deletedCount} product(s) deleted`,
        data: { requested: ids.length, deleted: result.deletedCount },
      });
    }

    const updateMap = {
      activate:   { isActive: true },
      deactivate: { isActive: false },
      feature:    { isFeatured: true },
      unfeature:  { isFeatured: false },
      clearSale:  { onSale: false, discountValue: 0, saleStartsAt: null, saleEndsAt: null },
    };

    let update;
    if (action === 'sale') {
      update = {
        onSale: true,
        discountType: options.discountType,
        discountValue: options.discountValue,
        saleStartsAt: options.saleStartsAt || null,
        saleEndsAt: options.saleEndsAt || null,
      };
    } else {
      update = updateMap[action];
    }

    const result = await Product.updateMany({ _id: { $in: ids } }, { $set: update });
    logger.info(`Bulk ${action} by admin ${req.user._id}`, { modified: result.modifiedCount });
    return res.status(200).json({
      success: true,
      message: `${result.modifiedCount} product(s) updated`,
      data: {
        requested: ids.length,
        matched: result.matchedCount,
        modified: result.modifiedCount,
      },
    });
  } catch (error) {
    return next(error);
  }
};
```

- [ ] **Step 4: Wire the route**

In `src/routes/product.routes.js`:

1. Add to the controller import destructure: `bulkAction`.
2. Add the validator import below the existing validator import:
   ```js
   const { validateBulkAction } = require('../validators/bulkAction.validator');
   ```
3. Under the admin block (after `router.use(isAuthenticated, isAdmin);`), add before the `/:id` patch line:
   ```js
   router.post('/bulk', validateBulkAction, bulkAction);
   ```

(`POST /bulk` does not collide with `POST /` or the `:id` GET/PATCH/DELETE routes.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/product.bulk.test.js`
Expected: PASS — all validation, authz, field-action, sale, clearSale, and delete tests green.

- [ ] **Step 6: Commit**

```bash
git add src/validators/bulkAction.validator.js src/controllers/product.controller.js src/routes/product.routes.js tests/product.bulk.test.js
git commit -m "feat: admin bulk actions for products (activate/feature/sale/delete)"
```

---

## Task 3: Image order manifest in updateProduct

**Files:**
- Modify: `src/validators/product.validator.js` (add `imageOrder` to update schema)
- Modify: `src/controllers/product.controller.js` (`updateProduct` image block)
- Test: `tests/product.images.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/product.images.test.js`:

```js
/**
 * Tests for PATCH /api/products/:id image ordering (imageOrder manifest).
 * Cloudinary mocked; each uploaded file gets a deterministic publicId.
 */
jest.mock('../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

jest.mock('../src/utils/cloudinary', () => ({
  validateImageFile: jest.fn(),
  uploadMultipleToCloudinary: jest.fn(),
  deleteMultipleFromCloudinary: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/middlewares/upload', () => {
  const multer = require('multer');
  return { upload: multer({ storage: multer.memoryStorage() }) };
});

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Product = require('../src/models/product.model');
const cloudinary = require('../src/utils/cloudinary');

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const makeUser = (overrides = {}) => ({
  name: 'Test User',
  email: `user-${Date.now()}-${Math.random()}@example.com`,
  phoneNumber: '12345678',
  address: '123 Test St',
  password: 'Password123*',
  ...overrides,
});

async function loginAsAdmin() {
  const data = makeUser({ email: `admin-${Date.now()}-${Math.random()}@example.com` });
  await request(app).post('/api/auth/signup').send(data);
  await User.findOneAndUpdate({ email: data.email }, { role: 'admin' });
  const res = await request(app).post('/api/auth/login').send({ email: data.email, password: data.password });
  return res.body.data.accessToken;
}

async function seedProduct(createdBy, images) {
  return Product.create({
    name: `Prod ${Math.random()}`,
    description: 'A quality product for pets of all sizes',
    price: 30,
    quantity: 15,
    categories: ['dogs'],
    images,
    createdBy,
  });
}

describe('PATCH /api/products/:id image ordering', () => {
  let adminToken;
  let adminId;

  beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });
  afterAll(async () => { await mongoose.disconnect(); });

  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    jest.clearAllMocks();
    cloudinary.uploadMultipleToCloudinary.mockResolvedValue([]);
    cloudinary.deleteMultipleFromCloudinary.mockResolvedValue(undefined);
    adminToken = await loginAsAdmin();
    adminId = (await User.findOne({ role: 'admin' }))._id;
  });

  it('reorders existing images via imageOrder (primary changes)', async () => {
    const p = await seedProduct(adminId, [
      { url: 'u1', publicId: 'pid-1' },
      { url: 'u2', publicId: 'pid-2' },
    ]);
    const res = await request(app)
      .patch(`/api/products/${p._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('keepImages', JSON.stringify([{ url: 'u1', publicId: 'pid-1' }, { url: 'u2', publicId: 'pid-2' }]))
      .field('imageOrder', JSON.stringify(['pid-2', 'pid-1']));
    expect(res.status).toBe(200);
    const updated = await Product.findById(p._id);
    expect(updated.images.map((i) => i.publicId)).toEqual(['pid-2', 'pid-1']);
  });

  it('interleaves a new upload between existing images', async () => {
    cloudinary.uploadMultipleToCloudinary.mockResolvedValueOnce([{ url: 'unew', publicId: 'pid-new' }]);
    const p = await seedProduct(adminId, [
      { url: 'u1', publicId: 'pid-1' },
      { url: 'u2', publicId: 'pid-2' },
    ]);
    const res = await request(app)
      .patch(`/api/products/${p._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('keepImages', JSON.stringify([{ url: 'u1', publicId: 'pid-1' }, { url: 'u2', publicId: 'pid-2' }]))
      .field('imageOrder', JSON.stringify(['pid-1', 'new:0', 'pid-2']))
      .attach('images', TINY_PNG, 'new.png');
    expect(res.status).toBe(200);
    const updated = await Product.findById(p._id);
    expect(updated.images.map((i) => i.publicId)).toEqual(['pid-1', 'pid-new', 'pid-2']);
  });

  it('makes a new upload the primary (index 0)', async () => {
    cloudinary.uploadMultipleToCloudinary.mockResolvedValueOnce([{ url: 'unew', publicId: 'pid-new' }]);
    const p = await seedProduct(adminId, [{ url: 'u1', publicId: 'pid-1' }]);
    const res = await request(app)
      .patch(`/api/products/${p._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('keepImages', JSON.stringify([{ url: 'u1', publicId: 'pid-1' }]))
      .field('imageOrder', JSON.stringify(['new:0', 'pid-1']))
      .attach('images', TINY_PNG, 'new.png');
    expect(res.status).toBe(200);
    const updated = await Product.findById(p._id);
    expect(updated.images[0].publicId).toBe('pid-new');
  });

  it('deletes an existing image omitted from imageOrder', async () => {
    const p = await seedProduct(adminId, [
      { url: 'u1', publicId: 'pid-1' },
      { url: 'u2', publicId: 'pid-2' },
    ]);
    const res = await request(app)
      .patch(`/api/products/${p._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('keepImages', JSON.stringify([{ url: 'u1', publicId: 'pid-1' }]))
      .field('imageOrder', JSON.stringify(['pid-1']));
    expect(res.status).toBe(200);
    expect(cloudinary.deleteMultipleFromCloudinary).toHaveBeenCalledWith(['pid-2']);
    const updated = await Product.findById(p._id);
    expect(updated.images.map((i) => i.publicId)).toEqual(['pid-1']);
  });

  it('rejects when imageOrder would leave zero images (400)', async () => {
    const p = await seedProduct(adminId, [{ url: 'u1', publicId: 'pid-1' }]);
    const res = await request(app)
      .patch(`/api/products/${p._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('keepImages', JSON.stringify([]))
      .field('imageOrder', JSON.stringify([]));
    expect(res.status).toBe(400);
  });

  it('falls back to legacy keepImages+append when imageOrder is absent', async () => {
    cloudinary.uploadMultipleToCloudinary.mockResolvedValueOnce([{ url: 'unew', publicId: 'pid-new' }]);
    const p = await seedProduct(adminId, [{ url: 'u1', publicId: 'pid-1' }]);
    const res = await request(app)
      .patch(`/api/products/${p._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('keepImages', JSON.stringify([{ url: 'u1', publicId: 'pid-1' }]))
      .attach('images', TINY_PNG, 'new.png');
    expect(res.status).toBe(200);
    const updated = await Product.findById(p._id);
    expect(updated.images.map((i) => i.publicId)).toEqual(['pid-1', 'pid-new']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/product.images.test.js`
Expected: FAIL — `imageOrder` is ignored, so the reorder/interleave/empty-rejection assertions fail (legacy fallback test may pass).

- [ ] **Step 3: Add `imageOrder` to the update validator**

In `src/validators/product.validator.js`, inside the `validateProductUpdate` schema object, add this line next to `keepImages`:

```js
    imageOrder: Joi.string().optional(), // JSON string of order tokens: publicId | "new:<idx>"
```

- [ ] **Step 4: Update the `updateProduct` image block**

In `src/controllers/product.controller.js`, replace the destructure line and the entire `if (keepImagesStr !== undefined) { ... }` block in `updateProduct` with:

```js
    const { keepImages: keepImagesStr, imageOrder: imageOrderStr, ...updateData } = req.body;

    // findByIdAndUpdate skips the pre('validate') derive hook, so derive here.
    if (Array.isArray(updateData.variants) && updateData.variants.length > 0) {
      updateData.price = Math.min(...updateData.variants.map((v) => Number(v.price)));
      updateData.quantity = updateData.variants.reduce((s, v) => s + (Number(v.quantity) || 0), 0);
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid product ID format', 400));
    }

    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return next(new AppError('Product not found', 404));
    }

    let updatedImages = existingProduct.images;

    // keepImages is always sent from the edit form — process image changes
    if (keepImagesStr !== undefined) {
      const keepImages = JSON.parse(keepImagesStr); // [{url, publicId}]
      const imageOrder = imageOrderStr ? JSON.parse(imageOrderStr) : null; // [publicId | "new:N"]

      // Which existing images survive: when imageOrder is present, the non-"new:" tokens
      // name the kept publicIds; otherwise fall back to keepImages.
      const keptPublicIds = imageOrder
        ? new Set(imageOrder.filter((t) => !String(t).startsWith('new:')))
        : new Set(keepImages.map((img) => img.publicId).filter(Boolean));

      const removedPublicIds = existingProduct.images
        .map((img) => img.publicId)
        .filter((pid) => pid && !keptPublicIds.has(pid));
      if (removedPublicIds.length > 0) {
        await deleteMultipleFromCloudinary(removedPublicIds);
      }

      // Upload any new files (index-aligned with req.files / "new:N" tokens)
      let newlyUploaded = [];
      if (req.files && req.files.length > 0) {
        req.files.forEach((file) => validateImageFile(file));
        newlyUploaded = await uploadMultipleToCloudinary(req.files, 'products');
      }

      if (imageOrder) {
        const existingByPid = new Map(existingProduct.images.map((img) => [img.publicId, img]));
        updatedImages = imageOrder
          .map((token) => {
            const t = String(token);
            if (t.startsWith('new:')) {
              const idx = Number(t.slice(4));
              return Number.isInteger(idx) ? newlyUploaded[idx] : null;
            }
            const existing = existingByPid.get(t);
            return existing ? { url: existing.url, publicId: existing.publicId } : null;
          })
          .filter(Boolean);
      } else {
        updatedImages = [...keepImages, ...newlyUploaded];
      }

      if (updatedImages.length === 0) {
        return next(new AppError('A product must have at least one image', 400));
      }
    }
```

(Everything below — the `findByIdAndUpdate` call using `updatedImages` — stays unchanged.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/product.images.test.js`
Expected: PASS — reorder, interleave, set-primary, omitted-deletion, empty-rejection, and legacy-fallback all green.

- [ ] **Step 6: Run the existing product suite to confirm no regression**

Run: `npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/product.controller.test.js`
Expected: PASS — the legacy update path is unchanged when `imageOrder` is absent.

- [ ] **Step 7: Commit**

```bash
git add src/validators/product.validator.js src/controllers/product.controller.js tests/product.images.test.js
git commit -m "feat: imageOrder manifest for product image reorder + set-primary"
```

---

## Self-Review Notes

- **Spec coverage:** F1 endpoint/validation/each-action/delete-cloudinary/authz → Tasks 1–2. F2 reorder/interleave/set-primary/omitted-delete/empty-reject/back-compat → Task 3. Variant-products-on-sale verified via `isOnSaleNow`/`effectivePrice` assertion (computeSale is product-level). ✓
- **Amount-off caveat:** behavior (not on sale when salePrice ≥ price) is inherent to `computeSale`; no extra task needed — documented in spec. The bulk validator permits `amount` without a per-product price check (no single price across many products), consistent with the design.
- **Type consistency:** `validateBulkAction` (validator) ↔ `bulkAction` (controller) ↔ route import; response shapes `{ requested, matched, modified }` / `{ requested, deleted }` match tests; `imageOrder` field name consistent across validator, controller, and tests.
- **No placeholders.** All steps contain runnable code/commands.
