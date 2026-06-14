# Discounts / On-Sale — Design Spec

**Date:** 2026-06-14
**Status:** Approved (brainstormed in session)

## Overview

Per-product sale pricing for VitalPaws. Admins put a product "on sale" by either a **percentage** or a **fixed sale price**, optionally scheduled with a start/end window. Customers see the sale price, the struck-through original, and a "−X% OFF" badge on product cards, the detail page, and the featured carousel; checkout charges the sale price. This is distinct from the existing (placeholder) cart-level coupon codes.

## Goals

- Admin sets a discount per product as **percent** or **absolute sale price** (either/both supported — admin picks one).
- Optional **scheduled window** (`saleStartsAt` / `saleEndsAt`) so a sale auto-activates and auto-expires; also works as a plain manual on/off toggle when no dates are set.
- Sale price, struck original, and "−X%" badge shown on cards, detail, and featured carousel, honoring currency formatting.
- **Checkout charges the live effective price** (server-computed, schedule-honored, tamper-proof).
- No stale derived data — everything customer-facing is computed live from the stored inputs.

## Non-Goals (v1)

- Store-wide / category-wide campaigns spanning many products (a separate `Sale` collection — future).
- Stacking product sales with cart coupon codes (the two are independent; coupon logic is unchanged).
- Tiered/quantity-based discounts (buy-N-get-M).
- Inline quick-toggle in the admin products table (editing is via the form).

## Architecture

**Approach: store only the admin inputs; expose computed Mongoose virtuals.** No denormalized sale price (avoids staleness), no separate collection (avoids joins). The schedule "just works" because activeness is evaluated at read time. Virtuals serialize into the JSON the frontend already receives, so the client renders directly from them.

## Data Model — Product (new fields)

`backend/src/models/product.model.js`:

```js
onSale:        { type: Boolean, default: false },
discountType:  { type: String, enum: ['percent', 'amount'], default: 'percent' },
discountValue: { type: Number, default: 0, min: 0 },   // percent (0–100) OR absolute MUR sale price
saleStartsAt:  { type: Date, default: null },
saleEndsAt:    { type: Date, default: null },
```

Schema options must enable virtual serialization: `{ timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }`.

### Virtuals (read-only, derived)

- **`salePrice`**
  - `percent`: `round2(price * (1 - clamp(discountValue, 0, 100) / 100))`
  - `amount`: `discountValue`
  - `round2(n)` = `Math.round(n * 100) / 100`.
- **`isOnSaleNow`** — true iff ALL:
  - `onSale === true`
  - `discountValue > 0`
  - `salePrice > 0 && salePrice < price`
  - within window: `(!saleStartsAt || now >= saleStartsAt) && (!saleEndsAt || now <= saleEndsAt)` where `now = Date.now()`.
- **`effectivePrice`** — `isOnSaleNow ? salePrice : price`.
- **`discountPercentLabel`** — integer % for the badge: `percent` → `Math.round(discountValue)`; `amount` → `Math.round((price - salePrice) / price * 100)`. Returns 0 when not on sale.

## Backend Integration

### Validator (`product.validator.js`)
Values arrive as strings from the admin multipart form — coerce as the existing `price`/`isActive` handling does. Rules:
- `onSale` boolean; `discountType` ∈ {`percent`,`amount`}; `discountValue` number ≥ 0.
- When `onSale` is true: `discountValue > 0`; if `percent` → `1 ≤ value ≤ 100`; if `amount` → `0 < value < price`.
- `saleStartsAt`/`saleEndsAt` optional valid dates; if both present → `saleEndsAt > saleStartsAt`.
- Violations → `AppError(message, 400)`.

### Product controller (`createProduct` / `updateProduct`)
Persist the five new fields, coercing types from FormData strings (booleans `"true"/"false"`, numbers, dates; empty date string → `null`). Mirrors current `price`/`quantity`/`isActive` handling.

### Order controller (`createOrder`)
Replace the per-item price read:
```js
const { price } = product;   // before
const price = product.effectivePrice;   // after
```
Checkout already recomputes totals from the DB (tamper protection), so `effectivePrice` is the authoritative charge; the schedule is honored because the virtual evaluates at checkout time.

### Cart controller (`addToCart`)
Store `product.effectivePrice` instead of `product.price` on the cart item, so the cart subtotal reflects the sale. (Checkout still recomputes from the DB regardless — this is display consistency only.)

## Frontend

### `ProductPrice` (new, DRY display unit)
`src/Components/HelperComponents/Price/ProductPrice.jsx`. Props `{ price, salePrice, isOnSaleNow, className }`. Wraps the existing currency-aware `Price`:
- `isOnSaleNow` → sale price (bold) + original price struck-through beside it (both via `Price`).
- else → just `<Price amount={price} />`.

### `SaleBadge` (new)
`src/Components/HelperComponents/SaleBadge/SaleBadge.jsx`. Small "−X% OFF" pill from `discountPercentLabel`. Corner ribbon on cards; inline on detail.

### Touch points
- **`ProductCardV2`** — render `ProductPrice` in the bottom row; `SaleBadge` corner ribbon when `isOnSaleNow`; **add-to-cart uses `effectivePrice`** (falls back to `price`). New props: `salePrice`, `isOnSaleNow`, `discountPercentLabel`, `effectivePrice` (original `price` stays).
- Call sites passing products to `ProductCardV2` (`PetShopPage`, `FeaturedProductSection`, search results) forward the sale fields from the product object.
- **`IndividualProductItemPage`** (detail) — `ProductPrice` + `SaleBadge` near the price; add-to-cart uses `effectivePrice`.
- **Featured carousel** — inherits via `ProductCardV2`.
- The `Price` component is unchanged (pure currency formatter).

### Admin
- **`AdminProductForm`** — a "Sale / Discount" section: **On Sale** toggle; when on: **discount type** select (Percentage | Fixed sale price), **value** input, optional **start/end date** pickers, and a **live sale-price preview** ("Sale price: Rs 40 (−20%)"). Client validation mirrors the backend. Appends `onSale`, `discountType`, `discountValue`, `saleStartsAt`, `saleEndsAt` (empty dates omitted/blank) to the existing FormData.
- **`AdminProducts`** table — an "On Sale" / "−X%" badge in the row to show discounted products at a glance.

## Error Handling
- Backend: `AppError` → global handler → `{ success: false, message }`. Admin form surfaces messages as toasts.
- Defense in depth: even if bad data is persisted, `isOnSaleNow` returns false (so `effectivePrice` = `price`), preventing a negative/invalid charge.

## Testing

### Backend (Jest + supertest, in-memory Mongo)
- **Virtuals:** `salePrice` for percent and amount; `isOnSaleNow` inside window / before start / after end / `onSale=false`; `effectivePrice` fallback; `discountPercentLabel` for both types.
- **Validator:** rejects percent > 100, amount ≥ price, `end < start`, `onSale` without value; accepts valid percent and amount.
- **Order:** checkout charges `effectivePrice` (sale active) and full `price` (sale off/expired); order line `price` reflects the charged amount.
- **Product create/update:** persists the five fields with correct coercion from FormData strings.

### Frontend (vitest + @testing-library)
- `ProductPrice`: renders struck original + sale price when `isOnSaleNow`; plain price otherwise.
- `SaleBadge`: renders the `discountPercentLabel` text; renders nothing when label is 0.

## Success Criteria
- Admin can put a product on sale by percent or fixed price, with optional dates; the form previews the sale price.
- Cards, detail, and featured carousel show the sale price + struck original + "−X%" badge while the sale is active, and revert automatically when it expires/toggles off.
- Checkout charges the sale price while active and the full price otherwise.
- All new backend + frontend tests pass; no regressions.
