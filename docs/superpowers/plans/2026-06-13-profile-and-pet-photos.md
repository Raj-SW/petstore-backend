# Profile & Pet Photos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users upload a profile photo (wire the existing backend endpoint to the UI) and manage a gallery of up to 6 photos per pet, with one cover photo.

**Architecture:** Per the approved spec, pet photos use dedicated per-image endpoints (add / delete / set-primary) that keep the existing JSON pet CRUD untouched. `Pet.images` is an array of `{ url, publicId }` where index 0 is the cover. Everything reuses the existing multer `upload` middleware and the Cloudinary helpers already used by `uploadAvatar`. Profile photo is frontend-only wiring.

**Tech Stack:** Express + Mongoose + multer + Cloudinary + Jest/supertest (backend); React 18 + axios `api` client + framer-motion + react-icons (frontend). No new npm packages.

**⚠️ Repo layout:** `backend/` and `frontend/` are **separate git repos**. Backend tasks commit inside `backend/`, frontend tasks inside `frontend/`. Never `git add` across repo boundaries.

**Reference (existing signatures):**
- `src/middlewares/upload.js` exports `{ upload }` (multer, memory storage, `image/*` filter, 20MB limit).
- `src/utils/cloudinary.js` exports `uploadMultipleToCloudinary(files, folder) -> Promise<[{ url, publicId }]>`, `deleteMultipleFromCloudinary(publicIds) -> Promise`, `validateImageFile(file)`.
- Pet controllers use `req.user._id` (ObjectId) and guard ownership with `pet.owner.toString() !== req.user._id.toString()`.

---

## File Structure

**Backend (`backend/`)**

| File | Responsibility |
|---|---|
| `src/models/pet.model.js` (modify) | Add `images: [{ url, publicId }]` |
| `src/controllers/pet.controller.js` (modify) | Add `addPetImages`, `deletePetImage`, `setPrimaryPetImage`; cloudinary cleanup in `deletePet` |
| `src/routes/pet.routes.js` (modify) | Wire the 3 image routes |
| `tests/pet.images.test.js` (create) | API tests for the 3 endpoints + delete cleanup |

**Frontend (`frontend/`)**

| File | Responsibility |
|---|---|
| `src/Services/api/usersApi.js` (modify) | `uploadAvatar(file)` |
| `src/Services/api/petApi.js` (modify) | `addPetImages`, `deletePetImage`, `setPrimaryPetImage` |
| `src/context/AuthContext.jsx` (modify) | `updateUser(partial)` helper to refresh user + localStorage |
| `src/Components/UserProfile/AvatarUploader.jsx` (create) + `.css` | Profile photo widget |
| `src/Components/UserProfile/ManagePhotosModal.jsx` (create) + `.css` | Pet gallery manager |
| `src/Pages/UserProfile.jsx` (modify) | Mount AvatarUploader + ManagePhotosModal |
| `src/Components/UserProfile/PetList.jsx` (modify) | Cover photo + "Photos" button |
| `src/Components/NavigationBar/NavigationBar.jsx` (modify) | Render avatar image when present |
| `src/Components/UserProfile/ManagePhotosModal.test.jsx` (create) | Smoke test |

---

## Phase 1 — Backend (pet images)

### Task 1: Failing API tests for pet image endpoints

**Files:**
- Create: `backend/tests/pet.images.test.js`

- [ ] **Step 1: Write the failing test file**

```js
/**
 * Tests for Pet image endpoints
 * POST   /api/pets/:id/images                  — add photos (max 6)
 * DELETE /api/pets/:id/images/:publicId        — remove one
 * PATCH  /api/pets/:id/images/:publicId/primary — set cover (move to index 0)
 */

// Mock Cloudinary so no real uploads happen. Each "uploaded" file returns a
// deterministic { url, publicId } derived from a counter.
let uploadCounter = 0;
jest.mock('../src/utils/cloudinary', () => ({
  uploadMultipleToCloudinary: jest.fn((files) =>
    Promise.resolve(files.map(() => {
      uploadCounter += 1;
      return { url: `http://img/${uploadCounter}.jpg`, publicId: `pets/p${uploadCounter}` };
    }))),
  deleteMultipleFromCloudinary: jest.fn(() => Promise.resolve()),
  validateImageFile: jest.fn(() => true),
}));

jest.mock('../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Pet = require('../src/models/pet.model');

const makeUser = (overrides = {}) => ({
  name: 'Pet Owner',
  email: `owner-${Date.now()}-${Math.random()}@example.com`,
  phoneNumber: '12345678',
  address: '1 Test St',
  password: 'Password123*',
  ...overrides,
});

async function signupAndLogin(userData) {
  await request(app).post('/api/auth/signup').send(userData);
  const res = await request(app).post('/api/auth/login').send({
    email: userData.email, password: userData.password,
  });
  return res.body.data.accessToken;
}

const png = () => Buffer.from('fakeimagebytes');

describe('Pet image endpoints', () => {
  let ownerToken;
  let owner;
  let otherToken;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
  });

  beforeEach(async () => {
    uploadCounter = 0;
    await User.deleteMany({});
    await Pet.deleteMany({});

    const ownerData = makeUser({ email: 'owner@test.com' });
    ownerToken = await signupAndLogin(ownerData);
    owner = await User.findOne({ email: 'owner@test.com' });

    otherToken = await signupAndLogin(makeUser({ email: 'other@test.com' }));
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  const makePet = (overrides = {}) => Pet.create({
    name: 'Rex', breed: 'Labrador', age: 3, type: 'dog',
    color: 'golden', gender: 'male', owner: owner._id, ...overrides,
  });

  describe('POST /api/pets/:id/images', () => {
    it('adds photos and returns the updated pet', async () => {
      const pet = await makePet();
      const res = await request(app)
        .post(`/api/pets/${pet._id}/images`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('petImages', png(), 'a.jpg')
        .attach('petImages', png(), 'b.jpg');
      expect(res.status).toBe(201);
      expect(res.body.data.images).toHaveLength(2);
      expect(res.body.data.images[0]).toHaveProperty('url');
      expect(res.body.data.images[0]).toHaveProperty('publicId');
    });

    it('rejects when no file is attached', async () => {
      const pet = await makePet();
      const res = await request(app)
        .post(`/api/pets/${pet._id}/images`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(400);
    });

    it('rejects exceeding the 6-photo cap', async () => {
      const existing = Array.from({ length: 5 }, (_, i) => ({ url: `u${i}`, publicId: `pets/x${i}` }));
      const pet = await makePet({ images: existing });
      const res = await request(app)
        .post(`/api/pets/${pet._id}/images`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('petImages', png(), 'a.jpg')
        .attach('petImages', png(), 'b.jpg');
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/at most 6/i);
    });

    it('rejects a non-owner with 403', async () => {
      const pet = await makePet();
      const res = await request(app)
        .post(`/api/pets/${pet._id}/images`)
        .set('Authorization', `Bearer ${otherToken}`)
        .attach('petImages', png(), 'a.jpg');
      expect(res.status).toBe(403);
    });

    it('404s for a missing pet', async () => {
      const res = await request(app)
        .post(`/api/pets/${new mongoose.Types.ObjectId()}/images`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('petImages', png(), 'a.jpg');
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/pets/:id/images/:publicId', () => {
    it('removes the matching image', async () => {
      const pet = await makePet({ images: [
        { url: 'u1', publicId: 'pets/keep' },
        { url: 'u2', publicId: 'pets/remove' },
      ] });
      const res = await request(app)
        .delete(`/api/pets/${pet._id}/images/${encodeURIComponent('pets/remove')}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.images).toHaveLength(1);
      expect(res.body.data.images[0].publicId).toBe('pets/keep');
    });

    it('404s when the publicId is not on the pet', async () => {
      const pet = await makePet({ images: [{ url: 'u1', publicId: 'pets/keep' }] });
      const res = await request(app)
        .delete(`/api/pets/${pet._id}/images/${encodeURIComponent('pets/ghost')}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(404);
    });

    it('rejects a non-owner with 403', async () => {
      const pet = await makePet({ images: [{ url: 'u1', publicId: 'pets/keep' }] });
      const res = await request(app)
        .delete(`/api/pets/${pet._id}/images/${encodeURIComponent('pets/keep')}`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/pets/:id/images/:publicId/primary', () => {
    it('moves the chosen image to index 0', async () => {
      const pet = await makePet({ images: [
        { url: 'u1', publicId: 'pets/a' },
        { url: 'u2', publicId: 'pets/b' },
        { url: 'u3', publicId: 'pets/c' },
      ] });
      const res = await request(app)
        .patch(`/api/pets/${pet._id}/images/${encodeURIComponent('pets/c')}/primary`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.images[0].publicId).toBe('pets/c');
      expect(res.body.data.images).toHaveLength(3);
    });

    it('404s when the publicId is not on the pet', async () => {
      const pet = await makePet({ images: [{ url: 'u1', publicId: 'pets/a' }] });
      const res = await request(app)
        .patch(`/api/pets/${pet._id}/images/${encodeURIComponent('pets/ghost')}/primary`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(404);
    });

    it('rejects a non-owner with 403', async () => {
      const pet = await makePet({ images: [{ url: 'u1', publicId: 'pets/a' }] });
      const res = await request(app)
        .patch(`/api/pets/${pet._id}/images/${encodeURIComponent('pets/a')}/primary`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/pets/:id cleans up images', () => {
    it('calls Cloudinary delete with the pet image publicIds', async () => {
      const { deleteMultipleFromCloudinary } = require('../src/utils/cloudinary');
      deleteMultipleFromCloudinary.mockClear();
      const pet = await makePet({ images: [
        { url: 'u1', publicId: 'pets/a' },
        { url: 'u2', publicId: 'pets/b' },
      ] });
      const res = await request(app)
        .delete(`/api/pets/${pet._id}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(deleteMultipleFromCloudinary).toHaveBeenCalledWith(['pets/a', 'pets/b']);
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run (from `backend/`): `npm test -- tests/pet.images.test.js`
Expected: FAIL — POST/DELETE/PATCH routes return 404 (not yet wired), `images` undefined.

*(No commit yet — commit lands green in Task 4.)*

---

### Task 2: Add `images` to the Pet model

**Files:**
- Modify: `backend/src/models/pet.model.js`

- [ ] **Step 1: Add the field**

In `src/models/pet.model.js`, inside the schema object, add an `images` array right after the `description` field and before `owner`:

```js
    description: {
      type: String,
      trim: true,
    },
    images: [
      {
        url: { type: String },
        publicId: { type: String },
      },
    ],
    owner: {
```

- [ ] **Step 2: Re-run tests**

Run: `npm test -- tests/pet.images.test.js`
Expected: still FAIL on missing routes (404), but model now accepts `images`.

---

### Task 3: Pet image controllers + delete cleanup

**Files:**
- Modify: `backend/src/controllers/pet.controller.js`

- [ ] **Step 1: Add Cloudinary imports**

At the top of `src/controllers/pet.controller.js`, replace the first two lines:

```js
const Pet = require('../models/pet.model');
const { AppError } = require('../middlewares/errorHandler');
```

with:

```js
const Pet = require('../models/pet.model');
const { AppError } = require('../middlewares/errorHandler');
const {
  uploadMultipleToCloudinary,
  deleteMultipleFromCloudinary,
  validateImageFile,
} = require('../utils/cloudinary');

const MAX_PET_IMAGES = 6;

// Shared ownership guard — returns the pet, or sends the right error via next().
async function loadOwnedPet(req, next) {
  const pet = await Pet.findById(req.params.id);
  if (!pet) {
    next(new AppError('Pet not found', 404));
    return null;
  }
  if (pet.owner.toString() !== req.user._id.toString()) {
    next(new AppError('You do not have permission to modify this pet', 403));
    return null;
  }
  return pet;
}
```

- [ ] **Step 2: Add the three image controllers + cleanup**

Append to the end of `src/controllers/pet.controller.js`:

```js
// Add photos to a pet (max MAX_PET_IMAGES total)
exports.addPetImages = async (req, res, next) => {
  try {
    const pet = await loadOwnedPet(req, next);
    if (!pet) return;

    if (!req.files || req.files.length === 0) {
      return next(new AppError('No images uploaded. Use field name "petImages".', 400));
    }
    if (pet.images.length + req.files.length > MAX_PET_IMAGES) {
      return next(new AppError(`A pet can have at most ${MAX_PET_IMAGES} photos`, 400));
    }

    req.files.forEach((file) => validateImageFile(file));
    const uploaded = await uploadMultipleToCloudinary(req.files, 'pets');
    pet.images.push(...uploaded);
    await pet.save();

    return res.status(201).json({ success: true, data: pet });
  } catch (error) {
    return next(error);
  }
};

// Delete a single photo from a pet
exports.deletePetImage = async (req, res, next) => {
  try {
    const pet = await loadOwnedPet(req, next);
    if (!pet) return;

    const { publicId } = req.params;
    const exists = pet.images.some((img) => img.publicId === publicId);
    if (!exists) return next(new AppError('Image not found', 404));

    await deleteMultipleFromCloudinary([publicId]);
    pet.images = pet.images.filter((img) => img.publicId !== publicId);
    await pet.save();

    return res.status(200).json({ success: true, data: pet });
  } catch (error) {
    return next(error);
  }
};

// Set a photo as the cover (move to index 0)
exports.setPrimaryPetImage = async (req, res, next) => {
  try {
    const pet = await loadOwnedPet(req, next);
    if (!pet) return;

    const { publicId } = req.params;
    const target = pet.images.find((img) => img.publicId === publicId);
    if (!target) return next(new AppError('Image not found', 404));

    pet.images = [target, ...pet.images.filter((img) => img.publicId !== publicId)];
    await pet.save();

    return res.status(200).json({ success: true, data: pet });
  } catch (error) {
    return next(error);
  }
};
```

- [ ] **Step 3: Clean up images in `deletePet`**

In `src/controllers/pet.controller.js`, find the `deletePet` function. Replace its body's delete section:

```js
    await Pet.findByIdAndDelete(req.params.id);
```

with:

```js
    if (pet.images && pet.images.length) {
      await deleteMultipleFromCloudinary(pet.images.map((img) => img.publicId));
    }
    await Pet.findByIdAndDelete(req.params.id);
```

- [ ] **Step 4: Re-run tests**

Run: `npm test -- tests/pet.images.test.js`
Expected: still FAIL — routes not wired yet (404 on the new paths). Controllers exist but aren't reachable.

---

### Task 4: Wire pet image routes → green

**Files:**
- Modify: `backend/src/routes/pet.routes.js`

- [ ] **Step 1: Add imports + routes**

In `src/routes/pet.routes.js`, update the controller import to include the new handlers and add `upload`. Replace:

```js
const {
  createPet,
  getMyPets,
  getPet,
  updatePet,
  deletePet,
} = require('../controllers/pet.controller');
```

with:

```js
const {
  createPet,
  getMyPets,
  getPet,
  updatePet,
  deletePet,
  addPetImages,
  deletePetImage,
  setPrimaryPetImage,
} = require('../controllers/pet.controller');
const { upload } = require('../middlewares/upload');
```

Then, after the existing `router.delete('/:id', deletePet);` line and before `module.exports`, add:

```js
// Pet photo management (gallery). All owner-guarded in the controller.
router.post('/:id/images', upload.array('petImages', 6), addPetImages);
router.delete('/:id/images/:publicId', deletePetImage);
router.patch('/:id/images/:publicId/primary', setPrimaryPetImage);
```

- [ ] **Step 2: Run the pet image tests to green**

Run: `npm test -- tests/pet.images.test.js`
Expected: PASS — all tests green.

- [ ] **Step 3: Run the full backend suite (no regressions)**

Run: `npm test`
Expected: PASS — existing suites still green.

- [ ] **Step 4: Commit (inside `backend/`)**

```bash
cd backend
git add src/models/pet.model.js src/controllers/pet.controller.js src/routes/pet.routes.js tests/pet.images.test.js
git commit -m "feat: pet photo gallery endpoints (add, delete, set-cover) with tests"
```

---

## Phase 2 — Frontend (profile photo)

### Task 5: usersApi.uploadAvatar + AuthContext updateUser

**Files:**
- Modify: `frontend/src/Services/api/usersApi.js`
- Modify: `frontend/src/context/AuthContext.jsx`

- [ ] **Step 1: Add `uploadAvatar` to usersApi**

In `src/Services/api/usersApi.js`, add this method inside the `usersApi` object (e.g. after `getUserPets`):

```js
  // Upload/replace the current user's profile photo
  uploadAvatar: async (file) => {
    const form = new FormData();
    form.append("avatar", file);
    const response = await api.patch("/users/upload-avatar", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data; // { success, data: { profileImage } }
  },
```

- [ ] **Step 2: Add `updateUser` to AuthContext**

In `src/context/AuthContext.jsx`, add a helper that merges fields into the current user and persists them, then expose it in the context value.

After the `login` function (or near the other methods), add:

```js
  // Merge partial fields into the current user + persist to localStorage.
  // Used after profile-photo upload so the navbar avatar updates live.
  const updateUser = (partial) => {
    setUser((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem("vp_user", JSON.stringify(next));
      return next;
    });
  };
```

Then add `updateUser` to the `value` object that is passed to `AuthContext.Provider` (find the `const value = { ... }` block and add `updateUser,` alongside `login,`).

- [ ] **Step 3: Verify build**

Run (from `frontend/`): `npx vite build`
Expected: builds with no errors.

- [ ] **Step 4: Commit (inside `frontend/`)**

```bash
cd frontend
git add src/Services/api/usersApi.js src/context/AuthContext.jsx
git commit -m "feat: usersApi.uploadAvatar + AuthContext.updateUser"
```

---

### Task 6: Avatar widget + navbar avatar

**Files:**
- Create: `frontend/src/Components/UserProfile/AvatarUploader.jsx`
- Create: `frontend/src/Components/UserProfile/AvatarUploader.css`
- Modify: `frontend/src/Pages/UserProfile.jsx`
- Modify: `frontend/src/Components/NavigationBar/NavigationBar.jsx`

- [ ] **Step 1: Create AvatarUploader.jsx**

```jsx
import { useRef, useState } from "react";
import { FiCamera } from "react-icons/fi";
import usersApi from "../../Services/api/usersApi";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import "./AvatarUploader.css";

const initials = (name) =>
  (name || "U").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

const AvatarUploader = () => {
  const { user, updateUser } = useAuth();
  const { addToast } = useToast();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const url = user?.profileImage?.url || user?.profileImage || null;

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      addToast("Please choose an image file", "error");
      return;
    }
    try {
      setUploading(true);
      const res = await usersApi.uploadAvatar(file);
      const newUrl = res?.data?.profileImage;
      if (newUrl) updateUser({ profileImage: { url: newUrl } });
      addToast("Profile photo updated", "success");
    } catch (err) {
      addToast(err?.message || "Failed to upload photo", "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="avatar-uploader">
      <div className="avatar-uploader-img">
        {url ? <img src={url} alt="Profile" /> : <span>{initials(user?.name)}</span>}
        <button
          type="button"
          className="avatar-uploader-btn"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          aria-label="Change profile photo"
          title="Change profile photo"
        >
          <FiCamera size={15} />
        </button>
      </div>
      {uploading && <p className="avatar-uploader-status">Uploading…</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={onPick}
      />
    </div>
  );
};

export default AvatarUploader;
```

- [ ] **Step 2: Create AvatarUploader.css**

```css
.avatar-uploader { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.avatar-uploader-img {
  position: relative;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  overflow: hidden;
  background: #0e2818;
  color: #f0c674;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  font-weight: 700;
}
.avatar-uploader-img img { width: 100%; height: 100%; object-fit: cover; }
.avatar-uploader-btn {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid #ffffff;
  background: #ba7517;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.avatar-uploader-btn:disabled { opacity: 0.6; cursor: default; }
.avatar-uploader-status { font-size: 12px; color: #888780; margin: 0; }
```

- [ ] **Step 3: Mount AvatarUploader in UserProfile**

In `src/Pages/UserProfile.jsx`, add the import near the other component imports:

```jsx
import AvatarUploader from "../Components/UserProfile/AvatarUploader";
```

Then render `<AvatarUploader />` in the profile header area (near where the user's name/details are shown — place it at the top of the profile info block). Insert `<AvatarUploader />` as the first child of the profile header container.

- [ ] **Step 4: Show the avatar in the navbar**

In `src/Components/NavigationBar/NavigationBar.jsx`, find where the user's name is rendered with the account icon (the `Raj Seetohul` area with an `FaUser`/circle icon). Replace the icon with a conditional avatar. First ensure `user` is available from `useAuth()` (it already is in this file).

Find the account button's icon element and replace it with:

```jsx
{user?.profileImage?.url ? (
  <img
    src={user.profileImage.url}
    alt=""
    className="nav-avatar-img"
  />
) : (
  <FaUserCircle size={22} />
)}
```

(If the file already imports a user icon under a different name, reuse that name instead of `FaUserCircle`; if `FaUserCircle` is not imported, add it to the existing `react-icons/fa` import.)

Add this CSS to the nearest NavigationBar stylesheet (`src/Components/NavigationBar/NavigationBar.css`):

```css
.nav-avatar-img { width: 26px; height: 26px; border-radius: 50%; object-fit: cover; }
```

- [ ] **Step 5: Verify build + manual check**

Run (from `frontend/`): `npx vite build`
Expected: builds clean.
Manual: log in, open profile, upload an image → it shows on the profile and the navbar avatar updates without reload.

- [ ] **Step 6: Commit (inside `frontend/`)**

```bash
cd frontend
git add src/Components/UserProfile/AvatarUploader.jsx src/Components/UserProfile/AvatarUploader.css src/Pages/UserProfile.jsx src/Components/NavigationBar/NavigationBar.jsx src/Components/NavigationBar/NavigationBar.css
git commit -m "feat: profile photo uploader + navbar avatar"
```

---

## Phase 3 — Frontend (pet photos)

### Task 7: petApi image methods

**Files:**
- Modify: `frontend/src/Services/api/petApi.js`

- [ ] **Step 1: Add the three methods**

In `src/Services/api/petApi.js`, add inside the `petApi` object (after `deletePet`):

```js
  // Add photos to a pet (gallery, max 6). files = File[] or FileList
  addPetImages: async (petId, files) => {
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("petImages", f));
    const response = await api.post(`/pets/${petId}/images`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data; // { success, data: pet }
  },

  // Delete one photo by its Cloudinary publicId
  deletePetImage: async (petId, publicId) => {
    const response = await api.delete(
      `/pets/${petId}/images/${encodeURIComponent(publicId)}`
    );
    return response.data;
  },

  // Set a photo as the cover (move to index 0)
  setPrimaryPetImage: async (petId, publicId) => {
    const response = await api.patch(
      `/pets/${petId}/images/${encodeURIComponent(publicId)}/primary`
    );
    return response.data;
  },
```

Also remove the stray `console.log(response.data);` inside `getUserPets` while here (it logs on every fetch).

- [ ] **Step 2: Verify build**

Run (from `frontend/`): `npx vite build`
Expected: builds clean.

- [ ] **Step 3: Commit (inside `frontend/`)**

```bash
cd frontend
git add src/Services/api/petApi.js
git commit -m "feat: petApi gallery methods (add/delete/set-cover) + drop stray log"
```

---

### Task 8: ManagePhotosModal component

**Files:**
- Create: `frontend/src/Components/UserProfile/ManagePhotosModal.jsx`
- Create: `frontend/src/Components/UserProfile/ManagePhotosModal.css`

- [ ] **Step 1: Create ManagePhotosModal.jsx**

```jsx
import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiStar, FiTrash2, FiPlus } from "react-icons/fi";
import petApi from "../../Services/api/petApi";
import { useToast } from "../../context/ToastContext";
import "./ManagePhotosModal.css";

const MAX = 6;

const ManagePhotosModal = ({ pet, onClose, onChange }) => {
  const { addToast } = useToast();
  const inputRef = useRef(null);
  const [images, setImages] = useState(pet.images || []);
  const [busy, setBusy] = useState(false);

  const petId = pet._id || pet.id;
  const atCap = images.length >= MAX;

  const sync = (updatedPet) => {
    setImages(updatedPet.images || []);
    if (onChange) onChange(updatedPet);
  };

  const onAdd = async (e) => {
    const files = e.target.files;
    e.target.value = "";
    if (!files || files.length === 0) return;
    if (images.length + files.length > MAX) {
      addToast(`A pet can have at most ${MAX} photos`, "error");
      return;
    }
    try {
      setBusy(true);
      const res = await petApi.addPetImages(petId, files);
      sync(res.data);
      addToast("Photos added", "success");
    } catch (err) {
      addToast(err?.message || "Failed to add photos", "error");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (publicId) => {
    try {
      setBusy(true);
      const res = await petApi.deletePetImage(petId, publicId);
      sync(res.data);
      addToast("Photo removed", "success");
    } catch (err) {
      addToast(err?.message || "Failed to remove photo", "error");
    } finally {
      setBusy(false);
    }
  };

  const onSetCover = async (publicId) => {
    try {
      setBusy(true);
      const res = await petApi.setPrimaryPetImage(petId, publicId);
      sync(res.data);
      addToast("Cover updated", "success");
    } catch (err) {
      addToast(err?.message || "Failed to set cover", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="mpm-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="mpm-modal"
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.94, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mpm-header">
            <h3>{pet.name} — Photos <span className="mpm-count">{images.length}/{MAX}</span></h3>
            <button className="mpm-close" onClick={onClose} aria-label="Close"><FiX /></button>
          </div>

          {images.length === 0 ? (
            <p className="mpm-empty">No photos yet. Add up to {MAX}.</p>
          ) : (
            <div className="mpm-grid">
              {images.map((img, i) => (
                <div key={img.publicId} className={`mpm-thumb${i === 0 ? " mpm-thumb-cover" : ""}`}>
                  <img src={img.url} alt="" />
                  {i === 0 && <span className="mpm-cover-tag">Cover</span>}
                  <div className="mpm-thumb-actions">
                    {i !== 0 && (
                      <button title="Set as cover" disabled={busy} onClick={() => onSetCover(img.publicId)}>
                        <FiStar size={14} />
                      </button>
                    )}
                    <button title="Delete" disabled={busy} onClick={() => onDelete(img.publicId)}>
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="mpm-add"
            disabled={busy || atCap}
            onClick={() => inputRef.current?.click()}
          >
            <FiPlus size={15} /> {atCap ? "Maximum reached" : "Add photos"}
          </button>
          <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={onAdd} />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ManagePhotosModal;
```

- [ ] **Step 2: Create ManagePhotosModal.css**

```css
.mpm-backdrop {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(20, 20, 18, 0.55);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.mpm-modal {
  background: #fff; border-radius: 14px; width: 100%; max-width: 460px;
  padding: 18px 20px 20px; box-shadow: 0 24px 60px rgba(0,0,0,0.25);
}
.mpm-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.mpm-header h3 { font-size: 17px; margin: 0; }
.mpm-count { font-size: 12px; color: #888780; font-weight: 500; }
.mpm-close { background: none; border: none; cursor: pointer; color: #555; }
.mpm-empty { color: #888780; font-size: 14px; text-align: center; padding: 18px 0; }
.mpm-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
.mpm-thumb { position: relative; aspect-ratio: 1; border-radius: 10px; overflow: hidden; border: 1px solid #e8e4dc; }
.mpm-thumb-cover { border-color: #ba7517; box-shadow: 0 0 0 2px #ba7517; }
.mpm-thumb img { width: 100%; height: 100%; object-fit: cover; }
.mpm-cover-tag {
  position: absolute; top: 4px; left: 4px; background: #ba7517; color: #fff;
  font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 6px;
}
.mpm-thumb-actions {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 8px;
  background: rgba(0,0,0,0.0); opacity: 0; transition: opacity 0.18s, background 0.18s;
}
.mpm-thumb:hover .mpm-thumb-actions { opacity: 1; background: rgba(0,0,0,0.35); }
.mpm-thumb-actions button {
  width: 30px; height: 30px; border-radius: 50%; border: none; cursor: pointer;
  background: #fff; color: #2c2c2a; display: flex; align-items: center; justify-content: center;
}
.mpm-thumb-actions button:disabled { opacity: 0.6; cursor: default; }
.mpm-add {
  width: 100%; padding: 10px; border-radius: 10px; border: 1px dashed #ba7517;
  background: #faeeda; color: #633806; font-weight: 600; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 6px;
}
.mpm-add:disabled { opacity: 0.55; cursor: default; }
```

*(No standalone run — exercised in Task 9 and Task 10.)*

---

### Task 9: PetList cover photo + "Photos" button

**Files:**
- Modify: `frontend/src/Components/UserProfile/PetList.jsx`
- Modify: `frontend/src/Pages/UserProfile.jsx`

- [ ] **Step 1: Render cover photo + Photos button in PetList**

In `src/Components/UserProfile/PetList.jsx`:

(a) Ensure the component accepts an `onManagePhotos` callback prop (add it to the destructured props alongside the existing edit/delete handlers).

(b) For each pet card, render the cover image. Add near the top of each pet's card markup:

```jsx
<div className="pet-cover">
  {pet.images && pet.images.length > 0 ? (
    <img src={pet.images[0].url} alt={pet.name} />
  ) : (
    <span className="pet-cover-placeholder">🐾</span>
  )}
</div>
```

(c) Add a "Photos" button alongside the existing Edit/Delete buttons for each pet:

```jsx
<button
  type="button"
  className="pet-photos-btn"
  onClick={() => onManagePhotos(pet)}
>
  Photos{pet.images?.length ? ` (${pet.images.length})` : ""}
</button>
```

(d) Add minimal styling to the PetList stylesheet (the CSS file already imported by PetList; if none, add a `<style>`-free rule to `src/Pages/UserProfile.jsx`'s stylesheet). Use this rule set in the existing PetList CSS file:

```css
.pet-cover { width: 100%; height: 120px; border-radius: 10px; overflow: hidden; background: #f1efe8; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; }
.pet-cover img { width: 100%; height: 100%; object-fit: cover; }
.pet-cover-placeholder { font-size: 34px; opacity: 0.5; }
.pet-photos-btn { padding: 5px 12px; border-radius: 8px; border: 1px solid #ba7517; background: #fff; color: #633806; font-weight: 600; cursor: pointer; }
```

- [ ] **Step 2: Wire the modal in UserProfile**

In `src/Pages/UserProfile.jsx`:

(a) Add imports:

```jsx
import ManagePhotosModal from "../Components/UserProfile/ManagePhotosModal";
```

(b) Add state for the pet whose photos are being managed (near the other `useState` calls):

```jsx
const [photosPet, setPhotosPet] = useState(null);
```

(c) Pass the handler to `PetList`:

```jsx
onManagePhotos={(pet) => setPhotosPet(pet)}
```

(d) Render the modal near the other modals in the JSX return, syncing the updated pet back into the `pets` list:

```jsx
{photosPet && (
  <ManagePhotosModal
    pet={photosPet}
    onClose={() => setPhotosPet(null)}
    onChange={(updated) => {
      setPhotosPet(updated);
      setPets((prev) => prev.map((p) => ((p._id || p.id) === (updated._id || updated.id) ? updated : p)));
    }}
  />
)}
```

- [ ] **Step 3: Verify build + manual check**

Run (from `frontend/`): `npx vite build`
Expected: builds clean.
Manual: open profile → a pet → Photos → add/delete/set-cover; the cover shows on the pet card afterward.

- [ ] **Step 4: Commit (inside `frontend/`)**

```bash
cd frontend
git add src/Components/UserProfile/ManagePhotosModal.jsx src/Components/UserProfile/ManagePhotosModal.css src/Components/UserProfile/PetList.jsx src/Pages/UserProfile.jsx
git commit -m "feat: pet photo gallery UI (cover on card + manage-photos modal)"
```

---

### Task 10: Manage-Photos modal smoke test + final verification

**Files:**
- Create: `frontend/src/Components/UserProfile/ManagePhotosModal.test.jsx`

- [ ] **Step 1: Write the smoke test**

> Note: this assumes the frontend has a vitest + @testing-library/react setup. If `npx vitest run` reports "command not found" or no config, skip this task's test (mark it done) and rely on the manual checks from Task 9 — do NOT add a test framework just for this.

```jsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ManagePhotosModal from "./ManagePhotosModal";

vi.mock("../../Services/api/petApi", () => ({ default: {} }));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ addToast: vi.fn() }) }));

const petWith = (n) => ({
  _id: "p1",
  name: "Rex",
  images: Array.from({ length: n }, (_, i) => ({ url: `u${i}`, publicId: `pets/${i}` })),
});

describe("ManagePhotosModal", () => {
  it("renders a thumbnail per image and the count", () => {
    render(<ManagePhotosModal pet={petWith(2)} onClose={() => {}} onChange={() => {}} />);
    expect(screen.getByText("2/6")).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(2);
  });

  it("disables Add when at the 6-photo cap", () => {
    render(<ManagePhotosModal pet={petWith(6)} onClose={() => {}} onChange={() => {}} />);
    expect(screen.getByText(/Maximum reached/i).closest("button")).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the smoke test**

Run (from `frontend/`): `npx vitest run src/Components/UserProfile/ManagePhotosModal.test.jsx`
Expected: PASS. (If no vitest setup exists, skip per the note above.)

- [ ] **Step 3: Final full-stack manual verification**

With backend (`npm run dev` in `backend/`) and frontend (`npm run dev` in `frontend/`) running, logged in:
- Profile photo: upload → shows on profile + navbar (no reload).
- Pet photos: add 2–3 to a pet → thumbnails appear; set a non-cover as cover → it moves to front + shows on the card; delete one → it disappears; try to exceed 6 → blocked with a toast.

- [ ] **Step 4: Commit (inside `frontend/`)**

```bash
cd frontend
git add src/Components/UserProfile/ManagePhotosModal.test.jsx
git commit -m "test: smoke test for ManagePhotosModal"
```

---

## Success Criteria (from spec)

- Profile photo upload works and reflects on profile + navbar without reload. ✔ Tasks 5–6
- Up to 6 photos per pet; add/delete/set-cover; card shows the cover. ✔ Tasks 1–4, 8–9
- Ownership enforced on every pet-image endpoint (403). ✔ Task 1 (tests) + Task 3 (guard)
- New backend tests pass, no regressions. ✔ Task 4
- 6-cap enforced server- and client-side. ✔ Task 3 (server) + Task 8 (client)
