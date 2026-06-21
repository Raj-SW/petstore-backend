<!-- Mirror copy for root-level discovery. Canonical: docs/superpowers/specs/2026-06-21-invoices-granular-and-shipping-tax-design.md — keep both in sync. -->

# Granular Invoices + Shipping/Tax Model — Design Spec (Epic 11)

**Date:** 2026-06-21
**Repo:** backend (`petstore-backend`) — settings/order/invoice models, `buildOrder`, invoice service + PDF. Admin settings UI in frontend.
**Status:** ✅ Approved design, pending implementation plan.
**Depends on:** Epic 6c (shared `formatMUR` / `src/utils/currency.js`, variant pricing).
**Coordinates with:** Epic 15 (checkout redesign — owns the `paymentMethod` enum expansion and the checkout *page* that surfaces shipping/tax) and Epic 14 (variant inventory). Epic 11 provides the shipping/tax *data*; Epic 15 displays/collects it.
**Backlog:** `docs/BACKLOG-2026-06-21.md` Epic 11.

## Problem

Invoices are thin and the wrong currency: line items are `{ name, quantity, unitPrice, total }` only; the PDF **hardcodes `$`** while the app is MUR; no variant labels, no original/sale price, no shipping fee or tax (neither modeled anywhere), no billing address, no order date or source.

## Current state (from code)

- `order.model.js`: items `{ product, variantId, variantLabel, quantity, price }` (`price` = net effective price paid; **no original price snapshot**); `totalAmount`, `discount`, `discountCode`, `shippingAddress`, `paymentMethod` (enum credit_card|paypal|stripe), `paymentDetails`, `source` (manual|subscription), `createdAt`; `finalAmount` virtual = `totalAmount − discount`. **No `shippingFee`, `tax`, or billing address.**
- `invoice.model.js`: `lineItems {name, quantity, unitPrice, total}`, subtotal, discount, total, shippingAddress, paymentMethod, transactionId, paidAt, status.
- `invoice.service.js`: `generateInvoice` builds the above from the order; `generatePDF` hardcodes `$`.
- **No store-settings resource** (`AdminSettings.jsx` has no backend).

## Decisions (locked in brainstorm)

- **Include shipping + tax**, modeled on the order and computed at checkout.
- **Shipping:** flat fee + free over a configurable threshold (admin-settable).
- **Tax:** configurable rate + inclusive/exclusive toggle in admin settings; **default 15% VAT, inclusive**.
- **Snapshot original price** per line going forward (so invoices show was/now + per-line savings for new orders; old orders show price paid only).
- Currency standardized to **MUR** via the shared `formatMUR`.

## Design

### 1. `StoreSettings` singleton (new)
- Model `storeSettings.model.js` (single doc): `shippingFlatFee` (Number), `freeShippingThreshold` (Number), `taxRatePercent` (Number, default 15), `taxInclusive` (Boolean, default true). A `getSettings()` helper upserts/returns the singleton with defaults.
- Endpoints: `GET /api/settings` (public — checkout needs it) and `PATCH /api/settings` (admin). Wire the existing `AdminSettings.jsx` to these.

### 2. Order model + `buildOrder` (checkout pricing)
- Order adds: `shippingFee`, `tax`, `taxRate`, `taxInclusive` (snapshot of the rate/mode used), and per-item **`originalPrice`** (product/variant base price at order time, alongside the effective `price`).
- `buildOrder` reads `StoreSettings` and computes (let `base = totalAmount − discount`):
  - `shippingFee = base ≥ freeShippingThreshold ? 0 : shippingFlatFee`.
  - **Inclusive:** `tax = base − base/(1 + rate)` (VAT already inside prices; broken out for display). `grandTotal = base + shippingFee`.
  - **Exclusive:** `tax = base × rate`. `grandTotal = base + tax + shippingFee`.
  - Snapshot each item's `originalPrice` (variant base price via the product, else product base price) next to the effective `price`.
- `finalAmount`/totals updated to include shipping (and tax when exclusive). Subscription `processDue` orders inherit the same computation (shipping/tax apply to recurring orders too).

### 3. Invoice model (expanded)
- Line items → `{ name, variantLabel, quantity, unitPrice, originalUnitPrice, lineDiscount, total }`.
- Invoice adds: `currency` (default `'MUR'`), `discountCode`, `shippingFee`, `tax`, `taxInclusive`, `grandTotal`, `billingAddress` (defaults to shipping), `customer { name, email, phone }`, `orderDate`, `source`. Keep `invoiceNumber` (`INV-YYYY-NNNN`).

### 4. Invoice service + PDF
- `generateInvoice` snapshots all of the above from the order (so historical invoices stay stable after product edits).
- `generatePDF`: render via the shared **`formatMUR`** (no more `$`); show per-line variant label, **was/now + "You saved Rs X"** when `originalUnitPrice > unitPrice`, line discount, then subtotal, discount (+ code), shipping, **VAT** (labeled "VAT incl." when inclusive, or added as a line when exclusive), **grand total**, billing + shipping, customer, order + paid dates, and `source` (mark subscription orders).

### 5. Currency
- Use the shared `formatMUR` (`src/utils/currency.js`, Epic 6c) in the PDF and any invoice display. No `$` anywhere customer-facing.

## Reuse
`formatMUR` (6c); the `StoreSettings` singleton is also consumed by Epic 15 (checkout) to display shipping/tax. Invoices continue to snapshot (historical stability).

## Testing
Run suites individually.
- **StoreSettings:** GET returns defaults (15% inclusive); admin PATCH updates; non-admin PATCH → 403.
- **`buildOrder`:** shipping = flat under threshold, 0 at/over threshold; inclusive tax extracts VAT without changing grandTotal; exclusive tax adds on top; `originalPrice` snapshot present; subscription orders include shipping/tax.
- **Invoice:** `generateInvoice` populates variant labels, original/effective prices, line discount, shipping, tax, grandTotal, billing/customer/dates/source; currency `MUR`.
- **PDF:** renders MUR amounts (no `$`), was/now savings, VAT line per mode (smoke test the buffer renders).

## Acceptance criteria
- A `StoreSettings` singleton drives admin-configurable shipping (flat + free-over-threshold) and tax (configurable rate, inclusive/exclusive, default 15% inclusive).
- `buildOrder` computes + stores `shippingFee`, `tax`, mode, and per-item `originalPrice`; recurring orders included.
- Invoice (data + PDF) shows per-line variant + was/now + line discount, subtotal, discount (+ code), shipping, VAT, grand total, billing + shipping, customer, order + paid dates, and source — all in **MUR**; the `$` hardcode is gone.
- Historical invoices remain stable after later product edits (snapshotting).
- Build + existing/new tests pass.

## Out of scope (owned elsewhere)
- The checkout **page** UX and `paymentMethod` options (COD/Card/Juice by MCB) — **Epic 15**.
- Variant-level inventory management — **Epic 14**.
- Weight/region-based shipping (flat + threshold only here).
