# Homepage Engagement: Question/Feedback Tabs + Feedback Testimonials — Design Spec

**Date:** 2026-06-14
**Status:** Approved, proceeding to implementation
**Scope:** Sub-project 2 of the batch. Full-stack. Adds a Feedback resource + a tabbed homepage engagement section + DB-driven "What Our Clients Say".

## Goal
1. Homepage: present the existing **question form** and a new **Leave Feedback** form as **tabs** (the Featured-section sliding-pill style).
2. A **Feedback / testimonials** feature: public submission (name, role, 1–5 rating, message, **up to 3 photos**), **admin moderation** (approve/delete), and display of **approved** feedback in the homepage **"What Our Clients Say"** carousel (the existing `StatsSection`).

## Approved decisions
- Feedback fields: `name`, `role` (optional subtitle), `rating` (1–5), `message`, `photos` (**0–3**, Cloudinary URLs), `approved` (default **false**).
- **Approval required** before a feedback shows publicly.
- **Anyone** can submit (public form).
- Homepage display: drive the existing `StatsSection` testimonials from approved feedback; **fall back to the current hardcoded testimonials when none exist**.
- Product `review` (user+product+rating) is unrelated — feedback is a new, separate model.

---

## Backend (`backend/`)

### `src/models/feedback.model.js` (new)
```
Feedback {
  name:     String, required, 2–80, trim
  role:     String, default '', trim, max 80      // e.g. "Dog parent"
  rating:   Number, required, min 1, max 5
  message:  String, required, 5–1000, trim
  photos:   [String], default [], validate max length 3   // Cloudinary URLs
  approved: Boolean, default false, index
  timestamps: true
}
```

### `src/controllers/feedback.controller.js` (new)
- `submitFeedback` (public) — `req.files` (multer, ≤3 images) → `uploadMultipleToCloudinary(files, 'feedback')` → `photos`; create with `approved:false`; 201 with a "pending approval" message. Validates name/rating/message (rating coerced from string).
- `getFeedback` (public) — `{ approved: true }`, sort `-createdAt`, optional `limit` (default 12); `{ success, count, data }`.
- `getFeedbackAdmin` (admin) — all, sort `-createdAt`.
- `updateFeedback` (admin) — set `approved` (and/or other fields); validate id; 404.
- `deleteFeedback` (admin) — delete by id; 404.

### `src/routes/feedback.routes.js` (new) — mount `/api/feedback` in `app.js`
```
POST   /api/feedback             submitFeedback   (public, upload.array('photos', 3))
GET    /api/feedback             getFeedback      (public)
GET    /api/feedback/admin/all   getFeedbackAdmin (auth, admin)
PATCH  /api/feedback/:id         updateFeedback   (auth, admin)
DELETE /api/feedback/:id         deleteFeedback   (auth, admin)
```
- `src/validators/feedback.validator.js` — `validateFeedback` (Joi: name 2–80 required, role optional, rating 1–5 required, message 5–1000 required). Runs after multer (validates `req.body`; photos handled in controller).
- (xss-clean bypass not needed — message is plain text rendered as text, not HTML.)

---

## Frontend (`frontend/`)

### `src/Services/api/feedbackApi.js` (new)
- `submitFeedback(formData)` — POST `/feedback` as `multipart/form-data` (fields + `photos` files).
- `getFeedback(params)` — GET `/feedback`.
- `getFeedbackAdmin()` — GET `/feedback/admin/all`.
- `updateFeedback(id, data)` — PATCH `/feedback/:id`.
- `deleteFeedback(id)` — DELETE `/feedback/:id`.

### Homepage tabbed engagement section
- New `src/Pages/HomePage/HomePageSections/EngagementSection/EngagementSection.jsx` (+ CSS) with a **sliding-pill tab bar** (same Framer Motion `layoutId` approach as `FeaturedProductSection`): **"Ask a Question"** and **"Leave Feedback"**.
  - **Ask a Question** tab: the existing contact/question form (move the form markup from `ContactSection.jsx`; submit via `contactApi.submitContact` — completes the E2E into the AdminContacts inbox).
  - **Leave Feedback** tab: form with Name, Role (optional), **star rating** (1–5 clickable stars), Message, and **up to 3 photo uploads** (file picker + thumbnails + remove; cap at 3) → `feedbackApi.submitFeedback`. On success: toast + "Thanks! Your feedback will appear once approved."
- `HomePage.jsx`: replace `<ContactSection />` with `<EngagementSection />`. (Keep `ContactSection.css` styles reused or fold into Engagement CSS.)

### Homepage "What Our Clients Say" (`StatsSection.jsx`)
- On mount, `feedbackApi.getFeedback({ limit: 12 })`; if results, map to the testimonial card shape (`{ name, role, quote: message, rating, image: photos[0] }`) and use them in the existing carousel; **else keep the hardcoded `TESTIMONIALS`**. No layout change.

### Admin
- `src/Pages/Admin/Feedback/AdminFeedback.jsx` (+ CSS) — DataTable (name, rating stars, message snippet, photos count, **Approved toggle** via `updateFeedback`, date), detail modal (full message + photo thumbnails), delete via shared `AnimatePresence` modal. Route `/admin/feedback` + sidebar item (icon `FiMessageSquare`). Stats strip (total / pending / approved).

---

## Data flow
1. Visitor → homepage → "Leave Feedback" tab → submits (with ≤3 photos) → `POST /api/feedback` → stored `approved:false`.
2. Admin → Feedback → sees pending → approves (or deletes).
3. Homepage `StatsSection` → `GET /api/feedback` (approved) → shows in "What Our Clients Say".
4. "Ask a Question" tab → `POST /api/contact` → AdminContacts inbox (already built).

## Error handling
- Backend: `AppError` + central handler; multer `fileFilter` rejects non-images; 400 validation; auth guards; >3 photos rejected by model validator.
- Frontend: toasts on submit/admin failures; StatsSection falls back to hardcoded on fetch error; photo picker enforces the 3-photo cap client-side.

## Testing
- **Backend (Jest+supertest):** submit → `approved:false` (201); `GET /api/feedback` returns approved only; admin list returns all (401/403 guards); `PATCH` approves; `DELETE`; photo upload mocked (`uploadMultipleToCloudinary`); validator rejects bad rating/missing message; model rejects >3 photos.
- **Frontend (Vitest+RTL):** feedback form submits via `feedbackApi` and enforces the 3-photo cap; tab switch toggles between Question and Feedback; `StatsSection` uses DB feedback when present and falls back when empty; `AdminFeedback` renders rows + approve toggle calls `updateFeedback`.
- Manual: submit feedback w/ photos → pending in admin → approve → appears in "What Our Clients Say".

## Out of scope (YAGNI)
- Replies/threads on feedback; per-feedback editing of photos after submit (delete + resubmit).
- Email notification on new feedback (could reuse the contact email util later).
- Star rating on the question form (questions aren't rated).

## New dependencies
None (multer + Cloudinary `uploadMultipleToCloudinary` already present).
