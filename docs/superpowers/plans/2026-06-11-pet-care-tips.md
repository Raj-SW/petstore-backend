# Pet Care Tips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Pet Care Tips feature — public listing + article pages with admin-managed tips and adverts — per the approved spec at `docs/superpowers/specs/2026-06-11-pet-care-tips-design.md`.

**Architecture:** New `PetCareTip` and `Advert` Mongoose models exposed via `/api/tips` and `/api/adverts` Express routers (public GETs, admin-guarded mutations), consumed by new React pages (`/pet-care-tips`, `/pet-care-tips/:slug`) and admin pages (`/admin/tips`, `/admin/adverts`). Rich text authored with the existing `RichTextEditor` and rendered with the existing DOMPurify-backed `RichTextRenderer`.

**Tech Stack:** Express + Mongoose + Joi + Jest/supertest (in-memory Mongo replica set) on the backend; React 18 + framer-motion + react-icons + existing axios `api` client on the frontend. No new npm packages.

**⚠️ Repo layout:** `backend/` and `frontend/` are **separate git repos** nested inside the parent repo. Backend tasks commit inside `backend/`, frontend tasks inside `frontend/`. Never `git add` across repo boundaries.

---

## File Structure

**Backend (`backend/`)**

| File | Responsibility |
|---|---|
| `src/models/petCareTip.model.js` | Tip schema, slug + readTime pre-save hooks, indexes |
| `src/models/advert.model.js` | Advert schema |
| `src/validators/tip.validator.js` | Joi create/update validation |
| `src/validators/advert.validator.js` | Joi create/update validation |
| `src/controllers/tip.controller.js` | List (filters/search/pagination), get by slug/id, admin CRUD |
| `src/controllers/advert.controller.js` | Public active list, admin CRUD |
| `src/routes/tip.routes.js` | Router wiring + auth guards |
| `src/routes/advert.routes.js` | Router wiring + auth guards |
| `src/app.js` (modify) | Mount routers, xss-clean bypass for tip HTML bodies |
| `scripts/seed-pet-care-tips.js` | Seed 12 tips + 4 adverts |
| `tests/tips.controller.test.js` | API tests for tips |
| `tests/adverts.controller.test.js` | API tests for adverts |

**Frontend (`frontend/`)**

| File | Responsibility |
|---|---|
| `src/Services/api/tipsApi.js` | Tips API calls |
| `src/Services/api/advertsApi.js` | Adverts API calls |
| `src/Pages/PetCareTips/tipTheme.js` | Animal colors/icons, category + difficulty constants |
| `src/Pages/PetCareTips/components/TipCard.jsx` | Grid card (normal + sponsored variant) |
| `src/Pages/PetCareTips/components/FeaturedSection.jsx` | Asymmetric featured layout |
| `src/Pages/PetCareTips/components/AnimalStrip.jsx` | Animal filter pills |
| `src/Pages/PetCareTips/components/CategoryChips.jsx` | Category filter chips |
| `src/Pages/PetCareTips/components/AdvertBanner.jsx` | Banner advert strip |
| `src/Pages/PetCareTips/PetCareTipsPage.jsx` + `PetCareTips.css` | Listing page |
| `src/Pages/PetCareTips/TipDetailPage.jsx` + `TipDetail.css` | Article page |
| `src/Pages/Admin/Tips/AdminTips.jsx` + `.css` | Admin tips table |
| `src/Pages/Admin/Tips/AdminTipForm.jsx` + `.css` | Create/edit form (RichTextEditor) |
| `src/Pages/Admin/Adverts/AdminAdverts.jsx` + `.css` | Admin adverts table + modal form |
| `src/main.jsx` (modify) | Routes |
| `src/Components/NavigationBar/NavigationBar.jsx` (modify) | "Care Tips" nav link |
| `src/Components/Admin/AdminLayout.jsx` (modify) | Sidebar items |
| `src/Pages/PetCareTips/components/TipCard.test.jsx` | Component smoke test |

---

## Phase 1 — Backend

### Task 1: Failing API tests for tips

**Files:**
- Create: `backend/tests/tips.controller.test.js`

- [ ] **Step 1: Write the failing test file**

```js
/**
 * Tests for Tip Controller
 * GET    /api/tips             — public list (published only, filters, search, pagination)
 * GET    /api/tips/:idOrSlug   — public single by slug or id
 * GET    /api/tips/admin/all   — admin list incl. drafts
 * GET    /api/tips/admin/:id   — admin single incl. drafts
 * POST   /api/tips             — create (admin)
 * PATCH  /api/tips/:id         — update (admin)
 * DELETE /api/tips/:id         — delete (admin)
 */

jest.mock('../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../src/app');
const User     = require('../src/models/user.model');
const PetCareTip = require('../src/models/petCareTip.model');

const makeUser = (overrides = {}) => ({
  name: 'Test User',
  email: `user-${Date.now()}-${Math.random()}@example.com`,
  phoneNumber: '12345678',
  address: '123 Test St',
  password: 'Password123*',
  ...overrides,
});

const makeTip = (createdBy, overrides = {}) => ({
  title: 'How to feed your dog',
  body: '<p>Feed your dog twice a day with a balanced diet rich in protein.</p>',
  animalType: 'dog',
  category: 'nutrition',
  difficulty: 'beginner',
  published: true,
  createdBy,
  ...overrides,
});

async function loginAs(userData) {
  await request(app).post('/api/auth/signup').send(userData);
  const res = await request(app).post('/api/auth/login').send({
    email: userData.email, password: userData.password,
  });
  return res.body.data.accessToken;
}

describe('Tip Controller', () => {
  let adminUser;
  let adminToken;
  let customerToken;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await PetCareTip.deleteMany({});

    adminUser = await User.create(makeUser({ email: 'admin@test.com', role: 'admin' }));
    const adminLoginRes = await request(app).post('/api/auth/login').send({
      email: 'admin@test.com', password: 'Password123*',
    });
    adminToken = adminLoginRes.body.data.accessToken;

    customerToken = await loginAs(makeUser());
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('GET /api/tips', () => {
    it('returns only published tips', async () => {
      await PetCareTip.create(makeTip(adminUser._id));
      await PetCareTip.create(makeTip(adminUser._id, { title: 'Draft tip', published: false }));

      const res = await request(app).get('/api/tips');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('How to feed your dog');
    });

    it('filters by animalType and category', async () => {
      await PetCareTip.create(makeTip(adminUser._id));
      await PetCareTip.create(makeTip(adminUser._id, {
        title: 'Cat grooming basics', animalType: 'cat', category: 'grooming',
      }));

      const res = await request(app).get('/api/tips?animalType=cat&category=grooming');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].animalType).toBe('cat');
    });

    it('filters featured tips', async () => {
      await PetCareTip.create(makeTip(adminUser._id, { title: 'Featured one', featured: true }));
      await PetCareTip.create(makeTip(adminUser._id, { title: 'Not featured' }));

      const res = await request(app).get('/api/tips?featured=true');
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].featured).toBe(true);
    });

    it('searches title and breed', async () => {
      await PetCareTip.create(makeTip(adminUser._id, { title: 'Golden retriever diet', breed: 'Golden Retriever' }));
      await PetCareTip.create(makeTip(adminUser._id, { title: 'Cat litter training', animalType: 'cat', category: 'training' }));

      const res = await request(app).get('/api/tips?search=golden');
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Golden retriever diet');
    });

    it('excludes a tip by id (for related tips)', async () => {
      const t1 = await PetCareTip.create(makeTip(adminUser._id));
      await PetCareTip.create(makeTip(adminUser._id, { title: 'Second dog tip' }));

      const res = await request(app).get(`/api/tips?exclude=${t1._id}`);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Second dog tip');
    });

    it('paginates with page and limit', async () => {
      for (let i = 1; i <= 7; i++) {
        await PetCareTip.create(makeTip(adminUser._id, { title: `Tip number ${i}` }));
      }
      const res = await request(app).get('/api/tips?page=2&limit=5');
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(7);
      expect(res.body.pages).toBe(2);
    });
  });

  describe('GET /api/tips/:idOrSlug', () => {
    it('returns a published tip by slug', async () => {
      const tip = await PetCareTip.create(makeTip(adminUser._id));
      const res = await request(app).get(`/api/tips/${tip.slug}`);
      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('How to feed your dog');
      expect(res.body.data.slug).toBe('how-to-feed-your-dog');
    });

    it('returns a published tip by id', async () => {
      const tip = await PetCareTip.create(makeTip(adminUser._id));
      const res = await request(app).get(`/api/tips/${tip._id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('How to feed your dog');
    });

    it('404s for a draft tip', async () => {
      const tip = await PetCareTip.create(makeTip(adminUser._id, { published: false }));
      const res = await request(app).get(`/api/tips/${tip._id}`);
      expect(res.status).toBe(404);
    });

    it('auto-computes readTime from body length', async () => {
      const words = Array.from({ length: 450 }, (_, i) => `word${i}`).join(' ');
      const tip = await PetCareTip.create(makeTip(adminUser._id, { body: `<p>${words}</p>` }));
      const res = await request(app).get(`/api/tips/${tip._id}`);
      expect(res.body.data.readTime).toBe(2); // 450 / 200 ≈ 2
    });
  });

  describe('admin endpoints', () => {
    it('GET /api/tips/admin/all returns drafts too (admin)', async () => {
      await PetCareTip.create(makeTip(adminUser._id));
      await PetCareTip.create(makeTip(adminUser._id, { title: 'Draft tip', published: false }));

      const res = await request(app)
        .get('/api/tips/admin/all')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('GET /api/tips/admin/all rejects non-admin', async () => {
      const res = await request(app)
        .get('/api/tips/admin/all')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /api/tips/admin/:id returns a draft (admin)', async () => {
      const tip = await PetCareTip.create(makeTip(adminUser._id, { published: false }));
      const res = await request(app)
        .get(`/api/tips/admin/${tip._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.published).toBe(false);
    });

    it('POST /api/tips creates a tip (admin)', async () => {
      const res = await request(app)
        .post('/api/tips')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'New cat tip',
          body: '<p>Brush your cat weekly to reduce shedding and hairballs.</p>',
          animalType: 'cat',
          category: 'grooming',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.slug).toBe('new-cat-tip');
      expect(res.body.data.published).toBe(false); // drafts by default
      expect(res.body.data.readTime).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/tips rejects unauthenticated', async () => {
      const res = await request(app).post('/api/tips').send(makeTip(adminUser._id));
      expect(res.status).toBe(401);
    });

    it('POST /api/tips rejects non-admin', async () => {
      const res = await request(app)
        .post('/api/tips')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ title: 'Nope', body: '<p>No.</p>', animalType: 'dog', category: 'health' });
      expect(res.status).toBe(403);
    });

    it('POST /api/tips validates required fields', async () => {
      const res = await request(app)
        .post('/api/tips')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Missing body' });
      expect(res.status).toBe(400);
    });

    it('POST /api/tips rejects invalid animalType', async () => {
      const res = await request(app)
        .post('/api/tips')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Bad animal', body: '<p>x</p>', animalType: 'dragon', category: 'health' });
      expect(res.status).toBe(400);
    });

    it('PATCH /api/tips/:id toggles published and featured', async () => {
      const tip = await PetCareTip.create(makeTip(adminUser._id, { published: false }));
      const res = await request(app)
        .patch(`/api/tips/${tip._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ published: true, featured: true });
      expect(res.status).toBe(200);
      expect(res.body.data.published).toBe(true);
      expect(res.body.data.featured).toBe(true);
    });

    it('PATCH /api/tips/:id recalculates readTime when body changes', async () => {
      const tip = await PetCareTip.create(makeTip(adminUser._id));
      const words = Array.from({ length: 650 }, (_, i) => `w${i}`).join(' ');
      const res = await request(app)
        .patch(`/api/tips/${tip._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: `<p>${words}</p>` });
      expect(res.body.data.readTime).toBe(3); // 650/200 ≈ 3
    });

    it('DELETE /api/tips/:id deletes (admin)', async () => {
      const tip = await PetCareTip.create(makeTip(adminUser._id));
      const res = await request(app)
        .delete(`/api/tips/${tip._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(await PetCareTip.countDocuments()).toBe(0);
    });

    it('PATCH 404s for missing tip', async () => {
      const res = await request(app)
        .patch(`/api/tips/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ published: true });
      expect(res.status).toBe(404);
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run (from `backend/`): `npm test -- tests/tips.controller.test.js`
Expected: FAIL — `Cannot find module '../src/models/petCareTip.model'`

*(No commit yet — commit lands with the green implementation in Task 5.)*

---

### Task 2: PetCareTip model

**Files:**
- Create: `backend/src/models/petCareTip.model.js`

- [ ] **Step 1: Write the model**

```js
const mongoose = require('mongoose');

const ANIMAL_TYPES = ['dog', 'cat', 'bird', 'fish', 'rabbit', 'reptile', 'other'];
const CATEGORIES = ['nutrition', 'grooming', 'health', 'training', 'exercise', 'dental', 'behavior'];
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

const petCareTipSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Tip title is required'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters'],
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true,
    },
    coverImage: {
      type: String,
      trim: true,
      default: '',
    },
    body: {
      type: String,
      required: [true, 'Tip body is required'],
    },
    animalType: {
      type: String,
      enum: { values: ANIMAL_TYPES, message: 'Invalid animal type' },
      required: [true, 'Animal type is required'],
    },
    category: {
      type: String,
      enum: { values: CATEGORIES, message: 'Invalid category' },
      required: [true, 'Category is required'],
    },
    breed: {
      type: String,
      trim: true,
      default: '',
    },
    difficulty: {
      type: String,
      enum: { values: DIFFICULTIES, message: 'Invalid difficulty' },
      default: 'beginner',
    },
    readTime: {
      type: Number,
      min: 1,
      default: 1,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    published: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

petCareTipSchema.pre('save', function (next) {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  if (this.isModified('body')) {
    // readTime = stripped word count at 200 wpm, minimum 1 minute
    const words = this.body
      .replace(/<[^>]*>/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    this.readTime = Math.max(1, Math.round(words / 200));
  }
  next();
});

petCareTipSchema.index({ animalType: 1, category: 1 });
petCareTipSchema.index({ published: 1, featured: 1 });
petCareTipSchema.index({ title: 'text' });

petCareTipSchema.statics.ANIMAL_TYPES = ANIMAL_TYPES;
petCareTipSchema.statics.CATEGORIES = CATEGORIES;
petCareTipSchema.statics.DIFFICULTIES = DIFFICULTIES;

module.exports = mongoose.models.PetCareTip || mongoose.model('PetCareTip', petCareTipSchema);
```

- [ ] **Step 2: Re-run tests**

Run: `npm test -- tests/tips.controller.test.js`
Expected: FAIL — now on missing routes (404s), not missing module.

---

### Task 3: Tip validator

**Files:**
- Create: `backend/src/validators/tip.validator.js`

- [ ] **Step 1: Write the validator**

```js
const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const ANIMAL_TYPES = ['dog', 'cat', 'bird', 'fish', 'rabbit', 'reptile', 'other'];
const CATEGORIES = ['nutrition', 'grooming', 'health', 'training', 'exercise', 'dental', 'behavior'];
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

const baseFields = {
  title: Joi.string().min(2).max(150).trim().messages({
    'string.min': 'Title must be at least 2 characters',
    'string.max': 'Title cannot exceed 150 characters',
  }),
  coverImage: Joi.string().uri().allow('').messages({
    'string.uri': 'Cover image must be a valid URL',
  }),
  body: Joi.string().min(1).messages({
    'string.empty': 'Tip body is required',
  }),
  animalType: Joi.string().valid(...ANIMAL_TYPES).messages({
    'any.only': `Animal type must be one of: ${ANIMAL_TYPES.join(', ')}`,
  }),
  category: Joi.string().valid(...CATEGORIES).messages({
    'any.only': `Category must be one of: ${CATEGORIES.join(', ')}`,
  }),
  breed: Joi.string().max(80).trim().allow(''),
  difficulty: Joi.string().valid(...DIFFICULTIES),
  featured: Joi.boolean(),
  published: Joi.boolean(),
};

const validateTip = (req, res, next) => {
  const schema = Joi.object({
    ...baseFields,
    title: baseFields.title.required(),
    body: baseFields.body.required(),
    animalType: baseFields.animalType.required(),
    category: baseFields.category.required(),
  });

  const { error, value } = schema.validate(req.body);
  if (error) return next(new AppError(error.details[0].message, 400));
  req.body = value;
  next();
};

const validateTipUpdate = (req, res, next) => {
  const schema = Joi.object(baseFields).min(1).messages({
    'object.min': 'At least one field is required to update',
  });

  const { error, value } = schema.validate(req.body);
  if (error) return next(new AppError(error.details[0].message, 400));
  req.body = value;
  next();
};

module.exports = { validateTip, validateTipUpdate };
```

---

### Task 4: Tip controller

**Files:**
- Create: `backend/src/controllers/tip.controller.js`

- [ ] **Step 1: Write the controller**

```js
const mongoose = require('mongoose');
const PetCareTip = require('../models/petCareTip.model');
const { AppError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

// GET /api/tips — public, published only
exports.getTips = async (req, res, next) => {
  try {
    const {
      animalType, category, difficulty, featured,
      search, exclude, page = 1, limit = 12, sort = '-createdAt',
    } = req.query;

    const query = { published: true };
    if (animalType) query.animalType = animalType;
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;
    if (featured !== undefined) query.featured = featured === 'true';
    if (exclude && mongoose.isValidObjectId(exclude)) query._id = { $ne: exclude };
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ title: rx }, { breed: rx }];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));

    const [tips, total] = await Promise.all([
      PetCareTip.find(query)
        .sort(sort)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      PetCareTip.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      count: tips.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
      data: tips,
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/tips/admin/all — admin, includes drafts
exports.getTipsAdmin = async (req, res, next) => {
  try {
    const tips = await PetCareTip.find().sort('-createdAt');
    return res.status(200).json({ success: true, count: tips.length, data: tips });
  } catch (error) {
    return next(error);
  }
};

// GET /api/tips/admin/:id — admin, single incl. draft
exports.getTipAdmin = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new AppError('Invalid tip id', 400));
    }
    const tip = await PetCareTip.findById(req.params.id);
    if (!tip) return next(new AppError('Tip not found', 404));
    return res.status(200).json({ success: true, data: tip });
  } catch (error) {
    return next(error);
  }
};

// GET /api/tips/:idOrSlug — public, published only
exports.getTip = async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;
    const query = mongoose.isValidObjectId(idOrSlug)
      ? { _id: idOrSlug }
      : { slug: idOrSlug.toLowerCase() };

    const tip = await PetCareTip.findOne({ ...query, published: true });
    if (!tip) return next(new AppError('Tip not found', 404));
    return res.status(200).json({ success: true, data: tip });
  } catch (error) {
    return next(error);
  }
};

// POST /api/tips — admin
exports.createTip = async (req, res, next) => {
  try {
    const tip = await PetCareTip.create({ ...req.body, createdBy: req.user._id });
    logger.info(`Tip created by admin ${req.user._id}`, { tipId: tip._id, title: tip.title });
    return res.status(201).json({ success: true, message: 'Tip created successfully', data: tip });
  } catch (error) {
    if (error.code === 11000) {
      return next(new AppError('A tip with this title already exists', 409));
    }
    return next(error);
  }
};

// PATCH /api/tips/:id — admin
// Uses doc.set + save (not findByIdAndUpdate) so slug/readTime pre-save hooks run.
exports.updateTip = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new AppError('Invalid tip id', 400));
    }
    const tip = await PetCareTip.findById(req.params.id);
    if (!tip) return next(new AppError('Tip not found', 404));

    tip.set(req.body);
    await tip.save();

    logger.info(`Tip updated by admin ${req.user._id}`, { tipId: tip._id });
    return res.status(200).json({ success: true, message: 'Tip updated successfully', data: tip });
  } catch (error) {
    if (error.code === 11000) {
      return next(new AppError('A tip with this title already exists', 409));
    }
    return next(error);
  }
};

// DELETE /api/tips/:id — admin
exports.deleteTip = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new AppError('Invalid tip id', 400));
    }
    const tip = await PetCareTip.findByIdAndDelete(req.params.id);
    if (!tip) return next(new AppError('Tip not found', 404));
    logger.info(`Tip deleted by admin ${req.user._id}`, { tipId: tip._id });
    return res.status(200).json({ success: true, message: 'Tip deleted successfully' });
  } catch (error) {
    return next(error);
  }
};
```

---

### Task 5: Tip routes + app.js wiring → green

**Files:**
- Create: `backend/src/routes/tip.routes.js`
- Modify: `backend/src/app.js`

- [ ] **Step 1: Write the router**

```js
const express = require('express');
const { isAuthenticated, isAdmin } = require('../middlewares/auth.middleware');
const {
  getTips,
  getTip,
  getTipsAdmin,
  getTipAdmin,
  createTip,
  updateTip,
  deleteTip,
} = require('../controllers/tip.controller');
const { validateTip, validateTipUpdate } = require('../validators/tip.validator');

const router = express.Router();

// Public routes
router.get('/', getTips);

// Admin routes — registered before /:idOrSlug so "admin" isn't matched as a slug
router.get('/admin/all', isAuthenticated, isAdmin, getTipsAdmin);
router.get('/admin/:id', isAuthenticated, isAdmin, getTipAdmin);

router.get('/:idOrSlug', getTip);

// Admin mutations
router.use(isAuthenticated, isAdmin);
router.post('/', validateTip, createTip);
router.patch('/:id', validateTipUpdate, updateTip);
router.delete('/:id', deleteTip);

module.exports = router;
```

- [ ] **Step 2: Wire into app.js**

In `backend/src/app.js`:

(a) Add to the route imports block (after `const contactRoutes = ...`, ~line 26):

```js
const tipRoutes = require('./routes/tip.routes');
```

(b) Replace the single line `app.use(xss());` (~line 72) with:

```js
// xss-clean irreversibly HTML-encodes JSON bodies, which would destroy the
// TipTap HTML stored in tip bodies. Tip mutations are admin-only and the
// frontend renders bodies exclusively through RichTextRenderer (DOMPurify),
// so we skip xss-clean for tip create/update requests only.
const xssMiddleware = xss();
app.use((req, res, next) => {
  const isTipMutation =
    req.path.startsWith('/api/tips') && ['POST', 'PATCH', 'PUT'].includes(req.method);
  if (isTipMutation) return next();
  return xssMiddleware(req, res, next);
});
```

(c) Add to the route mounts block (after `app.use('/api/contact', contactRoutes);`, ~line 130):

```js
app.use('/api/tips', tipRoutes);
```

(d) Raise the JSON body limit default — TipTap HTML articles exceed the current 10kb default. Change both body-parser lines (~line 95–96):

```js
app.use(express.json({ limit: process.env.BODY_LIMIT || '200kb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.BODY_LIMIT || '200kb' }));
```

- [ ] **Step 3: Run tips tests to green**

Run: `npm test -- tests/tips.controller.test.js`
Expected: PASS — all tests green.

- [ ] **Step 4: Run full backend suite (no regressions)**

Run: `npm test`
Expected: PASS — all existing suites still green.

- [ ] **Step 5: Commit (inside `backend/`)**

```bash
cd backend
git add src/models/petCareTip.model.js src/validators/tip.validator.js src/controllers/tip.controller.js src/routes/tip.routes.js src/app.js tests/tips.controller.test.js
git commit -m "feat: pet care tips API (model, validator, controller, routes, tests)"
```

---

### Task 6: Failing API tests for adverts

**Files:**
- Create: `backend/tests/adverts.controller.test.js`

- [ ] **Step 1: Write the failing test file**

```js
/**
 * Tests for Advert Controller
 * GET    /api/adverts            — public list (active only, placement filter)
 * GET    /api/adverts/admin/all  — admin list incl. inactive
 * POST   /api/adverts            — create (admin)
 * PATCH  /api/adverts/:id        — update (admin)
 * DELETE /api/adverts/:id        — delete (admin)
 */

jest.mock('../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../src/app');
const User     = require('../src/models/user.model');
const Advert   = require('../src/models/advert.model');

const makeUser = (overrides = {}) => ({
  name: 'Test User',
  email: `user-${Date.now()}-${Math.random()}@example.com`,
  phoneNumber: '12345678',
  address: '123 Test St',
  password: 'Password123*',
  ...overrides,
});

const makeAdvert = (createdBy, overrides = {}) => ({
  title: 'Royal Canin 20% off',
  link: 'https://example.com/promo',
  placement: 'banner',
  active: true,
  createdBy,
  ...overrides,
});

async function loginAs(userData) {
  await request(app).post('/api/auth/signup').send(userData);
  const res = await request(app).post('/api/auth/login').send({
    email: userData.email, password: userData.password,
  });
  return res.body.data.accessToken;
}

describe('Advert Controller', () => {
  let adminUser;
  let adminToken;
  let customerToken;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Advert.deleteMany({});

    adminUser = await User.create(makeUser({ email: 'admin@test.com', role: 'admin' }));
    const adminLoginRes = await request(app).post('/api/auth/login').send({
      email: 'admin@test.com', password: 'Password123*',
    });
    adminToken = adminLoginRes.body.data.accessToken;
    customerToken = await loginAs(makeUser());
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('GET /api/adverts', () => {
    it('returns only active adverts', async () => {
      await Advert.create(makeAdvert(adminUser._id));
      await Advert.create(makeAdvert(adminUser._id, { title: 'Inactive ad', active: false }));

      const res = await request(app).get('/api/adverts');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Royal Canin 20% off');
    });

    it('filters by placement', async () => {
      await Advert.create(makeAdvert(adminUser._id));
      await Advert.create(makeAdvert(adminUser._id, { title: 'Grid ad', placement: 'sponsored' }));

      const res = await request(app).get('/api/adverts?placement=sponsored');
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].placement).toBe('sponsored');
    });
  });

  describe('admin endpoints', () => {
    it('GET /api/adverts/admin/all returns inactive too', async () => {
      await Advert.create(makeAdvert(adminUser._id));
      await Advert.create(makeAdvert(adminUser._id, { title: 'Inactive ad', active: false }));

      const res = await request(app)
        .get('/api/adverts/admin/all')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('POST creates an advert (admin)', async () => {
      const res = await request(app)
        .post('/api/adverts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'VitaPet supplements',
          link: 'https://vitapet.example.com',
          placement: 'sponsored',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.active).toBe(true);
    });

    it('POST rejects invalid placement', async () => {
      const res = await request(app)
        .post('/api/adverts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Bad', link: 'https://x.com', placement: 'popup' });
      expect(res.status).toBe(400);
    });

    it('POST rejects non-admin', async () => {
      const res = await request(app)
        .post('/api/adverts')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(makeAdvert(adminUser._id));
      expect(res.status).toBe(403);
    });

    it('PATCH toggles active', async () => {
      const ad = await Advert.create(makeAdvert(adminUser._id));
      const res = await request(app)
        .patch(`/api/adverts/${ad._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: false });
      expect(res.status).toBe(200);
      expect(res.body.data.active).toBe(false);
    });

    it('DELETE removes an advert', async () => {
      const ad = await Advert.create(makeAdvert(adminUser._id));
      const res = await request(app)
        .delete(`/api/adverts/${ad._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(await Advert.countDocuments()).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/adverts.controller.test.js`
Expected: FAIL — `Cannot find module '../src/models/advert.model'`

---

### Task 7: Advert model, validator, controller, routes → green

**Files:**
- Create: `backend/src/models/advert.model.js`
- Create: `backend/src/validators/advert.validator.js`
- Create: `backend/src/controllers/advert.controller.js`
- Create: `backend/src/routes/advert.routes.js`
- Modify: `backend/src/app.js`

- [ ] **Step 1: Write the model**

```js
const mongoose = require('mongoose');

const PLACEMENTS = ['banner', 'sponsored'];

const advertSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Advert title is required'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters'],
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    image: {
      type: String,
      trim: true,
      default: '',
    },
    link: {
      type: String,
      required: [true, 'Advert link is required'],
      trim: true,
    },
    placement: {
      type: String,
      enum: { values: PLACEMENTS, message: 'Placement must be banner or sponsored' },
      required: [true, 'Placement is required'],
    },
    active: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

advertSchema.index({ placement: 1, active: 1 });
advertSchema.statics.PLACEMENTS = PLACEMENTS;

module.exports = mongoose.models.Advert || mongoose.model('Advert', advertSchema);
```

- [ ] **Step 2: Write the validator**

```js
const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const baseFields = {
  title: Joi.string().min(2).max(120).trim(),
  image: Joi.string().uri().allow(''),
  link: Joi.string().uri().messages({ 'string.uri': 'Link must be a valid URL' }),
  placement: Joi.string().valid('banner', 'sponsored').messages({
    'any.only': 'Placement must be banner or sponsored',
  }),
  active: Joi.boolean(),
};

const validateAdvert = (req, res, next) => {
  const schema = Joi.object({
    ...baseFields,
    title: baseFields.title.required(),
    link: baseFields.link.required(),
    placement: baseFields.placement.required(),
  });
  const { error, value } = schema.validate(req.body);
  if (error) return next(new AppError(error.details[0].message, 400));
  req.body = value;
  next();
};

const validateAdvertUpdate = (req, res, next) => {
  const schema = Joi.object(baseFields).min(1).messages({
    'object.min': 'At least one field is required to update',
  });
  const { error, value } = schema.validate(req.body);
  if (error) return next(new AppError(error.details[0].message, 400));
  req.body = value;
  next();
};

module.exports = { validateAdvert, validateAdvertUpdate };
```

- [ ] **Step 3: Write the controller**

```js
const mongoose = require('mongoose');
const Advert = require('../models/advert.model');
const { AppError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

// GET /api/adverts — public, active only
exports.getAdverts = async (req, res, next) => {
  try {
    const query = { active: true };
    if (req.query.placement) query.placement = req.query.placement;
    const adverts = await Advert.find(query).sort('-createdAt');
    return res.status(200).json({ success: true, count: adverts.length, data: adverts });
  } catch (error) {
    return next(error);
  }
};

// GET /api/adverts/admin/all — admin, includes inactive
exports.getAdvertsAdmin = async (req, res, next) => {
  try {
    const adverts = await Advert.find().sort('-createdAt');
    return res.status(200).json({ success: true, count: adverts.length, data: adverts });
  } catch (error) {
    return next(error);
  }
};

// POST /api/adverts — admin
exports.createAdvert = async (req, res, next) => {
  try {
    const advert = await Advert.create({ ...req.body, createdBy: req.user._id });
    logger.info(`Advert created by admin ${req.user._id}`, { advertId: advert._id });
    return res.status(201).json({ success: true, message: 'Advert created successfully', data: advert });
  } catch (error) {
    return next(error);
  }
};

// PATCH /api/adverts/:id — admin
exports.updateAdvert = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new AppError('Invalid advert id', 400));
    }
    const advert = await Advert.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!advert) return next(new AppError('Advert not found', 404));
    logger.info(`Advert updated by admin ${req.user._id}`, { advertId: advert._id });
    return res.status(200).json({ success: true, message: 'Advert updated successfully', data: advert });
  } catch (error) {
    return next(error);
  }
};

// DELETE /api/adverts/:id — admin
exports.deleteAdvert = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new AppError('Invalid advert id', 400));
    }
    const advert = await Advert.findByIdAndDelete(req.params.id);
    if (!advert) return next(new AppError('Advert not found', 404));
    logger.info(`Advert deleted by admin ${req.user._id}`, { advertId: advert._id });
    return res.status(200).json({ success: true, message: 'Advert deleted successfully' });
  } catch (error) {
    return next(error);
  }
};
```

- [ ] **Step 4: Write the router**

```js
const express = require('express');
const { isAuthenticated, isAdmin } = require('../middlewares/auth.middleware');
const {
  getAdverts,
  getAdvertsAdmin,
  createAdvert,
  updateAdvert,
  deleteAdvert,
} = require('../controllers/advert.controller');
const { validateAdvert, validateAdvertUpdate } = require('../validators/advert.validator');

const router = express.Router();

// Public
router.get('/', getAdverts);

// Admin
router.get('/admin/all', isAuthenticated, isAdmin, getAdvertsAdmin);
router.use(isAuthenticated, isAdmin);
router.post('/', validateAdvert, createAdvert);
router.patch('/:id', validateAdvertUpdate, updateAdvert);
router.delete('/:id', deleteAdvert);

module.exports = router;
```

- [ ] **Step 5: Wire into app.js**

(a) Add import after `const tipRoutes = ...`:

```js
const advertRoutes = require('./routes/advert.routes');
```

(b) Add mount after `app.use('/api/tips', tipRoutes);`:

```js
app.use('/api/adverts', advertRoutes);
```

- [ ] **Step 6: Run adverts tests to green, then full suite**

Run: `npm test -- tests/adverts.controller.test.js`
Expected: PASS
Run: `npm test`
Expected: PASS — no regressions.

- [ ] **Step 7: Commit (inside `backend/`)**

```bash
cd backend
git add src/models/advert.model.js src/validators/advert.validator.js src/controllers/advert.controller.js src/routes/advert.routes.js src/app.js tests/adverts.controller.test.js
git commit -m "feat: adverts API (model, validator, controller, routes, tests)"
```

---

### Task 8: Seed script

**Files:**
- Create: `backend/scripts/seed-pet-care-tips.js`

- [ ] **Step 1: Write the seed script**

```js
/**
 * Seed Pet Care Tips + Adverts
 *
 * Usage (from backend/):
 *   node scripts/seed-pet-care-tips.js           # adds seed data (skips if tips exist)
 *   node scripts/seed-pet-care-tips.js --fresh   # deletes existing tips/adverts first
 *
 * Requires MONGODB_URI in .env. Needs at least one admin user (creates a
 * fallback seed admin if none exists).
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/user.model');
const PetCareTip = require('../src/models/petCareTip.model');
const Advert = require('../src/models/advert.model');

const p = (text) => `<p>${text}</p>`;
const h3 = (text) => `<h3>${text}</h3>`;
const ul = (...items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;

const TIPS = [
  {
    title: 'How to build a balanced diet for your dog at every life stage',
    animalType: 'dog', category: 'nutrition', breed: 'Golden Retriever',
    difficulty: 'beginner', featured: true, published: true,
    coverImage: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=1200',
    body:
      p('A well-balanced diet is the foundation of your dog\'s health. Whether you have a puppy, an adult dog, or a senior companion, their nutritional needs change significantly across life stages.') +
      h3('Puppies (0–12 months)') +
      p('Puppies need calorie-dense food rich in protein and DHA to support rapid muscle and brain development.') +
      ul('Protein: at least 22% dry matter', 'Fat: at least 8% dry matter', 'Feed 3–4 small meals per day') +
      h3('Adult dogs (1–7 years)') +
      p('Focus on maintaining lean muscle mass and a healthy weight. Portion control matters more at this stage — energy needs drop by roughly 20% after the first year.') +
      h3('Senior dogs (7+ years)') +
      p('Senior formulas reduce calories while boosting joint-support nutrients like glucosamine and omega-3 fatty acids.'),
  },
  {
    title: 'Grooming your Persian cat: a step-by-step guide',
    animalType: 'cat', category: 'grooming', breed: 'Persian',
    difficulty: 'beginner', featured: true, published: true,
    coverImage: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=1200',
    body:
      p('Persian cats have long, dense coats that mat easily without daily care. Ten minutes a day keeps their coat healthy and your furniture fur-free.') +
      h3('Daily routine') +
      ul('Use a wide-tooth metal comb first to find tangles', 'Follow with a slicker brush for the undercoat', 'Wipe tear stains gently with a damp cotton pad') +
      h3('Monthly tasks') +
      p('Bathe with a cat-specific shampoo and trim nails. Introduce both early so your cat accepts them calmly.'),
  },
  {
    title: 'Signs of respiratory illness in parrots and what to do',
    animalType: 'bird', category: 'health', breed: 'African Grey',
    difficulty: 'advanced', featured: true, published: true,
    coverImage: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=1200',
    body:
      p('Birds hide illness instinctively, so respiratory symptoms are often advanced by the time they are visible. Knowing the early signs can save your parrot\'s life.') +
      h3('Watch for') +
      ul('Tail bobbing while breathing', 'Open-mouth breathing at rest', 'Discharge around nares', 'Voice changes or reduced vocalisation') +
      h3('What to do') +
      p('Move the bird to a warm, quiet room, remove airborne irritants (candles, non-stick pans, sprays), and contact an avian vet immediately. Respiratory illness in birds deteriorates fast.'),
  },
  {
    title: 'Teaching recall to puppies under 6 months',
    animalType: 'dog', category: 'training', breed: '',
    difficulty: 'beginner', featured: false, published: true,
    body:
      p('Recall is the single most important command for your puppy\'s safety. Start indoors with zero distractions.') +
      ul('Say the cue once, crouch, open arms', 'Reward every single return with high-value treats', 'Never call your puppy to something unpleasant') +
      p('Once reliable indoors, practice in a fenced garden, then on a long training lead in the park.'),
  },
  {
    title: 'Why dental hygiene matters for indoor cats',
    animalType: 'cat', category: 'dental', breed: '',
    difficulty: 'beginner', featured: false, published: true,
    body:
      p('By age three, most cats show signs of dental disease. Indoor cats are no exception — diet and genetics matter more than environment.') +
      ul('Brush with cat-safe toothpaste 3× a week', 'Dental treats reduce plaque but don\'t replace brushing', 'Annual vet dental checks catch resorption early') +
      p('Watch for drooling, dropping food, or pawing at the mouth — all signs of dental pain worth a vet visit.'),
  },
  {
    title: 'Maintaining water pH for tropical freshwater fish',
    animalType: 'fish', category: 'health', breed: '',
    difficulty: 'intermediate', featured: false, published: true,
    body:
      p('Stable pH matters more than a perfect number. Most community tropical fish thrive between 6.8 and 7.5, but sudden swings are what kill.') +
      ul('Test weekly with a liquid kit (strips are inaccurate)', 'Change 20–25% of water weekly with dechlorinated water', 'Avoid chasing pH with chemicals — fix the cause instead') +
      p('Driftwood lowers pH naturally; crushed coral raises it. Make changes gradually over days, not hours.'),
  },
  {
    title: 'What vegetables are safe for rabbits daily?',
    animalType: 'rabbit', category: 'nutrition', breed: '',
    difficulty: 'beginner', featured: false, published: true,
    body:
      p('A rabbit\'s diet should be 85% hay, but daily leafy greens add nutrients and enrichment.') +
      h3('Safe daily greens') +
      ul('Romaine lettuce (never iceberg)', 'Cilantro, basil, parsley', 'Carrot tops (the greens, not the root)') +
      h3('Occasional treats only') +
      p('Carrots, apple, and berries are sugary — keep to a tablespoon a few times a week.'),
  },
  {
    title: 'Enrichment activities for bearded dragons',
    animalType: 'reptile', category: 'exercise', breed: 'Bearded Dragon',
    difficulty: 'intermediate', featured: false, published: true,
    body:
      p('Bearded dragons are smarter than they look. Enrichment prevents lethargy and stereotypic glass-surfing.') +
      ul('Supervised free-roam time in a secure room', 'Climbing branches and basking platform rotation', 'Live insect hunts in a feeding bin', 'Shallow warm-water swims') +
      p('Rotate the enclosure layout monthly — novelty itself is enrichment for reptiles.'),
  },
  {
    title: 'Crate training without tears: a weekend plan',
    animalType: 'dog', category: 'behavior', breed: '',
    difficulty: 'intermediate', featured: false, published: true,
    body:
      p('A crate should be your dog\'s favourite room, not a punishment. This weekend plan builds positive association fast.') +
      h3('Day 1') +
      p('Feed all meals beside, then inside, the open crate. Toss treats in randomly throughout the day.') +
      h3('Day 2') +
      p('Close the door for 10 seconds during meals, building to 5 minutes. Stay in sight, ignore whining, reward silence.'),
  },
  {
    title: 'Setting up the perfect canary cage',
    animalType: 'bird', category: 'health', breed: 'Canary',
    difficulty: 'beginner', featured: false, published: true,
    body:
      p('Canaries live 10+ years with the right setup. Width matters more than height — they fly horizontally.') +
      ul('Minimum 60cm wide flight cage', 'Perches of varying natural diameters', 'Place away from drafts, kitchens, and direct sun') +
      p('Cover the cage at night for 10–12 hours of dark, quiet sleep.'),
  },
  {
    title: 'Hairball season: helping your long-haired cat cope',
    animalType: 'cat', category: 'health', breed: 'Maine Coon',
    difficulty: 'beginner', featured: false, published: true,
    body:
      p('Spring shedding means hairball season for long-haired breeds. More than one hairball a week warrants attention.') +
      ul('Daily brushing removes hair before your cat swallows it', 'Hairball-control food adds fibre to move hair through', 'A teaspoon of plain canned pumpkin helps digestion') +
      p('Repeated unproductive retching is an emergency — hairballs can cause blockages.'),
  },
  {
    title: 'DRAFT: Senior dog mobility checklist (unpublished)',
    animalType: 'dog', category: 'health', breed: '',
    difficulty: 'intermediate', featured: false, published: false,
    body:
      p('Draft article for review: monthly mobility checks for senior dogs.') +
      ul('Hesitation on stairs', 'Difficulty rising after rest', 'Muscle loss along the spine and hips'),
  },
];

const ADVERTS = [
  {
    title: 'Royal Canin — breed-specific nutrition, now 20% off at VitalPaws shop',
    image: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=800',
    link: '/petshop',
    placement: 'banner',
    active: true,
  },
  {
    title: 'Book a grooming appointment with our certified professionals',
    image: '',
    link: '/appointments',
    placement: 'banner',
    active: true,
  },
  {
    title: 'VitaPet supplements — complete daily nutrition for dogs',
    image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800',
    link: '/petshop',
    placement: 'sponsored',
    active: true,
  },
  {
    title: 'Inactive test advert (should never appear publicly)',
    image: '',
    link: '/petshop',
    placement: 'sponsored',
    active: false,
  },
];

async function run() {
  const fresh = process.argv.includes('--fresh');

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Aborting.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  let admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    console.log('No admin user found — creating seed admin (seed-admin@vitalpaws.test)');
    admin = await User.create({
      name: 'Seed Admin',
      email: 'seed-admin@vitalpaws.test',
      phoneNumber: '00000000',
      address: 'Seed Street',
      password: 'SeedAdmin123*',
      role: 'admin',
    });
  }

  if (fresh) {
    const { deletedCount: t } = await PetCareTip.deleteMany({});
    const { deletedCount: a } = await Advert.deleteMany({});
    console.log(`--fresh: removed ${t} tips, ${a} adverts`);
  } else if (await PetCareTip.countDocuments()) {
    console.log('Tips already exist. Re-run with --fresh to reseed. Aborting.');
    await mongoose.disconnect();
    return;
  }

  // create() (not insertMany) so pre-save slug/readTime hooks run
  for (const tip of TIPS) {
    await PetCareTip.create({ ...tip, createdBy: admin._id });
  }
  for (const ad of ADVERTS) {
    await Advert.create({ ...ad, createdBy: admin._id });
  }

  console.log(`Seeded ${TIPS.length} tips (${TIPS.filter((t) => t.published).length} published, ${TIPS.filter((t) => t.featured).length} featured)`);
  console.log(`Seeded ${ADVERTS.length} adverts (${ADVERTS.filter((a) => a.active).length} active)`);

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the seed against the dev database**

Run (from `backend/`): `node scripts/seed-pet-care-tips.js --fresh`
Expected output ends with:
```
Seeded 12 tips (11 published, 3 featured)
Seeded 4 adverts (3 active)
Done.
```

- [ ] **Step 3: Verify via API (optional but recommended)**

Start the server (`npm run dev`) and check:
- `GET http://localhost:5000/api/tips` → 11 published tips
- `GET http://localhost:5000/api/tips?featured=true` → 3 tips
- `GET http://localhost:5000/api/adverts?placement=banner` → 2 adverts

- [ ] **Step 4: Commit (inside `backend/`)**

```bash
cd backend
git add scripts/seed-pet-care-tips.js
git commit -m "feat: seed script for pet care tips and adverts"
```

---

## Phase 2 — Frontend

### Task 9: API services + theme constants

**Files:**
- Create: `frontend/src/Services/api/tipsApi.js`
- Create: `frontend/src/Services/api/advertsApi.js`
- Create: `frontend/src/Pages/PetCareTips/tipTheme.js`

- [ ] **Step 1: Write tipsApi.js**

```js
import { api } from "../../core/api/apiClient";

const tipsApi = {
  // Public list — params: animalType, category, difficulty, featured, search, exclude, page, limit
  getTips: async (params = {}) => {
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
    );
    const qs = new URLSearchParams(clean).toString();
    const response = await api.get(`/tips${qs ? `?${qs}` : ""}`);
    return response.data;
  },

  // Public single by slug or id
  getTip: async (idOrSlug) => {
    const response = await api.get(`/tips/${idOrSlug}`);
    return response.data;
  },

  // Admin: all tips incl. drafts
  getTipsAdmin: async () => {
    const response = await api.get("/tips/admin/all");
    return response.data;
  },

  // Admin: single tip incl. draft
  getTipAdmin: async (id) => {
    const response = await api.get(`/tips/admin/${id}`);
    return response.data;
  },

  createTip: async (tipData) => {
    const response = await api.post("/tips", tipData);
    return response.data;
  },

  updateTip: async (id, tipData) => {
    const response = await api.patch(`/tips/${id}`, tipData);
    return response.data;
  },

  deleteTip: async (id) => {
    const response = await api.delete(`/tips/${id}`);
    return response.data;
  },
};

export default tipsApi;
```

- [ ] **Step 2: Write advertsApi.js**

```js
import { api } from "../../core/api/apiClient";

const advertsApi = {
  // Public active adverts — params: placement ("banner" | "sponsored")
  getAdverts: async (placement) => {
    const qs = placement ? `?placement=${placement}` : "";
    const response = await api.get(`/adverts${qs}`);
    return response.data;
  },

  // Admin: all adverts incl. inactive
  getAdvertsAdmin: async () => {
    const response = await api.get("/adverts/admin/all");
    return response.data;
  },

  createAdvert: async (advertData) => {
    const response = await api.post("/adverts", advertData);
    return response.data;
  },

  updateAdvert: async (id, advertData) => {
    const response = await api.patch(`/adverts/${id}`, advertData);
    return response.data;
  },

  deleteAdvert: async (id) => {
    const response = await api.delete(`/adverts/${id}`);
    return response.data;
  },
};

export default advertsApi;
```

- [ ] **Step 3: Write tipTheme.js**

```js
/**
 * Shared constants for the Pet Care Tips feature.
 * Animal identity colors + icons, category and difficulty lists.
 */
import {
  FaDog, FaCat, FaDove, FaFish, FaCarrot, FaDragon, FaPaw, FaThLarge,
} from "react-icons/fa";

export const ANIMAL_TYPES = [
  { value: "dog",     label: "Dog",     color: "#1D9E75", tint: "#E1F5EE", icon: FaDog },
  { value: "cat",     label: "Cat",     color: "#7F77DD", tint: "#EEEDFE", icon: FaCat },
  { value: "bird",    label: "Bird",    color: "#EF9F27", tint: "#FAEEDA", icon: FaDove },
  { value: "fish",    label: "Fish",    color: "#378ADD", tint: "#E6F1FB", icon: FaFish },
  { value: "rabbit",  label: "Rabbit",  color: "#639922", tint: "#EAF3DE", icon: FaCarrot },
  { value: "reptile", label: "Reptile", color: "#D85A30", tint: "#FAECE7", icon: FaDragon },
  { value: "other",   label: "Other",   color: "#888780", tint: "#F1EFE8", icon: FaPaw },
];

export const ALL_ANIMALS_OPTION = { value: "", label: "All", icon: FaThLarge };

export const CATEGORIES = [
  "nutrition", "grooming", "health", "training", "exercise", "dental", "behavior",
];

export const DIFFICULTIES = ["beginner", "intermediate", "advanced"];

export const getAnimalTheme = (value) =>
  ANIMAL_TYPES.find((a) => a.value === value) || ANIMAL_TYPES[ANIMAL_TYPES.length - 1];

export const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
```

- [ ] **Step 4: Commit (inside `frontend/`)**

```bash
cd frontend
git add src/Services/api/tipsApi.js src/Services/api/advertsApi.js src/Pages/PetCareTips/tipTheme.js
git commit -m "feat: tips/adverts API services and tip theme constants"
```

---

### Task 10: TipCard component (+ sponsored variant) with test

**Files:**
- Create: `frontend/src/Pages/PetCareTips/components/TipCard.jsx`
- Create: `frontend/src/Pages/PetCareTips/components/TipCard.test.jsx`
- Create: `frontend/src/Pages/PetCareTips/PetCareTips.css` (started here, grown in later tasks)

- [ ] **Step 1: Write the failing component test**

```jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TipCard, { SponsoredCard } from "./TipCard";

const tip = {
  _id: "t1",
  slug: "how-to-feed-your-dog",
  title: "How to feed your dog",
  animalType: "dog",
  category: "nutrition",
  difficulty: "beginner",
  readTime: 5,
  coverImage: "",
};

describe("TipCard", () => {
  it("renders title, badges and read time", () => {
    render(<TipCard tip={tip} />, { wrapper: MemoryRouter });
    expect(screen.getByText("How to feed your dog")).toBeInTheDocument();
    expect(screen.getByText("Dog")).toBeInTheDocument();
    expect(screen.getByText("nutrition")).toBeInTheDocument();
    expect(screen.getByText(/5 min/)).toBeInTheDocument();
  });

  it("links to the tip detail page by slug", () => {
    render(<TipCard tip={tip} />, { wrapper: MemoryRouter });
    expect(screen.getByRole("link")).toHaveAttribute("href", "/pet-care-tips/how-to-feed-your-dog");
  });
});

describe("SponsoredCard", () => {
  it("renders the Sponsored badge and advert title", () => {
    const advert = { _id: "a1", title: "VitaPet supplements", link: "/petshop", image: "" };
    render(<SponsoredCard advert={advert} />, { wrapper: MemoryRouter });
    expect(screen.getByText("Sponsored")).toBeInTheDocument();
    expect(screen.getByText("VitaPet supplements")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run (from `frontend/`): `npm test -- TipCard`
Expected: FAIL — `Cannot find module './TipCard'` (or equivalent resolve error)

- [ ] **Step 3: Write TipCard.jsx**

```jsx
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FiClock, FiExternalLink } from "react-icons/fi";
import { getAnimalTheme, capitalize } from "../tipTheme";

const cardMotion = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.45, ease: "easeOut" },
};

const TipCard = ({ tip }) => {
  const theme = getAnimalTheme(tip.animalType);
  const Icon = theme.icon;

  return (
    <motion.article className="pct-card" {...cardMotion}>
      <Link to={`/pet-care-tips/${tip.slug || tip._id}`} className="pct-card-link">
        <div className="pct-card-strip" style={{ background: theme.color }} />
        <div className="pct-card-img" style={{ background: theme.tint }}>
          {tip.coverImage ? (
            <img src={tip.coverImage} alt={tip.title} loading="lazy" />
          ) : (
            <Icon style={{ color: theme.color, opacity: 0.4 }} size={32} aria-hidden="true" />
          )}
        </div>
        <div className="pct-card-body">
          <div className="pct-badges">
            <span className="pct-badge" style={{ background: theme.tint, color: theme.color }}>
              {theme.label}
            </span>
            <span className="pct-badge pct-badge-cat">{tip.category}</span>
          </div>
          <h3 className="pct-card-title">{tip.title}</h3>
          <div className="pct-card-meta">
            <FiClock size={12} aria-hidden="true" />
            <span>{tip.readTime} min · {capitalize(tip.difficulty)}</span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
};

export const SponsoredCard = ({ advert }) => (
  <motion.article className="pct-card pct-card-sponsored" {...cardMotion}>
    <a
      href={advert.link}
      className="pct-card-link"
      target={advert.link.startsWith("http") ? "_blank" : undefined}
      rel="noopener noreferrer"
    >
      <div className="pct-card-strip" style={{ background: "#B4B2A9" }} />
      <div className="pct-card-img pct-card-img-sponsored">
        {advert.image ? (
          <img src={advert.image} alt={advert.title} loading="lazy" />
        ) : (
          <FiExternalLink size={26} style={{ color: "#888780", opacity: 0.5 }} aria-hidden="true" />
        )}
      </div>
      <div className="pct-card-body">
        <div className="pct-badges">
          <span className="pct-badge pct-badge-sponsored">Sponsored</span>
        </div>
        <h3 className="pct-card-title">{advert.title}</h3>
        <div className="pct-card-meta">
          <FiExternalLink size={12} aria-hidden="true" />
          <span>Learn more</span>
        </div>
      </div>
    </a>
  </motion.article>
);

export default TipCard;
```

- [ ] **Step 4: Start PetCareTips.css with card + shared styles**

```css
/* ── Pet Care Tips — shared feature styles ─────────────────────────── */
:root {
  --pct-amber: #ba7517;
  --pct-amber-tint: #faeeda;
  --pct-amber-deep: #633806;
  --pct-border: #e8e4dc;
  --pct-text: #2c2c2a;
  --pct-text-muted: #6f6e68;
  --pct-surface: #ffffff;
  --pct-bg: #faf9f6;
  --pct-serif: Georgia, "Times New Roman", serif;
}

/* Cards */
.pct-card {
  background: var(--pct-surface);
  border: 1px solid var(--pct-border);
  border-radius: 12px;
  overflow: hidden;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}
.pct-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(44, 44, 42, 0.08);
}
.pct-card-link { display: block; color: inherit; text-decoration: none; }
.pct-card-strip { height: 5px; }
.pct-card-img {
  height: 110px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.pct-card-img img { width: 100%; height: 100%; object-fit: cover; }
.pct-card-img-sponsored { background: #f1efe8; }
.pct-card-body { padding: 14px 16px 16px; }
.pct-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.pct-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 9px;
  border-radius: 8px;
  text-transform: capitalize;
}
.pct-badge-cat { background: var(--pct-amber-tint); color: var(--pct-amber-deep); }
.pct-badge-sponsored {
  background: #f1efe8;
  color: #444441;
  border: 1px dashed #b4b2a9;
}
.pct-card-title {
  font-family: var(--pct-serif);
  font-size: 15px;
  font-weight: 500;
  line-height: 1.45;
  margin: 0 0 8px;
  color: var(--pct-text);
}
.pct-card-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--pct-text-muted);
}
.pct-card-sponsored { border-style: dashed; }
```

- [ ] **Step 5: Run test to verify pass**

Run: `npm test -- TipCard`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit (inside `frontend/`)**

```bash
cd frontend
git add src/Pages/PetCareTips/components/TipCard.jsx src/Pages/PetCareTips/components/TipCard.test.jsx src/Pages/PetCareTips/PetCareTips.css
git commit -m "feat: TipCard and SponsoredCard components with tests"
```

---

### Task 11: Listing building blocks — AnimalStrip, CategoryChips, AdvertBanner, FeaturedSection

**Files:**
- Create: `frontend/src/Pages/PetCareTips/components/AnimalStrip.jsx`
- Create: `frontend/src/Pages/PetCareTips/components/CategoryChips.jsx`
- Create: `frontend/src/Pages/PetCareTips/components/AdvertBanner.jsx`
- Create: `frontend/src/Pages/PetCareTips/components/FeaturedSection.jsx`
- Modify: `frontend/src/Pages/PetCareTips/PetCareTips.css` (append)

- [ ] **Step 1: Write AnimalStrip.jsx**

```jsx
import { ANIMAL_TYPES, ALL_ANIMALS_OPTION } from "../tipTheme";

const AnimalStrip = ({ selected, onSelect }) => {
  const options = [ALL_ANIMALS_OPTION, ...ANIMAL_TYPES];
  return (
    <div className="pct-animal-strip" role="tablist" aria-label="Filter by animal">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = selected === opt.value;
        return (
          <button
            key={opt.value || "all"}
            role="tab"
            aria-selected={active}
            className={`pct-animal-pill ${active ? "active" : ""}`}
            onClick={() => onSelect(opt.value)}
          >
            <Icon size={15} aria-hidden="true" />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default AnimalStrip;
```

- [ ] **Step 2: Write CategoryChips.jsx**

```jsx
import { CATEGORIES, capitalize } from "../tipTheme";

const CategoryChips = ({ selected, onSelect }) => (
  <div className="pct-chip-row" role="tablist" aria-label="Filter by category">
    <button
      role="tab"
      aria-selected={!selected}
      className={`pct-chip ${!selected ? "on" : ""}`}
      onClick={() => onSelect("")}
    >
      All categories
    </button>
    {CATEGORIES.map((cat) => (
      <button
        key={cat}
        role="tab"
        aria-selected={selected === cat}
        className={`pct-chip ${selected === cat ? "on" : ""}`}
        onClick={() => onSelect(cat)}
      >
        {capitalize(cat)}
      </button>
    ))}
  </div>
);

export default CategoryChips;
```

- [ ] **Step 3: Write AdvertBanner.jsx**

```jsx
import { FiHeart, FiArrowRight } from "react-icons/fi";

const AdvertBanner = ({ advert }) => {
  if (!advert) return null;
  const external = advert.link.startsWith("http");
  return (
    <a
      href={advert.link}
      className="pct-banner-ad"
      target={external ? "_blank" : undefined}
      rel="noopener noreferrer"
    >
      <div className="pct-banner-left">
        <div className="pct-banner-icon">
          {advert.image
            ? <img src={advert.image} alt="" loading="lazy" />
            : <FiHeart size={20} aria-hidden="true" />}
        </div>
        <div>
          <p className="pct-banner-tag">Sponsored</p>
          <p className="pct-banner-title">{advert.title}</p>
        </div>
      </div>
      <span className="pct-banner-cta">
        Shop now <FiArrowRight size={13} aria-hidden="true" />
      </span>
    </a>
  );
};

export default AdvertBanner;
```

- [ ] **Step 4: Write FeaturedSection.jsx**

```jsx
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FiClock } from "react-icons/fi";
import { getAnimalTheme, capitalize } from "../tipTheme";

const FeaturedSection = ({ tips }) => {
  if (!tips || tips.length === 0) return null;
  const [main, ...rest] = tips;
  const mainTheme = getAnimalTheme(main.animalType);
  const MainIcon = mainTheme.icon;

  return (
    <section className="pct-section">
      <div className="pct-eyebrow">Featured this week</div>
      <div className="pct-featured-layout">
        <motion.div
          className="pct-feat-main pct-card"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link to={`/pet-care-tips/${main.slug || main._id}`} className="pct-card-link">
            <div className="pct-feat-main-img" style={{ background: mainTheme.tint }}>
              <span className="pct-badge pct-feat-float">Featured</span>
              {main.coverImage ? (
                <img src={main.coverImage} alt={main.title} />
              ) : (
                <MainIcon size={56} style={{ color: mainTheme.color, opacity: 0.3 }} aria-hidden="true" />
              )}
            </div>
            <div className="pct-card-body">
              <div className="pct-badges">
                <span className="pct-badge" style={{ background: mainTheme.tint, color: mainTheme.color }}>
                  {mainTheme.label}
                </span>
                <span className="pct-badge pct-badge-cat">{main.category}</span>
                <span className="pct-badge pct-badge-cat">{capitalize(main.difficulty)}</span>
              </div>
              <h3 className="pct-feat-title">{main.title}</h3>
              <div className="pct-card-meta">
                <FiClock size={12} aria-hidden="true" />
                <span>{main.readTime} min read{main.breed ? ` · ${main.breed}` : ""}</span>
              </div>
            </div>
          </Link>
        </motion.div>

        <div className="pct-feat-stack">
          {rest.slice(0, 2).map((tip, i) => {
            const theme = getAnimalTheme(tip.animalType);
            const Icon = theme.icon;
            return (
              <motion.div
                key={tip._id}
                className="pct-feat-small pct-card"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.12 * (i + 1) }}
              >
                <Link to={`/pet-care-tips/${tip.slug || tip._id}`} className="pct-card-link pct-feat-small-link">
                  <div className="pct-feat-small-img" style={{ background: theme.tint }}>
                    {tip.coverImage ? (
                      <img src={tip.coverImage} alt={tip.title} loading="lazy" />
                    ) : (
                      <Icon size={26} style={{ color: theme.color, opacity: 0.4 }} aria-hidden="true" />
                    )}
                  </div>
                  <div className="pct-feat-small-body">
                    <div className="pct-badges">
                      <span className="pct-badge" style={{ background: theme.tint, color: theme.color }}>
                        {theme.label}
                      </span>
                      <span className="pct-badge pct-badge-cat">{tip.category}</span>
                    </div>
                    <h3 className="pct-feat-small-title">{tip.title}</h3>
                    <div className="pct-card-meta">
                      <FiClock size={11} aria-hidden="true" />
                      <span>{tip.readTime} min · {capitalize(tip.difficulty)}</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturedSection;
```

- [ ] **Step 5: Append styles to PetCareTips.css**

```css
/* ── Sections & eyebrows ───────────────────────────────────────────── */
.pct-section { margin-bottom: 36px; }
.pct-eyebrow {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  color: var(--pct-amber);
  margin-bottom: 16px;
}
.pct-eyebrow::after { content: ""; flex: 1; height: 1px; background: var(--pct-border); }

/* ── Animal strip ──────────────────────────────────────────────────── */
.pct-animal-strip {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 0 12px;
  scrollbar-width: none;
}
.pct-animal-strip::-webkit-scrollbar { display: none; }
.pct-animal-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid var(--pct-border);
  border-radius: 22px;
  background: var(--pct-surface);
  color: var(--pct-text-muted);
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}
.pct-animal-pill:hover { border-color: var(--pct-amber); }
.pct-animal-pill.active {
  border-color: var(--pct-amber);
  background: var(--pct-amber-tint);
  color: var(--pct-amber-deep);
  font-weight: 600;
}

/* ── Category chips ────────────────────────────────────────────────── */
.pct-chip-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
.pct-chip {
  font-size: 12px;
  padding: 6px 14px;
  border: 1px solid var(--pct-border);
  border-radius: 20px;
  background: var(--pct-surface);
  color: var(--pct-text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
}
.pct-chip:hover { border-color: var(--pct-amber); }
.pct-chip.on {
  border-color: var(--pct-amber);
  background: var(--pct-amber-tint);
  color: var(--pct-amber-deep);
  font-weight: 600;
}

/* ── Banner advert ─────────────────────────────────────────────────── */
.pct-banner-ad {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: var(--pct-surface);
  border: 1px solid var(--pct-border);
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 36px;
  text-decoration: none;
  color: inherit;
  transition: box-shadow 0.25s ease;
}
.pct-banner-ad:hover { box-shadow: 0 6px 18px rgba(44, 44, 42, 0.07); }
.pct-banner-left { display: flex; align-items: center; gap: 14px; min-width: 0; }
.pct-banner-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: var(--pct-amber-tint);
  color: var(--pct-amber);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}
.pct-banner-icon img { width: 100%; height: 100%; object-fit: cover; }
.pct-banner-tag {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--pct-text-muted);
  margin: 0 0 3px;
}
.pct-banner-title { font-size: 14px; font-weight: 600; margin: 0; color: var(--pct-text); }
.pct-banner-cta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 18px;
  background: var(--pct-amber);
  color: var(--pct-amber-tint);
  border-radius: 8px;
  white-space: nowrap;
}

/* ── Featured layout ───────────────────────────────────────────────── */
.pct-featured-layout {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 16px;
}
.pct-feat-main-img {
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}
.pct-feat-main-img img { width: 100%; height: 100%; object-fit: cover; }
.pct-feat-float {
  position: absolute;
  top: 12px;
  left: 12px;
  background: var(--pct-amber-tint);
  color: var(--pct-amber-deep);
  z-index: 1;
}
.pct-feat-title {
  font-family: var(--pct-serif);
  font-size: 18px;
  font-weight: 500;
  line-height: 1.4;
  margin: 0 0 8px;
  color: var(--pct-text);
}
.pct-feat-stack { display: flex; flex-direction: column; gap: 16px; }
.pct-feat-small { flex: 1; }
.pct-feat-small-link { display: flex; height: 100%; }
.pct-feat-small-img {
  width: 88px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.pct-feat-small-img img { width: 100%; height: 100%; object-fit: cover; }
.pct-feat-small-body { padding: 12px 14px; min-width: 0; }
.pct-feat-small-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  margin: 0 0 6px;
  color: var(--pct-text);
}

@media (max-width: 860px) {
  .pct-featured-layout { grid-template-columns: 1fr; }
}
```

- [ ] **Step 6: Commit (inside `frontend/`)**

```bash
cd frontend
git add src/Pages/PetCareTips/components/AnimalStrip.jsx src/Pages/PetCareTips/components/CategoryChips.jsx src/Pages/PetCareTips/components/AdvertBanner.jsx src/Pages/PetCareTips/components/FeaturedSection.jsx src/Pages/PetCareTips/PetCareTips.css
git commit -m "feat: listing building blocks (animal strip, chips, banner ad, featured section)"
```

---

### Task 12: PetCareTipsPage + routes + nav link

**Files:**
- Create: `frontend/src/Pages/PetCareTips/PetCareTipsPage.jsx`
- Modify: `frontend/src/Pages/PetCareTips/PetCareTips.css` (append)
- Modify: `frontend/src/main.jsx`
- Modify: `frontend/src/Components/NavigationBar/NavigationBar.jsx:34`

- [ ] **Step 1: Write PetCareTipsPage.jsx**

```jsx
import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { FiSearch } from "react-icons/fi";
import { FaPaw } from "react-icons/fa";
import tipsApi from "../../Services/api/tipsApi";
import advertsApi from "../../Services/api/advertsApi";
import { useToast } from "../../context/ToastContext";
import TipCard, { SponsoredCard } from "./components/TipCard";
import FeaturedSection from "./components/FeaturedSection";
import AnimalStrip from "./components/AnimalStrip";
import CategoryChips from "./components/CategoryChips";
import AdvertBanner from "./components/AdvertBanner";
import "./PetCareTips.css";

const SPONSORED_EVERY = 5; // inject a sponsored card after every 5th tip

const PetCareTipsPage = () => {
  const [tips, setTips] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [bannerAds, setBannerAds] = useState([]);
  const [sponsoredAds, setSponsoredAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [animalType, setAnimalType] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { addToast } = useToast();
  const debounceRef = useRef(null);

  // Debounce search input → API param
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Featured + adverts: once on mount
  useEffect(() => {
    (async () => {
      try {
        const [featRes, bannerRes, sponsoredRes] = await Promise.all([
          tipsApi.getTips({ featured: true, limit: 3 }),
          advertsApi.getAdverts("banner"),
          advertsApi.getAdverts("sponsored"),
        ]);
        setFeatured(featRes.data || []);
        setBannerAds(bannerRes.data || []);
        setSponsoredAds(sponsoredRes.data || []);
      } catch {
        // Featured/ads failing shouldn't block the page; grid fetch shows its own toast
      }
    })();
  }, []);

  // Grid: refetch on filter/search change
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await tipsApi.getTips({
          animalType,
          category,
          search: debouncedSearch,
          limit: 30,
        });
        setTips(res.data || []);
      } catch {
        addToast("Failed to load tips", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [animalType, category, debouncedSearch, addToast]);

  // Interleave sponsored cards into the grid
  const gridItems = useMemo(() => {
    const items = [];
    let adIndex = 0;
    tips.forEach((tip, i) => {
      items.push({ type: "tip", data: tip });
      if ((i + 1) % SPONSORED_EVERY === 0 && sponsoredAds.length > 0) {
        items.push({ type: "ad", data: sponsoredAds[adIndex % sponsoredAds.length] });
        adIndex += 1;
      }
    });
    return items;
  }, [tips, sponsoredAds]);

  return (
    <div className="pct-page">
      {/* Hero */}
      <header className="pct-hero">
        <FaPaw className="pct-hero-paw" aria-hidden="true" />
        <motion.p
          className="pct-hero-label"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          Expert knowledge, for every pet
        </motion.p>
        <motion.h1
          className="pct-hero-title"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
        >
          Care tips written with love, for every animal you love
        </motion.h1>
        <motion.p
          className="pct-hero-sub"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2 }}
        >
          From golden retrievers to bearded dragons — trusted advice tailored to
          your pet&apos;s breed, age, and needs.
        </motion.p>
        <motion.div
          className="pct-search"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.3 }}
        >
          <FiSearch size={17} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search by pet, breed, or topic…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search tips"
          />
        </motion.div>
      </header>

      <div className="pct-content">
        <AnimalStrip selected={animalType} onSelect={setAnimalType} />

        {!debouncedSearch && !animalType && !category && (
          <FeaturedSection tips={featured} />
        )}

        <AdvertBanner advert={bannerAds[0]} />

        <section className="pct-section">
          <div className="pct-eyebrow">Browse all tips</div>
          <CategoryChips selected={category} onSelect={setCategory} />

          {loading ? (
            <div className="pct-empty">Loading tips…</div>
          ) : gridItems.length === 0 ? (
            <div className="pct-empty">
              No tips found — try a different filter or search term.
            </div>
          ) : (
            <div className="pct-grid">
              {gridItems.map((item, i) =>
                item.type === "tip" ? (
                  <TipCard key={item.data._id} tip={item.data} />
                ) : (
                  <SponsoredCard key={`ad-${i}`} advert={item.data} />
                )
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default PetCareTipsPage;
```

- [ ] **Step 2: Append page styles to PetCareTips.css**

```css
/* ── Page shell, hero, grid ────────────────────────────────────────── */
.pct-page { background: var(--pct-bg); min-height: 100vh; }
.pct-hero {
  position: relative;
  overflow: hidden;
  background: var(--pct-surface);
  border-bottom: 1px solid var(--pct-border);
  padding: 56px 24px 44px;
  text-align: left;
  max-width: 100%;
}
.pct-hero > * { max-width: 1080px; margin-left: auto; margin-right: auto; }
.pct-hero-paw {
  position: absolute;
  right: 4%;
  top: -20px;
  font-size: 150px;
  opacity: 0.05;
  color: var(--pct-text);
  pointer-events: none;
}
.pct-hero-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1.6px;
  text-transform: uppercase;
  color: var(--pct-amber);
  margin: 0 auto 12px;
}
.pct-hero-title {
  font-family: var(--pct-serif);
  font-size: clamp(26px, 4vw, 36px);
  font-weight: 500;
  line-height: 1.25;
  color: var(--pct-text);
  margin: 0 auto 12px;
  max-width: 1080px;
}
.pct-hero-sub {
  font-size: 15px;
  color: var(--pct-text-muted);
  line-height: 1.6;
  margin: 0 auto 26px;
}
.pct-search {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--pct-bg);
  border: 1px solid var(--pct-border);
  border-radius: 12px;
  padding: 12px 18px;
  max-width: 560px !important;
  margin-left: auto;
  margin-right: auto;
  color: var(--pct-text-muted);
  transition: border-color 0.2s ease;
}
.pct-search:focus-within { border-color: var(--pct-amber); }
.pct-search input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: var(--pct-text);
}
.pct-content { max-width: 1080px; margin: 0 auto; padding: 28px 24px 64px; }
.pct-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.pct-empty {
  padding: 48px 0;
  text-align: center;
  color: var(--pct-text-muted);
  font-size: 14px;
}
@media (max-width: 980px) { .pct-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px) { .pct-grid { grid-template-columns: 1fr; } }
```

- [ ] **Step 3: Add route to main.jsx**

(a) Add import after the `OrderConfirmedPage` import (line 16):

```jsx
import PetCareTipsPage from "./Pages/PetCareTips/PetCareTipsPage.jsx";
```

(b) Add public child route after the `appointments` route entry (after line 70):

```jsx
      {
        path: "pet-care-tips",
        element: <PetCareTipsPage />,
      },
```

- [ ] **Step 4: Add nav link in NavigationBar.jsx**

At `frontend/src/Components/NavigationBar/NavigationBar.jsx:34`, after the Pet Store entry:

```jsx
  { label: "Pet Store", href: "/petshop" },
  { label: "Care Tips", href: "/pet-care-tips" },
```

- [ ] **Step 5: Manual verification**

Run: `npm run dev` (frontend) with the backend running and seeded.
Verify at `http://localhost:5173/pet-care-tips`:
- Hero renders with staggered animation, search works (type "golden" → 1 result)
- Animal pills filter the grid; featured section hides while filtering
- Banner advert shows; sponsored card appears after the 5th tip
- Cards animate in on scroll

- [ ] **Step 6: Commit (inside `frontend/`)**

```bash
cd frontend
git add src/Pages/PetCareTips/PetCareTipsPage.jsx src/Pages/PetCareTips/PetCareTips.css src/main.jsx src/Components/NavigationBar/NavigationBar.jsx
git commit -m "feat: pet care tips listing page with search, filters, adverts"
```

---

### Task 13: TipDetailPage

**Files:**
- Create: `frontend/src/Pages/PetCareTips/TipDetailPage.jsx`
- Create: `frontend/src/Pages/PetCareTips/TipDetail.css`
- Modify: `frontend/src/main.jsx`

- [ ] **Step 1: Write TipDetailPage.jsx**

```jsx
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FiClock, FiCalendar, FiUser, FiArrowLeft, FiChevronRight, FiArrowRight } from "react-icons/fi";
import tipsApi from "../../Services/api/tipsApi";
import advertsApi from "../../Services/api/advertsApi";
import { RichTextRenderer } from "../../Components/RichText";
import { getAnimalTheme, capitalize } from "./tipTheme";
import "./TipDetail.css";

const TipDetailPage = () => {
  const { slug } = useParams();
  const [tip, setTip] = useState(null);
  const [related, setRelated] = useState([]);
  const [advert, setAdvert] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | notfound

  useEffect(() => {
    (async () => {
      try {
        setStatus("loading");
        window.scrollTo(0, 0);
        const res = await tipsApi.getTip(slug);
        const loaded = res.data;
        setTip(loaded);
        setStatus("ready");

        const [relRes, adRes] = await Promise.all([
          tipsApi.getTips({ animalType: loaded.animalType, exclude: loaded._id, limit: 3 }),
          advertsApi.getAdverts("sponsored"),
        ]);
        setRelated(relRes.data || []);
        setAdvert((adRes.data || [])[0] || null);
      } catch {
        setStatus("notfound");
      }
    })();
  }, [slug]);

  if (status === "loading") {
    return <div className="ptd-state">Loading tip…</div>;
  }
  if (status === "notfound") {
    return (
      <div className="ptd-state">
        <p>Tip not found.</p>
        <Link to="/pet-care-tips" className="ptd-back">
          <FiArrowLeft size={14} aria-hidden="true" /> Back to tips
        </Link>
      </div>
    );
  }

  const theme = getAnimalTheme(tip.animalType);
  const Icon = theme.icon;

  return (
    <motion.div
      className="ptd-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Breadcrumb */}
      <nav className="ptd-breadcrumb" aria-label="Breadcrumb">
        <Link to="/pet-care-tips" className="ptd-back">
          <FiArrowLeft size={14} aria-hidden="true" /> Back to tips
        </Link>
        <FiChevronRight size={12} aria-hidden="true" />
        <span>{theme.label}</span>
        <FiChevronRight size={12} aria-hidden="true" />
        <span>{capitalize(tip.category)}</span>
      </nav>

      {/* Cover hero */}
      <div className="ptd-cover" style={{ background: theme.tint }}>
        {tip.coverImage ? (
          <img src={tip.coverImage} alt="" className="ptd-cover-img" />
        ) : (
          <Icon className="ptd-cover-icon" style={{ color: theme.color }} aria-hidden="true" />
        )}
        <div className="ptd-cover-overlay">
          <div className="ptd-badges">
            <span className="ptd-badge" style={{ background: theme.tint, color: theme.color }}>
              {theme.label}
            </span>
            <span className="ptd-badge ptd-badge-amber">{capitalize(tip.category)}</span>
            {tip.breed && <span className="ptd-badge ptd-badge-amber">{tip.breed}</span>}
            <span className="ptd-badge ptd-badge-amber">{capitalize(tip.difficulty)}</span>
          </div>
          <h1 className="ptd-title">{tip.title}</h1>
        </div>
      </div>

      {/* Body */}
      <div className="ptd-layout">
        <article className="ptd-article">
          <div className="ptd-meta">
            <span><FiClock size={13} aria-hidden="true" /> {tip.readTime} min read</span>
            <span>
              <FiCalendar size={13} aria-hidden="true" />{" "}
              {new Date(tip.createdAt).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
            </span>
            <span><FiUser size={13} aria-hidden="true" /> VitalPaws team</span>
          </div>
          <RichTextRenderer content={tip.body} className="ptd-body" />
        </article>

        <aside className="ptd-sidebar">
          <div className="ptd-side-card">
            <p className="ptd-side-title">About this tip</p>
            <dl className="ptd-facts">
              <div><dt>Animal</dt><dd>{theme.label}</dd></div>
              {tip.breed && <div><dt>Breed</dt><dd>{tip.breed}</dd></div>}
              <div><dt>Category</dt><dd>{capitalize(tip.category)}</dd></div>
              <div><dt>Difficulty</dt><dd>{capitalize(tip.difficulty)}</dd></div>
              <div><dt>Read time</dt><dd>{tip.readTime} min</dd></div>
            </dl>
          </div>

          {advert && (
            <a
              href={advert.link}
              className="ptd-side-card ptd-ad"
              target={advert.link.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
            >
              <p className="ptd-ad-tag">Sponsored</p>
              {advert.image && <img src={advert.image} alt="" className="ptd-ad-img" loading="lazy" />}
              <p className="ptd-ad-title">{advert.title}</p>
              <span className="ptd-ad-cta">
                Shop now <FiArrowRight size={12} aria-hidden="true" />
              </span>
            </a>
          )}

          {related.length > 0 && (
            <div className="ptd-side-card">
              <p className="ptd-side-title">You might also like</p>
              {related.map((r) => {
                const rTheme = getAnimalTheme(r.animalType);
                const RIcon = rTheme.icon;
                return (
                  <Link key={r._id} to={`/pet-care-tips/${r.slug || r._id}`} className="ptd-related">
                    <span className="ptd-related-thumb" style={{ background: rTheme.tint }}>
                      <RIcon size={16} style={{ color: rTheme.color }} aria-hidden="true" />
                    </span>
                    <span>
                      <span className="ptd-related-title">{r.title}</span>
                      <span className="ptd-related-meta">
                        {rTheme.label} · {capitalize(r.category)} · {r.readTime} min
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </aside>
      </div>
    </motion.div>
  );
};

export default TipDetailPage;
```

- [ ] **Step 2: Write TipDetail.css**

```css
/* ── Tip detail page ───────────────────────────────────────────────── */
.ptd-page { background: #faf9f6; min-height: 100vh; padding-bottom: 64px; }
.ptd-state {
  padding: 96px 24px;
  text-align: center;
  color: #6f6e68;
  font-size: 15px;
}
.ptd-breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 1080px;
  margin: 0 auto;
  padding: 18px 24px;
  font-size: 13px;
  color: #6f6e68;
}
.ptd-back {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #ba7517;
  font-weight: 600;
  text-decoration: none;
}
.ptd-cover {
  position: relative;
  height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.ptd-cover-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.ptd-cover-icon { font-size: 90px; opacity: 0.2; }
.ptd-cover-overlay {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  background: #ffffff;
  border-top: 1px solid #e8e4dc;
  padding: 18px 24px;
}
.ptd-cover-overlay > * { max-width: 1032px; margin-left: auto; margin-right: auto; }
.ptd-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.ptd-badge { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 8px; }
.ptd-badge-amber { background: #faeeda; color: #633806; }
.ptd-title {
  font-family: Georgia, "Times New Roman", serif;
  font-size: clamp(20px, 3vw, 28px);
  font-weight: 500;
  line-height: 1.35;
  color: #2c2c2a;
  margin: 0;
}
.ptd-layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 28px;
  max-width: 1080px;
  margin: 28px auto 0;
  padding: 0 24px;
}
.ptd-article {
  background: #ffffff;
  border: 1px solid #e8e4dc;
  border-radius: 12px;
  padding: 28px 32px;
}
.ptd-meta {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  font-size: 13px;
  color: #6f6e68;
  padding-bottom: 16px;
  border-bottom: 1px solid #e8e4dc;
  margin-bottom: 22px;
}
.ptd-meta span { display: inline-flex; align-items: center; gap: 5px; }
.ptd-body { font-size: 15px; line-height: 1.75; color: #444441; }
.ptd-body h3 {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 18px;
  font-weight: 500;
  color: #2c2c2a;
  margin: 24px 0 10px;
}
.ptd-body blockquote {
  margin: 20px 0;
  padding: 16px 20px;
  background: #faeeda;
  border-left: 3px solid #ba7517;
  border-radius: 0 12px 12px 0;
  font-family: Georgia, "Times New Roman", serif;
  font-style: italic;
  color: #633806;
}
.ptd-sidebar { display: flex; flex-direction: column; gap: 18px; }
.ptd-side-card {
  background: #ffffff;
  border: 1px solid #e8e4dc;
  border-radius: 12px;
  padding: 18px;
  text-decoration: none;
  color: inherit;
}
.ptd-side-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: #6f6e68;
  margin: 0 0 12px;
}
.ptd-facts { margin: 0; }
.ptd-facts div {
  display: flex;
  justify-content: space-between;
  padding: 7px 0;
  border-bottom: 1px solid #f1efe8;
  font-size: 13px;
}
.ptd-facts div:last-child { border-bottom: none; }
.ptd-facts dt { color: #6f6e68; }
.ptd-facts dd { margin: 0; font-weight: 600; color: #2c2c2a; }
.ptd-ad { display: block; transition: box-shadow 0.25s ease; }
.ptd-ad:hover { box-shadow: 0 6px 18px rgba(44, 44, 42, 0.07); }
.ptd-ad-tag {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #6f6e68;
  margin: 0 0 8px;
}
.ptd-ad-img { width: 100%; height: 110px; object-fit: cover; border-radius: 8px; margin-bottom: 10px; }
.ptd-ad-title { font-size: 13px; font-weight: 600; margin: 0 0 10px; color: #2c2c2a; }
.ptd-ad-cta {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 14px;
  background: #ba7517;
  color: #faeeda;
  border-radius: 8px;
}
.ptd-related {
  display: flex;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid #f1efe8;
  text-decoration: none;
  color: inherit;
}
.ptd-related:last-child { border-bottom: none; }
.ptd-related-thumb {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ptd-related-title { display: block; font-size: 13px; font-weight: 600; line-height: 1.4; color: #2c2c2a; }
.ptd-related-meta { display: block; font-size: 11px; color: #6f6e68; margin-top: 2px; }
@media (max-width: 900px) {
  .ptd-layout { grid-template-columns: 1fr; }
}
```

- [ ] **Step 3: Add route to main.jsx**

(a) Import after `PetCareTipsPage`:

```jsx
import TipDetailPage from "./Pages/PetCareTips/TipDetailPage.jsx";
```

(b) Child route directly after the `pet-care-tips` entry:

```jsx
      {
        path: "pet-care-tips/:slug",
        element: <TipDetailPage />,
      },
```

- [ ] **Step 4: Manual verification**

With backend running and seeded, click a card from `/pet-care-tips`:
- Article renders rich HTML (headings, lists) through RichTextRenderer
- Sidebar shows facts, a sponsored advert, and up to 3 related tips of the same animal
- A bogus URL like `/pet-care-tips/not-a-real-slug` shows the "Tip not found" state

- [ ] **Step 5: Commit (inside `frontend/`)**

```bash
cd frontend
git add src/Pages/PetCareTips/TipDetailPage.jsx src/Pages/PetCareTips/TipDetail.css src/main.jsx
git commit -m "feat: tip detail page with rich text body, related tips, sidebar advert"
```

---

### Task 14: Admin — AdminTips list page + sidebar entries

**Files:**
- Create: `frontend/src/Pages/Admin/Tips/AdminTips.jsx`
- Create: `frontend/src/Pages/Admin/Tips/AdminTips.css`
- Modify: `frontend/src/Components/Admin/AdminLayout.jsx:88` (menuItems)
- Modify: `frontend/src/main.jsx` (admin routes)

- [ ] **Step 1: Write AdminTips.jsx**

```jsx
import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiPlus, FiBookOpen, FiCheckCircle, FiEdit3, FiStar } from "react-icons/fi";
import DataTable from "../../../Components/Admin/DataTable/DataTable";
import tipsApi from "../../../Services/api/tipsApi";
import { useToast } from "../../../context/ToastContext";
import { capitalize } from "../../PetCareTips/tipTheme";
import "./AdminTips.css";

const AdminTips = () => {
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedTip, setSelectedTip] = useState(null);
  const { addToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => { fetchTips(); }, []);

  const fetchTips = async () => {
    try {
      setLoading(true);
      const response = await tipsApi.getTipsAdmin();
      setTips(response.data || []);
    } catch {
      addToast("Failed to fetch tips", "error");
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => ({
    total: tips.length,
    published: tips.filter((t) => t.published).length,
    drafts: tips.filter((t) => !t.published).length,
    featured: tips.filter((t) => t.featured).length,
  }), [tips]);

  const toggleField = async (tip, field) => {
    try {
      await tipsApi.updateTip(tip._id, { [field]: !tip[field] });
      addToast(`Tip ${field} updated`, "success");
      fetchTips();
    } catch {
      addToast(`Failed to update ${field}`, "error");
    }
  };

  const handleDelete = (tip) => {
    setSelectedTip(tip);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedTip) return;
    try {
      await tipsApi.deleteTip(selectedTip._id);
      addToast("Tip deleted successfully", "success");
      fetchTips();
      setDeleteModalOpen(false);
      setSelectedTip(null);
    } catch {
      addToast("Failed to delete tip", "error");
    }
  };

  const columns = [
    {
      header: "Title",
      accessor: "title",
      render: (value) => <span className="at-title">{value}</span>,
    },
    {
      header: "Animal",
      accessor: "animalType",
      render: (value) => <span className="at-pill">{capitalize(value)}</span>,
    },
    {
      header: "Category",
      accessor: "category",
      render: (value) => <span className="at-pill">{capitalize(value)}</span>,
    },
    {
      header: "Difficulty",
      accessor: "difficulty",
      render: (value) => capitalize(value),
    },
    {
      header: "Featured",
      accessor: "featured",
      sortable: false,
      render: (value, item) => (
        <button
          className={`at-toggle ${value ? "on" : ""}`}
          onClick={(e) => { e.stopPropagation(); toggleField(item, "featured"); }}
          title={value ? "Unfeature" : "Feature"}
        >
          <FiStar size={14} />
        </button>
      ),
    },
    {
      header: "Status",
      accessor: "published",
      render: (value, item) => (
        <button
          className={`at-status ${value ? "published" : "draft"}`}
          onClick={(e) => { e.stopPropagation(); toggleField(item, "published"); }}
          title="Click to toggle"
        >
          {value ? "Published" : "Draft"}
        </button>
      ),
    },
    {
      header: "Created",
      accessor: "createdAt",
      render: (value) => (value ? new Date(value).toLocaleDateString() : "—"),
    },
  ];

  return (
    <motion.div
      className="admin-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Pet Care Tips</h1>
          <p className="admin-page-subtitle">Manage tips, featured picks, and drafts</p>
        </div>
        <Link to="/admin/tips/new" className="add-button">
          <FiPlus />
          New Tip
        </Link>
      </div>

      {!loading && (
        <div className="at-stats">
          <div className="at-stat-card">
            <FiBookOpen size={18} />
            <div><p className="at-stat-value">{stats.total}</p><p className="at-stat-label">Total</p></div>
          </div>
          <div className="at-stat-card">
            <FiCheckCircle size={18} />
            <div><p className="at-stat-value">{stats.published}</p><p className="at-stat-label">Published</p></div>
          </div>
          <div className="at-stat-card">
            <FiEdit3 size={18} />
            <div><p className="at-stat-value">{stats.drafts}</p><p className="at-stat-label">Drafts</p></div>
          </div>
          <div className="at-stat-card">
            <FiStar size={18} />
            <div><p className="at-stat-value">{stats.featured}</p><p className="at-stat-label">Featured</p></div>
          </div>
        </div>
      )}

      <DataTable
        data={tips}
        columns={columns}
        loading={loading}
        onEdit={(tip) => navigate(`/admin/tips/edit/${tip._id}`)}
        onDelete={handleDelete}
        onView={(tip) => window.open(`/pet-care-tips/${tip.slug || tip._id}`, "_blank")}
      />

      <AnimatePresence>
        {deleteModalOpen && (
          <motion.div
            className="admin-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDeleteModalOpen(false)}
          >
            <motion.div
              className="admin-modal"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>Delete tip?</h3>
              <p>&ldquo;{selectedTip?.title}&rdquo; will be permanently removed.</p>
              <div className="admin-modal-actions">
                <button className="at-btn-secondary" onClick={() => setDeleteModalOpen(false)}>
                  Cancel
                </button>
                <button className="at-btn-danger" onClick={confirmDelete}>
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AdminTips;
```

- [ ] **Step 2: Write AdminTips.css**

```css
/* ── Admin tips ────────────────────────────────────────────────────── */
.at-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}
.at-stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border: 1px solid #e8e4dc;
  border-radius: 10px;
  padding: 14px 16px;
  color: #ba7517;
}
.at-stat-value { font-size: 20px; font-weight: 600; margin: 0; color: #2c2c2a; }
.at-stat-label { font-size: 12px; color: #6f6e68; margin: 0; }
.at-title { font-weight: 600; }
.at-pill {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 8px;
  background: #faeeda;
  color: #633806;
}
.at-toggle {
  border: 1px solid #e8e4dc;
  background: #fff;
  color: #b4b2a9;
  border-radius: 8px;
  padding: 5px 8px;
  cursor: pointer;
}
.at-toggle.on { background: #faeeda; color: #ba7517; border-color: #ba7517; }
.at-status {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 12px;
  border: none;
  cursor: pointer;
}
.at-status.published { background: #e1f5ee; color: #0f6e56; }
.at-status.draft { background: #f1efe8; color: #5f5e5a; }
.admin-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.admin-modal {
  background: #fff;
  border-radius: 12px;
  padding: 24px 28px;
  max-width: 380px;
  width: 90%;
}
.admin-modal h3 { margin: 0 0 8px; }
.admin-modal p { margin: 0 0 18px; color: #6f6e68; font-size: 14px; }
.admin-modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
.at-btn-secondary {
  padding: 8px 16px;
  border: 1px solid #e8e4dc;
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
}
.at-btn-danger {
  padding: 8px 16px;
  border: none;
  background: #e24b4a;
  color: #fff;
  border-radius: 8px;
  cursor: pointer;
}
```

*(Note: if `.admin-modal-backdrop` / `.admin-modal` already exist globally from other admin pages, the duplicate definitions here are harmless overrides with identical look.)*

- [ ] **Step 3: Add sidebar entries in AdminLayout.jsx**

(a) Extend the react-icons import (line 5–21) with `FiBookOpen` and `FiSpeaker`:

```jsx
import {
  FiHome, FiUsers, FiPackage, FiShoppingCart, FiCalendar, FiBarChart2,
  FiSettings, FiMenu, FiX, FiLogOut, FiUserCheck, FiBox, FiFileText,
  FiCreditCard, FiExternalLink, FiBookOpen, FiSpeaker,
} from "react-icons/fi";
```

(b) In `menuItems` (line 33–89), insert after the Products entry (line 53):

```jsx
    {
      title: "Pet Care Tips",
      path: "/admin/tips",
      icon: <FiBookOpen className="menu-icon" />,
    },
    {
      title: "Adverts",
      path: "/admin/adverts",
      icon: <FiSpeaker className="menu-icon" />,
    },
```

- [ ] **Step 4: Add admin route in main.jsx**

(a) Import in the Admin imports block (after line 40):

```jsx
import AdminTips from "./Pages/Admin/Tips/AdminTips";
```

(b) Add child route after the `products/edit/:id` entry (line 144–148):

```jsx
      {
        path: "tips",
        element: <AdminTips />,
      },
```

- [ ] **Step 5: Manual verification**

Log in as admin → `/admin/tips`:
- Stats show 12 / 11 / 1 / 3 (after seeding)
- Star toggle features/unfeatures; status pill toggles draft/published
- Delete shows confirm modal and removes the row

- [ ] **Step 6: Commit (inside `frontend/`)**

```bash
cd frontend
git add src/Pages/Admin/Tips/AdminTips.jsx src/Pages/Admin/Tips/AdminTips.css src/Components/Admin/AdminLayout.jsx src/main.jsx
git commit -m "feat: admin tips management page with featured/published toggles"
```

---

### Task 15: Admin — AdminTipForm (create + edit)

**Files:**
- Create: `frontend/src/Pages/Admin/Tips/AdminTipForm.jsx`
- Create: `frontend/src/Pages/Admin/Tips/AdminTipForm.css`
- Modify: `frontend/src/main.jsx`

- [ ] **Step 1: Write AdminTipForm.jsx**

```jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FiArrowLeft, FiSave } from "react-icons/fi";
import { RichTextEditor } from "../../../Components/RichText";
import tipsApi from "../../../Services/api/tipsApi";
import { useToast } from "../../../context/ToastContext";
import { ANIMAL_TYPES, CATEGORIES, DIFFICULTIES, capitalize } from "../../PetCareTips/tipTheme";
import "./AdminTipForm.css";

const EMPTY_FORM = {
  title: "",
  coverImage: "",
  body: "",
  animalType: "dog",
  category: "nutrition",
  breed: "",
  difficulty: "beginner",
  featured: false,
  published: false,
};

const AdminTipForm = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const res = await tipsApi.getTipAdmin(id);
        const t = res.data;
        setForm({
          title: t.title || "",
          coverImage: t.coverImage || "",
          body: t.body || "",
          animalType: t.animalType || "dog",
          category: t.category || "nutrition",
          breed: t.breed || "",
          difficulty: t.difficulty || "beginner",
          featured: Boolean(t.featured),
          published: Boolean(t.published),
        });
      } catch {
        addToast("Failed to load tip", "error");
        navigate("/admin/tips");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit, addToast, navigate]);

  const set = (field) => (e) => {
    const value = e?.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e;
    setForm((f) => ({ ...f, [field]: value }));
  };

  const validate = () => {
    const errs = {};
    if (form.title.trim().length < 2) errs.title = "Title must be at least 2 characters";
    if (!form.body || form.body === "<p></p>") errs.body = "Tip body is required";
    if (form.coverImage && !/^https?:\/\//.test(form.coverImage)) {
      errs.coverImage = "Cover image must be a valid URL";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      setSaving(true);
      const payload = { ...form, breed: form.breed.trim() };
      if (isEdit) {
        await tipsApi.updateTip(id, payload);
        addToast("Tip updated", "success");
      } else {
        await tipsApi.createTip(payload);
        addToast("Tip created", "success");
      }
      navigate("/admin/tips");
    } catch (err) {
      addToast(err?.response?.data?.message || "Failed to save tip", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="admin-page"><p>Loading…</p></div>;

  return (
    <motion.div
      className="admin-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="admin-page-header">
        <div>
          <Link to="/admin/tips" className="atf-back">
            <FiArrowLeft size={14} /> Back to tips
          </Link>
          <h1 className="admin-page-title">{isEdit ? "Edit Tip" : "New Tip"}</h1>
        </div>
      </div>

      <form className="atf-form" onSubmit={handleSubmit}>
        <div className="atf-field">
          <label htmlFor="atf-title">Title</label>
          <input id="atf-title" type="text" value={form.title} onChange={set("title")} maxLength={150} />
          {errors.title && <p className="atf-error">{errors.title}</p>}
        </div>

        <div className="atf-field">
          <label htmlFor="atf-cover">Cover image URL (optional)</label>
          <input id="atf-cover" type="url" value={form.coverImage} onChange={set("coverImage")} placeholder="https://…" />
          {errors.coverImage && <p className="atf-error">{errors.coverImage}</p>}
        </div>

        <div className="atf-row">
          <div className="atf-field">
            <label htmlFor="atf-animal">Animal</label>
            <select id="atf-animal" value={form.animalType} onChange={set("animalType")}>
              {ANIMAL_TYPES.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>
          <div className="atf-field">
            <label htmlFor="atf-category">Category</label>
            <select id="atf-category" value={form.category} onChange={set("category")}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{capitalize(c)}</option>
              ))}
            </select>
          </div>
          <div className="atf-field">
            <label htmlFor="atf-difficulty">Difficulty</label>
            <select id="atf-difficulty" value={form.difficulty} onChange={set("difficulty")}>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>{capitalize(d)}</option>
              ))}
            </select>
          </div>
          <div className="atf-field">
            <label htmlFor="atf-breed">Breed (optional)</label>
            <input id="atf-breed" type="text" value={form.breed} onChange={set("breed")} maxLength={80} placeholder="e.g. Golden Retriever" />
          </div>
        </div>

        <RichTextEditor
          label="Tip body"
          value={form.body}
          onChange={set("body")}
          preset="standard"
          placeholder="Write the tip content…"
          minHeight="260px"
          error={errors.body}
        />

        <div className="atf-toggles">
          <label className="atf-check">
            <input type="checkbox" checked={form.featured} onChange={set("featured")} />
            Featured (shows in the featured section)
          </label>
          <label className="atf-check">
            <input type="checkbox" checked={form.published} onChange={set("published")} />
            Published (visible to users)
          </label>
        </div>

        <div className="atf-actions">
          <Link to="/admin/tips" className="at-btn-secondary">Cancel</Link>
          <button type="submit" className="atf-submit" disabled={saving}>
            <FiSave size={15} /> {saving ? "Saving…" : isEdit ? "Save changes" : "Create tip"}
          </button>
        </div>
      </form>
    </motion.div>
  );
};

export default AdminTipForm;
```

- [ ] **Step 2: Write AdminTipForm.css**

```css
/* ── Admin tip form ────────────────────────────────────────────────── */
.atf-back {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 600;
  color: #ba7517;
  text-decoration: none;
  margin-bottom: 6px;
}
.atf-form {
  background: #fff;
  border: 1px solid #e8e4dc;
  border-radius: 12px;
  padding: 24px 28px;
  max-width: 860px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.atf-field { display: flex; flex-direction: column; gap: 6px; }
.atf-field label { font-size: 13px; font-weight: 600; color: #444441; }
.atf-field input,
.atf-field select {
  padding: 10px 12px;
  border: 1px solid #e8e4dc;
  border-radius: 8px;
  font-size: 14px;
  background: #fff;
}
.atf-field input:focus,
.atf-field select:focus { outline: none; border-color: #ba7517; }
.atf-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 14px;
}
.atf-error { color: #a32d2d; font-size: 12px; margin: 0; }
.atf-toggles { display: flex; gap: 24px; flex-wrap: wrap; }
.atf-check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #444441;
  cursor: pointer;
}
.atf-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px solid #f1efe8;
}
.atf-submit {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 22px;
  background: #ba7517;
  color: #faeeda;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.atf-submit:disabled { opacity: 0.6; cursor: default; }

/* Cancel link (shared look with AdminTips buttons; duplicated because this
   page imports only its own stylesheet) */
.at-btn-secondary {
  padding: 8px 16px;
  border: 1px solid #e8e4dc;
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
  text-decoration: none;
  color: #444441;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
}
```

- [ ] **Step 3: Add routes in main.jsx**

(a) Import after `AdminTips`:

```jsx
import AdminTipForm from "./Pages/Admin/Tips/AdminTipForm";
```

(b) Child routes after the `tips` entry:

```jsx
      {
        path: "tips/new",
        element: <AdminTipForm />,
      },
      {
        path: "tips/edit/:id",
        element: <AdminTipForm />,
      },
```

- [ ] **Step 4: Manual verification**

- `/admin/tips/new`: create a tip with rich formatting (heading + list), leave unpublished → appears in admin list as Draft, NOT on the public page
- Toggle it published → appears on `/pet-care-tips`
- Edit the draft seed tip: body loads in the editor, save persists, readTime recalculates

- [ ] **Step 5: Commit (inside `frontend/`)**

```bash
cd frontend
git add src/Pages/Admin/Tips/AdminTipForm.jsx src/Pages/Admin/Tips/AdminTipForm.css src/main.jsx
git commit -m "feat: admin tip create/edit form with rich text editor"
```

---

### Task 16: Admin — AdminAdverts page

**Files:**
- Create: `frontend/src/Pages/Admin/Adverts/AdminAdverts.jsx`
- Create: `frontend/src/Pages/Admin/Adverts/AdminAdverts.css`
- Modify: `frontend/src/main.jsx`

- [ ] **Step 1: Write AdminAdverts.jsx**

```jsx
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiPlus, FiSave } from "react-icons/fi";
import DataTable from "../../../Components/Admin/DataTable/DataTable";
import advertsApi from "../../../Services/api/advertsApi";
import { useToast } from "../../../context/ToastContext";
import "./AdminAdverts.css";

const EMPTY_FORM = { title: "", image: "", link: "", placement: "banner", active: true };

const AdminAdverts = () => {
  const [adverts, setAdverts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // advert being edited, or null = create
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  useEffect(() => { fetchAdverts(); }, []);

  const fetchAdverts = async () => {
    try {
      setLoading(true);
      const response = await advertsApi.getAdvertsAdmin();
      setAdverts(response.data || []);
    } catch {
      addToast("Failed to fetch adverts", "error");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (advert) => {
    setEditing(advert);
    setForm({
      title: advert.title,
      image: advert.image || "",
      link: advert.link,
      placement: advert.placement,
      active: advert.active,
    });
    setModalOpen(true);
  };

  const set = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (form.title.trim().length < 2 || !form.link.trim()) {
      addToast("Title and link are required", "error");
      return;
    }
    try {
      setSaving(true);
      if (editing) {
        await advertsApi.updateAdvert(editing._id, form);
        addToast("Advert updated", "success");
      } else {
        await advertsApi.createAdvert(form);
        addToast("Advert created", "success");
      }
      setModalOpen(false);
      fetchAdverts();
    } catch (err) {
      addToast(err?.response?.data?.message || "Failed to save advert", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (advert) => {
    try {
      await advertsApi.updateAdvert(advert._id, { active: !advert.active });
      addToast("Advert updated", "success");
      fetchAdverts();
    } catch {
      addToast("Failed to update advert", "error");
    }
  };

  const handleDelete = async (advert) => {
    if (!window.confirm(`Delete advert "${advert.title}"?`)) return;
    try {
      await advertsApi.deleteAdvert(advert._id);
      addToast("Advert deleted", "success");
      fetchAdverts();
    } catch {
      addToast("Failed to delete advert", "error");
    }
  };

  const columns = [
    {
      header: "Title",
      accessor: "title",
      render: (value) => <span className="aa-title">{value}</span>,
    },
    {
      header: "Placement",
      accessor: "placement",
      render: (value) => (
        <span className={`aa-placement ${value}`}>
          {value === "banner" ? "Banner" : "Sponsored card"}
        </span>
      ),
    },
    {
      header: "Link",
      accessor: "link",
      sortable: false,
      render: (value) => <span className="aa-link">{value}</span>,
    },
    {
      header: "Active",
      accessor: "active",
      render: (value, item) => (
        <button
          className={`aa-status ${value ? "on" : "off"}`}
          onClick={(e) => { e.stopPropagation(); toggleActive(item); }}
          title="Click to toggle"
        >
          {value ? "Active" : "Inactive"}
        </button>
      ),
    },
    {
      header: "Created",
      accessor: "createdAt",
      render: (value) => (value ? new Date(value).toLocaleDateString() : "—"),
    },
  ];

  return (
    <motion.div
      className="admin-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Adverts</h1>
          <p className="admin-page-subtitle">Banner and sponsored placements on the tips page</p>
        </div>
        <button className="add-button" onClick={openCreate}>
          <FiPlus />
          New Advert
        </button>
      </div>

      <DataTable
        data={adverts}
        columns={columns}
        loading={loading}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            className="admin-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModalOpen(false)}
          >
            <motion.form
              className="admin-modal aa-modal"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSave}
            >
              <h3>{editing ? "Edit advert" : "New advert"}</h3>

              <div className="aa-field">
                <label htmlFor="aa-title">Title</label>
                <input id="aa-title" type="text" value={form.title} onChange={set("title")} maxLength={120} />
              </div>
              <div className="aa-field">
                <label htmlFor="aa-image">Image URL (optional)</label>
                <input id="aa-image" type="url" value={form.image} onChange={set("image")} placeholder="https://…" />
              </div>
              <div className="aa-field">
                <label htmlFor="aa-link">Link</label>
                <input id="aa-link" type="text" value={form.link} onChange={set("link")} placeholder="https://… or /petshop" />
              </div>
              <div className="aa-field">
                <label htmlFor="aa-placement">Placement</label>
                <select id="aa-placement" value={form.placement} onChange={set("placement")}>
                  <option value="banner">Banner (between sections)</option>
                  <option value="sponsored">Sponsored card (in grid)</option>
                </select>
              </div>
              <label className="aa-check">
                <input type="checkbox" checked={form.active} onChange={set("active")} />
                Active
              </label>

              <div className="admin-modal-actions">
                <button type="button" className="at-btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="aa-submit" disabled={saving}>
                  <FiSave size={14} /> {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AdminAdverts;
```

**Note on relative links:** the backend validator requires `link` to be a valid URI for *create*. Relative links like `/petshop` are seeded directly via Mongoose (bypassing Joi), but the admin form posts through the API. If the admin needs relative links from the form, loosen the Joi rule to `Joi.string().min(1)` for `link` — decide during execution and keep validator + form consistent. Default decision: **loosen to `Joi.string().min(1)`** so internal links work (update `advert.validator.js` `link` field and its test accordingly: the "rejects invalid placement" test still covers 400s).

- [ ] **Step 2: Write AdminAdverts.css**

```css
/* ── Admin adverts ─────────────────────────────────────────────────── */
.aa-title { font-weight: 600; }
.aa-link {
  font-size: 12px;
  color: #6f6e68;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
}
.aa-placement {
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 8px;
}
.aa-placement.banner { background: #e6f1fb; color: #185fa5; }
.aa-placement.sponsored { background: #faeeda; color: #633806; }
.aa-status {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 12px;
  border: none;
  cursor: pointer;
}
.aa-status.on { background: #e1f5ee; color: #0f6e56; }
.aa-status.off { background: #f1efe8; color: #5f5e5a; }
.aa-modal { max-width: 460px; display: flex; flex-direction: column; gap: 14px; }
.aa-field { display: flex; flex-direction: column; gap: 5px; }
.aa-field label { font-size: 13px; font-weight: 600; color: #444441; }
.aa-field input,
.aa-field select {
  padding: 9px 12px;
  border: 1px solid #e8e4dc;
  border-radius: 8px;
  font-size: 14px;
}
.aa-check { display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer; }
.aa-submit {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  background: #ba7517;
  color: #faeeda;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
.aa-submit:disabled { opacity: 0.6; }

/* Shared modal styles — duplicated from AdminTips.css because this page
   imports only its own stylesheet (classes used by the modal markup above) */
.admin-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.admin-modal {
  background: #fff;
  border-radius: 12px;
  padding: 24px 28px;
  width: 90%;
}
.admin-modal h3 { margin: 0 0 8px; }
.admin-modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
.at-btn-secondary {
  padding: 8px 16px;
  border: 1px solid #e8e4dc;
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
  text-decoration: none;
  color: #444441;
  font-size: 14px;
}
```

- [ ] **Step 3: Update advert validator for relative links (backend)**

In `backend/src/validators/advert.validator.js`, change the `link` base field to allow internal paths:

```js
  link: Joi.string().min(1).trim().messages({
    'string.empty': 'Advert link is required',
  }),
```

Run (from `backend/`): `npm test -- tests/adverts.controller.test.js`
Expected: PASS.

Commit (inside `backend/`):

```bash
cd backend
git add src/validators/advert.validator.js
git commit -m "fix: allow relative internal links in advert validator"
```

- [ ] **Step 4: Add admin route in main.jsx**

(a) Import after `AdminTipForm`:

```jsx
import AdminAdverts from "./Pages/Admin/Adverts/AdminAdverts";
```

(b) Child route after the `tips/edit/:id` entry:

```jsx
      {
        path: "adverts",
        element: <AdminAdverts />,
      },
```

- [ ] **Step 5: Manual verification**

`/admin/adverts`:
- Table lists 4 seeded adverts; inactive one shows "Inactive"
- Create a sponsored advert with link `/petshop` → saves, appears on the public tips grid
- Toggle active off → disappears from public page on refresh

- [ ] **Step 6: Commit (inside `frontend/`)**

```bash
cd frontend
git add src/Pages/Admin/Adverts/AdminAdverts.jsx src/Pages/Admin/Adverts/AdminAdverts.css src/main.jsx
git commit -m "feat: admin adverts management with placement and active toggles"
```

---

### Task 17: Final verification + graph update

- [ ] **Step 1: Full backend suite**

Run (from `backend/`): `npm test`
Expected: ALL suites pass (existing + tips + adverts).

- [ ] **Step 2: Frontend tests + build**

Run (from `frontend/`):
```bash
npm test
npm run build
```
Expected: tests pass, build succeeds with no errors.

- [ ] **Step 3: End-to-end smoke pass**

With both apps running and the database seeded:
1. `/pet-care-tips` — featured (3), banner ad, grid (11 published), search "golden" → 1 result
2. Click through to detail — body renders, related tips show, sidebar ad shows
3. `/admin/tips` — 12 rows; toggle draft → published; verify it appears publicly
4. `/admin/adverts` — toggle an ad inactive; verify it disappears publicly
5. Non-admin user cannot open `/admin/tips` (RoleBasedRoute blocks)

- [ ] **Step 4: Update the knowledge graph (parent repo)**

Run (from the parent `Pet Project/` directory): `graphify update .`
(AST-only, no API cost — keeps `graphify-out/graph.json` current with the new files.)

- [ ] **Step 5: Commit docs (parent repo)**

```bash
git add docs/superpowers/specs/2026-06-11-pet-care-tips-design.md docs/superpowers/plans/2026-06-11-pet-care-tips.md graphify-out/
git commit -m "docs: pet care tips spec + implementation plan; graph update"
```

---

## Execution Tracking

| Task | Description | Repo | Status |
|---|---|---|---|
| 1 | Failing tips API tests | backend | ⬜ Pending |
| 2 | PetCareTip model | backend | ⬜ Pending |
| 3 | Tip validator | backend | ⬜ Pending |
| 4 | Tip controller | backend | ⬜ Pending |
| 5 | Tip routes + app.js → green + commit | backend | ⬜ Pending |
| 6 | Failing adverts API tests | backend | ⬜ Pending |
| 7 | Advert model/validator/controller/routes → green | backend | ⬜ Pending |
| 8 | Seed script | backend | ⬜ Pending |
| 9 | API services + theme constants | frontend | ⬜ Pending |
| 10 | TipCard + test | frontend | ⬜ Pending |
| 11 | Listing building blocks | frontend | ⬜ Pending |
| 12 | Listing page + routes + nav | frontend | ⬜ Pending |
| 13 | Tip detail page | frontend | ⬜ Pending |
| 14 | Admin tips list + sidebar | frontend | ⬜ Pending |
| 15 | Admin tip form | frontend | ⬜ Pending |
| 16 | Admin adverts | frontend + backend validator fix | ⬜ Pending |
| 17 | Final verification + graph update | both + parent | ⬜ Pending |
