# Variant Option Matrix + Reusable Attribute Values — Design

**Date:** 2026-07-10
**Repos:** `backend/` + `frontend/`
**Approach chosen:** Option matrix with flat variant storage (Shopify model). Rejected: true nested tree (rework of cart/order/inventory/subscriptions for identical buyer outcome), separate SKU collection (overkill).

## Problem

1. A variant (e.g. "5kg") cannot carry its own sub-options (e.g. flavours) with independent price and stock. Admin needs multi-axis variants: Weight × Flavour × … with price/stock per combination.
2. Categories, colors, and suitable-for values typed on earlier products cannot be reselected when creating new products — admins retype them (typos, drift).

## Feature 1 — Option matrix

### Data model (`backend/src/models/product.model.js`)

```js
options: {
  type: [{
    name:   { type: String, required: true, trim: true, maxlength: 30 },
    values: { type: [String], required: true },   // ordered, admin-controlled
  }],
  validate: [(arr) => arr.length <= 4, 'A product supports at most 4 option axes'],
  default: [],
},
variants: [{
  label:        { type: String, required: true, trim: true, maxlength: 120 }, // derived when options exist
  optionValues: { type: Map, of: String, default: undefined },                // { Weight: "5kg", Flavour: "Chicken" }
  price:        { type: Number, required: true, min: 0 },
  quantity:     { type: Number, required: true, min: 0, default: 0 },
  images:       [{ url: String, publicId: String }],   // unchanged, max 6
}]
```

- `label` maxlength raised 40 → 120 (joined combination labels).
- When `options.length > 0`, the server derives `label` = option values joined with `" · "` in axis order, overwriting whatever the client sent.
- Existing products (no `options`, variants with plain labels, or no variants) remain valid unchanged. **No migration.**
- Existing pre('validate') roll-up (product price = min variant price, quantity = sum) unchanged — it only reads `price`/`quantity`.
- `variantsView` virtual additionally exposes `optionValues` (as plain object) so the product page can match combinations.
- **Untouched:** cart, order, inventory, subscription schemas and logic. Each combination is one variant row with one `variantId`; those systems already key on `variantId`.

### Validation rules (model-level + `product.validator.js` where applicable)

1. Max 4 option axes.
2. Option names non-empty, unique (case-insensitive) within a product.
3. Each option's `values` non-empty, values unique within the axis.
4. When `options` exist: every variant must supply `optionValues` with exactly the option names as keys, and each value must be listed in that axis's `values`.
5. No two variants may share the same combination (same optionValues).
6. When `options` is empty: variants behave exactly as today (free-text label), `optionValues` absent.
7. Not every combination must exist — admin may omit combinations that aren't sold.

Violations → 400 with a clear message.

### API

`POST /products` and `PUT /products/:id` accept `options` (JSON string in the multipart form, like `sections`/`variants` today). No new endpoints for feature 1.

### Admin form (`frontend/src/Pages/Admin/Products/AdminProductForm.jsx`)

- **Axes editor** replaces the "+ Add variant" flow header: up to 4 rows, each = option-name input + tag-input of values (same chip UX as categories). Option-name input suggests previously used option names (feature 2 endpoint).
- **Combination table**: cartesian product of the axis values, auto-regenerated on axis change. Row = derived label (read-only) + price + stock + optional per-combination images + remove button. Edits survive axis changes via a signature key (`JSON.stringify(sorted optionValues)`) — pure logic in a new `frontend/src/utils/variantMatrix.js`:
  - `generateCombinations(options) → [{optionValues, key}]`
  - `mergeCombinations(existingVariants, combinations) → variants` (preserves price/qty/images of surviving combos, blanks new ones, drops removed ones)
- **0 axes** = simple product: top-level price/stock inputs, exactly today's behaviour. Single-axis legacy products load as 1 axis whose values are the existing labels *only if* they have `optionValues`; otherwise they load in the legacy flat editor (variants without options keep working via rule 6).
- Submit: `options` appended as JSON string alongside the existing `variants` JSON.

### Product detail page (frontend)

- If `product.options.length > 0`: render one shadcn `Select` per axis. A full selection resolves against `variantsView` by `optionValues` → drives price, sale price, stock badge, image swap, and add-to-cart `variantId` (existing plumbing).
- Value choices that lead to no existing/in-stock combination are disabled.
- Products without `options` keep the current single pill-list UI untouched.

## Feature 2 — Reusable attribute values

### API

`GET /products/attribute-values` — admin-only route (before `/:id` in route order):

```json
{ "categories": [...], "colors": [...], "suitableFor": [...], "optionNames": [...] }
```

Implementation: `Product.distinct('categories')`, `distinct('colors')`, `distinct('genders')`, `distinct('options.name')`; each sorted case-insensitively, empty strings removed. No caching (admin-only, cheap).

### Admin form

- Fetch once on mount via new `productsApi.getAttributeValues()`.
- Categories / colors / suitable-for tag inputs: quick-pick suggestion rows become `union(hardcoded defaults, fetched values) − already selected` (categories already have this UI — colors and suitable-for gain the same row).
- Option-name inputs suggest `optionNames`.
- Endpoint failure → silent fallback to today's hardcoded suggestions.

## Error handling

- Server validation errors surface via the existing toast pipeline (form already shows API error messages).
- Client pre-submit validation extends the existing `validate()`: every kept combination needs price ≥ 0 and stock ≥ 0; at least one combination must remain when axes are defined.

## Testing

**Backend unit (co-located):**
- Model/validator: >4 axes rejected; duplicate axis names rejected; optionValues key mismatch rejected; duplicate combination rejected; label derivation ("5kg · Chicken"); legacy variants without options still valid; roll-up min/sum over matrix variants.
- `attribute-values` controller logic (distinct merge/sort) with mocked model.

**Backend integration (`tests/integration/products/`):**
- Create product with 2-axis matrix via API → variants persisted with derived labels; product-level price/quantity rolled up.
- Update axes (add a value) → new combination accepted.
- Cart add + order create using a matrix `variantId` (proves downstream compat).
- `GET /products/attribute-values` returns distinct values; 403 for non-admin.

**Frontend unit (Vitest):**
- `variantMatrix.js`: cartesian generation, merge preserves edits, removal, empty axes.
- Suggestion merge util.
- AdminProductForm renders axes editor / legacy editor per product shape (smoke level).

Existing 1-level variant tests must stay green.

## Out of scope

- Migration of existing products to option axes (they keep working as-is).
- Per-axis images (images stay per combination).
- Managed/curated attribute lists (auto-distinct only).
- Buyer-side filtering by option values.
