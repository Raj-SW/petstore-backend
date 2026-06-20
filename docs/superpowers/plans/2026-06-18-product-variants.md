# Product Weight/Size Variants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one product carry several weight/size variants (e.g. 1kg/3kg/5kg/10kg), each with its own price and stock, selectable on the product page and captured through cart, orders, and subscriptions.

**Architecture:** Embedded `variants[]` subdocuments on Product. A pure `computeSale(basePrice, saleFields)` helper powers both product-level virtuals and a per-variant `variantsView`. For variant products, the product-level `price`/`quantity` are derived (min price / total stock) so existing sort/filter/"From" pricing keep working. Cart/order/subscription items gain `variantId` + `variantLabel`; `buildOrder` reserves the chosen variant's stock; the frontend adds a size selector and treats `product+variant` as the cart line identity.

**Tech Stack:** Node/Express/Mongoose, Joi; Jest + supertest + MongoMemoryReplSet (backend). React + Vite, react-use-cart, Vitest + Testing Library (frontend).

**Repos:** backend (`Raj-SW/petstore-backend`) Tasks 1–6; frontend (`Raj-SW/petstore-frontend`) Tasks 7–11. Branch `feature/feedback-engagement-2026-06-14`.

**Spec:** `backend/docs/superpowers/specs/2026-06-18-product-variants-design.md`

**Test command (backend):** `npx cross-env NODE_ENV=test jest --runInBand --forceExit <file>` (re-run once if the auth `beforeEach` flakes).

---

## File structure

| File | Responsibility |
|---|---|
| `backend/src/models/product.model.js` | `variants[]`, `computeSale`, refactored virtuals, `hasVariants`, derive hook, `variantsView`, `priceForVariant` |
| `backend/src/models/cart.model.js`, `order.model.js`, `subscription.model.js` | item `variantId` + `variantLabel` |
| `backend/src/validators/product.validator.js` | accept `variants`, relax price/quantity |
| `backend/src/controllers/product.controller.js` | parse `variants`, enforce variants-or-price, derive on update |
| `backend/src/validators/cart.validator.js`, `controllers/cart.controller.js` | variant-aware add, line = product+variant |
| `backend/src/services/order.service.js`, `controllers/order.controller.js` | variant pricing + variant stock reservation |
| `backend/src/validators/subscription.validator.js`, `controllers/subscription.controller.js` | accept + pass `variantId` |
| `frontend/src/Services/api/cartApi.js`, `context/CartContext.jsx` | send `variantId`; composite line id |
| `frontend/src/Pages/IndividualProductItemPage/IndividualProductItemPage.jsx` | size selector + pass variantId |
| `frontend/src/Components/HelperComponents/ProductCard/ProductCardV2.jsx` | "From" price + route-to-detail |
| `frontend/src/Pages/Admin/Products/AdminProductForm.jsx` | variants editor |
| `frontend/src/Pages/CartCheckoutPage/*`, MySubscriptions, admin lists | show variant label |

---

## Phase 1 — Backend model + pricing

### Task 1: Product variants, `computeSale`, derive, `variantsView` (TDD)

**Files:**
- Modify: `backend/src/models/product.model.js`
- Test: `backend/tests/product.variants.model.test.js`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/product.variants.model.test.js`:

```javascript
const mongoose = require('mongoose');
const Product = require('../src/models/product.model');
const User = require('../src/models/user.model');

describe('Product variants', () => {
  let adminId;
  beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });
  beforeEach(async () => {
    await Product.deleteMany({});
    await User.deleteMany({});
    const admin = await User.create({
      name: 'A', email: `a-${Date.now()}@t.com`, phoneNumber: '12345678',
      address: 'x', password: 'Password123*', role: 'admin',
    });
    adminId = admin._id;
  });
  afterAll(async () => { await mongoose.connection.close(); });

  const base = (over = {}) => ({
    name: 'Dog Food', description: 'Premium kibble for dogs',
    categories: ['food'], createdBy: adminId, ...over,
  });

  it('derives product price (min) and quantity (sum) from variants', async () => {
    const p = await Product.create(base({
      variants: [
        { label: '1kg', price: 300, quantity: 5 },
        { label: '5kg', price: 1200, quantity: 8 },
      ],
    }));
    expect(p.hasVariants).toBe(true);
    expect(p.price).toBe(300);
    expect(p.quantity).toBe(13);
  });

  it('variantsView applies the sale % per variant', async () => {
    const p = await Product.create(base({
      onSale: true, discountType: 'percent', discountValue: 10,
      variants: [{ label: '5kg', price: 1000, quantity: 3 }],
    }));
    const view = p.toJSON().variantsView;
    expect(view).toHaveLength(1);
    expect(view[0].effectivePrice).toBe(900);
    expect(view[0].isOnSaleNow).toBe(true);
    expect(view[0].discountPercentLabel).toBe(10);
  });

  it('priceForVariant returns the variant effective price', async () => {
    const p = await Product.create(base({
      onSale: true, discountType: 'percent', discountValue: 50,
      variants: [{ label: '1kg', price: 200, quantity: 2 }],
    }));
    expect(p.priceForVariant(p.variants[0]._id)).toBe(100);
  });

  it('non-variant products keep working unchanged', async () => {
    const p = await Product.create(base({ price: 500, quantity: 9 }));
    expect(p.hasVariants).toBe(false);
    expect(p.effectivePrice).toBe(500);
    expect(p.toJSON().variantsView).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/product.variants.model.test.js`
Expected: FAIL — `hasVariants`/`variantsView`/`priceForVariant` undefined; price not derived.

- [ ] **Step 3: Add the variants field**

In `backend/src/models/product.model.js`, add this block immediately after the `sections: [...]` field (before `createdBy`):

```javascript
    variants: [
      {
        label:    { type: String, required: true, trim: true, maxlength: 40 },
        price:    { type: Number, required: true, min: 0 },
        quantity: { type: Number, required: true, min: 0, default: 0 },
      },
    ],
```

- [ ] **Step 4: Add `computeSale` and refactor the virtuals**

In `product.model.js`, replace the existing `// ── Sale pricing virtuals …` block (the `round2` const and the four `productSchema.virtual(...)` definitions) with:

```javascript
// ── Sale pricing (one helper drives product-level + per-variant pricing) ──
const round2 = (n) => Math.round(n * 100) / 100;

function computeSale(basePrice, { onSale, discountType, discountValue, saleStartsAt, saleEndsAt }) {
  const price = Number(basePrice) || 0;
  let salePrice = null;
  if (discountValue && discountValue > 0) {
    if (discountType === 'amount') salePrice = round2(discountValue);
    else salePrice = round2(price * (1 - Math.min(100, Math.max(0, discountValue)) / 100));
  }
  let isOnSaleNow = false;
  if (onSale && salePrice != null && salePrice > 0 && salePrice < price) {
    const now = Date.now();
    const startOk = !saleStartsAt || now >= new Date(saleStartsAt).getTime();
    const endOk = !saleEndsAt || now <= new Date(saleEndsAt).getTime();
    isOnSaleNow = startOk && endOk;
  }
  const effectivePrice = isOnSaleNow ? salePrice : price;
  let discountPercentLabel = 0;
  if (isOnSaleNow) {
    discountPercentLabel = discountType === 'percent'
      ? Math.round(discountValue)
      : Math.round(((price - salePrice) / price) * 100);
  }
  return { salePrice, isOnSaleNow, effectivePrice, discountPercentLabel };
}

productSchema.virtual('salePrice').get(function () { return computeSale(this.price, this).salePrice; });
productSchema.virtual('isOnSaleNow').get(function () { return computeSale(this.price, this).isOnSaleNow; });
productSchema.virtual('effectivePrice').get(function () { return computeSale(this.price, this).effectivePrice; });
productSchema.virtual('discountPercentLabel').get(function () { return computeSale(this.price, this).discountPercentLabel; });

productSchema.virtual('hasVariants').get(function () {
  return Array.isArray(this.variants) && this.variants.length > 0;
});

productSchema.virtual('variantsView').get(function () {
  if (!this.hasVariants) return [];
  return this.variants.map((v) => {
    const s = computeSale(v.price, this);
    return {
      _id: v._id, label: v.label, quantity: v.quantity, price: v.price,
      salePrice: s.salePrice, isOnSaleNow: s.isOnSaleNow,
      effectivePrice: s.effectivePrice, discountPercentLabel: s.discountPercentLabel,
    };
  });
});

productSchema.methods.priceForVariant = function (variantId) {
  const v = this.variants && this.variants.id(variantId);
  if (!v) return null;
  return computeSale(v.price, this).effectivePrice;
};
```

- [ ] **Step 5: Derive price/quantity before validation**

In `product.model.js`, add this hook immediately after the existing `productSchema.pre('save', …)` slug hook. It must be `pre('validate')` because Mongoose validates required fields before `save` middleware runs:

```javascript
// For variant products, derive the product-level price (lowest) and quantity
// (total stock) so price sort/filter and the card "From" price keep working.
productSchema.pre('validate', function (next) {
  if (Array.isArray(this.variants) && this.variants.length > 0) {
    this.price = Math.min(...this.variants.map((v) => Number(v.price)));
    this.quantity = this.variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0);
  }
  next();
});
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/product.variants.model.test.js`
Expected: PASS (4 tests).

- [ ] **Step 7: Regression — sale tests still green**

Run: `npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/product.sale.test.js` (or the existing sale test file; run `ls tests | grep -i sale` if unsure).
Expected: PASS — the virtual refactor is behavior-preserving.

- [ ] **Step 8: Commit**

```bash
cd backend
git add src/models/product.model.js tests/product.variants.model.test.js
git commit -m "feat: product variants — embedded variants, computeSale, variantsView, derive"
```

---

### Task 2: Validator + controller accept variants (TDD)

**Files:**
- Modify: `backend/src/validators/product.validator.js`
- Modify: `backend/src/controllers/product.controller.js`
- Test: `backend/tests/product.variants.api.test.js`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/product.variants.api.test.js`. Reuse the multipart create pattern from the existing product/sale test (open `tests/product.sale.test.js` or `tests/product.controller.test.js` to copy the admin-token helper and the cloudinary mock; match its exact helper names):

```javascript
process.env.NODE_ENV = 'test';
jest.mock('../src/utils/cloudinary', () => ({
  uploadToCloudinary: jest.fn().mockResolvedValue({ secure_url: 'https://cdn/x.jpg', public_id: 'products/x' }),
  uploadMultipleToCloudinary: jest.fn().mockResolvedValue([{ url: 'https://cdn/x.jpg', publicId: 'products/x' }]),
  deleteFromCloudinary: jest.fn().mockResolvedValue({}),
}));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Product = require('../src/models/product.model');

async function adminToken() {
  const email = `admin-${Date.now()}@test.com`;
  await User.create({ name: 'Admin', email, phoneNumber: '12345678', address: 'x', password: 'Password123*', role: 'admin' });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Password123*' });
  return res.body.data.accessToken;
}

describe('Product variants API', () => {
  let token;
  beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });
  beforeEach(async () => { await Product.deleteMany({}); await User.deleteMany({}); token = await adminToken(); });
  afterAll(async () => { await mongoose.connection.close(); });

  it('creates a product with variants and derives price/quantity', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .field('name', 'Dog Food')
      .field('description', 'Premium kibble for dogs')
      .field('categories', 'food')
      .field('variants', JSON.stringify([
        { label: '1kg', price: 300, quantity: 5 },
        { label: '5kg', price: 1200, quantity: 8 },
      ]))
      .attach('images', Buffer.from('img'), 'x.jpg');
    expect(res.status).toBe(201);
    expect(res.body.data.price).toBe(300);
    expect(res.body.data.quantity).toBe(13);
    expect(res.body.data.variants).toHaveLength(2);
  });

  it('rejects a product with neither variants nor price/quantity', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .field('name', 'No Price')
      .field('description', 'Missing price and quantity here')
      .field('categories', 'food')
      .attach('images', Buffer.from('img'), 'x.jpg');
    expect(res.status).toBe(400);
  });
});
```

> If the product route field for images, the cloudinary util path, or the multipart field names differ, copy them verbatim from the existing product test before running.

- [ ] **Step 2: Run to verify it fails**

Run: `npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/product.variants.api.test.js`
Expected: FAIL — variants ignored; price/quantity still required so the first test 400s.

- [ ] **Step 3: Relax price/quantity + accept variants in the validator**

In `backend/src/validators/product.validator.js`, in the **create** schema (`validateProduct`): remove `.required()` from `price` and `quantity` (keep the `min`/`integer` rules), and add `variants: Joi.string().optional()` next to the `sections` line. Do the same `variants: Joi.string().optional()` addition in the **update** schema (`validateProductUpdate`).

Then, in `validateProduct`, after the existing `const saleErr = saleValidationError(value); if (saleErr) …` block, add a variants-or-price guard:

```javascript
  // Either variants (a non-empty JSON array) or both price and quantity must be present.
  let parsedVariants = [];
  if (value.variants) {
    try { parsedVariants = JSON.parse(value.variants); } catch { return next(new AppError('Invalid variants format', 400)); }
  }
  if (!Array.isArray(parsedVariants) || parsedVariants.length === 0) {
    if (value.price === undefined || value.quantity === undefined) {
      return next(new AppError('Either variants, or price and quantity, are required', 400));
    }
  } else {
    for (const v of parsedVariants) {
      if (!v.label || typeof v.label !== 'string' || Number(v.price) < 0 || Number(v.quantity) < 0
          || v.price === undefined || v.quantity === undefined) {
        return next(new AppError('Each variant needs a label, price (>=0) and quantity (>=0)', 400));
      }
    }
  }
```

- [ ] **Step 4: Parse variants in the controller**

In `backend/src/controllers/product.controller.js`, in the **create** handler, right after the existing sections-parse block (`if (req.body.sections && typeof req.body.sections === 'string') { … }`), add:

```javascript
    // Parse variants JSON string from FormData
    if (req.body.variants && typeof req.body.variants === 'string') {
      try { req.body.variants = JSON.parse(req.body.variants); } catch { req.body.variants = []; }
    }
```

In the **update** handler, add the same parse block after its sections-parse block, and (because `findByIdAndUpdate` skips the `pre('validate')` derive hook) derive price/quantity into `updateData` when variants are present. After the line that builds `updateData` (the `const { keepImages: keepImagesStr, ...updateData } = req.body;` line), add:

```javascript
    if (Array.isArray(updateData.variants) && updateData.variants.length > 0) {
      updateData.price = Math.min(...updateData.variants.map((v) => Number(v.price)));
      updateData.quantity = updateData.variants.reduce((s, v) => s + (Number(v.quantity) || 0), 0);
    }
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/product.variants.api.test.js`
Expected: PASS (2 tests). Re-run once if the auth `beforeEach` flakes.

- [ ] **Step 6: Regression**

Run: `npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/product.sale.test.js tests/product.controller.test.js`
Expected: PASS — non-variant create still requires price/quantity (the controller guard enforces it).

- [ ] **Step 7: Commit**

```bash
cd backend
git add src/validators/product.validator.js src/controllers/product.controller.js tests/product.variants.api.test.js
git commit -m "feat: accept product variants on create/update (validator + controller)"
```

---

## Phase 2 — Backend purchase flow

### Task 3: Add `variantId` + `variantLabel` to cart/order/subscription items

**Files:**
- Modify: `backend/src/models/cart.model.js`, `order.model.js`, `subscription.model.js`

- [ ] **Step 1: Add the fields to each item schema**

In each of `cart.model.js`, `order.model.js`, and `subscription.model.js`, find the per-item sub-schema (the one with `product`, `quantity`, `price` — in subscription it's `items: [{ product, quantity }]`) and add these two fields alongside `product`:

```javascript
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    variantLabel: { type: String, default: null },
```

(For `subscription.model.js`, add them inside the `items` array sub-object next to `product` and `quantity`.)

- [ ] **Step 2: Sanity build**

Run: `npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/order.controller.test.js`
Expected: PASS — additive optional fields don't break existing flows.

- [ ] **Step 3: Commit**

```bash
cd backend
git add src/models/cart.model.js src/models/order.model.js src/models/subscription.model.js
git commit -m "feat: variantId + variantLabel on cart/order/subscription items"
```

---

### Task 4: Variant-aware add-to-cart (TDD)

**Files:**
- Modify: `backend/src/validators/cart.validator.js` (allow `variantId`)
- Modify: `backend/src/controllers/cart.controller.js`
- Test: `backend/tests/cart.variants.test.js`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/cart.variants.test.js`:

```javascript
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Product = require('../src/models/product.model');
const Cart = require('../src/models/cart.model');

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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/cart.variants.test.js`
Expected: FAIL — variantId ignored; one merged line; no 400.

- [ ] **Step 3: Allow `variantId` in the cart validator**

In `backend/src/validators/cart.validator.js`, in the `validateAddToCart` schema, add `variantId: Joi.string().hex().length(24).optional()` (next to `productId`).

- [ ] **Step 4: Make `addToCart` variant-aware**

In `backend/src/controllers/cart.controller.js`, replace the body of `exports.addToCart` (the part from `const { productId, quantity } = req.body;` through the `cart.items.push(...)` / `existingItem` logic) with:

```javascript
    const { productId, variantId = null, quantity } = req.body;

    const product = await Product.findById(productId);

    // Variant products require a variant selection.
    if (product && product.hasVariants && !variantId) {
      return next(new AppError('Please select a size/option', 400));
    }

    let itemPrice = 0;
    let variantLabel = null;
    if (product) {
      if (variantId && product.hasVariants) {
        const v = product.variants.id(variantId);
        if (!v) return next(new AppError('Selected option is unavailable', 400));
        itemPrice = product.priceForVariant(variantId);
        variantLabel = v.label;
      } else {
        itemPrice = product.effectivePrice;
      }
    }

    let cart = await Cart.findOne({ user: req.user.id });
    if (!cart) cart = await Cart.create({ user: req.user.id });

    // A line is identified by product + variant.
    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId
        && String(item.variantId || '') === String(variantId || ''),
    );

    if (existingItem) {
      existingItem.quantity += quantity;
      if (product) existingItem.price = itemPrice;
    } else {
      cart.items.push({ product: productId, variantId, variantLabel, quantity, price: itemPrice });
    }
```

(Leave the `await cart.save()` + response below unchanged.)

- [ ] **Step 5: Run to verify it passes**

Run: `npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/cart.variants.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
cd backend
git add src/validators/cart.validator.js src/controllers/cart.controller.js tests/cart.variants.test.js
git commit -m "feat: variant-aware add-to-cart (line = product + variant)"
```

---

### Task 5: Variant pricing + stock reservation in `buildOrder` (TDD)

**Files:**
- Modify: `backend/src/services/order.service.js`
- Modify: `backend/src/controllers/order.controller.js` (pass `variantId` through)
- Test: `backend/tests/order.variants.test.js`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/order.variants.test.js`:

```javascript
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
    expect(fresh.variants.id(v5).quantity).toBe(6);            // 8 - 2
    expect(fresh.variants.id(product.variants[0]._id).quantity).toBe(5); // 1kg untouched
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/order.variants.test.js`
Expected: FAIL — buildOrder ignores variantId; prices off product.effectivePrice and decrements product.quantity.

- [ ] **Step 3: Make `buildOrder` variant-aware**

In `backend/src/services/order.service.js`, inside the first `for (const item of items)` loop, replace the price/stock computation so it resolves a variant when `item.variantId` is present. Replace the loop body (the block computing `price`, checking stock, and pushing to `orderItems`) with:

```javascript
    // eslint-disable-next-line no-await-in-loop
    const product = await Product.findById(item.product).session(session);
    if (!product) throw new AppError('Product not found', 404);
    if (!product.isActive) throw new AppError(`Product ${product.name} is not available`, 400);

    let price;
    let variantLabel = null;
    if (item.variantId && product.hasVariants) {
      const v = product.variants.id(item.variantId);
      if (!v) throw new AppError(`Selected option for ${product.name} is unavailable`, 400);
      if (v.quantity != null && v.quantity < item.quantity) {
        throw new AppError(`Insufficient stock for ${product.name} (${v.label})`, 400);
      }
      price = product.priceForVariant(item.variantId);
      variantLabel = v.label;
    } else {
      if (product.quantity != null && product.quantity > 0 && product.quantity < item.quantity) {
        throw new AppError(`Insufficient stock for ${product.name}`, 400);
      }
      price = product.effectivePrice;
    }

    totalItems += item.quantity;
    totalAmount += price * item.quantity;
    orderItems.push({
      product: product._id, quantity: item.quantity, price,
      variantId: item.variantId || null, variantLabel,
    });
```

- [ ] **Step 4: Reserve variant stock in the movements loop**

In the same file, in the second loop that decrements stock (`for (const item of orderItems) { … }`), replace its body with a variant-aware version:

```javascript
    // eslint-disable-next-line no-await-in-loop
    const prod = await Product.findById(item.product).session(session);
    let prevQty;
    let newQty;
    if (item.variantId && prod && prod.variants && prod.variants.id(item.variantId)) {
      const v = prod.variants.id(item.variantId);
      prevQty = v.quantity;
      newQty = Math.max(0, prevQty - item.quantity);
      // eslint-disable-next-line no-await-in-loop
      await Product.updateOne(
        { _id: item.product, 'variants._id': item.variantId },
        { $inc: { 'variants.$.quantity': -item.quantity } },
        { session },
      );
    } else {
      prevQty = prod ? (prod.quantity ?? prod.stock ?? 0) : 0;
      newQty = Math.max(0, prevQty - item.quantity);
      const stockField = (prod && prod.quantity != null) ? 'quantity' : 'stock';
      // eslint-disable-next-line no-await-in-loop
      await Product.findByIdAndUpdate(item.product, { $inc: { [stockField]: -item.quantity } }, { session });
    }
    movements.push({
      product: item.product, type: 'order', delta: -item.quantity,
      prevQty, newQty, createdBy: userId, orderId: order._id,
    });
```

> Note: the `pre('validate')` derive hook only runs on `document.save()`, not `updateOne`/`findByIdAndUpdate`, so the product-level `price`/`quantity` won't auto-resync here. That's acceptable — the cart/order already snapshot the variant price, and product-level fields resync on the next admin save. (If exact live resync is wanted later, recompute in a follow-up; out of scope for v1.)

- [ ] **Step 5: Pass `variantId` from the order controller**

In `backend/src/controllers/order.controller.js`, change the cart→items mapping:

```javascript
      items: cart.items.map((i) => ({ product: i.product, variantId: i.variantId || null, quantity: i.quantity })),
```

- [ ] **Step 6: Run to verify it passes + regression**

Run: `npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/order.variants.test.js tests/order.controller.test.js`
Expected: PASS — variant test green; existing order tests unaffected (non-variant path unchanged).

- [ ] **Step 7: Commit**

```bash
cd backend
git add src/services/order.service.js src/controllers/order.controller.js tests/order.variants.test.js
git commit -m "feat: buildOrder prices + reserves stock per variant"
```

---

### Task 6: Subscriptions capture the variant (TDD)

**Files:**
- Modify: `backend/src/validators/subscription.validator.js`
- Modify: `backend/src/controllers/subscription.controller.js`
- Test: extend `backend/tests/subscription.controller.test.js`

- [ ] **Step 1: Write the failing test**

In `backend/tests/subscription.controller.test.js`, add a test inside the `describe('GET /api/subscriptions/process-due', …)` block (reuse the file's `makeProduct`, `customerId`, `ADDRESS`, and cron-secret helpers). It creates a variant product, subscribes to the 5kg variant, runs the cron, and asserts the generated order used the variant:

```javascript
    it('reorders the chosen variant for a due subscription', async () => {
      const product = await Product.create({
        name: 'Var Food', description: 'Premium kibble dogs', categories: ['food'], createdBy: admin._id,
        images: [{ url: 'https://cdn/x.jpg', publicId: 'products/x' }],
        variants: [{ label: '1kg', price: 300, quantity: 5 }, { label: '5kg', price: 1200, quantity: 8 }],
      });
      const v5 = product.variants[1]._id;
      const sub = await Subscription.create({
        user: customerId, items: [{ product: product._id, variantId: v5, variantLabel: '5kg', quantity: 1 }],
        shippingAddress: ADDRESS, paymentMethod: 'stripe', intervalUnit: 'week', intervalCount: 2,
        discountPercent: 0, nextRunAt: new Date(Date.now() - 1000), source: 'product',
      });

      const res = await request(app).get('/api/subscriptions/process-due')
        .set('Authorization', 'Bearer test-cron-secret');
      expect(res.status).toBe(200);
      expect(res.body.processed).toBe(1);

      const orders = await Order.find({ user: customerId });
      expect(orders[0].items[0].variantLabel).toBe('5kg');
      expect(orders[0].totalAmount).toBe(1200);

      const fresh = await Product.findById(product._id);
      expect(fresh.variants.id(v5).quantity).toBe(7);
    });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/subscription.controller.test.js -t "reorders the chosen variant"`
Expected: FAIL — `processDue` stock pre-check reads product.quantity, and items passed to buildOrder omit `variantId`.

- [ ] **Step 3: Allow `variantId` in the subscription validator**

In `backend/src/validators/subscription.validator.js`, in **both** the create and update item schemas (`items: Joi.array().items(Joi.object({ product, quantity }))`), add `variantId: Joi.string().hex().length(24).optional()` to the item object.

- [ ] **Step 4: Pass `variantId` through `processDue` (and fix its stock pre-check)**

In `backend/src/controllers/subscription.controller.js`, inside `processDue`'s per-sub transaction:

(a) Update the stock pre-check loop to read variant stock when present:

```javascript
          let inStock = true;
          for (const it of sub.items) {
            // eslint-disable-next-line no-await-in-loop
            const product = await Product.findById(it.product).session(session);
            let available = 0;
            if (it.variantId && product && product.variants && product.variants.id(it.variantId)) {
              available = product.variants.id(it.variantId).quantity ?? 0;
            } else if (product && product.quantity != null) {
              available = product.quantity;
            }
            if (!product || available < it.quantity) { inStock = false; break; }
          }
```

(b) In the `buildOrder({ … items: sub.items.map(...) … })` call, include the variant:

```javascript
            items: sub.items.map((i) => ({ product: i.product, variantId: i.variantId || null, quantity: i.quantity })),
```

- [ ] **Step 5: Run to verify it passes + regression**

Run: `npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/subscription.controller.test.js`
Expected: PASS (all, incl. the new variant test). Re-run once if the auth `beforeEach` flakes.

- [ ] **Step 6: Commit**

```bash
cd backend
git add src/validators/subscription.validator.js src/controllers/subscription.controller.js tests/subscription.controller.test.js
git commit -m "feat: subscriptions capture + reorder the chosen variant"
```

---

## Phase 3 — Frontend

### Task 7: cartApi + CartContext send/track the variant

**Files:**
- Modify: `frontend/src/Services/api/cartApi.js`
- Modify: `frontend/src/context/CartContext.jsx`

- [ ] **Step 1: cartApi.addToCart accepts variantId**

In `frontend/src/Services/api/cartApi.js`, update `addToCart`:

```javascript
  addToCart: async (productId, quantity = 1, variantId = null) => {
    const response = await api.post("/cart", { productId, quantity, variantId });
    return response.data;
  },
```

- [ ] **Step 2: CartContext — composite line id + pass variantId**

In `frontend/src/context/CartContext.jsx`:

(a) In the login-restore `converted` mapping, build a composite id and keep variant fields so restored lines stay distinct:

```javascript
          const converted = backendCart.items.map((item) => ({
            id: item.variantId ? `${item.product?._id || item.product}::${item.variantId}` : (item.product?._id || item.product),
            productId: item.product?._id || item.product,
            variantId: item.variantId || null,
            variantLabel: item.variantLabel || null,
            name: item.product?.name || "Product",
            price: item.price,
            image: item.product?.images?.[0]?.url || "",
            quantity: item.quantity,
          }));
```

(b) In `addItem`, sync using the item's real product id + variant (the local `item.id` may be composite):

```javascript
  const addItem = useCallback(
    async (item, quantity = 1) => {
      rucRef.current.addItem(item, quantity);
      if (user) {
        try {
          await cartApi.addToCart(item.productId || item.id, quantity, item.variantId || null);
        } catch { /* silent */ }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id]
  );
```

(c) In the "push up local cart after login" branch, also pass variant:

```javascript
          ruc.items.forEach((item) => {
            cartApi.addToCart(item.productId || item.id, item.quantity, item.variantId || null).catch(() => {});
          });
```

(Leave `removeItem`/`updateItemQuantity` keyed by the local composite `id` — the backend cart is rebuilt at checkout, so their best-effort backend sync staying product-keyed is acceptable for v1.)

- [ ] **Step 3: Build**

Run (from `frontend/`): `npm run build`
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
cd frontend
git add src/Services/api/cartApi.js src/context/CartContext.jsx
git commit -m "feat: cart tracks variant (composite line id, sends variantId)"
```

---

### Task 8: Product page size selector

**Files:**
- Modify: `frontend/src/Pages/IndividualProductItemPage/IndividualProductItemPage.jsx`
- Modify: `frontend/src/Pages/IndividualProductItemPage/IndividaulItemPage.css`

- [ ] **Step 1: Add variant state + selection**

Near the other `useState` calls (after `const [quantity, setQuantity] = useState(1);`), add:

```jsx
  const [selectedVariant, setSelectedVariant] = useState(null);
```

After the product loads (in the existing `setProduct(...)` effect, or a new `useEffect` keyed on `product`), default to the first in-stock variant:

```jsx
  useEffect(() => {
    if (product?.variantsView?.length) {
      const inStock = product.variantsView.find((v) => v.quantity > 0) || product.variantsView[0];
      setSelectedVariant(inStock);
    }
  }, [product]);
```

- [ ] **Step 2: Derive display price/stock from the selected variant**

Find where `stockQty` and the price are computed (around `const stockQty = product.stock ?? product.quantity ?? null;`). Add variant-aware values right after:

```jsx
  const hasVariants = Array.isArray(product.variantsView) && product.variantsView.length > 0;
  const vStock = hasVariants ? (selectedVariant?.quantity ?? 0) : stockQty;
  const displayPrice = hasVariants ? (selectedVariant?.price ?? product.price) : product.price;
  const displaySalePrice = hasVariants ? (selectedVariant?.salePrice ?? null) : product.salePrice;
  const displayOnSale = hasVariants ? !!selectedVariant?.isOnSaleNow : product.isOnSaleNow;
  const displayPctLabel = hasVariants ? (selectedVariant?.discountPercentLabel ?? 0) : product.discountPercentLabel;
```

Update the `ProductPrice` / `SaleBadge` in the price row to use these (`price={displayPrice} salePrice={displaySalePrice} isOnSaleNow={displayOnSale}` and `<SaleBadge percent={displayPctLabel} />`), and change the quantity-stepper `disabled` and the stock badge to use `vStock` instead of `stockQty`.

- [ ] **Step 3: Render the size selector**

Just above the `ip-actions` purchase panel (after the price row / overview), add:

```jsx
            {hasVariants && (
              <div className="ip-variants">
                <span className="ip-variants-label">Size</span>
                <div className="ip-variants-row">
                  {product.variantsView.map((v) => (
                    <button
                      key={v._id}
                      type="button"
                      className={`ip-variant${selectedVariant?._id === v._id ? " ip-variant--active" : ""}${v.quantity <= 0 ? " ip-variant--out" : ""}`}
                      disabled={v.quantity <= 0}
                      onClick={() => setSelectedVariant(v)}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
```

- [ ] **Step 4: Pass the variant on add-to-cart + subscribe**

In `handleAddToCart`, pass the composite id + variant fields to `addItem`. Find the `addItem({...})` / `addItem(item, quantity)` call and build the item so variant products produce a distinct line:

```jsx
    const variantId = hasVariants ? selectedVariant?._id : null;
    const lineId = variantId ? `${productId}::${variantId}` : productId;
    addItem(
      {
        id: lineId,
        productId,
        variantId,
        variantLabel: hasVariants ? selectedVariant?.label : null,
        name: productName,
        price: displayOnSale ? displaySalePrice : displayPrice,
        image: images[0],
      },
      quantity
    );
```

(Adapt the object keys to the existing `addItem` call's shape — keep whatever extra fields it already passes.)

Pass the variant to the Subscribe widget too: `<SubscribeWidget product={product} quantity={quantity} variantId={hasVariants ? selectedVariant?._id : null} />`, and in `SubscribeWidget.jsx` include `variantId` in the `items` payload: `items: [{ product: product._id || product.id, variantId: variantId || null, quantity }]`.

- [ ] **Step 5: Add CSS**

Append to `IndividaulItemPage.css`:

```css
.ip-variants { margin: 0.4rem 0 0.2rem; }
.ip-variants-label {
  display: block; font-size: 0.78rem; font-weight: 600; letter-spacing: 0.04em;
  text-transform: uppercase; color: #8a958c; margin-bottom: 0.5rem;
}
.ip-variants-row { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.ip-variant {
  min-width: 56px; padding: 0.5rem 1rem; border-radius: 12px;
  border: 1.5px solid rgba(0, 28, 16, 0.14); background: #fff;
  font-family: var(--font-body); font-weight: 600; font-size: 0.9rem;
  color: var(--color-primary-forest, #001c10); cursor: pointer; transition: all 0.16s ease;
}
.ip-variant:hover:not(:disabled) { border-color: var(--color-accent-gold, #d99a2b); }
.ip-variant--active {
  background: var(--color-primary-forest, #001c10); border-color: var(--color-primary-forest, #001c10); color: #f6ece3;
}
.ip-variant--out { opacity: 0.4; cursor: not-allowed; text-decoration: line-through; }
```

- [ ] **Step 6: Build + browser check**

Run: `npm run build`. Then open a variant product in the preview and confirm: size chips render, selecting one updates the price/sale badge and the max quantity, out-of-stock sizes are disabled, and Add to Cart produces a line with the size label.

- [ ] **Step 7: Commit**

```bash
cd frontend
git add src/Pages/IndividualProductItemPage/ src/Components/Subscriptions/SubscribeWidget.jsx
git commit -m "feat: product page size/weight selector + variant add-to-cart"
```

---

### Task 9: Product cards — "From" price + force size choice

**Files:**
- Modify: `frontend/src/Components/HelperComponents/ProductCard/ProductCardV2.jsx`

- [ ] **Step 1: Show "From {lowest}" and route variant products to detail**

Open `ProductCardV2.jsx`. It already receives product fields and has `navigate(\`/product/${id}\`)` on the card and a `handleAddToCart`. Add a `hasVariants` flag from the product props (the card is passed product fields in `PetShopPage` — thread `variantsView`/`hasVariants` through, or read `product.variantsView`). Then:

- When `hasVariants`, render the price as `From {formatted lowest effectivePrice}` (lowest = `Math.min(...variantsView.map(v => v.effectivePrice))`).
- When `hasVariants`, the quick add-to-cart button instead navigates to the product detail (so the user must pick a size): change its `onClick` to `navigate(\`/product/${id}\`)` and its label to "Select options".

Thread the needed fields: in `PetShopPage.jsx` and the featured carousel where `<ProductCard … />` is rendered, pass `variantsView={p.variantsView}` (and any `hasVariants`). Adapt prop names to the card's existing signature.

- [ ] **Step 2: Build + check**

Run: `npm run build`. In the preview, a variant product card shows "From Rs X" and its button opens the detail page; non-variant cards are unchanged.

- [ ] **Step 3: Commit**

```bash
cd frontend
git add src/Components/HelperComponents/ProductCard/ProductCardV2.jsx src/Pages/PetShopPage/PetShopPage.jsx
git commit -m "feat: product cards show From-price and route variant items to detail"
```

---

### Task 10: Admin product form — variants editor

**Files:**
- Modify: `frontend/src/Pages/Admin/Products/AdminProductForm.jsx`

- [ ] **Step 1: Add variants state**

Near the other state (`const [sections, setSections] = useState([]);`), add:

```jsx
  const [variants, setVariants] = useState([]); // [{ label, price, quantity }]
```

In the edit-mode hydrate effect (where `setSections(...)` runs from the loaded product), add:

```jsx
        setVariants(Array.isArray(p.variants) ? p.variants.map((v) => ({ label: v.label, price: v.price, quantity: v.quantity })) : []);
```

- [ ] **Step 2: Render the variants editor**

Above the price/quantity inputs (or in a dedicated section near them), add an editor. When `variants.length > 0`, hide the top-level price/quantity inputs and show a hint:

```jsx
        <div className="apf-variants">
          <div className="apf-variants-head">
            <label>Weight / size variants</label>
            <button type="button" onClick={() => setVariants((vs) => [...vs, { label: "", price: "", quantity: "" }])}>
              + Add variant
            </button>
          </div>
          {variants.length > 0 && (
            <p className="apf-hint">Price &amp; stock are set per variant — the top-level price/stock are derived automatically.</p>
          )}
          {variants.map((v, i) => (
            <div key={i} className="apf-variant-row">
              <input placeholder="Label (e.g. 5kg)" value={v.label}
                onChange={(e) => setVariants((vs) => vs.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
              <input type="number" min="0" placeholder="Price" value={v.price}
                onChange={(e) => setVariants((vs) => vs.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} />
              <input type="number" min="0" placeholder="Stock" value={v.quantity}
                onChange={(e) => setVariants((vs) => vs.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} />
              <button type="button" onClick={() => setVariants((vs) => vs.filter((_, j) => j !== i))}>Remove</button>
            </div>
          ))}
        </div>
```

Wrap the existing price + quantity fields so they only render `when variants.length === 0` (e.g. `{variants.length === 0 && ( …price/quantity inputs… )}`).

- [ ] **Step 3: Send variants in the multipart payload**

In the submit handler, where the FormData is assembled (the existing `sections` append uses `fd.append("sections", JSON.stringify(sections))`), add — only when there are variants — a normalized append, and skip appending price/quantity when variants exist:

```jsx
    if (variants.length > 0) {
      fd.append("variants", JSON.stringify(
        variants.map((v) => ({ label: v.label.trim(), price: Number(v.price), quantity: Number(v.quantity) }))
      ));
    }
```

(Find the lines that `fd.append("price", …)` / `fd.append("quantity", …)` and guard them with `if (variants.length === 0)`.)

- [ ] **Step 4: Minimal CSS**

Append to the admin product form's stylesheet (find the CSS file imported by `AdminProductForm.jsx`):

```css
.apf-variants { margin: 1rem 0; }
.apf-variants-head { display: flex; align-items: center; justify-content: space-between; }
.apf-variant-row { display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 8px; margin-top: 8px; }
.apf-hint { font-size: 12px; color: #8a7a66; margin: 6px 0; }
```

- [ ] **Step 5: Build + check**

Run: `npm run build`. In the preview, Admin → Products → New: add 2 variants, save, and confirm the product detail shows the size selector with those prices.

- [ ] **Step 6: Commit**

```bash
cd frontend
git add src/Pages/Admin/Products/
git commit -m "feat: admin product form — weight/size variants editor"
```

---

### Task 11: Show the variant label in cart, checkout, orders, subscriptions

**Files:**
- Modify: `frontend/src/Pages/CartCheckoutPage/CartCheckOutPage.jsx` (cart line + summary)
- Modify: `frontend/src/Pages/Subscriptions/MySubscriptions.jsx`, `frontend/src/Pages/MyOrders/*` (where line items render)

- [ ] **Step 1: Render the label under the product name**

Wherever a cart/order/subscription line shows the product name, append the variant when present, e.g.:

```jsx
{item.variantLabel && <span className="line-variant"> · {item.variantLabel}</span>}
```

For orders/subscriptions the items come from the backend (`item.variantLabel`); for the cart they come from the local cart line (`item.variantLabel`). Add a tiny muted style for `.line-variant` (`font-size: 0.82em; color: #8a958c;`) in the nearest stylesheet.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
cd frontend
git add -A
git commit -m "feat: show variant label on cart/order/subscription lines"
```

---

## Task 12: Final verification

- [ ] **Step 1: Backend suites**

Run (from `backend/`):
```bash
npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/product.variants.model.test.js tests/product.variants.api.test.js tests/cart.variants.test.js tests/order.variants.test.js tests/subscription.controller.test.js tests/order.controller.test.js
```
Expected: all pass (re-run once if the auth `beforeEach` flakes).

- [ ] **Step 2: Frontend build + tests**

Run (from `frontend/`):
```bash
npx vitest run
npm run build
```
Expected: pass + clean build.

- [ ] **Step 3: Browser smoke**

- Admin → create a product with 1kg/3kg/5kg variants → product detail shows size chips; selecting changes price + max qty; out-of-stock size disabled.
- Add 1kg and 5kg of the same product → two cart lines, each labelled; checkout creates one order with both variant lines; stock decrements per variant.
- Subscribe to a variant → it appears in My Subscriptions with the size; the cron reorders that variant.
- Non-variant products and existing orders are unchanged.

---

## Self-Review

**Spec coverage:**
- Embedded `variants[]`, per-variant price + stock → Task 1 ✅
- `hasVariants`, derive price/quantity, `computeSale`, `variantsView`, `priceForVariant` → Task 1 ✅
- Validator/controller accept variants; variants-or-price → Task 2 ✅
- `variantId` + `variantLabel` on cart/order/subscription items → Task 3 ✅
- Variant-aware add-to-cart; line = product+variant → Task 4 ✅
- `buildOrder` variant pricing + variant stock reservation; order controller passes variantId → Task 5 ✅
- Subscriptions capture + reorder variant → Task 6 ✅
- Frontend cart variantId + composite line id → Task 7 ✅
- Product-page size selector + variant add-to-cart + Subscribe variant → Task 8 ✅
- Cards "From" price + route-to-detail → Task 9 ✅
- Admin variants editor → Task 10 ✅
- Variant label in cart/order/subscription UI → Task 11 ✅

**Placeholder scan:** No TBD/TODO. Frontend tasks (8–11) use grep-first adaptation against existing files (`addItem` shape, card props, admin FormData appends, line-item render sites) — these are grounded edits to existing code with concrete snippets, not missing logic, matching the convention used in the recurring-orders plan.

**Type/name consistency:** `variantId` + `variantLabel` are the field names used uniformly across models (Task 3), cart controller (Task 4), buildOrder (Task 5), subscriptions (Task 6), and frontend (Tasks 7–8, 11). `computeSale(basePrice, saleFields)` is defined in Task 1 and reused by `variantsView`/`priceForVariant` there. `variantsView[*].effectivePrice` is produced in Task 1 and consumed in Tasks 8 (price display) and 9 ("From" price). The composite cart line id `\`${productId}::${variantId}\`` is defined in Task 7 and produced in Task 8. `priceForVariant(variantId)` defined in Task 1, used in Tasks 4 and 5.
