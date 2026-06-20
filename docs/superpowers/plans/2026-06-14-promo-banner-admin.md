# Admin-Managed Promo Banner Carousel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use `- [ ]`. **Per user instruction: do NOT git commit/push. Stage in working tree only.**

**Goal:** Make the homepage promo carousel admin-managed (via the Advert system) and narrower (960px), with uploaded wide-banner images, ordering, and optional links.

**Architecture:** Extend Advert with a `hero` placement + `order`; add a banner-aware Cloudinary upload + endpoint; admin manages slides in the existing Adverts page; the carousel fetches active `hero` adverts and hides when empty.

**Tech Stack:** Express/Mongoose/Joi/Cloudinary (backend, Jest); React/Vite/Framer Motion (frontend, Vitest).

**Spec:** `docs/superpowers/specs/2026-06-14-promo-banner-admin-design.md`

---

## BACKEND

### Task 1: Cloudinary banner transform
**Files:** Modify `src/utils/cloudinary.js`
- [ ] Add, after `uploadToCloudinary`:
```js
// Wide-banner upload — preserves aspect ratio (no square crop), caps width.
exports.uploadBannerToCloudinary = async (file, folder = 'adverts') => {
  try {
    const b64 = Buffer.from(file.buffer).toString('base64');
    const dataURI = `data:${file.mimetype};base64,${b64}`;
    const result = await cloudinary.uploader.upload(dataURI, {
      folder,
      resource_type: 'auto',
      transformation: [
        { width: 1600, crop: 'limit', quality: 'auto' },
        { fetch_format: 'auto' },
      ],
    });
    return { url: result.secure_url, publicId: result.public_id };
  } catch (error) {
    logger.error('Cloudinary banner upload error:', error);
    throw new AppError('Error uploading banner to Cloudinary', 500);
  }
};
```
- [ ] Stage only.

### Task 2: Advert model — hero placement, order, conditional link
**Files:** Modify `src/models/advert.model.js`; Test `tests/advert.model.test.js` (new)
- [ ] **Failing test** `tests/advert.model.test.js`:
```js
const mongoose = require('mongoose');
const Advert = require('../src/models/advert.model');

describe('Advert model — hero', () => {
  it('accepts placement "hero" without a link', () => {
    const err = new Advert({ title: 'Hero One', placement: 'hero', createdBy: new mongoose.Types.ObjectId() }).validateSync();
    expect(err).toBeUndefined();
  });
  it('still requires a link for banner placement', () => {
    const err = new Advert({ title: 'Banner', placement: 'banner', createdBy: new mongoose.Types.ObjectId() }).validateSync();
    expect(err.errors.link).toBeDefined();
  });
  it('defaults order to 0', () => {
    const a = new Advert({ title: 'X', placement: 'hero', createdBy: new mongoose.Types.ObjectId() });
    expect(a.order).toBe(0);
  });
});
```
- [ ] **Run** `cd backend && npx cross-env NODE_ENV=test jest --runInBand tests/advert.model.test.js` → FAIL.
- [ ] **Implement:** in `advert.model.js` set `const PLACEMENTS = ['banner', 'sponsored', 'hero'];`; change `link` to:
```js
    link: {
      type: String,
      required: [function () { return this.placement !== 'hero'; }, 'Advert link is required'],
      trim: true,
    },
```
and add after `placement`:
```js
    order: { type: Number, default: 0 },
```
- [ ] **Run** → PASS. Stage only.

### Task 3: Validator — hero, order, conditional link
**Files:** Modify `src/validators/advert.validator.js`
- [ ] `placement`: `Joi.string().valid('banner', 'sponsored', 'hero')`.
- [ ] add `order: Joi.number().min(0)` to `baseFields`.
- [ ] In `validateAdvert`, replace `link: baseFields.link.required()` with:
```js
    link: baseFields.link.when('placement', {
      is: 'hero',
      then: Joi.optional().allow(''),
      otherwise: Joi.required(),
    }),
```
(Keep `validateAdvertUpdate` as `Joi.object(baseFields).min(1)`.) Stage only.

### Task 4: Controller — sort by order + uploadImage
**Files:** Modify `src/controllers/advert.controller.js`
- [ ] `getAdverts`: change `.sort('-createdAt')` → `.sort('order -createdAt')`.
- [ ] Add:
```js
const { uploadBannerToCloudinary } = require('../utils/cloudinary'); // add to existing requires
// ...
exports.uploadImage = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('No image uploaded', 400));
    const result = await uploadBannerToCloudinary(req.file, 'adverts');
    return res.status(200).json({ success: true, data: { url: result.url } });
  } catch (error) {
    return next(error);
  }
};
```
- [ ] Stage only.

### Task 5: Route
**Files:** Modify `src/routes/advert.routes.js`
- [ ] Add `const { upload } = require('../middlewares/upload');`, import `uploadImage` from controller, and after `/admin/all`:
```js
router.post('/upload-image', isAuthenticated, isAdmin, upload.single('image'), uploadImage);
```
- [ ] Stage only.

### Task 6: Controller tests (extend)
**Files:** Modify `tests/adverts.controller.test.js`
- [ ] Add (Cloudinary mocked at top: `jest.mock('../src/utils/cloudinary', () => ({ uploadBannerToCloudinary: jest.fn().mockResolvedValue({ url: 'https://cdn.example.com/b.jpg', publicId: 'adverts/b' }) }));`):
  - POST hero advert without link → 201.
  - POST banner without link → 400.
  - `GET /api/adverts?placement=hero` returns active hero sorted by `order` (create two with order 2 then 1, assert order 1 first).
  - `POST /api/adverts/upload-image` (admin, `.attach('image', ...)`) → 200 `{data:{url}}`.
- [ ] **Run** `npx cross-env NODE_ENV=test jest --runInBand tests/adverts.controller.test.js` → PASS. Stage only.

### Task 7: Seed hero banners
**Files:** Create `scripts/seed-promo-banners.js` (mirror `seed-gallery.js`)
- [ ] 4 hero adverts, `active: true`, `order` 1..4, wide Unsplash image URLs (~1920w), `link: '/petshop'` on a couple. `--fresh` → `Advert.deleteMany({ placement: 'hero' })`. Ensure admin user.
- [ ] **Run** `node scripts/seed-promo-banners.js` → "Seeded 4 hero banners". Stage only.

---

## FRONTEND

### Task 8: advertsApi.uploadImage
**Files:** Modify `src/Services/api/advertsApi.js`
- [ ] Add:
```js
  uploadImage: async (file) => {
    const fd = new FormData();
    fd.append("image", file);
    const response = await api.post("/adverts/upload-image", fd, { headers: { "Content-Type": "multipart/form-data" } });
    return response.data?.data?.url;
  },
```
Stage only.

### Task 9: PromoBannerCarousel — data-driven + hide-empty + narrower
**Files:** Modify `PromoBannerCarousel.jsx` + `PromoBannerCarousel.css`; Test `PromoBannerCarousel.test.jsx` (new)
- [ ] **Failing test** `PromoBannerCarousel.test.jsx`:
```jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
vi.mock("../../../../Services/api/advertsApi", () => ({ default: { getAdverts: vi.fn() } }));
import advertsApi from "../../../../Services/api/advertsApi";
import PromoBannerCarousel from "./PromoBannerCarousel";

beforeEach(() => vi.clearAllMocks());

describe("PromoBannerCarousel", () => {
  it("renders nothing when there are no hero banners", async () => {
    advertsApi.getAdverts.mockResolvedValue({ data: [] });
    const { container } = render(<PromoBannerCarousel />);
    await waitFor(() => expect(advertsApi.getAdverts).toHaveBeenCalledWith("hero"));
    expect(container.querySelector(".pbc-root")).toBeNull();
  });
  it("renders fetched banners with a link when provided", async () => {
    advertsApi.getAdverts.mockResolvedValue({ data: [{ _id: "1", image: "https://x/img.jpg", title: "Promo", link: "/petshop" }] });
    render(<PromoBannerCarousel />);
    const img = await screen.findByAltText("Promo");
    expect(img).toBeInTheDocument();
    expect(img.closest("a")).toHaveAttribute("href", "/petshop");
  });
});
```
- [ ] **Run** `cd frontend && npx vitest run src/Pages/HomePage/HomePageSections/PromoBannerCarousel/PromoBannerCarousel.test.jsx` → FAIL.
- [ ] **Implement** `PromoBannerCarousel.jsx`: remove the 18 image imports + static `SLIDES`; add `const [slides, setSlides] = useState(null)` and on mount `advertsApi.getAdverts('hero').then(r => setSlides((r.data||[]).map(a => ({ id: a._id, image: a.image, link: a.link, alt: a.title })))).catch(() => setSlides([]))`. While `slides === null` → `return null`; if `slides.length === 0` → `return null`. Keep the motion/track/dots/progress, but compute `const multi = slides.length > 1;` and only render arrows/dots/progress + run autoplay when `multi`. Wrap each slide `<img>` in `slide.link ? <a href={slide.link} target={slide.link.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">…</a> : <>…</>`. Use a single `<img src={slide.image} alt={slide.alt} className="pbc-img" />` (drop `<picture>`/responsive sources).
- [ ] **CSS:** `.pbc-root { max-width: 960px; margin: 0 auto; }` (add to existing rule).
- [ ] **Run** test → PASS. Stage only.

### Task 10: AdminAdverts — hero option, upload, order, optional link
**Files:** Modify `src/Pages/Admin/Adverts/AdminAdverts.jsx` (+ small CSS if needed)
- [ ] `EMPTY_FORM` → add `order: 0`.
- [ ] Edit-load: include `order: advert.order ?? 0`.
- [ ] Placement select: add `<option value="hero">Homepage carousel (hero banner)</option>`.
- [ ] Image field: add a file input + button that calls `advertsApi.uploadImage(file)` and sets `form.image` (with an `uploadingImage` state); keep the URL input as fallback; when `form.placement === 'hero'` show hint text "Recommended ~1920×680 (wide banner)". Show a preview `<img>` when `form.image` is set.
- [ ] Add an `order` number input: `<input type="number" min="0" value={form.order} onChange={set('order')} />`.
- [ ] Validation: change the guard so `link` is required only when `form.placement !== 'hero'`:
```js
if (form.title.trim().length < 2 || (form.placement !== 'hero' && !form.link.trim())) {
  addToast("Title is required (and a link for banner/sponsored)", "error");
  return;
}
```
- [ ] Stage only.

### Task 11: Frontend verification
- [ ] `npx vitest run src/Pages/HomePage/HomePageSections/PromoBannerCarousel/PromoBannerCarousel.test.jsx` → pass.
- [ ] `npm run build` → clean.
- [ ] `npm test` → all green. Stage only — do NOT commit.

### Task 12: Live verification
- [ ] Backend already running (nodemon picks up changes). `curl "http://localhost:5000/api/adverts?placement=hero"` → seeded banners, sorted by order.
- [ ] Note for user: open homepage → narrower carousel with seeded banners; admin can upload/add/reorder.

---

## Self-Review
- **Spec coverage:** width (T9 CSS), admin-managed via Advert (T2,T3,T4,T5,T10), upload (T1,T4,T5,T8,T10), order (T2,T3,T4,T10), optional link (T2,T3,T10), hide-empty (T9), seed (T7), banner Cloudinary transform (T1,T4), resolution hint (T10), tests (T2,T6,T9). All covered.
- **Placeholders:** concrete code for the non-obvious pieces; AdminAdverts edits enumerated against the file's known structure (read at implementation time for exact JSX anchors).
- **Consistency:** `uploadBannerToCloudinary` defined T1 → used T4; `order` model(T2)/validator(T3)/sort(T4)/form(T10); placement `hero` consistent; `/adverts/upload-image` returns `{data:{url}}` (T4) consumed by `advertsApi.uploadImage` (T8) used in T10; carousel reads `getAdverts('hero')` (T9) which the seed (T7) populates.
- **Commit policy:** every task ends "Stage only — do NOT commit."
