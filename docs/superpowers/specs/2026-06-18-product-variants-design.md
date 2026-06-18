# Product Weight/Size Variants — Design Spec

**Date:** 2026-06-18
**Status:** Approved (design)
**Repos:** backend (`Raj-SW/petstore-backend`) + frontend (`Raj-SW/petstore-frontend`).

## Summary

Let one product carry several **weight/size variants** (e.g. dog food in 1kg / 3kg / 5kg / 10kg) instead of duplicating the product per size. Each variant has its own **price** and its own **stock**. Admins add variants when creating/editing a product; customers pick a variant on the product page (price, sale badge, and max quantity update accordingly), and the chosen variant flows through the cart, checkout/orders, and recurring subscriptions.

## Decisions (locked during brainstorming)

1. **Stock:** per-variant (each weight tracks its own quantity).
2. **Pricing:** each variant has its own absolute price.
3. **Sale:** the existing `onSale`/discount applies as a **% off the selected variant's price** (reuse the sale logic per variant).
4. **Scope:** variant is captured in cart, checkout/orders, **and** subscriptions.
5. **Data model:** embedded `variants[]` subdocuments on Product (not a separate collection, not variants-as-products).
6. **Back-compat:** products with no variants behave exactly as today; when variants exist, the product-level `price`/`quantity` are **derived** (price = lowest variant price, quantity = sum of variant stock).

## Non-goals

- Variant attributes other than a single label (no color×size matrices, no per-variant images/SKU in v1).
- Per-variant independent sales (one product-level sale %, applied to the selected variant).
- Migrating existing products — they simply have an empty `variants[]`.

## Architecture

### Data model — `product.model.js`

Add an embedded array:

```js
variants: [
  {
    label:    { type: String, required: true, trim: true, maxlength: 40 }, // "5kg"
    price:    { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 0, default: 0 },        // per-variant stock
  },
]
```

- `hasVariants` virtual → `Array.isArray(this.variants) && this.variants.length > 0`.
- **Derive on save** (pre-save hook): if `hasVariants`, set `this.price = Math.min(...variants.price)` and `this.quantity = sum(variants.quantity)`. Keeps price sort/filter, the card "From" price, and product-level stock checks working unchanged.
- `price`/`quantity` stay schema-`required`; for variant products the derive hook fills them, and the validator (below) accepts a request that supplies variants instead of price/quantity.

### Pricing & sale

Extract the discount math into one pure helper so product-level and per-variant pricing stay identical:

```js
// computeSale(basePrice, { onSale, discountType, discountValue, saleStartsAt, saleEndsAt })
//   → { salePrice, isOnSaleNow, effectivePrice, discountPercentLabel }
```

- The existing `salePrice` / `isOnSaleNow` / `effectivePrice` / `discountPercentLabel` virtuals are refactored to call `computeSale(this.price, …)` — identical output, no behavior change for non-variant products.
- A serialized **`variantsView`** virtual maps each variant to `{ _id, label, quantity, price, salePrice, isOnSaleNow, effectivePrice, discountPercentLabel }` by running `computeSale(variant.price, …)`. The frontend reads these so the displayed price/sale badge per size is correct.
- A helper method `priceForVariant(variantId)` returns the variant's `effectivePrice` (used by cart/order pricing on the server).

### Cart / order / subscription items

Add two fields to the **cart item**, **order item**, and **subscription item** schemas:

```js
variantId:    { type: mongoose.Schema.Types.ObjectId, default: null }, // ref to the product's variant subdoc
variantLabel: { type: String, default: null },                         // snapshot for history/display
```

`price` continues to be snapshotted at add-time (from the variant's `effectivePrice`, or the product's when no variant).

**Cart line identity** changes from *product* to *product + variant*:
- `POST /api/cart` body becomes `{ productId, variantId?, quantity }`.
  - If the product `hasVariants`, `variantId` is **required** and must match a variant; price = that variant's `effectivePrice`; stock checked against the variant's `quantity`.
  - If no variants, behaves as today (variantId null).
  - A line is matched by `product` **and** `variantId` (same product, two sizes = two lines).
- Update/remove key off the **cart-item `_id`** (a cart line) instead of `productId`:
  - `PATCH /api/cart/:itemId { quantity }`, `DELETE /api/cart/:itemId`.
  - Frontend cart already carries a per-line id; it sends that line id.

### Order building — `order.service.js#buildOrder`

`items` entries may include `variantId`. For each item:
- Resolve the product; if `variantId` given, find the variant subdoc → `price = computeSale(variant.price, …).effectivePrice`, and reserve stock by decrementing **`variants.$[v].quantity`** (positional/arrayFilters `$inc`), recording `variantLabel`.
- If no `variantId`, current behavior (product `effectivePrice`, decrement product `quantity`).
- Stock-availability check uses the variant's quantity when applicable.
- `StockMovement` records the product (optionally note the variant label in its existing note/meta — no schema change required).

### Subscriptions

- `subscription.model.js` items gain `variantId` + `variantLabel`.
- `createSubscription` accepts `items: [{ product, variantId?, quantity }]`; the subscription validator allows `variantId`.
- `processDue` passes each item's `variantId` into `buildOrder` (already handled there) and its stock pre-check reads the variant's quantity.

### Admin — `AdminProductForm.jsx`

- A new **Variants** section: repeatable rows, each `label · price · stock`, with add/remove buttons.
- When ≥1 variant exists, hide the top-level price/stock inputs (they're auto-derived) and show a hint ("Price & stock are set per variant below").
- On submit, send `variants: [{ label, price, quantity }]` (multipart-safe: JSON-stringify the array field, parsed server-side like the existing `sections`).
- **Validator** (`product.validator.js`): accept `variants` (array of `{label, price>=0, quantity>=0}`); require **either** a non-empty `variants` array **or** `price` + `quantity`.
- The product controller parses `variants` (like `sections`) on create/update; the derive hook handles price/quantity.

### Frontend — product page & cards

- **`IndividualProductItemPage`**: when `product.variants?.length`, render a **size selector** (chips) above the price; default to the first in-stock variant. Selecting a variant drives the displayed `ProductPrice`/`SaleBadge` (from `variantsView`), the stock badge, and the quantity stepper max. `handleAddToCart` and `SubscribeWidget` pass the selected `variantId`.
- **Frontend `CartContext`**: cart lines keyed by `product + variantId`; each line stores `variantId`, `variantLabel`, `price`. Checkout sync sends `variantId` per line; cart/order/subscription rows render the variant label under the name.
- **Product cards** (`ProductCardV2`, featured): show **"From Rs {lowest effectivePrice}"** when `hasVariants`; the quick add-to-cart for a variant product routes to the product detail (must pick a size) rather than adding blindly.

## Data flow

1. Admin creates a product with variants → derive hook sets product price/stock → saved.
2. Customer opens detail → sees size chips + "From" price → picks 5kg → price/stock update → Add to Cart sends `{ productId, variantId, quantity }`.
3. Cart line keyed by product+variant; checkout → `buildOrder` prices from the variant's effectivePrice and reserves that variant's stock; order item records `variantLabel`.
4. Subscriptions capture `variantId`; the cron runner reorders the same variant.

## Error handling

- Add-to-cart for a variant product without `variantId` → 400 ("Please select a size").
- `variantId` not found on the product → 400.
- Insufficient variant stock → 400 (existing insufficient-stock path, variant-aware).
- Subscription/`processDue`: out-of-variant-stock follows the existing skip-and-advance path.

## Testing

**Backend (Jest):**
- Product create with variants → 201; derived `price` = lowest, `quantity` = sum; `variantsView` prices reflect the sale %.
- Validator: variants OR price/quantity; reject a variant missing price.
- `buildOrder`: with `variantId`, prices from the variant's effectivePrice, decrements that variant's stock (not others), records `variantLabel`.
- Cart: add same product in two variants → two lines; add variant product without `variantId` → 400.
- Subscription `processDue` reorders the correct variant.

**Frontend (Vitest):**
- Product page renders the size selector and updates price on variant change; add-to-cart payload includes `variantId`.
- Cart line shows the variant label.

## Files (touch-points)

| Area | File | Change |
|---|---|---|
| Model | `backend/src/models/product.model.js` | `variants[]`, `hasVariants`, derive hook, `computeSale`, `variantsView`, `priceForVariant` |
| Model | `backend/src/models/cart.model.js`, `order.model.js`, `subscription.model.js` | item `variantId` + `variantLabel` |
| Validator | `backend/src/validators/product.validator.js`, `subscription.validator.js` | accept `variants` / `variantId` |
| Controller | `backend/src/controllers/product.controller.js` | parse `variants` on create/update |
| Cart | `backend/src/controllers/cart.controller.js` + routes | variant-aware add; key update/remove by item id |
| Orders | `backend/src/services/order.service.js` | variant pricing + variant stock reservation |
| Subscriptions | `backend/src/controllers/subscription.controller.js` | accept + pass `variantId` |
| Admin UI | `frontend/src/Pages/Admin/Products/AdminProductForm.jsx` | variants editor |
| Product UI | `frontend/src/Pages/IndividualProductItemPage/IndividualProductItemPage.jsx` | size selector + pass variantId |
| Cart UI | `frontend/src/context/CartContext.jsx`, cart/checkout, `ProductCardV2` | line identity, "From" price, label display |
| API | `frontend/src/Services/api/cartApi.js` | variantId in add; item-id in update/remove |

## Open questions (none blocking)

- Whether to surface a per-variant "Out of stock" chip styling (default: disable the chip + grey it).
- Future: per-variant images/SKU (out of scope for v1).
