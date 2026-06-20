# Homepage Engagement: Feedback + Tabs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`. Commit per the user's current instruction (saving for handoff).

**Goal:** Add a Feedback resource (public submit + photos + admin moderation), a tabbed homepage engagement section (Question | Feedback), and DB-driven "What Our Clients Say".

**Architecture:** New backend Feedback model/controller/routes/validator (multipart photo upload → Cloudinary). Frontend `feedbackApi`, an `EngagementSection` with Featured-style tabs, `StatsSection` fed from approved feedback, and an `AdminFeedback` moderation page.

**Tech Stack:** Express/Mongoose/Joi/multer/Cloudinary (Jest); React/Vite/Framer Motion (Vitest).

**Spec:** `docs/superpowers/specs/2026-06-14-feedback-engagement-design.md`

---

## BACKEND

### Task 1: Feedback model
**Files:** Create `src/models/feedback.model.js`; Test `tests/feedback.model.test.js`
- [ ] Failing test: required name/rating/message; rating 1–5 enforced; rejects >3 photos; `approved` defaults false.
```js
const mongoose = require('mongoose');
const Feedback = require('../src/models/feedback.model');
describe('Feedback model', () => {
  it('requires name, rating, message', () => {
    const e = new Feedback({}).validateSync();
    expect(e.errors.name).toBeDefined();
    expect(e.errors.rating).toBeDefined();
    expect(e.errors.message).toBeDefined();
  });
  it('rejects rating out of range', () => {
    expect(new Feedback({ name: 'A', rating: 9, message: 'hello there' }).validateSync().errors.rating).toBeDefined();
  });
  it('rejects more than 3 photos', () => {
    const e = new Feedback({ name: 'A', rating: 5, message: 'hello there', photos: ['a','b','c','d'] }).validateSync();
    expect(e.errors.photos).toBeDefined();
  });
  it('defaults approved to false', () => {
    expect(new Feedback({ name: 'A', rating: 5, message: 'hello there' }).approved).toBe(false);
  });
});
```
- [ ] Implement:
```js
const mongoose = require('mongoose');
const feedbackSchema = new mongoose.Schema({
  name:    { type: String, required: [true, 'Name is required'], trim: true, minlength: 2, maxlength: 80 },
  role:    { type: String, trim: true, maxlength: 80, default: '' },
  rating:  { type: Number, required: [true, 'Rating is required'], min: 1, max: 5 },
  message: { type: String, required: [true, 'Message is required'], trim: true, minlength: 5, maxlength: 1000 },
  photos:  { type: [String], default: [], validate: { validator: (a) => a.length <= 3, message: 'At most 3 photos' } },
  approved:{ type: Boolean, default: false, index: true },
}, { timestamps: true });
module.exports = mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema);
```
- [ ] Run → pass.

### Task 2: Validator
**Files:** Create `src/validators/feedback.validator.js`
- [ ] `validateFeedback` (mirror tip validator): name 2–80 required, role optional max 80, rating number 1–5 required, message 5–1000 required. Coerce rating (Joi.number() coerces strings). `req.body` may arrive via multipart — validate after multer.

### Task 3: Controller
**Files:** Create `src/controllers/feedback.controller.js`
- [ ] `submitFeedback` (public): `let photos = []; if (req.files?.length) { const r = await uploadMultipleToCloudinary(req.files, 'feedback'); photos = r.map(x => x.url); } const fb = await Feedback.create({ ...req.body, photos, approved: false });` → 201 `{ success, message: 'Thanks! Your feedback will appear once approved.' }`.
- [ ] `getFeedback` (public): `Feedback.find({ approved: true }).sort('-createdAt').limit(Math.min(50, +req.query.limit || 12))` → `{ success, count, data }`.
- [ ] `getFeedbackAdmin` (admin): all, sort `-createdAt`.
- [ ] `updateFeedback` (admin): validate id; `findByIdAndUpdate(id, req.body, { new: true, runValidators: true })`; 404.
- [ ] `deleteFeedback` (admin): validate id; delete; 404.

### Task 4: Routes + app wiring
**Files:** Create `src/routes/feedback.routes.js`; Modify `src/app.js`
- [ ] Routes:
```js
const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middlewares/auth.middleware');
const { upload } = require('../middlewares/upload');
const { validateFeedback } = require('../validators/feedback.validator');
const c = require('../controllers/feedback.controller');
router.post('/', upload.array('photos', 3), validateFeedback, c.submitFeedback);
router.get('/', c.getFeedback);
router.get('/admin/all', isAuthenticated, isAdmin, c.getFeedbackAdmin);
router.patch('/:id', isAuthenticated, isAdmin, c.updateFeedback);
router.delete('/:id', isAuthenticated, isAdmin, c.deleteFeedback);
module.exports = router;
```
- [ ] `app.js`: `const feedbackRoutes = require('./routes/feedback.routes');` + `app.use('/api/feedback', feedbackRoutes);`.

### Task 5: Backend tests
**Files:** Create `tests/feedback.controller.test.js` (mirror adverts/contact harness; mock `uploadMultipleToCloudinary`)
- [ ] Submit (multipart fields, no file) → 201 + `approved:false`; `GET /api/feedback` returns approved only; admin list 401/403/200; PATCH approves; DELETE; bad rating → 400.
- [ ] Run isolated suites → pass.

---

## FRONTEND

### Task 6: feedbackApi
**Files:** Create `src/Services/api/feedbackApi.js`
- [ ] `submitFeedback(formData)` POST `/feedback` multipart; `getFeedback(params)`; `getFeedbackAdmin()`; `updateFeedback(id,data)`; `deleteFeedback(id)`. Mirror existing api modules.

### Task 7: EngagementSection (tabs)
**Files:** Create `src/Pages/HomePage/HomePageSections/EngagementSection/EngagementSection.jsx` (+CSS); Modify `HomePage.jsx`
- [ ] Build the sliding-pill tab bar (copy the `fp-tab*` motion `layoutId` approach from `FeaturedProductSection`). Tab "Ask a Question" = the question form (reuse the contact form markup; submit via `contactApi.submitContact`). Tab "Leave Feedback" = `FeedbackForm` (see Task 8).
- [ ] `HomePage.jsx`: replace `<ContactSection />` import/usage with `<EngagementSection />`.

### Task 8: FeedbackForm (+ star rating + photo upload)
**Files:** Create `src/Pages/HomePage/HomePageSections/EngagementSection/FeedbackForm.jsx`
- [ ] Fields: name, role, **star rating** (5 clickable stars, controlled), message, **photo upload** (`<input type=file multiple accept=image/*>`, cap 3, thumbnail previews + remove). On submit build `FormData` (name, role, rating, message, each photo as `photos`) → `feedbackApi.submitFeedback` → toast "Thanks! Appears once approved", reset.
- [ ] Failing test `FeedbackForm.test.jsx`: fills fields + sets rating + submits → `feedbackApi.submitFeedback` called; cannot add a 4th photo. (Mock feedbackApi + toast.) Implement → pass.

### Task 9: StatsSection from DB
**Files:** Modify `src/Pages/HomePage/HomePageSections/StatsSection.jsx`
- [ ] On mount `feedbackApi.getFeedback({ limit: 12 })`; if `data.length`, map to the testimonial card shape used by the carousel (`{ name, role, quote: message, rating, image: photos[0] }`) and use them; else keep hardcoded `TESTIMONIALS`. No layout change.

### Task 10: AdminFeedback
**Files:** Create `src/Pages/Admin/Feedback/AdminFeedback.jsx` (+CSS); Modify `main.jsx`, `AdminLayout.jsx`
- [ ] Mirror AdminGallery: DataTable (name, rating stars, message snippet, photos count, Approved toggle via `updateFeedback`, date), view modal (message + photo thumbs), delete modal. Stats strip (total/pending/approved).
- [ ] `main.jsx`: admin route `{ path: 'feedback', element: <AdminFeedback /> }`. `AdminLayout.jsx`: sidebar item "Feedback" (`FiMessageSquare`).

### Task 11: Verification
- [ ] `npx vitest run src/Pages/HomePage/HomePageSections/EngagementSection/FeedbackForm.test.jsx` → pass.
- [ ] `npm run build` → clean. `npm test` → all green.
- [ ] Live: `curl -X POST http://localhost:5000/api/feedback -F name=Test -F rating=5 -F "message=Great place"` → 201; `curl http://localhost:5000/api/feedback` → [] (unapproved). Backend nodemon picks up changes.

---

## Self-Review
- **Spec coverage:** model+photos cap (T1), validator (T2), controller incl. multipart upload + approved-only (T3), routes+mount (T4), backend tests (T5), feedbackApi (T6), tabbed section (T7), feedback form w/ rating+≤3 photos (T8), StatsSection DB-driven+fallback (T9), admin moderation (T10), verify (T11). Covered.
- **Placeholders:** code for non-obvious pieces; UI tasks described as "mirror X" with explicit fields/behaviours (read analogue at impl).
- **Consistency:** `uploadMultipleToCloudinary` (exists) → T3; `getFeedback` approved-only (T3) consumed by StatsSection (T9); `feedbackApi` methods (T6) used in T8/T9/T10; `approved` field (T1) toggled in T10.
