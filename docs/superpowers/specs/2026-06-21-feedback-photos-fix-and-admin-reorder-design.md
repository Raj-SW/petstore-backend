# Feedback Photos — Homepage Fix + Admin Reorder/Manage — Design Spec (Epic 7)

**Date:** 2026-06-21
**Repos:** backend (`petstore-backend`) — model/migration/controller/validator; frontend (`petstore-frontend`) — `StatsSection.jsx` (homepage) + `AdminFeedback.jsx` (admin).
**Status:** ✅ Approved design, pending implementation plan.
**Backlog:** `docs/BACKLOG-2026-06-21.md` Epic 7; phase-1 notes in `docs/BACKLOG-2026-06-21-PHASE1-BRAINSTORM.md`. Reuses the image-reorder pattern from `2026-06-21-product-bulk-actions-and-image-ordering-design.md` (Epic 6).

## Problem

Two issues with feedback photos:

1. **🐛 Homepage shows wrong photos for the wrong feedback** ("What Our Client Say", `StatsSection.jsx`). Root cause (verified): each fetched feedback is mapped to a single `image: fb.photos?.[0]`; the image grid then renders that one photo **or, when a feedback has no photo, falls back to a hardcoded `SLIDE_IMAGES[activeIdx]` set of stock demo images**. So a real text testimonial with no photo is paired with unrelated stock images, and even photo'd feedback only ever shows `photos[0]` (the other two grid slots are placeholders, never that feedback's other photos).
2. **Admin can't manage feedback photos.** `Feedback.photos` is `[String]` (plain URLs, no Cloudinary `publicId`); `updateFeedback` does `findByIdAndUpdate(req.body)` with no upload handling. Admins need to reorder (choose what shows first), delete inappropriate photos, and add photos.

## Current state (from code)

- `models/feedback.model.js`: `{ name, role, rating, message, photos: [String] (≤3), approved }`.
- `controllers/feedback.controller.js`: `submitFeedback` uploads via `uploadMultipleToCloudinary` (returns `{url, publicId}`) but stores only `r.url`. `updateFeedback` = `findByIdAndUpdate(id, req.body, {runValidators})` — accepts arbitrary fields (mass-assignment), no uploads.
- Frontend `StatsSection.jsx`: maps feedback → `{ id, author, text, rating, image: fb.photos?.[0] }`; grid falls back to hardcoded `SLIDE_IMAGES`. `AdminFeedback.jsx`: lists/approves/deletes feedback. `@dnd-kit/*` already installed.

## Design

### Part A — Storage upgrade (backend)

- **Model:** `Feedback.photos` `[String]` → `[{ url: String, publicId: String }]` (keep the ≤3 validator on array length).
- **`submitFeedback`:** store the full Cloudinary result `{ url, publicId }` (not just `url`).
- **Migration script** (`scripts/migrate-feedback-photos.js`): convert existing string photos to `{ url, publicId }`. Backfill `publicId` by parsing the Cloudinary URL (`…/upload/v123/<publicId>.<ext>` → `<publicId>`); if unparseable, set `publicId: ''` (legacy delete then just drops from the array, no cloud cleanup). Idempotent (skip docs already in object form).

### Part B — Homepage fix (frontend `StatsSection.jsx`)

- Map each feedback to carry **all** its photos: `photos: (fb.photos || []).map(p => p.url)`, keyed by `fb._id`. Track a `usingDbData` flag (true when the API returned ≥1 approved feedback).
- **Render only the active feedback's own photos**, keyed by `_id` (not array index, to avoid cross-wiring during slide transitions). **Adaptive layout by photo count:**
  - 0 photos → a tasteful no-photo card (author initials / quote styling); **no placeholders, no stock images**.
  - 1 photo → one framed image.
  - 2–3 photos → a small grid of those photos.
- **Remove the `SLIDE_IMAGES` fallback from DB mode.** Keep the hardcoded `TESTIMONIALS` + `SLIDE_IMAGES` strictly for the **empty state** (API returns zero approved feedback) — i.e. only when `usingDbData` is false.

### Part C — Admin photo management (backend + frontend)

Reuse the Epic-6 image-reorder/upload pattern.

- **Backend `updateFeedback`** (or a dedicated `PATCH /api/feedback/:id` multipart handler):
  - Accept multipart: existing photos to keep (in order) + an `imageOrder` manifest (tokens: `publicId` for kept, `new:<idx>` for uploaded files) + new files.
  - Upload new files to `feedback` folder; delete removed photos from Cloudinary (`deleteMultipleFromCloudinary` on dropped `publicId`s, best-effort).
  - Rebuild `photos` in manifest order; enforce ≤3 total (400 if exceeded).
  - **Restrict writable fields** to an allow-list (`name, role, rating, message, approved, photos`) — fixes the current mass-assignment.
  - Non-multipart updates (e.g. approve toggle) keep working.
- **Frontend `AdminFeedback.jsx`:** per-feedback editor with: drag-reorder (`@dnd-kit`, first = primary), per-photo delete (×), and an add-photo uploader (disabled once at 3). Save sends the multipart manifest + kept + new files (same shape as `AdminProductForm`).

## Testing

Run suites individually.
- **Backend:** `submitFeedback` stores `{url, publicId}`; admin update reorders (manifest order honored), deletes removed (asserts `deleteMultipleFromCloudinary` called with dropped publicIds — mocked), appends new uploads, enforces ≤3 (400), and ignores non-allow-listed fields; migration script converts string→object and is idempotent.
- **Frontend:** `StatsSection` renders only the active feedback's own photos; a no-photo feedback shows the no-photo card (no stock images); empty API → hardcoded fallback. `AdminFeedback` reorder/delete/add interactions update the saved order.

## Acceptance criteria

- Homepage testimonials display **only each feedback's own photos**; a feedback with no photo never shows unrelated/stock images; layout adapts to 0 / 1 / 2–3 photos; the hardcoded testimonial set appears only when there is no approved feedback.
- `Feedback.photos` stored as `[{ url, publicId }]`; existing data migrated.
- Admin can reorder (first = primary, drives homepage order), delete individual photos (Cloudinary cleaned up), and add photos (≤3) on a feedback; changes persist.
- `updateFeedback` only writes allow-listed fields.
- Build + existing/new tests pass.

## Out of scope
- Redesigning the testimonial section beyond the photo presentation.
- Carousel/animation overhaul (keep the existing slide mechanism).
