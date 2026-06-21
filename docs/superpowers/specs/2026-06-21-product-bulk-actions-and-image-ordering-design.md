# Admin Product Bulk Actions + Image Ordering — Design Spec

**Date:** 2026-06-21
**Repo:** backend (`petstore-backend`). Frontend admin UI is built separately in `petstore-frontend`; this spec defines the API contract it consumes.
**Status:** Approved design, pending implementation plan.

## Goal

Two independent admin-panel enhancements to product management:

1. **Bulk actions** — select multiple products in the admin list and apply one action to all at once.
2. **Image ordering** — drag product images into any order (position 0 = primary/cover everywhere) and explicitly "Set as primary", including for freshly-uploaded images, in a single save.

Both are admin-only (behind the existing `isAuthenticated, isAdmin` guard on `product.routes.js`).

---

## Feature 1 — Bulk actions

### Endpoint

`POST /api/products/bulk` (admin-only).

Request body:
```jsonc
{
  "action": "activate" | "deactivate" | "feature" | "unfeature" | "sale" | "clearSale" | "delete",
  "ids": ["<productId>", "..."],   // 1..100 valid Mongo ObjectIds
  "options": {                      // REQUIRED only when action === "sale"; ignored otherwise
    "discountType": "percent" | "amount",
    "discountValue": 20,            // > 0
    "saleStartsAt": null,           // optional ISO 8601 date string or null
    "saleEndsAt": null              // optional ISO 8601 date string or null
  }
}
```

Success response (non-delete):
```jsonc
{ "success": true, "message": "...", "data": { "requested": 5, "matched": 5, "modified": 4 } }
```
Success response (delete):
```jsonc
{ "success": true, "message": "...", "data": { "requested": 5, "deleted": 5 } }
```

### Why a single endpoint (not per-action routes)

One validated `action` enum keeps the API surface minimal and—critically—prevents mass-assignment. The client never sends a raw `$set`; each `action` maps to a fixed, server-defined update. Per-action routes would multiply boilerplate (route + validator + handler ×7) for no benefit.

### Handler behavior (`bulkAction` controller)

Action → fixed update:

| action | effect |
|--------|--------|
| `activate` | `$set: { isActive: true }` |
| `deactivate` | `$set: { isActive: false }` |
| `feature` | `$set: { isFeatured: true }` |
| `unfeature` | `$set: { isFeatured: false }` |
| `sale` | `$set: { onSale: true, discountType, discountValue, saleStartsAt, saleEndsAt }` |
| `clearSale` | `$set: { onSale: false, discountValue: 0, saleStartsAt: null, saleEndsAt: null }` |
| `delete` | collect images, delete from Cloudinary (best-effort), then `deleteMany` |

- Non-delete actions: a single `Product.updateMany({ _id: { $in: ids } }, { $set: ... })`. Return `matchedCount`/`modifiedCount`.
- `delete`: `Product.find({ _id: { $in: ids } })` → gather all `images[].publicId` → `deleteMultipleFromCloudinary(publicIds)` wrapped in try/catch (log failures, do **not** block the DB delete — matches existing single-`deleteProduct` behavior) → `Product.deleteMany({ _id: { $in: ids } })`. Return `deletedCount`.
- Log each bulk op with admin id, action, and affected count (mirrors existing `logger.info` calls).

### Variant products

`onSale`, `discountType`, `discountValue`, `saleStartsAt`, `saleEndsAt` are **product-level** fields. `computeSale` already derives both the product-level virtuals and the per-variant `variantsView` from them, so the `sale`/`clearSale` bulk actions work unchanged for variant products. No per-variant handling needed.

### Validation (`validateBulkAction`)

- `action`: required, must be one of the seven enum values.
- `ids`: required array, length 1–100, every element a valid ObjectId (reject otherwise with 400).
- `options`: required object **only** when `action === "sale"`:
  - `discountType` ∈ {percent, amount}; `discountValue` number > 0.
  - For `percent`, `discountValue` ≤ 100.
  - `saleStartsAt`/`saleEndsAt` optional ISO dates; if both present, `saleEndsAt` ≥ `saleStartsAt`.
- Follows the existing Joi-based validator pattern in `src/validators/`.

### Edge cases & caveats

- Empty/missing `ids`, >100 ids, invalid ObjectId → 400.
- `sale` with missing/invalid `options` → 400.
- **Amount discount > a product's base price:** not an error. `computeSale` only marks a product on-sale when `salePrice > 0 && salePrice < price`, so such products simply won't display as on-sale. Documented so admins understand a uniform amount-off may not apply to cheaper items; percent is safer across mixed prices.
- Bulk op is not wrapped in a transaction: `updateMany` is atomic per document, and delete's Cloudinary cleanup is intentionally best-effort. Partial Cloudinary failures are logged but don't fail the request.

### Frontend (separate repo, for reference)

Checkbox column on the admin product list + a sticky bulk-action toolbar showing the selected count and the four action groups (activate/deactivate, feature/unfeature, sale/clear, delete). Delete shows a confirm dialog; sale opens a small modal for discount type/value + optional dates. On success, refresh the list and surface the returned summary.

---

## Feature 2 — Image reorder + "Set as primary"

### Current state (no change needed for existing-image reorder)

Images are stored as an ordered array `images: [{ url, publicId }]`; **position 0 is already the primary/cover** consumed everywhere (cards, detail, featured). `updateProduct` already rebuilds images as `[...keepImages, ...newlyUploaded]`, **preserving the order of `keepImages`**. Therefore:

- **Reordering existing images** = the edit form sends `keepImages` in the dragged order. Already supported.
- **"Set as primary"** = move that image to index 0 of `keepImages` client-side. Already supported.

### The gap

New uploads are always **appended last**, so an admin cannot drop a freshly-uploaded photo into the middle, or make a new upload the cover, within the same save.

### Fix — optional `imageOrder` manifest (backward-compatible)

The edit form **may** send an ordered `imageOrder` array of string tokens describing the desired final order:

- existing image → its `publicId`
- new file → `"new:<index>"`, where `<index>` is that file's position in the multipart `images` files array (`req.files`)

Backend `updateProduct` flow when `imageOrder` is present:
1. Validate/delete removed images as today (an existing image whose `publicId` is **not** referenced in `imageOrder` is treated as removed → deleted from Cloudinary).
2. Upload `req.files` → `newlyUploaded[]` (index-aligned with `req.files`).
3. Build final `images` by walking `imageOrder`:
   - token `"new:N"` → `newlyUploaded[N]`
   - otherwise → the existing image whose `publicId` matches the token
   - skip tokens that resolve to nothing (defensive).
4. Save the rebuilt array.

When `imageOrder` is **absent**, fall back to today's behavior (`keepImages` ordered + new files appended). This keeps existing clients working unchanged.

### Validation / safety

- `imageOrder`, if present, must be an array of strings; `"new:N"` indices must be within `req.files` bounds; non-`new` tokens must match an existing image's `publicId`. Invalid/dangling tokens are skipped rather than 500-ing, but a fully empty resulting `images` array is rejected (a product must keep ≥1 image, consistent with create).
- No schema change: still `images: [{ url, publicId }]`, order-as-priority. No `isPrimary`/`order` fields added (deliberately — the array index already is the source of truth and all consumers rely on it).

### Frontend (separate repo, for reference)

Drag-and-drop thumbnail grid in the product edit form (existing + newly-selected files shown together), plus a "Make cover" button per thumbnail that moves it to position 0. On save, the form emits `imageOrder` alongside the existing multipart `images` files and the `keepImages` field.

---

## Testing

Run affected suites individually (full `npm test` flakes under combined load):

**Bulk actions** (`tests/product.bulk.*.test.js`):
- each action toggles the right field(s) on multiple products; returns correct `matched`/`modified`.
- `sale` sets discount fields incl. dates; `clearSale` resets them; variant product gets correct `variantsView` pricing afterward.
- `delete` removes docs and calls Cloudinary delete with the right publicIds (mocked); returns `deleted` count.
- validation failures: bad action, empty ids, >100 ids, invalid ObjectId, `sale` missing options, percent > 100, end-before-start → 400.
- authz: non-admin → 403.

**Image ordering** (extend `tests/product.controller.test.js` / a new `product.images.test.js`):
- `imageOrder` reorders existing images (primary changes).
- `imageOrder` interleaves a new upload between existing ones.
- `imageOrder` makes a new upload the primary (index 0).
- an existing image omitted from `imageOrder` is deleted (Cloudinary mock asserted).
- absent `imageOrder` → legacy `keepImages + appended` behavior unchanged.
- resulting empty image set → 400.

## Out of scope

- No new product fields or schema migration.
- Frontend implementation (separate repo).
- Bulk actions beyond the four chosen (no bulk category/stock/export this round).
