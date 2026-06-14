# Admin-Managed Promo Banner Carousel — Design Spec

**Date:** 2026-06-14
**Status:** Approved, proceeding to implementation
**Scope:** Full-stack (backend `backend/` + frontend `frontend/`). Reuses the existing **Advert** subsystem.

## Problem / Goal

The homepage `PromoBannerCarousel` currently renders 18 hardcoded brand images bundled in the frontend. We want:
1. **Narrower width** — constrain the carousel to `max-width: 960px`, centered (today it is full-bleed).
2. **Admin-managed slides** — the admin uploads/chooses which images appear, sets order, and an optional link per slide, with no code changes.

## Approved decisions

- **Storage:** reuse the **Advert** model with a new placement `hero` + an `order` field (no new model).
- **Width:** `max-width: 960px`, centered.
- **Link:** optional per slide (clickable when set).
- **Empty state:** if no active `hero` adverts exist, the carousel **renders nothing** (no hardcoded fallback).
- **Images:** one image per slide (responsive via `object-fit: cover` + existing height breakpoints), uploaded to Cloudinary.
- **Seed:** seed 3–4 `hero` banners so the homepage isn't empty after the hardcoded images are removed.

## Image resolution guidance (surfaced in the admin UI)

- Carousel is 960px wide; display heights 340 (desktop) / 260 (tablet ≤991px) / 190 (mobile ≤575px); `object-fit: cover`.
- **Recommended source: ~1920 × 680 px** (≈ 2.8:1 wide banner), min ~960 × 340. WebP/JPEG.
- Keep key content (logos/text) in the **horizontal center band** — top/bottom get cropped more on small screens.
- The admin upload field shows this hint text.

## Cloudinary transform fix (required)

`utils/cloudinary.js → uploadToCloudinary()` force-crops every upload to **800×800 `crop:'fill'`** (square) — fine for product thumbnails, **wrong for wide banners**. Add a banner-friendly path:

- Add `uploadBannerToCloudinary(file, folder='adverts')` to `utils/cloudinary.js` that uploads with `transformation: [{ width: 1600, crop: 'limit', quality: 'auto' }, { fetch_format: 'auto' }]` — limits max width to 1600px, **preserves aspect ratio, no square crop**.
- The advert image-upload endpoint uses this banner transform. Products/pets keep the existing square `uploadToCloudinary` untouched.

---

## Backend (`backend/`)

### `src/models/advert.model.js`
- Add `'hero'` to `PLACEMENTS` (`['banner', 'sponsored', 'hero']`).
- Add `order: { type: Number, default: 0 }`.
- Make `link` **conditionally required**: `required: function () { return this.placement !== 'hero'; }` (banner/sponsored still require a link; hero does not).
- Existing index `{ placement: 1, active: 1 }` stays (covers the hero query).

### `src/validators/advert.validator.js`
- `placement` valid set → add `'hero'`.
- Add `order: Joi.number().min(0)`.
- `link` required **only** when placement ≠ hero: in `validateAdvert`, use `link: baseFields.link.when('placement', { is: 'hero', then: Joi.optional().allow(''), otherwise: Joi.required() })`.

### `src/controllers/advert.controller.js`
- `getAdverts`: change sort to `.sort('order -createdAt')` (admin-controlled order ascending, then newest). Still filters `active: true` + optional `placement`.
- Add `uploadImage(req, res, next)`: if no `req.file` → `AppError('No image uploaded', 400)`; `const { uploadBannerToCloudinary } = require('../utils/cloudinary'); const r = await uploadBannerToCloudinary(req.file, 'adverts'); res.json({ success: true, data: { url: r.url } })`.

### `src/utils/cloudinary.js`
- Add `uploadBannerToCloudinary` (see transform above), mirroring `uploadToCloudinary` error handling.

### `src/routes/advert.routes.js`
- Add `const { upload } = require('../middlewares/upload');` and `router.post('/upload-image', isAuthenticated, isAdmin, upload.single('image'), uploadImage);` (declared after `/admin/all`, before the generic mutations — POST so no path conflict, but kept explicit and admin-guarded).

### `scripts/seed-promo-banners.js` (new)
- Mirror `seed-gallery.js`. Seeds 3–4 adverts with `placement: 'hero'`, `active: true`, ascending `order`, wide banner image URLs (Unsplash ~1920px), optional `link` (e.g. `/petshop`). `--fresh` removes existing hero adverts only (`deleteMany({ placement: 'hero' })`). Ensures an admin user (createdBy).

---

## Frontend (`frontend/`)

### `src/Services/api/advertsApi.js`
- Add `uploadImage(file)` → `FormData` field `image` → `POST /adverts/upload-image` → returns `response.data?.data?.url`. (Same shape as `galleryApi.uploadImage`.)

### `src/Pages/Admin/Adverts/AdminAdverts.jsx`
- `EMPTY_FORM`: add `order: 0`.
- Placement `<select>`: add `<option value="hero">Homepage carousel (hero banner)</option>`.
- Image field: add an **upload** control (file picker → `advertsApi.uploadImage` → set `form.image`), keeping the URL input as a fallback. Show the resolution hint ("Recommended ~1920×680, wide banner") when placement is `hero`.
- Add an `order` number input (shown for all; matters for hero).
- Validation: require `link` only when `placement !== 'hero'` (today it always requires link).
- When editing, load `order` (default 0) into the form.
- Subtitle copy updated to mention the homepage carousel.

### `src/Pages/HomePage/HomePageSections/PromoBannerCarousel/PromoBannerCarousel.jsx`
- Remove the 18 hardcoded image imports and the static `SLIDES`.
- On mount, fetch `advertsApi.getAdverts('hero')`; map `data` → slides `{ id: _id, image, link, alt: title }` (API already returns them sorted by `order`).
- **If zero slides → `return null`** (hide the section).
- Render each slide's image (single image, `object-fit: cover`); if `slide.link`, wrap in `<a>` (external `target=_blank` for `http`, internal otherwise).
- Keep autoplay/arrows/dots/progress, but **disable autoplay + hide arrows/dots when only one slide**.
- Loading: render nothing (or a low-height placeholder) until the fetch resolves; on fetch error, render nothing.

### `src/Pages/HomePage/HomePageSections/PromoBannerCarousel/PromoBannerCarousel.css`
- `.pbc-root`: `max-width: 960px; margin: 0 auto;` (add) — keep `position: relative; overflow: hidden`. Heights unchanged. Optionally add `border-radius` is **out of scope** (user chose "narrower", not the inset/rounded option).

---

## Data flow

1. Admin → Adverts → New, sets placement **hero**, uploads an image (→ `/adverts/upload-image` → Cloudinary wide transform → URL stored in `image`), sets `order`, optional `link`, `active`.
2. Homepage `PromoBannerCarousel` fetches `GET /api/adverts?placement=hero` (active only, sorted by order) and renders the slides; hides if none.

## Error handling

- Backend: `AppError` + central handler; upload errors via multer `fileFilter`; validation 400.
- Frontend: upload failure → toast; carousel fetch failure → render nothing (never breaks the homepage); admin form validation messages as today.

## Testing

- **Backend (Jest+supertest, extend `tests/adverts.controller.test.js`):** create hero advert without a link succeeds (201); banner/sponsored without link still 400; `getAdverts?placement=hero` returns active hero sorted by `order`; `order` persisted; `POST /adverts/upload-image` returns `{data:{url}}` (Cloudinary mocked). Model: `validateSync` accepts `hero`; link not required for hero, required otherwise.
- **Frontend (Vitest+RTL):** `PromoBannerCarousel` renders fetched hero slides; renders nothing when the API returns `[]`; a slide with `link` renders an anchor (API mocked). (Keep it light — Framer Motion/timers mocked or avoided.)
- Manual: seed → homepage shows narrower carousel; admin uploads a banner and it appears; empty (deactivate all) → carousel disappears.

## Out of scope (YAGNI)

- Per-device (desktop/tablet/mobile) image variants — single image only.
- Drag-to-reorder UI (numeric `order` field only).
- Rounded-corner/inset styling (user chose plain narrower).
- Migrating the old bundled brand `.webp` assets into the DB (admin re-uploads as desired; seed provides starter banners).

## New dependencies
None (multer + Cloudinary already present).
