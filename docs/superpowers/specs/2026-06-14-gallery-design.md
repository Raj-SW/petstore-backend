# Gallery (Mini Blog) — Design Spec

**Date:** 2026-06-14
**Status:** Approved (UI directions), pending spec review
**Scope:** Full-stack feature spanning the backend repo (`backend/`) and frontend repo (`frontend/`). Mirrors the existing **Pet Care Tips** subsystem.

## Problem / Goal

VitalPaws needs a **Gallery**: a mini blog where admins publish posts about events they attended or other noteworthy happenings. Each post is a rich-text article with a cover image and **inline images**, organised with headings/sections. Visitors browse a card list and open individual posts. Adverts appear on both the list and detail pages.

This is a single cohesive subsystem (one spec), directly analogous to Pet Care Tips, and reuses its patterns, the RichText editor, the Cloudinary upload utilities, and the existing Advert system.

## Approved UX decisions

- **Authoring model:** inline-image rich text — the body is one HTML document authored in the existing TipTap editor, extended with an image node so images can be dropped anywhere; headings provide sectioning. Plus a separate cover image.
- **Post fields:** title, cover image, body (HTML), **category**, **event date**, **location**, **tags**, **featured** flag, **published/draft** toggle.
- **List page (Editorial):** brand header (script title) → category filter chips → featured-post hero → banner advert → 3-column card grid. Cards show cover, category pill, title, event date + location, excerpt.
- **Detail page (Two-column):** article left (cover, title, meta, rich body with inline images), sticky right sidebar with event details, an advert, and "More moments" (related posts).
- **Admin:** a manage table (thumbnail, title, category, event date, status, featured star, edit/delete, search, "+ New Post") and a create/edit form (all fields, cover dropzone, RichText editor with inline 🖼 image upload, Save-draft / Publish, Featured toggle).
- **Adverts:** reuse the existing `Advert` collection as-is. List page renders a `banner` advert; detail sidebar renders a `sponsored`/`banner` advert. No advert schema changes.

## Brand / design system

Forest `#001C10` (primary), amber `#b45309` (accent), warm-ivory `#F6ECE3` (background), script font for page titles, body font elsewhere — consistent with the Pet Care Tips pages. Framer Motion scroll-reveals and the existing card/chip styling are reused.

---

## Backend (`backend/`)

### Model — `src/models/galleryPost.model.js`

```
GalleryPost {
  title:      String, required, 2–150 chars, trim
  slug:       String, unique, lowercase, indexed   // auto from title (pre-save), same algorithm as petCareTip
  coverImage: String, default ''                    // Cloudinary URL
  body:       String, required                       // sanitized TipTap HTML
  excerpt:    String, default '', max 300            // optional; if blank, derived from body text (first ~160 chars) on save
  category:   String, enum [event, community, award, announcement, behind_the_scenes], required
  eventDate:  Date,   required                       // when the event happened
  location:   String, default '', trim, max 160
  tags:       [String], default []                   // lowercased, trimmed, de-duped on save
  featured:   Boolean, default false
  published:  Boolean, default false
  createdBy:  ObjectId ref User, required
  timestamps: true
}
```
- `pre('save')`: build slug from title when title modified (reuse Tips' slug logic); normalise tags; derive excerpt if empty.
- Index: `{ category: 1, published: 1 }` and `{ featured: 1, published: 1 }`.

### Controller — `src/controllers/gallery.controller.js`

- `getPosts(req)` — public. Query `published: true`. Supports `?category=`, `?tag=`, `?featured=true`, `?search=` (title regex), pagination (`page`, `limit` default 12), sorted by `eventDate` desc. Returns `{ data, pagination }` (same envelope as products/tips).
- `getPost(req)` — public. By slug **or** id, `published: true` only. Returns post + a small `related` array (same category, newest 3, excluding self).
- `getPostsAdmin(req)` — admin. All posts incl. drafts.
- `getPostAdmin(req)` — admin. Single by id incl. draft.
- `createPost(req)` — admin. Body validated; `createdBy = req.user._id`.
- `updatePost(req)` — admin. Partial update.
- `deletePost(req)` — admin. Removes the doc. (Cover/inline images are left in Cloudinary — same behaviour as Tips; documented as out of scope.)
- `uploadImage(req)` — admin. `req.file` (one image) → `uploadToCloudinary(file, 'gallery')` → `res { url }`. Used by both the cover dropzone and the inline editor image button.

All controller methods use the existing `AppError` + `errorHandler` and the `catchAsync`/try-pattern already used by `tip.controller.js`.

### Routes — `src/routes/gallery.routes.js` (mounted `app.use('/api/gallery', galleryRoutes)` in `app.js`)

```
GET    /api/gallery                 getPosts            (public)
GET    /api/gallery/admin/all       getPostsAdmin       (auth, admin)
GET    /api/gallery/admin/:id       getPostAdmin        (auth, admin)
GET    /api/gallery/:idOrSlug       getPost             (public)
POST   /api/gallery/upload-image    uploadImage         (auth, admin, upload.single('image'))
POST   /api/gallery                 createPost          (auth, admin, validateGalleryPost)
PATCH  /api/gallery/:id             updatePost          (auth, admin, validateGalleryPostUpdate)
DELETE /api/gallery/:id             deletePost          (auth, admin)
```
Order matters: specific `/admin/*` and `/upload-image` routes are declared before `/:idOrSlug`. `isAuthenticated, isAdmin` guard the mutating + admin routes (same pattern as `tip.routes.js`).

### Validator — `src/validators/gallery.validator.js`

Joi schemas (mirror `tip.validator.js`): `validateGalleryPost` (title, body required; category in enum; eventDate ISO date; location/tags/excerpt optional; featured/published booleans) and `validateGalleryPostUpdate` (all optional). Tags accepts array or comma-string and normalises.

### xss-clean caveat (app.js)

`app.js` already bypasses `xss-clean` for `/api/tips` POST/PATCH because it would mangle TipTap HTML. **Extend that bypass to `/api/gallery`** POST/PATCH (the body holds TipTap HTML, rendered via DOMPurify on the frontend). Body limit (200kb) already covers article bodies.

---

## Frontend (`frontend/`)

### API client — `src/Services/api/galleryApi.js`

`getPosts(params)`, `getPost(idOrSlug)`, `getPostsAdmin()`, `getPostAdmin(id)`, `createPost(data)`, `updatePost(id, data)`, `deletePost(id)`, `uploadImage(file)` (posts `multipart/form-data` with field `image`, returns `{url}`). Same axios instance/envelope handling as `tipsApi.js`.

### RichText — inline images

- Add dependency `@tiptap/extension-image`.
- Add a `"blog"` preset (or extend `"full"`) in `src/Components/RichText/extensions.js` that includes `Image.configure({ inline: false, HTMLAttributes: { class: 'rte-img' } })`.
- Add an image button to `Toolbar.jsx` for that preset: opens a file picker → `galleryApi.uploadImage(file)` → `editor.chain().focus().setImage({ src: url }).run()`. Shows an inline spinner while uploading; surfaces errors via the existing toast.
- `RichTextRenderer` already sanitises with DOMPurify; ensure `img` (with `src`, `alt`, `class`) is in the allowed tags/attrs so inline images render.

### User pages

- `src/Pages/Gallery/GalleryPage.jsx` (+ `Gallery.css`) — Editorial layout: header, `CategoryChips` (reuse Tips' component or a thin local copy), featured hero (first `featured && published` post), a `banner` `AdvertBanner` (reused), then a responsive 3-col `GalleryCard` grid fed by `getPosts`. Loading skeletons + empty state. Framer Motion reveals.
- `src/Pages/Gallery/GalleryDetailPage.jsx` (+ `GalleryDetail.css`) — Two-column: article (cover, category label, title, `eventDate`/`location`/author meta, tags, `RichTextRenderer` body) + sticky sidebar (event details card, advert, related posts from `getPost().related`). 404/empty handling for unknown slug or draft.
- `src/Pages/Gallery/components/GalleryCard.jsx` — cover, category pill, title, date + location, excerpt; links to `/gallery/:slug`.
- Routes in `main.jsx`: `/gallery` → `GalleryPage`, `/gallery/:slug` → `GalleryDetailPage`. Add a nav entry (NavigationBar) consistent with how Pet Care Tips is linked.

### Admin pages

- `src/Pages/Admin/Gallery/AdminGallery.jsx` (+ CSS) — manage table via `getPostsAdmin`; search box; status + category badges; featured star toggle (calls `updatePost`); edit/delete; "+ New Post".
- `src/Pages/Admin/Gallery/AdminGalleryForm.jsx` (+ CSS) — create/edit. Fields: title, category select, event date (date input), location, tags (comma input), cover dropzone (uploads via `galleryApi.uploadImage`, stores returned URL), `RichTextEditor preset="blog"` for body, Published + Featured toggles, Save-draft / Publish. Reuses validation-error display pattern from `AdminTipForm`.
- Wire routes (`/admin/gallery`, `/admin/gallery/new`, `/admin/gallery/:id/edit`) under the admin `RoleBasedRoute`, and add a sidebar item (icon, e.g. `FiImage`) in `AdminLayout.jsx`.

---

## Data flow

1. Admin opens `AdminGalleryForm` → uploads cover + writes body, inserting inline images (each upload hits `POST /api/gallery/upload-image`, returns a Cloudinary URL embedded in the HTML) → Publish → `POST /api/gallery` stores the post (slug auto-generated, excerpt derived).
2. Visitor hits `/gallery` → `getPosts({published})` renders hero + grid; a `banner` advert is fetched from the existing advert API.
3. Visitor clicks a card → `/gallery/:slug` → `getPost(slug)` renders the sanitised body + sidebar advert + related posts.

## Error handling

- Backend: `AppError` + central `errorHandler`; 404 for unknown/unpublished slug; 400 for validation; 401/403 via auth guards; upload errors (non-image / >20MB) surfaced by the existing multer `fileFilter`.
- Frontend: toast on upload/save failures; skeletons during load; empty states on no results; detail page shows a friendly "post not found" for bad slugs.

## Testing

- **Backend (Jest + supertest, mirrors `tests/tip*`):** model slug/excerpt/tag normalisation; `getPosts` filtering + pagination + published-only; `getPost` by slug/id + related; admin CRUD happy paths + auth guards (401/403); `uploadImage` returns a URL (Cloudinary mocked); validator rejects bad category/missing fields.
- **Frontend (Vitest + RTL, mirrors `TipCard.test.jsx`):** `GalleryCard` renders title/category/date/location and links by slug; `GalleryPage` requests published posts and renders hero + grid; `AdminGalleryForm` validates required fields and calls `createPost`/`updatePost`; RichText image button calls `uploadImage` and inserts the node (upload mocked). Embla/3rd-party-heavy bits mocked as needed.
- Manual: full create→publish→view round-trip in the browser; inline image upload; advert placement on both pages; mobile layout.

## Out of scope (YAGNI)

- Comments, likes, sharing.
- Per-post advert targeting (adverts stay global by placement).
- Orphaned-image cleanup in Cloudinary on post delete (same as Tips today).
- Scheduling/auto-publish; multiple authors/roles beyond existing admin.

## New dependencies

- Frontend: `@tiptap/extension-image` (matches installed TipTap v2 line).
- Backend: none (multer + Cloudinary util already present).
