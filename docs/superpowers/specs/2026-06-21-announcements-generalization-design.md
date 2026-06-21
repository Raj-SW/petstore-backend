# Announcements Generalization — Design Spec (Epic 9b)

**Date:** 2026-06-21
**Repo:** backend (`petstore-backend`) for model/controller/templates/validators; frontend composer + profile toggles (`petstore-frontend`) consume the API.
**Status:** ✅ Approved design, pending implementation plan.
**Depends on:** Epic 9a (`2026-06-21-announcement-email-links-design.md`) for per-product email deep-links + the URL resolver.
**Backlog:** `docs/BACKLOG-2026-06-21.md` Epic 9b; phase-1 notes in `docs/BACKLOG-2026-06-21-PHASE1-BRAINSTORM.md`.

## Goal

Generalize the current `SaleAnnouncement` (hard-wired to `products[]`, single `sale-announcement` template, sent to everyone with `emailPreferences.sales`) into a **typed Announcement** system so admins can announce sales, new products, price drops, restocks, new tips/posts, events, and free-form news.

## Current state (from code)

- `models/saleAnnouncement.model.js`: `{ subject, message, products[], audienceCount, sentCount, failedCount, source: 'inline'|'composer', createdBy, sentAt }` → collection `saleannouncements`.
- `controllers/announcement.controller.js`: `createAnnouncement` resolves `products`, selects recipients (`role:'customer'`, `emailPreferences.sales != false`), sends `sale-announcement` per recipient (sequential, per-recipient failures non-fatal), records counts; `getAnnouncements` history; `unsubscribe` flips `emailPreferences.sales=false` via `makeUnsubscribeToken(userId)`.
- `models/user.model.js`: `emailPreferences: { sales: Boolean (default true) }`.
- Inline path: AdminProductForm "notify customers" → `source:'inline'` sale announcement.
- Content models available as targets: `PetCareTip` (`petCareTip.model.js`), `GalleryPost` (`galleryPost.model.js`).

## Design

### 1. Model — new `Announcement` (fresh collection)

New model `Announcement` → collection `announcements`. The existing `SaleAnnouncement`/`saleannouncements` is **retained read-only as legacy** (no data migration).

Fields:
- `type` — enum: `sale`, `new_product`, `price_drop`, `restock`, `new_tip`, `new_post`, `event`, `general`. Required.
- `bucket` — enum: `promotions`, `news`. **Derived server-side from `type`** (never trusted from the client):
  - promotions ← `sale`, `new_product`, `price_drop`, `restock`
  - news ← `new_tip`, `new_post`, `event`, `general`
- `subject` — String, required (2–150).
- `message` — String, optional (≤1000), intro/body copy.
- `products` — `[ObjectId ref Product]` (product types).
- `contentRef` — `{ kind: 'tip'|'post', id: ObjectId }` (content types; `tip`→PetCareTip, `post`→GalleryPost).
- `event` — `{ title, startsAt: Date, endsAt: Date?, location: String?, description: String?, link: String? }` (event type).
- `cta` — `{ label: String, url: String }` (optional; any type, common for `general`).
- `audienceCount`, `sentCount`, `failedCount` — Number, default 0.
- `source` — enum `inline`|`composer`, required.
- `createdBy` — `ObjectId ref User`, required.
- `sentAt` — Date.
- timestamps. Index `{ createdAt: -1 }`, `{ type: 1 }`.

### 2. Validation (per-type)

`validators/announcement.validator.js` (extend/replace): base requires `type` + `subject`. Then per type:
- product types (`sale|new_product|price_drop|restock`) → `products` present and non-empty (valid ObjectIds).
- content types (`new_tip|new_post`) → `contentRef.kind` ∈ {tip,post} and a valid `contentRef.id`.
- `event` → `event.title` and `event.startsAt` required; if `endsAt` present it must be ≥ `startsAt`.
- `general` → at least one of `message` or `cta` (must have something to render).
- `bucket` from the client is ignored; the controller/model derives it.

### 3. Controller (`createAnnouncement` generalized)

1. Validate; derive `bucket` from `type`.
2. Resolve target & guard existence: product types load `products` (404/400 if none valid); content types load the referenced tip/post (400 if missing); event/general use inline fields.
3. Recipients = `User.find({ role:'customer', ['emailPreferences.'+bucket]: { $ne: false } })`.
4. Build template data (Handlebars can't compute — precompute in JS):
   - per-type booleans `isProductType`, `isContent`, `isEvent`, `isGeneral`.
   - product types → product rows **including per-product deep links** `productUrl(p._id)` (from 9a) + `shopUrl()`.
   - content types → `{ title, coverImage, excerpt, readUrl }` (readUrl = `frontendUrl('tips/'+slug)` or the gallery route — resolve actual route during impl).
   - event → formatted date/time + `event` fields + optional `cta`.
   - general → `message` + optional `cta`.
   - `unsubscribeUrl` via `apiUrl('announcements/unsubscribe') + '?token=' + makeUnsubscribeToken(user._id, bucket)`.
5. Send the single `announcement` template per recipient (sequential, per-recipient failure non-fatal, as today). Record counts; persist the `Announcement`.

`getAnnouncements` reads the new `announcements` collection (legacy history not merged — acceptable per "fresh collection" decision; a separate legacy view can be added later if wanted).

### 4. Email template — single flexible `announcement.html`

One template with conditional blocks (consistent header/footer; aligns with Epic 10):
- Header: `{{subject}}`, greeting, optional `{{message}}`.
- `{{#if isProductType}}` product grid (reuse the 9a product-row markup with per-product "View product →" links + "Shop the sale" CTA).
- `{{#if isContent}}` article card: cover image, title, excerpt, "Read more →" → `{{readUrl}}`.
- `{{#if isEvent}}` event block: title, date/time, location, description, optional link/CTA.
- `{{#if isGeneral}}` free-form body + optional CTA button (`{{cta.label}}` → `{{cta.url}}`).
- Footer: bucket-aware unsubscribe (`{{unsubscribeUrl}}`).

(The old `sale-announcement.html` may be kept until the composer fully cuts over, or removed once `announcement.html` covers the sale type.)

### 5. User model + opt-in buckets

- `emailPreferences` evolves `{ sales }` → `{ promotions: Boolean (default true), news: Boolean (default true) }`.
- **Migration:** one-time script/`$rename`-style backfill — set `promotions` = existing `sales` (default true if absent), `news` = true. `updateProfile` accepts both toggles.
- **Unsubscribe:** `makeUnsubscribeToken(userId, bucket)` encodes the bucket; `/announcements/unsubscribe?token=` sets `emailPreferences[bucket] = false` and the result page names the bucket. `verifyUnsubscribeToken` returns `{ userId, bucket }`.
- Frontend profile exposes two toggles (the existing "Receive sale & promo emails" maps to Promotions).

### 6. Inline path

AdminProductForm "notify customers" continues to create `type: 'sale'`, `source: 'inline'` — unchanged behavior under the new model.

### 7. Frontend (separate repo, reference)

Admin composer (`/admin/announcements`) gains a **type selector** that reveals the matching target picker: product multiselect (product types), tip-or-post picker (content), event fields (event), or rich body + CTA (general). Profile gains Promotions + News toggles.

## Testing

Run suites individually.
- **Model/validator:** each type validates its required target; wrong/missing target → 400; bucket derived correctly per type; client-supplied bucket ignored.
- **Controller:** recipients filtered by the derived bucket's pref; product types include per-product deep links (9a) + shopUrl; content/event/general build the right data; counts recorded; `Announcement` persisted to the new collection.
- **Unsubscribe:** token round-trips `{userId, bucket}`; the link flips only that bucket; invalid token → friendly page.
- **Inline path:** product-form notify creates `type:'sale'`, bucket `promotions`.
- **Migration:** users with `sales:false` end up `promotions:false`, `news:true`.

## Acceptance criteria

- Admin can create announcements of all 8 types via the API; each validates its required target; `bucket` is derived server-side.
- Recipients are filtered by `emailPreferences[bucket]`; the single flexible template renders the correct block per type; product types deep-link each product (9a) + a shop CTA.
- The unsubscribe link flips the correct bucket; the profile exposes Promotions + News toggles; existing `sales` preference is migrated to `promotions`.
- The inline product-form "notify customers" still works (type `sale`).
- New announcements are written to the `announcements` collection; legacy `saleannouncements` is untouched/read-only.
- Existing announcement send behavior (sequential, non-fatal per-recipient failures, capped recipients) is preserved; new per-type tests pass.

## Out of scope
- Scheduling/queued sends (send-now only, as today).
- Automatic restock/back-in-stock triggers (a `restock` announcement is admin-composed, not auto-fired).
- Email branding/layout restyle and merging legacy history into the new list — Epic 10 / later.
