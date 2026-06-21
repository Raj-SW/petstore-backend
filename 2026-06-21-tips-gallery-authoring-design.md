<!-- Mirror copy for root-level discovery. Canonical: docs/superpowers/specs/2026-06-21-tips-gallery-authoring-design.md — keep both in sync. -->

# Pet Care Tips + Gallery Authoring — Design Spec (Epic 8)

**Date:** 2026-06-21
**Repos:** backend (`petstore-backend`) — models/migration/controllers/validators/upload endpoint; frontend (`petstore-frontend`) — AdminTipForm, AdminGalleryForm, detail pages, tips list.
**Status:** ✅ Approved design, pending implementation plan.
**Depends on:** Epic 2 (`<SearchBar>`, RTE image-overflow fix 2d) and the unified `<ImageManager>` + immediate-upload model from Epic 6b (`2026-06-21-variant-images-and-mur-pricing-design.md`).
**Backlog:** `docs/BACKLOG-2026-06-21.md` Epic 8. Reuses ImageManager, SectionsEditor, SearchBar, RichText, shared `uploadImage` controller (DRY register).

## Goal

Richer authoring for **Pet Care Tips** and **Gallery posts** (identical model shape): a cover image, per-section images, and images embedded in the rich-text body — plus the reusable search bar on the tips list. Sectioning (text) already exists; this adds images and a real upload path.

## Current state (from code)

- `petCareTip.model.js` & `galleryPost.model.js` both have: `coverImage: String` (URL, default `''`), `body: String` (RTE HTML), `sections: [{ heading, body, order }]`. **No per-section image; `coverImage` is a bare string with no `publicId`.**
- `tip.routes.js` has get/post/patch only — **no `/upload-image`** (so the RTE can't host body images). Gallery already has `POST /api/gallery/upload-image` (per the session handoff).
- `app.js` xss-clean bypass already covers `/api/tips` + `/api/gallery` POST/PATCH/PUT, so section/body HTML is preserved.

## Design

Apply identically to **both** `petCareTip` and `galleryPost`.

### Backend
- **`coverImage`: `String` → `{ url, publicId }`** (single cover image). **Migration:** wrap existing non-empty string covers into `{ url, publicId }` (parse `publicId` from the Cloudinary URL, best-effort; `''` URL → empty object). Idempotent.
- **`sections[]` += `images: [{ url, publicId }]`** (default `[]`, **≤8** per section). Convention: **`images[0]` = the section lead**, the rest a gallery; the section `body` (RTE) can also embed inline images.
- **Upload endpoints:** add `POST /api/tips/upload-image` (admin); reuse the existing `POST /api/gallery/upload-image`. Both implemented via the **shared `uploadImage` controller** (Epic 6b) returning `{ url, publicId }`. Consumed by the cover uploader, the per-section ImageManager, and the TipTap RTE for body images.
- **Create/update controllers:** accept `coverImage` + section `images` as JSON refs (immediate-upload model). On update, **diff** stored vs incoming `publicId`s across the cover and all section images (and removed sections) → `deleteMultipleFromCloudinary(removed)` (best-effort).
- **Validators (tip + gallery):** `coverImage` optional object `{url, publicId}`; each section `images` an array of `{url, publicId}` (≤8). Existing required fields unchanged.

### Frontend
- **Shared `SectionsEditor`** (extend the existing `atf-sections` editor): each section row = heading + RTE body + an **`<ImageManager>`** bound to the section's `images` (drag-reorder, first = lead, delete, add via the upload endpoint). Used by **both** AdminTipForm and AdminGalleryForm (DRY — one editor, two forms).
- **Cover image:** a single-image uploader (`<ImageManager max={1}>`) per form, immediate-upload.
- **TipTap RTE:** configure the image extension to upload inserted/pasted images via the resource's `/upload-image` endpoint (hosted URL, not base64). Rendering constrained by the **Epic 2d RTE fix** (`RichTextRenderer.css`: `img { max-width:100%; height:auto; }`).
- **Detail pages** (`TipDetailPage`, `GalleryDetailPage`): render the cover at top; per section render `images[0]` as a lead + the remaining gallery + the RTE body; all images overflow-safe.
- **`PetCareTipsPage` (list):** add the reusable **`<SearchBar>`** (Epic 2), `onSearch` wired to the tips search (server-side via `getTips` `search` param if supported, else local filter over the loaded list). Gallery-list search is an optional follow-on.

## Reuse (DRY)
`<ImageManager>` (cover + section galleries), `SectionsEditor` (shared by both admin forms), `<SearchBar>`, RichText editor/renderer + the image-overflow fix, and the shared backend `uploadImage` controller. No bespoke per-resource image code.

## Testing
Run suites individually.
- **Backend:** tip + gallery create/update accept `coverImage` + section `images` refs; update diffs and deletes removed Cloudinary assets (cover swap, removed section image, removed section); `POST /api/tips/upload-image` returns `{url, publicId}`; ≤8 section images enforced; migration wraps string `coverImage` and is idempotent.
- **Frontend:** AdminTipForm/AdminGalleryForm cover uploader + per-section ImageManager + RTE image upload; detail pages render cover + section lead/gallery + constrained RTE body images; tips list `<SearchBar>` filters results.

## Acceptance criteria
- Both `petCareTip` and `galleryPost`: `coverImage` is `{url, publicId}` (existing data migrated); each section supports `images: [{url, publicId}]` (≤8, first = lead) plus inline RTE body images.
- Admin can upload a cover, per-section images (reorder/delete/add via `<ImageManager>`), and embed images in the RTE body (uploaded via `/tips|/gallery/upload-image`); updates clean up removed Cloudinary assets.
- Tip and Gallery detail pages render the cover, section images, and RTE body images **without layout overflow** (Epic 2d).
- The Pet Care Tips list uses the reusable `<SearchBar>`.
- Both admin forms use the **shared `SectionsEditor`**.
- Build + existing/new tests pass.

## Out of scope
- Gallery-list search bar (optional parallel follow-on).
- New section/body authoring features beyond images (e.g. embeds/video).
