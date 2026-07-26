# Merge Google Reviews into the Feedback System (A′) — Design

**Date:** 2026-07-26
**Repos:** backend (model, routes, controller, seed) + frontend (StatsSection, TrustStrip, AdminFeedback)
**Depends on:** Group A merged first (A′ edits `StatsSection`/`TrustStrip` and deletes `googleReviews.js`).

## Goal

Make Google reviews and organic customer feedback one merged, admin-curated set. The homepage "What Our Clients Say" wall and the golden strip's review count both read from the DB. The admin already approves/edits/deletes feedback; A′ adds the ability to bring Google reviews into that same collection and manage them there.

## Why this is small

The moderation system already exists:
- Public `GET /feedback` returns only `approved: true` (`feedback.controller.js:38-42`).
- `AdminFeedback.jsx` already has approve/unapprove toggle, edit, delete, and approved/pending stats.
- Admin endpoints exist: `getFeedbackAdmin`, `updateFeedback` (approve), `deleteFeedback`.

So "admin chooses which reviews show" and "delete the test entries" are already built. A′ only needs to (a) get Google reviews into the collection, (b) distinguish them, and (c) point the frontend count at the DB.

---

## Backend

### 1. `source` field on the feedback model
`src/models/feedback.model.js`: add
```js
source: { type: String, enum: ['organic', 'google'], default: 'organic', index: true }
```
Existing docs lack the field → read as `undefined` → treated as organic (no badge). No backfill required; an optional one-line migration may set `source:'organic'` on existing docs.

### 2. Admin create endpoint
`POST /feedback/admin` (`isAuthenticated`, `isAdmin`) → `createFeedbackAdmin`:
- Body: `{ name, role?, rating (1-5), message, source? }`. Validated by the existing feedback validator (reuse; `source` optional, defaults `'google'` for admin-created).
- Creates with `approved: true` (admin-created is trusted, unlike public submit which is `approved:false`).
- Returns the created doc.

### 3. Curated Google reviews seed
`scripts/seedGoogleReviews.js`:
- Source data: a backend data file `src/data/googleReviews.seed.js` holding the 20 curated reviews (moved verbatim from the frontend `googleReviews.js` being retired), shape `{ name, rating, message, source:'google' }`.
- Inserts each as `approved:true`, **idempotent**: skip if a `source:'google'` doc with the same `name` + `message` already exists (avoids duplicates on re-run).
- Removes the known test entries: delete feedback docs `name` in `['TestUser','Moisa']`. (Guarded to those exact names; logs what it deleted.)
- Runnable via `node scripts/seedGoogleReviews.js`; connects with the app's existing Mongo config.

### 4. Review counts for the frontend
Add `GET /feedback/stats` (public) → `getFeedbackStats`:
```js
{ googleApproved: <count source:'google', approved:true>,
  avgRating: <avg rating over approved, 1 decimal, or null> }
```
Small, cache-friendly, one aggregation. Used by the strip (count) and available to StatsSection (avg).

---

## Frontend

### 5. StatsSection — badge from DB `source`
`src/Pages/HomePage/HomePageSections/StatsSection.jsx`:
- The feedback mapping (`feedback.controller` items → testimonials) already runs; add `source: fb.source` to each mapped object.
- The "via Google" badge condition becomes `featured?.source === 'google'` (lowercase, matching the enum).
- Remove the `import { GOOGLE_REVIEWS } from './googleReviews'` and the `GOOGLE_REVIEWS.length ? … : TESTIMONIALS` seed — initial state reverts to `TESTIMONIALS` (the generic fallback shown only until the API responds). The DB now carries the real Google reviews.
- Update `StatsSection.test.jsx`: remove the `./googleReviews` mock; the "via Google" test now feeds a feedback item with `source:'google'` through the mocked `feedbackApi`.

### 6. TrustStrip — live count
`src/Pages/HomePage/HomePageSections/TrustStrip/TrustStrip.jsx`:
- Replace the `reviewCountLabel()` import with a fetch of `GET /feedback/stats` on mount; show `` `${googleApproved}+` `` for the "Google Reviews" badge and stat.
- While loading / on error, fall back to a sensible constant (e.g. hide the count or show the last known number) so the strip never renders `undefined+`.

### 7. Retire the frontend curated list
- Delete `src/Pages/HomePage/HomePageSections/googleReviews.js` and `googleReviews.test.js` (superseded by the DB + backend seed data). Confirm no remaining imports.

---

## Admin

### 8. AdminFeedback — add + distinguish
`src/Pages/Admin/Feedback/AdminFeedback.jsx`:
- **"Add review" form** (modal/inline): name, role (optional), rating, message, source (default `google`) → calls new `feedbackApi.createFeedbackAdmin` → `POST /feedback/admin`. On success, refetch the admin list.
- **Source badge/column** in the table so Google vs organic entries are visible; optional filter by source.
- `feedbackApi.js`: add `createFeedbackAdmin(data)`.

### 9. Test-entry cleanup
"TestUser" / "Moisa" removed by the seed script (step 3) or via the existing admin delete. No new capability.

---

## Data flow

- Homepage wall: `GET /feedback?approved=true` → merged organic + Google (badged) → StatsSection.
- Strip count: `GET /feedback/stats` → `googleApproved` → TrustStrip.
- Admin: `GET /feedback/admin/all` → all entries with source → approve/edit/delete/add.

## Error handling

- `/feedback/stats` failure → strip falls back gracefully (no `undefined`).
- Seed is idempotent and guarded; safe to re-run.
- Admin create validates via the existing validator; rejects bad rating/short message.

## Testing

- Backend: `createFeedbackAdmin` (creates approved, defaults source google, rejects invalid); `getFeedbackStats` (counts only approved google, avg over approved); seed idempotency (second run inserts nothing new, removes test entries once).
- Frontend: StatsSection "via Google" badge from a `source:'google'` feedback item; TrustStrip renders `N+` from a mocked stats response and falls back on error.

## Out of scope / deferred

- Live Google Places sync (still rejected — API key/cost/ToS/5-review cap).
- Per-review photos for Google reviews (Google reviews seed without photos; monogram fallback already handles it).
- Sorting/pinning specific reviews to the top (admin approve/unapprove is the only visibility control for now).
