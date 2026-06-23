# Architecture Decisions

Key design choices and their rationale. Read this before touching any of these systems.

---

## Image Management — Immediate-Upload Contract

**Decision:** Images upload immediately to Cloudinary when the user adds them in the UI. The form submits only the final ordered `[{url, publicId}]` refs as JSON (`imageRefs` field). The backend diffs incoming refs against stored refs and calls `deleteMultipleFromCloudinary` on removed ones.

**Why:** The previous approach (deferred multipart — send files on form save, compute image order via a manifest token) was implemented for products, feedback, and tips separately and was not reusable. Immediate-upload gives one shared `<ImageManager>` component that works for every resource. Tradeoff: uploading then cancelling orphans a Cloudinary asset (tracked as a deferred cleanup sweep, out of scope now).

**Component:** `frontend/src/Components/Admin/ImageManager/ImageManager.jsx`
Props: `value` (`[{url,publicId}]`), `onChange`, `uploadUrl`, `max`, `onError`, `label`
Upload endpoint pattern (per resource): `POST /api/<resource>/upload-image` → returns `{ data: { url, publicId } }`

**Backend routes that use this pattern:**
- `POST /api/products/upload-image`
- `POST /api/feedback/upload-image`
- `POST /api/tips/upload-image`
- `POST /api/gallery/upload-image` (was already there)

---

## MUR-Only Pricing

**Decision:** The store is MUR-only. No `currency` field is added to any model. Shared formatter lives in `backend/src/utils/currency.js` (`formatMUR(amount)` → `"Rs 1,234"`). All price inputs in admin are labelled `Rs`.

**Why:** Avoids currency conversion complexity. All stored numbers are MUR by definition. The invoice PDF previously hardcoded `$` — that's fixed via `formatMUR`.

**Do not add a `currency` field** to products, orders, or invoices. Multi-currency is explicitly out of scope.

---

## Typed Announcements (Epic 9b)

**Decision:** Fresh `Announcement` collection with a discriminated type field (`sale | event | content | general`). Types map to buckets (`promotions` = sale; `news` = event/content/general). The legacy `SaleAnnouncement` collection is kept read-only (no migration, no deletion).

**Why:** `SaleAnnouncement` was hard-wired to `products[]`. The new model supports events (with date/location), content refs (tips/gallery), and general CTAs. Changing the old schema in-place would require a migration and break existing email history.

**Email preferences:** `emailPreferences` on User now has `{ promotions, news }` booleans (migrated from `sales`). Unsubscribe tokens are bucket-scoped: `makeUnsubscribeToken(userId, bucket)`.

---

## Variant-Aware Inventory

**Decision:** `StockMovement` has `variantId` + `variantLabel`. `restock` and `adjust` endpoints **require** `variantId` in the body when the product `hasVariants`. The shared `deriveProductFromVariants` utility recomputes the product-level `price`, `quantity`, and `stockStatus` roll-up after any variant mutation.

**Why:** The old inventory wrote directly to product-level `quantity`. For variant products that field is a derived roll-up (Σ variant quantities) — writing to it directly was silently overwritten on the next product save.

**Utility:** `backend/src/utils/product.utils.js` → `deriveProductFromVariants(product)`. Used in `updateProduct` and all inventory mutation controllers. Do not bypass it.

---

## StoreSettings Singleton

**Decision:** A single `StoreSettings` document (enforced by a unique index on a constant `key: "global"` field). Fetched with `findOneAndUpdate({ key: "global" }, ..., { upsert: true })`. Public `GET /api/store-settings`; admin `PATCH /api/admin/store-settings`.

**Fields:** `shippingFlatFee`, `freeShippingThreshold`, `taxRatePercent` (default 15), `taxInclusive` (default true).

`buildOrder` in `order.service.js` reads these at order creation time and snapshots `shippingFee`, `tax`, `taxRate`, `taxInclusive` onto the Order document so historical orders are stable.

---

## Subscription Analytics — Demand Prediction

**Decision:** `predictDemand({ horizonDays, safetyMargin })` in `backend/src/services/subscription.analytics.service.js` keys demand by `(productId, variantId)` — variant-aware. Excludes paused/cancelled subscriptions and respects per-subscription skip dates. Returns `restockNeeded: true` when projected demand ≥ current stock × (1 + safetyMargin).

Horizon options surfaced in the UI: 30 / 60 / 90 days.

---

## FormData + JSON Fields Pattern

Several admin forms (product, tip, gallery) use `multipart/form-data` via axios because they can optionally receive legacy file uploads. JSON sub-objects (sections, variants, imageRefs) are serialised as JSON strings and appended to FormData:

```js
fd.append("variants", JSON.stringify([{ label, price, quantity, images }]));
fd.append("imageRefs", JSON.stringify([{ url, publicId }]));
fd.append("sections",  JSON.stringify([{ title, body, order }]));
```

The backend parses them with a shared `parseJsonField(value, fallback)` helper. Validators declare these fields as `Joi.string().optional()`.
