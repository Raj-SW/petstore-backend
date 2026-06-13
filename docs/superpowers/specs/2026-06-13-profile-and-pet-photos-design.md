# Profile & Pet Photos — Design Spec

**Date:** 2026-06-13
**Status:** Approved (brainstormed in session)

## Overview

Let a user (1) upload a single profile photo and (2) manage a gallery of multiple photos for each of their pets, with one designated as the cover. Reuses the existing Cloudinary pipeline and image-upload middleware. No new infrastructure or npm packages.

## Goals

- A user can upload/replace their profile photo; it appears on the profile page and the navbar.
- A user can add multiple photos to each pet (max 6), delete individual photos, and choose which one is the cover.
- Pet cards display the cover photo (with an animal-icon placeholder when there are none).

## Non-Goals (v1)

- Image cropping/editing in-browser.
- Reordering beyond "set as cover" (no full drag-to-reorder).
- Photos uploaded during pet creation (gallery is managed after the pet exists — Approach 2).
- Shared/public pet galleries; these are private to the owner.

## Architecture

Follows existing VitalPaws patterns. Pet-image operations are modeled as dedicated per-image endpoints (Approach 2), keeping the existing JSON pet CRUD untouched. All reuse:

- `src/middlewares/upload.js` — multer memory storage, image-only `fileFilter`, size limit.
- Cloudinary helpers already used by `uploadAvatar`: `uploadMultipleToCloudinary(files, folder) -> [{ url, publicId }]`, `deleteMultipleFromCloudinary([publicId])`, `validateImageFile(file)`.

## Data Model

### Pet (add field)

`src/models/pet.model.js` gains:

```js
images: [
  {
    url:      { type: String },
    publicId: { type: String },
  },
]
```

- `images[0]` is the **primary / cover** photo. No separate flag.
- Cap: **6** photos per pet (enforced in the controller, not the schema).

### User (already exists)

`profileImage: { url, publicId }` — added earlier this session. No change.

## API

### Pet images — all require `isAuthenticated`; ownership checked in-controller

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/pets/:id/images` | owner | `upload.array('petImages', 6)`. Validate each file, upload to Cloudinary `pets/` folder, append to `images`. Rejects if `existing + uploaded > 6`. |
| DELETE | `/api/pets/:id/images/:publicId` | owner | Remove the image from Cloudinary and pull it from `images`. |
| PATCH | `/api/pets/:id/images/:publicId/primary` | owner | Move the matching image to index 0 (becomes cover). |

Guards (every endpoint):
- Pet not found → **404** `Pet not found`.
- `pet.owner.toString() !== req.user.id` → **403** (same guard as `getPet`).
- `:publicId` not in `pet.images` → **404** `Image not found`.
- POST with no files → **400** `No images uploaded...`.
- POST exceeding cap → **400** `A pet can have at most 6 photos`.

`deletePet` is updated to also delete the pet's images from Cloudinary (avoid orphans).

### Profile photo (already implemented)

`PATCH /api/users/upload-avatar` — `upload.single('avatar')`, replaces the existing avatar. No backend work; frontend wiring only.

## Frontend

### API services

`src/Services/api/usersApi.js` (new method):
- `uploadAvatar(file)` — builds `FormData` with field `avatar`, `PATCH /users/upload-avatar` with `Content-Type: multipart/form-data`.

`src/Services/api/petApi.js` (new methods):
- `addPetImages(petId, files)` — `FormData` with repeated `petImages`, `POST /pets/:id/images`.
- `deletePetImage(petId, publicId)` — `DELETE /pets/:id/images/:publicId`.
- `setPrimaryPetImage(petId, publicId)` — `PATCH /pets/:id/images/:publicId/primary`.

### Profile photo widget

On the User Profile page header:
- Shows `user.profileImage.url`, else an initials fallback.
- Camera/edit button → hidden file input → preview → upload → success toast.
- On success: update `AuthContext` user + `localStorage` (`vp_user`) so the navbar avatar updates live. The navbar renders `profileImage.url` when present, initials otherwise.

### Pet "Manage Photos" modal

- `PetList` cards render the cover photo (`images[0].url`); placeholder is the animal icon on a soft tint when `images` is empty (same treatment as the tip-card placeholder).
- A camera/"Photos" button on each card opens a modal:
  - Thumbnail grid of `images` with the cover marked.
  - **Add**: multi-file picker; disabled when at 6; shows `n/6`.
  - **Delete**: × on hover per thumbnail.
  - **Set as cover**: ★ on hover (hidden for the current cover).
- Each action: loading state, success/error toast, then refetch the pet (or update local state). Optimistic thumbnail removal rolled back on error.

### Flow

Create pet (unchanged JSON form) → pet appears in list → click Photos → manage gallery → cover shows on the card.

## Validation & Error Handling

- Image-only + size cap via existing `upload` middleware → 400.
- 6-cap enforced in `addPetImages` → 400.
- Ownership → 403; missing pet → 404; unknown publicId → 404.
- Avatar reuses `validateImageFile` + no-file → 400.
- All API errors flow through the global `AppError` handler → `{ success: false, message }`; frontend surfaces them via `addToast`.

## Testing

### Backend (Jest + supertest, in-memory Mongo; Cloudinary mocked)

`tests/pet.images.test.js`:
- `addPetImages`: success appends and returns updated pet; exceeding 6 → 400; non-owner → 403; no file → 400; missing pet → 404.
- `deletePetImage`: success pulls image + calls Cloudinary delete; non-owner → 403; unknown publicId → 404.
- `setPrimaryPetImage`: moves target to index 0; non-owner → 403; unknown publicId → 404.
- `deletePet`: also clears the pet's Cloudinary images.

### Frontend

- Smoke test for the Manage-Photos modal: renders thumbnails, the Add control is disabled at the 6-cap.

## Success Criteria

- User can upload/replace a profile photo; it shows on profile + navbar without a reload.
- User can add up to 6 photos per pet, delete any, and set any as cover; the card reflects the cover.
- All new backend tests pass; no regressions in existing suites.
- Ownership is enforced — a user cannot touch another user's pet photos.
