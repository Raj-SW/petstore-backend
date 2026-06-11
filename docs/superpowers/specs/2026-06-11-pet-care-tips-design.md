# Pet Care Tips — Design Spec

**Date:** 2026-06-11
**Status:** Approved (brainstormed + mockups validated in session)

## Overview

A Pet Care Tips knowledge base for VitalPaws. Users browse, search, and read expert pet-care articles filtered by animal type, category, breed, and difficulty. Admins manage tips (full CRUD, draft/publish, feature) and adverts (banner + sponsored placements) from the existing admin dashboard.

## Goals

- Users can search and filter tips by animal type, category, and free-text search.
- A featured section curated by admin (featured flag) headlines the page.
- Admin-managed adverts appear in two placements: a banner strip between sections and sponsored cards mixed into the tip grid.
- Tip detail page renders rich text (TipTap HTML) safely with related tips and a sidebar advert.
- All content is dynamic — no hardcoded tips.

## Non-Goals (v1)

- Cover image uploads (cover image is a URL string; Cloudinary upload can come later).
- Mobile bottom navigation bar / Embla mobile carousel (basic responsive stacking only).
- User-submitted tips, comments, likes, bookmarks.
- Advert click/impression analytics.

## Architecture

Follows existing VitalPaws patterns exactly:

- **Backend** (separate repo `backend/`): Mongoose models → Joi validators → controllers (AppError + logger) → Express routers mounted in `app.js`. Public GETs unauthenticated; mutations behind `isAuthenticated, isAdmin`.
- **Frontend** (separate repo `frontend/`): API service modules in `Services/api/`, pages in `Pages/<Name>/`, admin pages with the shared `DataTable`, routes in `main.jsx`.

## Data Models

### PetCareTip

| Field | Type | Notes |
|---|---|---|
| title | String, required, 2–150 chars | |
| slug | String, unique, lowercase | auto from title (pre-save) |
| coverImage | String URL, optional | empty → animal-color placeholder |
| body | String, required | TipTap HTML |
| animalType | enum: dog, cat, bird, fish, rabbit, reptile, other | required |
| category | enum: nutrition, grooming, health, training, exercise, dental, behavior | required |
| breed | String, optional | free text |
| difficulty | enum: beginner, intermediate, advanced | default beginner |
| readTime | Number (minutes) | auto: word count / 200 wpm, min 1 (pre-save) |
| featured | Boolean, default false | shows in featured section |
| published | Boolean, default false | drafts hidden from public API |
| createdBy | ObjectId ref User, required | |
| timestamps | createdAt / updatedAt | |

### Advert

| Field | Type | Notes |
|---|---|---|
| title | String, required, 2–120 chars | |
| image | String URL, optional | |
| link | String URL, required | click-through |
| placement | enum: banner, sponsored | required |
| active | Boolean, default true | |
| createdBy | ObjectId ref User, required | |
| timestamps | createdAt / updatedAt | |

## API

### Tips — `/api/tips`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/tips` | public | Published tips. Query: `animalType, category, difficulty, featured, search, exclude, page, limit, sort` |
| GET | `/api/tips/admin/all` | admin | All tips incl. drafts |
| GET | `/api/tips/:idOrSlug` | public | Single published tip by slug or id |
| POST | `/api/tips` | admin | Create |
| PATCH | `/api/tips/:id` | admin | Update (any field incl. featured/published toggles) |
| DELETE | `/api/tips/:id` | admin | Delete |

### Adverts — `/api/adverts`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/adverts` | public | Active adverts. Query: `placement` |
| GET | `/api/adverts/admin/all` | admin | All adverts |
| POST | `/api/adverts` | admin | Create |
| PATCH | `/api/adverts/:id` | admin | Update |
| DELETE | `/api/adverts/:id` | admin | Delete |

### XSS handling (important)

`app.js` applies `xss-clean` globally, which irreversibly HTML-encodes JSON bodies — it would destroy TipTap HTML. Tips/adverts mutations are admin-only and the frontend renders bodies exclusively through `RichTextRenderer` (DOMPurify allow-list). Therefore `app.js` skips `xss()` for `POST/PATCH/PUT` on paths starting with `/api/tips`. Defense remains: admin-only authoring + DOMPurify at render.

## Frontend

### Design language (validated via mockups)

- Warm amber accent: `#BA7517` (deep), `#FAEEDA` (tint), `#633806` (text-on-tint) for CTAs, eyebrows, active filters.
- Serif headings (Georgia stack) for hero title and card titles; sans for UI.
- Animal identity colors: dog `#1D9E75`, cat `#7F77DD`, bird `#EF9F27`, fish `#378ADD`, rabbit `#639922`, reptile `#D85A30`, other `#888780`. Used for 5px card top strips, icon tints, cover placeholders.
- Flat surfaces, 1px light borders, 12px radius cards, no heavy shadows.
- Uppercase letter-spaced amber eyebrow labels above sections.

### Page: `/pet-care-tips` (listing)

1. **Hero** — amber eyebrow ("Expert knowledge, for every pet"), serif H1, subtitle, search input (debounced → `search` param), oversized low-opacity paw icon decoration.
2. **Animal strip** — horizontal pill row (All + 7 animal types) with icons; active pill amber.
3. **Featured section** — eyebrow "Featured this week"; asymmetric grid: 1 large card + 2 stacked small cards (first 3 `featured=true` tips).
4. **Banner advert** — first active `placement=banner` advert; icon box + Sponsored tag + title + amber "Shop now" CTA linking out.
5. **Browse grid** — eyebrow "Browse all tips"; category chip row; 3-col card grid (2-col tablet, 1-col mobile). Sponsored adverts (`placement=sponsored`) injected after every 5th card with dashed border + Sponsored badge.
6. **Animations** — Framer Motion: hero stagger fade-up on mount; cards fade+slide-up on scroll into view (`react-intersection-observer`).

### Page: `/pet-care-tips/:slug` (detail)

1. Breadcrumb ("← Back to tips" in amber + animal/category crumbs).
2. Cover hero: animal-color tint background (or coverImage), overlay strip at bottom with badges + serif title.
3. Two-column: article (65%) + sidebar (35%); stacks on mobile.
4. Article: meta row (read time, date, author "VitalPaws team"), body via `RichTextRenderer`.
5. Sidebar: "About this tip" facts card; sponsored advert card; "You might also like" — 3 related tips (same animalType, excluding current).

### Admin

- `/admin/tips` — stats cards (total, published, drafts, featured) + DataTable (title, animal, category, difficulty, featured toggle, published toggle, edit/delete). "New tip" button.
- `/admin/tips/new`, `/admin/tips/edit/:id` — form: title, coverImage URL, animalType, category, breed, difficulty, featured, published, body via existing `RichTextEditor`.
- `/admin/adverts` — DataTable (title, placement, active toggle, link, edit/delete) + create/edit modal form.
- AdminLayout sidebar gains "Pet Care Tips" and "Adverts" items.
- NavigationBar gains "Care Tips" link → `/pet-care-tips`.

### Reused components/packages (no new installs)

`RichTextEditor` / `RichTextRenderer` (existing TipTap + DOMPurify suite), `DataTable` (admin), framer-motion, react-intersection-observer, react-icons, axios `api` client.

## Seed Data

`backend/scripts/seed-pet-care-tips.js` — connects via `MONGODB_URI`, finds (or creates) an admin user, upserts 12 published tips spanning all 7 animal types and all 7 categories (3 featured, 1 draft to test admin visibility) and 4 adverts (2 banner, 2 sponsored, 1 inactive). Idempotent: clears existing tips/adverts first when run with `--fresh`.

## Testing

- Backend: `tests/tips.controller.test.js`, `tests/adverts.controller.test.js` — Jest + supertest + in-memory Mongo replica set (existing harness). Cover: public list filters/search/pagination, draft hidden publicly, slug lookup, admin CRUD, auth guards (401/403), validation errors, advert placement filter.
- Frontend: existing vitest harness; component smoke test for TipCard rendering fields and sponsored variant.

## Error Handling

- API errors use existing `AppError` → global error handler shape `{ success: false, message }`.
- Frontend pages show toast on fetch failure (existing `useToast`) and an empty-state block ("No tips found — try a different filter").
- Detail page: 404 from API → "Tip not found" state with back link.
