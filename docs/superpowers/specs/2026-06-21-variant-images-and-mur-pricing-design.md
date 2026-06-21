# Variant Images + MUR Pricing — Design Spec (Epic 6b/6c)

**Date:** 2026-06-21
**Repos:** backend (`petstore-backend`) — model/controller/validator/util; frontend (`petstore-frontend`) — `<ImageManager>`, AdminProductForm, product detail gallery.
**Status:** ✅ Approved design, pending implementation plan.
**Supersedes:** the `imageOrder`/`keepImages` deferred-multipart image mechanism in `2026-06-21-product-bulk-actions-and-image-ordering-design.md` (Epic 6, Feature 2) and `2026-06-21-feedback-photos-fix-and-admin-reorder-design.md` (Epic 7, Part C) — both updated with revision banners pointing here.
**Backlog:** Epic 6b/6c. Reuse register in `docs/BACKLOG-2026-06-21-PHASE1-BRAINSTORM.md`.

## Part 1 — Shared image management (the canonical image system)

A single image-handling system reused by products, variants, feedback, and tips — replacing per-feature mechanisms.

### Backend contract
- **Upload endpoint (per resource, one shared controller):** `POST /api/<resource>/upload-image` (admin, multer single file) → uploads to Cloudinary in the resource's folder with the resource's transform → returns `{ url, publicId }`. Implemented once as a reusable `uploadImage(folder, variant)` controller helper; each resource route mounts it (`products`, `feedback`, `tips`, `gallery` already has one). Product images use the square transform; banners/covers use the wide `uploadBannerToCloudinary`.
- **Storage:** every image-bearing resource stores `images: [{ url, publicId }]` (or `photos` for feedback), **array order = display priority, index 0 = primary**.
- **Update = send final refs + diff cleanup:** the client sends the final, ordered `images` array as JSON (refs already uploaded). The backend diffs the stored vs incoming `publicId` set and calls `deleteMultipleFromCloudinary(removed)` (best-effort). No `keepImages`, no `imageOrder` token manifest, no deferred file upload on the save request.
- **Delete resource:** delete all its image `publicId`s (unchanged).
- *Tradeoff:* an upload followed by cancel orphans the Cloudinary asset (minor storage waste). A periodic unreferenced-asset sweep is **out of scope** (tracked).

### Frontend `<ImageManager>` (one shared component)
Props: `value` (`[{url, publicId}]`), `onChange`, `uploadUrl`, `max`. Behavior: drop/select a file → upload immediately to `uploadUrl` → append the returned ref; **drag-reorder** (`@dnd-kit`); **set primary** (move to index 0); **delete** (remove from list). The parent form holds the ordered refs and submits them. Used by AdminProductForm (product + each variant), AdminFeedback, AdminTipForm.

## Part 2 — Variant-specific images (6b)

- **Model:** the embedded variant subschema gains `images: [{ url: String, publicId: String }]` (default `[]`). Cap **≤6** per variant (validator).
- **Create/update:** variant images travel inside the existing `variants` JSON payload (each variant object carries its `images` array of refs). The controller diffs variant images (old vs new, across all variants) and deletes removed `publicId`s from Cloudinary. Removing an entire variant deletes that variant's images.
- **Product detail (frontend):** when a variant is selected, the gallery shows **that variant's images**; if the variant has none, it **falls back to the product-level images**. Default (no variant selected) shows product-level images.
- **Validation:** each variant image ref must have `url` + `publicId`; ≤6 per variant.

## Part 3 — MUR-only pricing (6c)

- **Decision:** the store is **MUR-only** — no `currency` field is added anywhere.
- **Shared util:** extract `formatMUR(amount)` to `src/utils/currency.js` (single source). Replace the local `formatMUR` copies in `announcement.controller.js` and `subscription.controller.js` with imports; use it in any customer-facing price rendering.
- **Admin inputs:** the product price input **and** each variant price input are labelled **`Rs`** (MUR) so admins create prices in MUR by default. (No behavioral change to stored numbers — they were always MUR; this makes it explicit.)
- **Display fixes:** correct obvious `$` leaks in customer-facing output. The invoice PDF currently hardcodes `$`; the **full** invoice currency overhaul lives in Epic 11, which reuses `src/utils/currency.js`. 6c establishes the util + input labels + non-invoice `$` fixes.

## Revision impact on Epics 6 & 7
- **Epic 6 (product images):** Feature 2's `imageOrder` manifest + `keepImages` + deferred multipart is replaced by the shared immediate-upload model above (product images = `images: [{url,publicId}]` sent as ordered JSON; backend diffs for cleanup). The product create/update validators change accordingly (images as JSON refs, not files). Bulk actions (Feature 1) are unaffected.
- **Epic 7 (feedback):** Part C's multipart manifest is replaced by the shared model — admin feedback photo add/reorder/delete via `<ImageManager>` + immediate upload; public `submitFeedback` keeps its multipart submit but stores `{url, publicId}`.

## Testing
Run suites individually.
- **Shared upload:** `upload-image` returns `{url, publicId}`; rejects non-images.
- **Products:** create/update accepts `images` JSON refs; update diffs and deletes removed publicIds (Cloudinary mocked); delete removes all.
- **Variants:** variant images persist (≤6 enforced); update diffs variant images for cleanup; removing a variant deletes its images; `priceForVariant`/`variantsView` unaffected.
- **MUR:** `formatMUR` util output (`Rs 1,234`); controllers import the shared util (no local copies); no `$` in announcement/subscription/product output.
- **Frontend:** `<ImageManager>` upload-on-add, reorder, set-primary, delete; product detail swaps to variant images on selection and falls back to product images when empty.

## Acceptance criteria
- One shared `<ImageManager>` + immediate-upload backend contract; Epics 6 & 7 specs revised to it (banners added).
- Variants carry their own ordered images (≤6); product detail swaps galleries on variant selection and falls back to product images; variant and variant-image deletion clean up Cloudinary.
- `formatMUR` lives in `src/utils/currency.js` and is the single formatter (controllers import it); product + variant price inputs show `Rs`; no `$` in customer-facing output outside the (Epic 11) invoice work; no `currency` field added.
- Build + tests pass.

## Out of scope
- Multi-currency / conversion (explicitly MUR-only).
- Orphaned-Cloudinary-asset sweep (tracked separately).
- The full granular invoice currency overhaul (Epic 11, reuses the shared util).
