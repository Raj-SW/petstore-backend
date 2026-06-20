# Discounts / On-Sale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-product sale pricing — admins discount a product by percent or fixed price with an optional schedule; customers see the sale price + struck original + "−X%" badge, and checkout charges the sale price.

**Architecture:** Store only the admin inputs on the Product (`onSale`, `discountType`, `discountValue`, `saleStartsAt`, `saleEndsAt`); expose four live Mongoose virtuals (`salePrice`, `isOnSaleNow`, `effectivePrice`, `discountPercentLabel`) that serialize into JSON. Checkout and cart use `effectivePrice`. Frontend renders from the serialized fields via a shared `ProductPrice` + `SaleBadge`.

**Tech Stack:** Express + Mongoose + Joi + Jest/supertest (backend, on `feature/feedback-engagement-2026-06-14`); React 18 + the currency-aware `Price` + vitest (frontend, same branch). No new packages.

**⚠️ Repo layout:** `backend/` and `frontend/` are **separate git repos**, both on branch `feature/feedback-engagement-2026-06-14`. Commit backend changes in `backend/`, frontend in `frontend/`. Never `git add` across repos.

**Spec:** `backend/docs/superpowers/specs/2026-06-14-discounts-on-sale-design.md`.

---

## File Structure

**Backend (`backend/`)**

| File | Change |
|---|---|
| `src/models/product.model.js` | Add 5 fields + 4 virtuals + `round2` helper |
| `src/validators/product.validator.js` | Validate sale fields in create + update |
| `src/controllers/product.controller.js` | (no code change needed — `...req.body` already persists validated fields) |
| `src/controllers/order.controller.js` | `const { price } = product` → `const price = product.effectivePrice` |
| `src/controllers/cart.controller.js` | `addToCart`/`updateCartItem` use `product.effectivePrice` |
| `tests/product.sale.test.js` | New — virtuals, validator, checkout |

**Frontend (`frontend/`)**

| File | Change |
|---|---|
| `src/Components/HelperComponents/Price/ProductPrice.jsx` (+`.css`) | New — sale + struck original |
| `src/Components/HelperComponents/SaleBadge/SaleBadge.jsx` (+`.css`) | New — "−X% OFF" pill |
| `src/Components/HelperComponents/Price/ProductPrice.test.jsx` | New — vitest |
| `src/Components/HelperComponents/ProductCard/ProductCardV2.jsx` | Use `ProductPrice` + `SaleBadge`; cart uses effective price |
| `src/Pages/PetShopPage/PetShopPage.jsx` | Pass sale fields to card |
| `src/Pages/HomePage/HomePageSections/FeaturedProductSection.jsx` | Pass sale fields to card |
| `src/Pages/IndividualProductItemPage/IndividualProductItemPage.jsx` | Sale display + effective price to cart |
| `src/Pages/Admin/Products/AdminProductForm.jsx` | Sale/discount form section + preview + FormData |
| `src/Pages/Admin/Products/AdminProducts.jsx` | "On Sale" badge in the table |

---

## Phase 1 — Backend

### Task 1: Failing tests for sale virtuals, validator, checkout

**Files:**
- Create: `backend/tests/product.sale.test.js`

- [ ] **Step 1: Write the failing test file**

```js
/**
 * Discounts / On-Sale — Product sale virtuals, validator, and checkout charging.
 */
jest.mock('../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Product = require('../src/models/product.model');
const Cart = require('../src/models/cart.model');
const Order = require('../src/models/order.model');

const makeUser = (o = {}) => ({
  name: 'Test User', email: `u-${Date.now()}-${Math.random()}@x.com`,
  phoneNumber: '12345678', address: '1 St', password: 'Password123*', ...o,
});

const baseProduct = (o = {}) => ({
  name: 'Dog Food', description: 'A good product description here.',
  price: 100, quantity: 50, categories: ['food'],
  images: [{ url: 'http://x/img.jpg', publicId: 'p1' }], isActive: true, ...o,
});

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
    const p = await Product.create(baseProduct({ onSale: true, discountType: 'percent', discountValue: 20 }));
    expect(p.salePrice).toBe(80);
    expect(p.isOnSaleNow).toBe(true);
    expect(p.effectivePrice).toBe(80);
    expect(p.discountPercentLabel).toBe(20);
  });

  it('salePrice: amount uses the absolute value', async () => {
    const p = await Product.create(baseProduct({ onSale: true, discountType: 'amount', discountValue: 75 }));
    expect(p.salePrice).toBe(75);
    expect(p.isOnSaleNow).toBe(true);
    expect(p.effectivePrice).toBe(75);
    expect(p.discountPercentLabel).toBe(25); // (100-75)/100
  });

  it('isOnSaleNow false when onSale is off → effectivePrice = price', async () => {
    const p = await Product.create(baseProduct({ onSale: false, discountType: 'percent', discountValue: 20 }));
    expect(p.isOnSaleNow).toBe(false);
    expect(p.effectivePrice).toBe(100);
    expect(p.discountPercentLabel).toBe(0);
  });

  it('isOnSaleNow false before the window starts', async () => {
    const p = await Product.create(baseProduct({
      onSale: true, discountType: 'percent', discountValue: 20,
      saleStartsAt: new Date(Date.now() + 60 * 60 * 1000),
    }));
    expect(p.isOnSaleNow).toBe(false);
    expect(p.effectivePrice).toBe(100);
  });

  it('isOnSaleNow false after the window ends', async () => {
    const p = await Product.create(baseProduct({
      onSale: true, discountType: 'percent', discountValue: 20,
      saleEndsAt: new Date(Date.now() - 60 * 60 * 1000),
    }));
    expect(p.isOnSaleNow).toBe(false);
    expect(p.effectivePrice).toBe(100);
  });

  it('isOnSaleNow true inside the window', async () => {
    const p = await Product.create(baseProduct({
      onSale: true, discountType: 'percent', discountValue: 10,
      saleStartsAt: new Date(Date.now() - 1000), saleEndsAt: new Date(Date.now() + 60 * 60 * 1000),
    }));
    expect(p.isOnSaleNow).toBe(true);
    expect(p.effectivePrice).toBe(90);
  });

  it('serializes virtuals to JSON', async () => {
    const p = await Product.create(baseProduct({ onSale: true, discountType: 'percent', discountValue: 20 }));
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

  const post = (body) => request(app).post('/api/products')
    .set('Authorization', `Bearer ${token}`).send(body);

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
    const p = await Product.create(baseProduct({ onSale: true, discountType: 'percent', discountValue: 20 }));
    const res = await checkout(p);
    expect(res.status).toBe(201);
    expect(res.body.data.totalAmount).toBe(160); // 80 * 2
    expect(res.body.data.items[0].price).toBe(80);
  });

  it('charges the full price when the sale is off', async () => {
    const p = await Product.create(baseProduct({ onSale: false, discountType: 'percent', discountValue: 20 }));
    const res = await checkout(p);
    expect(res.status).toBe(201);
    expect(res.body.data.totalAmount).toBe(200); // 100 * 2
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run (from `backend/`): `npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/product.sale.test.js`
Expected: FAIL — `salePrice`/`isOnSaleNow` undefined; validator allows bad values; checkout charges full price.

*(No commit yet — green at Task 4.)*

---

### Task 2: Product model — fields + virtuals

**Files:**
- Modify: `backend/src/models/product.model.js`

- [ ] **Step 1: Add the five fields**

In `src/models/product.model.js`, find the `isFeatured` field and add the sale fields immediately after it (still inside the schema-fields object):

```js
    isFeatured: {
      type: Boolean,
      default: false,
    },
    onSale: {
      type: Boolean,
      default: false,
    },
    discountType: {
      type: String,
      enum: ['percent', 'amount'],
      default: 'percent',
    },
    discountValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    saleStartsAt: {
      type: Date,
      default: null,
    },
    saleEndsAt: {
      type: Date,
      default: null,
    },
```

(Keep whatever field currently follows `isFeatured` after these.)

- [ ] **Step 2: Add the virtuals**

In `src/models/product.model.js`, after the schema is defined and before `module.exports` (e.g. just after the existing indexes block), add:

```js
// ── Sale pricing virtuals (derived live from the inputs; serialized via toJSON) ──
const round2 = (n) => Math.round(n * 100) / 100;

productSchema.virtual('salePrice').get(function () {
  if (!this.discountValue || this.discountValue <= 0) return null;
  if (this.discountType === 'amount') return round2(this.discountValue);
  const pct = Math.min(100, Math.max(0, this.discountValue));
  return round2(this.price * (1 - pct / 100));
});

productSchema.virtual('isOnSaleNow').get(function () {
  if (!this.onSale) return false;
  const sp = this.salePrice;
  if (sp == null || sp <= 0 || sp >= this.price) return false;
  const now = Date.now();
  if (this.saleStartsAt && now < new Date(this.saleStartsAt).getTime()) return false;
  if (this.saleEndsAt && now > new Date(this.saleEndsAt).getTime()) return false;
  return true;
});

productSchema.virtual('effectivePrice').get(function () {
  return this.isOnSaleNow ? this.salePrice : this.price;
});

productSchema.virtual('discountPercentLabel').get(function () {
  if (!this.isOnSaleNow) return 0;
  if (this.discountType === 'percent') return Math.round(this.discountValue);
  return Math.round(((this.price - this.salePrice) / this.price) * 100);
});
```

- [ ] **Step 3: Re-run tests**

Run: `npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/product.sale.test.js`
Expected: the "Product sale virtuals" block now PASSES; validator + checkout blocks still FAIL.

---

### Task 3: Validator — sale fields (create + update)

**Files:**
- Modify: `backend/src/validators/product.validator.js`

- [ ] **Step 1: Add a shared sale-validation helper**

At the top of `src/validators/product.validator.js`, after the imports (after `const { AppError } = require(...)` — if AppError isn't imported, add `const { AppError } = require('../middlewares/errorHandler');`), add:

```js
// Cross-field sale validation shared by create + update. Returns an error
// message string, or null if valid. `body` is the Joi-validated value object.
function saleValidationError(body) {
  if (!body.onSale) return null;
  const value = Number(body.discountValue);
  if (!value || value <= 0) return 'A discount value greater than 0 is required when a product is on sale';
  if (body.discountType === 'percent') {
    if (value < 1 || value > 100) return 'Percentage discount must be between 1 and 100';
  } else if (body.discountType === 'amount') {
    if (body.price !== undefined && !(value > 0 && value < Number(body.price))) {
      return 'Fixed sale price must be greater than 0 and less than the product price';
    }
  }
  if (body.saleStartsAt && body.saleEndsAt) {
    if (new Date(body.saleEndsAt).getTime() <= new Date(body.saleStartsAt).getTime()) {
      return 'Sale end date must be after the start date';
    }
  }
  return null;
}
```

- [ ] **Step 2: Add the sale fields to the create schema (`validateProduct`)**

In the `validateProduct` Joi object (next to `isActive`/`isFeatured`), add:

```js
    onSale:        Joi.boolean().truthy('true').falsy('false').default(false),
    discountType:  Joi.string().valid('percent', 'amount').default('percent'),
    discountValue: Joi.number().min(0).default(0),
    saleStartsAt:  Joi.date().allow('', null).optional(),
    saleEndsAt:    Joi.date().allow('', null).optional(),
```

Then, in `validateProduct`, right after `req.body = value;` and before `next();`, add the cross-field check:

```js
  const saleErr = saleValidationError(value);
  if (saleErr) return next(new AppError(saleErr, 400));
```

- [ ] **Step 3: Add the same to the update schema (`validateProductUpdate`)**

Add the identical five `Joi` lines into the `validateProductUpdate` schema object, and the same cross-field check after its `req.body = value;`:

```js
  const saleErr = saleValidationError(value);
  if (saleErr) return next(new AppError(saleErr, 400));
```

- [ ] **Step 4: Re-run tests**

Run: `npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/product.sale.test.js`
Expected: virtuals + validator blocks PASS; checkout block still FAILS (still charging full price).

---

### Task 4: Checkout + cart use effectivePrice → green

**Files:**
- Modify: `backend/src/controllers/order.controller.js`
- Modify: `backend/src/controllers/cart.controller.js`

- [ ] **Step 1: Order controller charges the effective price**

In `src/controllers/order.controller.js`, find:

```js
      const { price } = product;
```

Replace with:

```js
      const price = product.effectivePrice;
```

- [ ] **Step 2: Cart stores the effective price**

In `src/controllers/cart.controller.js`, in `addToCart`, find:

```js
    const itemPrice = product ? product.price : 0;
```

Replace with:

```js
    const itemPrice = product ? product.effectivePrice : 0;
```

Then in `updateCartItem`, find:

```js
    cartItem.price = product.price;
```

Replace with:

```js
    cartItem.price = product.effectivePrice;
```

- [ ] **Step 3: Run the sale tests to green**

Run: `npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/product.sale.test.js`
Expected: PASS — all blocks green.

- [ ] **Step 4: Run the order + product suites (no regressions)**

Run: `npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/order.controller.test.js`
Expected: PASS. (The full `npm test` is known-flaky under load — run suites individually.)

- [ ] **Step 5: Commit (inside `backend/`)**

```bash
cd backend
git add src/models/product.model.js src/validators/product.validator.js src/controllers/order.controller.js src/controllers/cart.controller.js tests/product.sale.test.js
git commit -m "feat: per-product sale pricing (model virtuals, validation, checkout) with tests"
```

---

## Phase 2 — Frontend display

### Task 5: ProductPrice + SaleBadge components (+ test)

**Files:**
- Create: `frontend/src/Components/HelperComponents/Price/ProductPrice.jsx`
- Create: `frontend/src/Components/HelperComponents/Price/ProductPrice.css`
- Create: `frontend/src/Components/HelperComponents/SaleBadge/SaleBadge.jsx`
- Create: `frontend/src/Components/HelperComponents/SaleBadge/SaleBadge.css`
- Create: `frontend/src/Components/HelperComponents/Price/ProductPrice.test.jsx`

- [ ] **Step 1: Create ProductPrice.jsx**

```jsx
import Price from "./Price";
import "./ProductPrice.css";

/**
 * Product price display: when on sale, shows the sale price with the original
 * struck-through beside it; otherwise just the price. Currency formatting is
 * delegated to <Price>.
 */
const ProductPrice = ({ price, salePrice, isOnSaleNow, className = "" }) => {
  if (isOnSaleNow && salePrice != null) {
    return (
      <span className={`product-price ${className}`}>
        <Price amount={salePrice} className="product-price-sale" />
        <Price amount={price} className="product-price-original" />
      </span>
    );
  }
  return <Price amount={price} className={className} />;
};

export default ProductPrice;
```

- [ ] **Step 2: Create ProductPrice.css**

```css
.product-price { display: inline-flex; align-items: baseline; gap: 0.45rem; }
.product-price-sale { font-weight: 700; color: #c0392b; }
.product-price-original { font-size: 0.82em; color: #999; text-decoration: line-through; }
```

- [ ] **Step 3: Create SaleBadge.jsx**

```jsx
import "./SaleBadge.css";

/** "−X% OFF" pill. Renders nothing when percent is falsy/0. */
const SaleBadge = ({ percent, className = "" }) => {
  if (!percent || percent <= 0) return null;
  return <span className={`sale-badge ${className}`}>-{percent}% OFF</span>;
};

export default SaleBadge;
```

- [ ] **Step 4: Create SaleBadge.css**

```css
.sale-badge {
  display: inline-block;
  background: #c0392b;
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  padding: 3px 8px;
  border-radius: 6px;
  line-height: 1;
}
```

- [ ] **Step 5: Create ProductPrice.test.jsx**

```jsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ProductPrice from "./ProductPrice";

// Price uses CurrencyContext; mock it to a plain formatter.
vi.mock("../../../context/CurrencyContext", () => ({
  useCurrency: () => ({ formatPrice: (n) => `Rs ${n}`, selectedCurrency: "MUR" }),
}));

describe("ProductPrice", () => {
  it("shows sale price + struck original when on sale", () => {
    render(<ProductPrice price={100} salePrice={80} isOnSaleNow />);
    expect(screen.getByText("Rs 80")).toBeInTheDocument();
    const original = screen.getByText("Rs 100");
    expect(original).toBeInTheDocument();
    expect(original).toHaveClass("product-price-original");
  });

  it("shows only the price when not on sale", () => {
    render(<ProductPrice price={100} salePrice={null} isOnSaleNow={false} />);
    expect(screen.getByText("Rs 100")).toBeInTheDocument();
    expect(screen.queryByText("Rs 80")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the test**

Run (from `frontend/`): `npx vitest run src/Components/HelperComponents/Price/ProductPrice.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit (inside `frontend/`)**

```bash
cd frontend
git add src/Components/HelperComponents/Price/ProductPrice.jsx src/Components/HelperComponents/Price/ProductPrice.css src/Components/HelperComponents/SaleBadge/SaleBadge.jsx src/Components/HelperComponents/SaleBadge/SaleBadge.css src/Components/HelperComponents/Price/ProductPrice.test.jsx
git commit -m "feat: ProductPrice + SaleBadge display components with test"
```

---

### Task 6: ProductCardV2 sale display + call sites

**Files:**
- Modify: `frontend/src/Components/HelperComponents/ProductCard/ProductCardV2.jsx`
- Modify: `frontend/src/Pages/PetShopPage/PetShopPage.jsx`
- Modify: `frontend/src/Pages/HomePage/HomePageSections/FeaturedProductSection.jsx`

- [ ] **Step 1: Update ProductCardV2 to accept + render sale info**

In `src/Components/HelperComponents/ProductCard/ProductCardV2.jsx`:

(a) Add imports near the existing `Price` import:

```jsx
import ProductPrice from "../Price/ProductPrice";
import SaleBadge from "../SaleBadge/SaleBadge";
```

(b) Change the component signature to accept the new props (default them so existing non-sale call sites keep working):

```jsx
const ProductCardV2 = ({
  id, imageUrl, title, price, description,
  salePrice = null, isOnSaleNow = false, discountPercentLabel = 0, effectivePrice,
}) => {
```

(c) In `handleAddToCart`, charge the effective price:

```jsx
  const handleAddToCart = (e) => {
    e.stopPropagation();
    addItem({ id, name: title, price: effectivePrice ?? price, image: imageUrl }, qty);
    showCartToast("add", title);
  };
```

(d) In the image wrap, add the badge (right after the opening `<div className="pcv2-img-wrap">` and the `<img .../>`):

```jsx
        {isOnSaleNow && (
          <SaleBadge percent={discountPercentLabel} className="pcv2-sale-badge" />
        )}
```

(e) Replace the price line `<Price amount={price} className="pcv2-price" />` with:

```jsx
          <ProductPrice
            price={price}
            salePrice={salePrice}
            isOnSaleNow={isOnSaleNow}
            className="pcv2-price"
          />
```

(If `Price` is no longer referenced after this, remove its now-unused import.)

(f) Add badge positioning to `src/Components/HelperComponents/ProductCard/ProductCardV2.css`:

```css
.pcv2-img-wrap { position: relative; }
.pcv2-sale-badge { position: absolute; top: 10px; left: 10px; z-index: 2; }
```

- [ ] **Step 2: Pass sale fields from PetShopPage**

In `src/Pages/PetShopPage/PetShopPage.jsx`, find the `<ProductCard ... />` usage and add the sale props (the product object `p` carries the serialized virtuals):

```jsx
            <ProductCard
              id={p.id}
              imageUrl={p.images?.[0]?.url || (typeof p.images?.[0] === 'string' ? p.images[0] : null) || p.imageUrl}
              title={p.name || p.title}
              price={p.price}
              description={p.description}
              salePrice={p.salePrice}
              isOnSaleNow={p.isOnSaleNow}
              discountPercentLabel={p.discountPercentLabel}
              effectivePrice={p.effectivePrice}
            />
```

- [ ] **Step 3: Pass sale fields from FeaturedProductSection**

In `src/Pages/HomePage/HomePageSections/FeaturedProductSection.jsx`, find the `<ProductCard ... />` render and add the same four sale props sourced from the `product` object:

```jsx
                  salePrice={product.salePrice}
                  isOnSaleNow={product.isOnSaleNow}
                  discountPercentLabel={product.discountPercentLabel}
                  effectivePrice={product.effectivePrice}
```

(Add these lines alongside the existing `id`/`imageUrl`/`title`/`price`/`description` props on that `<ProductCard>`.)

- [ ] **Step 4: Build**

Run (from `frontend/`): `npx vite build`
Expected: clean build.

- [ ] **Step 5: Commit (inside `frontend/`)**

```bash
cd frontend
git add src/Components/HelperComponents/ProductCard/ProductCardV2.jsx src/Components/HelperComponents/ProductCard/ProductCardV2.css src/Pages/PetShopPage/PetShopPage.jsx src/Pages/HomePage/HomePageSections/FeaturedProductSection.jsx
git commit -m "feat: sale price + badge on product cards (shop + featured); cart uses effective price"
```

---

### Task 7: Product detail page sale display

**Files:**
- Modify: `frontend/src/Pages/IndividualProductItemPage/IndividualProductItemPage.jsx`

- [ ] **Step 1: Add sale display to the detail page**

In `src/Pages/IndividualProductItemPage/IndividualProductItemPage.jsx`:

(a) Add imports near the top (alongside the existing `Price` import if present):

```jsx
import ProductPrice from "@/Components/HelperComponents/Price/ProductPrice";
import SaleBadge from "@/Components/HelperComponents/SaleBadge/SaleBadge";
```

(b) Find where the product price is rendered (a `<Price amount={product.price} ... />` or similar) and replace it with the sale-aware display + badge:

```jsx
        <div className="product-detail-price-row">
          <ProductPrice
            price={product.price}
            salePrice={product.salePrice}
            isOnSaleNow={product.isOnSaleNow}
          />
          {product.isOnSaleNow && <SaleBadge percent={product.discountPercentLabel} />}
        </div>
```

(c) Find the add-to-cart handler on this page and make it use the effective price — change the `price:` passed to `addItem` from `product.price` to `product.effectivePrice ?? product.price`.

- [ ] **Step 2: Build**

Run (from `frontend/`): `npx vite build`
Expected: clean build.

- [ ] **Step 3: Commit (inside `frontend/`)**

```bash
cd frontend
git add src/Pages/IndividualProductItemPage/IndividualProductItemPage.jsx
git commit -m "feat: sale price + badge on product detail page; cart uses effective price"
```

---

## Phase 3 — Admin

### Task 8: AdminProductForm sale section + live preview

**Files:**
- Modify: `frontend/src/Pages/Admin/Products/AdminProductForm.jsx`

- [ ] **Step 1: Add sale fields to the form's initial state**

In `src/Pages/Admin/Products/AdminProductForm.jsx`, find the form initial-state object (it has `price`, `quantity`, `isActive`, `isFeatured`) and add:

```js
  onSale:        false,
  discountType:  "percent",
  discountValue: "",
  saleStartsAt:  "",
  saleEndsAt:    "",
```

And where an existing product is loaded into the form (the block mapping `p.price`, `p.isActive`, etc.), add:

```js
  onSale:        p.onSale ?? false,
  discountType:  p.discountType ?? "percent",
  discountValue: p.discountValue ?? "",
  saleStartsAt:  p.saleStartsAt ? p.saleStartsAt.slice(0, 10) : "",
  saleEndsAt:    p.saleEndsAt ? p.saleEndsAt.slice(0, 10) : "",
```

- [ ] **Step 2: Add a computed sale-price preview**

Near the top of the component body (after the form state is defined), add:

```jsx
  const priceNum = Number(form.price) || 0;
  const valNum = Number(form.discountValue) || 0;
  const previewSalePrice =
    form.discountType === "percent"
      ? Math.round(priceNum * (1 - Math.min(100, Math.max(0, valNum)) / 100) * 100) / 100
      : valNum;
  const previewPct =
    form.discountType === "percent"
      ? Math.round(valNum)
      : priceNum > 0 ? Math.round(((priceNum - valNum) / priceNum) * 100) : 0;
```

- [ ] **Step 3: Render the Sale / Discount section**

Add this section to the form JSX (place it after the `isFeatured`/`isActive` toggles area):

```jsx
        <div className="admin-pf-field">
          <label className="admin-pf-check">
            <input
              type="checkbox"
              checked={form.onSale}
              onChange={(e) => setForm((f) => ({ ...f, onSale: e.target.checked }))}
            />
            On Sale
          </label>
        </div>

        {form.onSale && (
          <div className="admin-pf-sale">
            <div className="admin-pf-row">
              <div className="admin-pf-field">
                <label>Discount type</label>
                <select
                  value={form.discountType}
                  onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value }))}
                >
                  <option value="percent">Percentage (%)</option>
                  <option value="amount">Fixed sale price (Rs)</option>
                </select>
              </div>
              <div className="admin-pf-field">
                <label>{form.discountType === "percent" ? "Percent off" : "Sale price (Rs)"}</label>
                <input
                  type="number"
                  min="0"
                  value={form.discountValue}
                  onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
                />
              </div>
            </div>
            <div className="admin-pf-row">
              <div className="admin-pf-field">
                <label>Sale starts (optional)</label>
                <input
                  type="date"
                  value={form.saleStartsAt}
                  onChange={(e) => setForm((f) => ({ ...f, saleStartsAt: e.target.value }))}
                />
              </div>
              <div className="admin-pf-field">
                <label>Sale ends (optional)</label>
                <input
                  type="date"
                  value={form.saleEndsAt}
                  onChange={(e) => setForm((f) => ({ ...f, saleEndsAt: e.target.value }))}
                />
              </div>
            </div>
            {valNum > 0 && priceNum > 0 && (
              <p className="admin-pf-sale-preview">
                Sale price: <strong>Rs {previewSalePrice}</strong> (−{previewPct}%)
              </p>
            )}
          </div>
        )}
```

- [ ] **Step 4: Append the sale fields to the submit FormData**

Find the block that appends `price`/`quantity`/`isActive`/`isFeatured` to the `FormData` (`fd.append(...)`) and add:

```js
    fd.append("onSale", String(form.onSale));
    fd.append("discountType", form.discountType);
    fd.append("discountValue", String(Number(form.discountValue) || 0));
    if (form.saleStartsAt) fd.append("saleStartsAt", form.saleStartsAt);
    if (form.saleEndsAt) fd.append("saleEndsAt", form.saleEndsAt);
```

- [ ] **Step 5: Add minimal styling**

Append to the form's stylesheet (the CSS file imported by `AdminProductForm.jsx`):

```css
.admin-pf-sale { border: 1px solid #e3dccf; border-radius: 10px; padding: 12px; margin-top: 8px; }
.admin-pf-sale-preview { margin: 8px 0 0; color: #633806; font-size: 0.9rem; }
```

- [ ] **Step 6: Build**

Run (from `frontend/`): `npx vite build`
Expected: clean build.

- [ ] **Step 7: Commit (inside `frontend/`)**

```bash
cd frontend
git add src/Pages/Admin/Products/AdminProductForm.jsx src/Pages/Admin/Products/AdminProductForm.css
git commit -m "feat: admin product form sale/discount section with live preview"
```

---

### Task 9: AdminProducts list badge

**Files:**
- Modify: `frontend/src/Pages/Admin/Products/AdminProducts.jsx`

- [ ] **Step 1: Show an On-Sale badge in the products table**

In `src/Pages/Admin/Products/AdminProducts.jsx`, find the table column definitions. Add a small inline badge to the Price (or Name) column's `render` so on-sale rows are obvious. For the price column render, change it to:

```jsx
      render: (value, item) =>
        item.isOnSaleNow ? (
          <span>
            <span style={{ color: "#c0392b", fontWeight: 700 }}>Rs {item.effectivePrice}</span>{" "}
            <span style={{ textDecoration: "line-through", color: "#999", fontSize: "0.85em" }}>Rs {value}</span>{" "}
            <span style={{ background: "#c0392b", color: "#fff", fontSize: "0.7em", padding: "1px 6px", borderRadius: 5 }}>
              -{item.discountPercentLabel}%
            </span>
          </span>
        ) : (
          <span>Rs {value}</span>
        ),
```

(If the price column currently uses a different `render` or accessor, adapt to match — the key behavior is: on-sale rows show the discounted price + struck original + "−X%" chip. If there is no price column with a `render`, add a "Sale" column whose `render` returns the chip when `item.isOnSaleNow`, else `—`.)

- [ ] **Step 2: Build**

Run (from `frontend/`): `npx vite build`
Expected: clean build.

- [ ] **Step 3: Commit (inside `frontend/`)**

```bash
cd frontend
git add src/Pages/Admin/Products/AdminProducts.jsx
git commit -m "feat: on-sale badge in admin products table"
```

---

### Task 10: Verification

- [ ] **Step 1: Frontend tests + build**

Run (from `frontend/`):
```bash
npx vitest run src/Components/HelperComponents/Price/ProductPrice.test.jsx
npm run build
```
Expected: ProductPrice tests pass; build clean.

- [ ] **Step 2: Backend sale tests**

Run (from `backend/`): `npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/product.sale.test.js`
Expected: PASS.

- [ ] **Step 3: Live smoke (backend dev server on :5000, admin token)**

With `cd backend && npm run dev` running:
- Create/update a product via Admin → Products with On Sale = 20% → save.
- `GET http://localhost:5000/api/products/<id>` → response includes `isOnSaleNow: true`, `salePrice`, `effectivePrice`, `discountPercentLabel: 20`.
- The product card on `/petshop` shows the sale price + struck original + "−20% OFF" badge.

---

## Success Criteria (from spec)
- Admin sets percent or fixed sale price + optional dates; form previews the sale price. ✔ Tasks 8–9
- Cards / detail / featured show sale price + struck original + "−X%" badge while active, revert when off/expired. ✔ Tasks 5–7
- Checkout charges the sale price while active, full price otherwise. ✔ Tasks 1–4
- Backend + frontend tests pass; no regressions. ✔ Tasks 1–4, 5, 10
