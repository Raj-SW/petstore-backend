# Merge Google Reviews into Feedback (A′) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store Google reviews in the same `feedback` collection as organic feedback, tagged by `source`, so the homepage shows one merged admin-curated set and the strip count comes from the DB.

**Architecture:** Backend adds a `source` field, an admin-create endpoint, a public stats endpoint, and an idempotent seed. Frontend points `StatsSection` (wall) and `TrustStrip` (count) at the DB and retires the curated `googleReviews.js`. Admin gets an "Add review" form. Existing approve/edit/delete moderation is reused unchanged.

**Tech Stack:** Backend — Node/Express, Mongoose, Jest 29 (unit co-located `src/**/*.test.js`; integration `tests/integration/**` with supertest + mongodb-memory-server). Frontend — React/Vite, vitest 4, framer-motion.

**Repos & branches:**
- Backend: repo `backend`, branch `feat/merge-google-reviews` (already created; spec committed).
- Frontend: repo `frontend`, create branch `feat/merge-google-reviews` from `main` (Group A already merged to main).
- Each task is tagged **[BE]** or **[FE]**. Do BE tasks first (API must exist before FE consumes it).

## Global Constraints

- `source` enum is exactly `['organic','google']`, default `'organic'`. The frontend "via Google" badge and count key off the lowercase string `'google'`.
- The public feedback validator uses Joi `stripUnknown: true` — a field not in the schema is silently dropped. The admin-create path MUST use a validator that explicitly allows `source`, or it will never persist.
- Admin-created reviews are `approved: true` (trusted); public submissions stay `approved: false`.
- Never fabricate reviews. The seed data is the 20 real reviews already curated in the (soon-deleted) frontend `googleReviews.js`, copied verbatim.
- Backend single-file test: `npx cross-env NODE_ENV=test jest <path> --runInBand --forceExit`. Frontend single-file test: `npx vitest run <path>`.
- Windows/git: the frontend source dir is physically `src/Pages/...` (capital P) and the checkout is case-sensitive for tracked paths — `git add` with real casing and confirm `git status` before commit.

---

### Task 1 [BE]: `source` field on the feedback model

**Files:**
- Modify: `src/models/feedback.model.js`
- Test: `src/models/feedback.model.test.js` (extend)

**Interfaces:**
- Produces: `Feedback` docs carry `source: 'organic' | 'google'` (default `'organic'`).

- [ ] **Step 1: Add failing test**

Append to `src/models/feedback.model.test.js`:
```js
it("defaults source to organic and accepts google", () => {
  const fb = new Feedback({ name: "Amy", rating: 5, message: "Lovely place" });
  expect(fb.source).toBe("organic");
  const g = new Feedback({ name: "Amy", rating: 5, message: "Lovely place", source: "google" });
  expect(g.validateSync()).toBeUndefined();
  expect(g.source).toBe("google");
});

it("rejects an unknown source", () => {
  const e = new Feedback({ name: "Amy", rating: 5, message: "Lovely place", source: "yelp" }).validateSync();
  expect(e.errors.source).toBeDefined();
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx cross-env NODE_ENV=test jest src/models/feedback.model.test.js --runInBand --forceExit`
Expected: FAIL (source undefined / no enum validation).

- [ ] **Step 3: Add the field**

In `src/models/feedback.model.js`, add inside the schema (after `photos`, before `approved`):
```js
    source: {
      type: String,
      enum: ['organic', 'google'],
      default: 'organic',
      index: true,
    },
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx cross-env NODE_ENV=test jest src/models/feedback.model.test.js --runInBand --forceExit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/models/feedback.model.js src/models/feedback.model.test.js
git commit -m "feat(feedback): add source field (organic|google)"
```

---

### Task 2 [BE]: Admin-create validator (allows `source`)

**Files:**
- Modify: `src/validators/feedback.validator.js`
- Test: `src/validators/feedback.validator.test.js` (extend)

**Interfaces:**
- Produces: `validateFeedbackAdmin` middleware — validates `{ name, role?, rating, message, source? }`, defaults `source` to `'google'`, leaves `req.body` with `source` present.

- [ ] **Step 1: Add failing test**

Check the existing test file for how it invokes middleware (it builds a fake `req`/`res`/`next`). Mirror that. Add:
```js
const { validateFeedbackAdmin } = require("./feedback.validator");

describe("validateFeedbackAdmin", () => {
  const run = (body) => {
    const req = { body };
    let err; const next = (e) => { err = e; };
    validateFeedbackAdmin(req, {}, next);
    return { req, err };
  };

  it("defaults source to google and keeps it on the body", () => {
    const { req, err } = run({ name: "Nal", rating: 5, message: "Great place, helpful staff" });
    expect(err).toBeUndefined();
    expect(req.body.source).toBe("google");
  });

  it("accepts an explicit organic source", () => {
    const { req, err } = run({ name: "Nal", rating: 5, message: "Great place, helpful staff", source: "organic" });
    expect(err).toBeUndefined();
    expect(req.body.source).toBe("organic");
  });

  it("rejects an invalid source", () => {
    const { err } = run({ name: "Nal", rating: 5, message: "Great place, helpful staff", source: "yelp" });
    expect(err).toBeDefined();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx cross-env NODE_ENV=test jest src/validators/feedback.validator.test.js --runInBand --forceExit`
Expected: FAIL (`validateFeedbackAdmin` undefined).

- [ ] **Step 3: Implement**

In `src/validators/feedback.validator.js`, add before `module.exports`:
```js
const validateFeedbackAdmin = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(80).trim().required().messages({
      'string.min': 'Name must be at least 2 characters',
      'any.required': 'Name is required',
    }),
    role: Joi.string().max(80).trim().allow(''),
    rating: Joi.number().min(1).max(5).required().messages({
      'number.base': 'Rating is required',
      'number.min': 'Rating must be between 1 and 5',
      'number.max': 'Rating must be between 1 and 5',
    }),
    message: Joi.string().min(5).max(1000).trim().required().messages({
      'string.min': 'Message must be at least 5 characters',
      'any.required': 'Message is required',
    }),
    source: Joi.string().valid('organic', 'google').default('google'),
  });
  const { error, value } = schema.validate(req.body, { stripUnknown: true });
  if (error) return next(new AppError(error.details[0].message, 400));
  req.body = value;
  next();
};
```
And update the exports line:
```js
module.exports = { validateFeedback, validateFeedbackAdmin };
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx cross-env NODE_ENV=test jest src/validators/feedback.validator.test.js --runInBand --forceExit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/validators/feedback.validator.js src/validators/feedback.validator.test.js
git commit -m "feat(feedback): admin-create validator allowing source"
```

---

### Task 3 [BE]: Admin-create endpoint

**Files:**
- Modify: `src/controllers/feedback.controller.js`
- Modify: `src/routes/feedback.routes.js`
- Test: `tests/integration/feedback/feedback.controller.test.js` (extend)

**Interfaces:**
- Consumes: `validateFeedbackAdmin` (Task 2), `source` field (Task 1).
- Produces: `POST /api/feedback/admin` (admin) → creates `{ ...body, approved: true }`, returns `201 { success, data }`.

- [ ] **Step 1: Add failing integration test**

In `tests/integration/feedback/feedback.controller.test.js`, add a describe block (reuse the file's `adminToken`/`customerToken` from `beforeEach`):
```js
describe("POST /api/feedback/admin", () => {
  it("admin creates an approved google review by default", async () => {
    const res = await request(app)
      .post("/api/feedback/admin")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Nal Raj", rating: 5, message: "Great place, very helpful staff" });
    expect(res.status).toBe(201);
    expect(res.body.data.approved).toBe(true);
    expect(res.body.data.source).toBe("google");
  });

  it("rejects a non-admin (403)", async () => {
    const res = await request(app)
      .post("/api/feedback/admin")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ name: "Nal Raj", rating: 5, message: "Great place, very helpful staff" });
    expect(res.status).toBe(403);
  });

  it("rejects invalid payload (400)", async () => {
    const res = await request(app)
      .post("/api/feedback/admin")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "N", rating: 9, message: "x" });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx cross-env NODE_ENV=test jest tests/integration/feedback/feedback.controller.test.js --runInBand --forceExit`
Expected: FAIL (404 — route not defined).

- [ ] **Step 3: Implement controller**

In `src/controllers/feedback.controller.js`, add after `submitFeedback`:
```js
// POST /api/feedback/admin — admin creates an approved review (e.g. a Google review)
exports.createFeedbackAdmin = async (req, res, next) => {
  try {
    const feedback = await Feedback.create({ ...req.body, approved: true });
    logger.info('Admin feedback created', { feedbackId: feedback._id, source: feedback.source });
    return res.status(201).json({ success: true, data: feedback });
  } catch (error) {
    return next(error);
  }
};
```

- [ ] **Step 4: Wire the route**

In `src/routes/feedback.routes.js`: import `validateFeedbackAdmin` and `createFeedbackAdmin`, then add under the Admin section:
```js
router.post('/admin', isAuthenticated, isAdmin, validateFeedbackAdmin, createFeedbackAdmin);
```
Update the two destructured imports accordingly (`validateFeedbackAdmin` from the validator, `createFeedbackAdmin` from the controller).

- [ ] **Step 5: Run — expect PASS**

Run: `npx cross-env NODE_ENV=test jest tests/integration/feedback/feedback.controller.test.js --runInBand --forceExit`
Expected: PASS (all, including new).

- [ ] **Step 6: Commit**

```bash
git add src/controllers/feedback.controller.js src/routes/feedback.routes.js tests/integration/feedback/feedback.controller.test.js
git commit -m "feat(feedback): admin-create endpoint POST /feedback/admin"
```

---

### Task 4 [BE]: Public stats endpoint

**Files:**
- Modify: `src/controllers/feedback.controller.js`
- Modify: `src/routes/feedback.routes.js`
- Test: `tests/integration/feedback/feedback.controller.test.js` (extend)

**Interfaces:**
- Produces: `GET /api/feedback/stats` (public) → `200 { success, data: { googleApproved: number, avgRating: number|null } }`. `googleApproved` counts `{ source:'google', approved:true }`. `avgRating` is the mean rating over approved docs, rounded to 1 decimal, or `null` when none.

- [ ] **Step 1: Add failing integration test**

```js
describe("GET /api/feedback/stats", () => {
  it("counts approved google reviews and averages approved ratings", async () => {
    await Feedback.create({ name: "G One", rating: 5, message: "Great google review here", source: "google", approved: true });
    await Feedback.create({ name: "G Two", rating: 4, message: "Another google review here", source: "google", approved: true });
    await Feedback.create({ name: "Pending", rating: 1, message: "Not approved yet please", source: "google", approved: false });
    await Feedback.create({ name: "Organic", rating: 5, message: "Organic approved feedback", source: "organic", approved: true });
    const res = await request(app).get("/api/feedback/stats");
    expect(res.status).toBe(200);
    expect(res.body.data.googleApproved).toBe(2);
    // approved ratings: 5, 4, 5 -> 4.7 (pending excluded)
    expect(res.body.data.avgRating).toBeCloseTo(4.7, 1);
  });

  it("returns null avgRating when there are no approved reviews", async () => {
    const res = await request(app).get("/api/feedback/stats");
    expect(res.status).toBe(200);
    expect(res.body.data.googleApproved).toBe(0);
    expect(res.body.data.avgRating).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx cross-env NODE_ENV=test jest tests/integration/feedback/feedback.controller.test.js --runInBand --forceExit`
Expected: FAIL (404).

- [ ] **Step 3: Implement controller**

Add to `src/controllers/feedback.controller.js`:
```js
// GET /api/feedback/stats — public counts for the homepage strip
exports.getFeedbackStats = async (req, res, next) => {
  try {
    const [googleApproved, ratingAgg] = await Promise.all([
      Feedback.countDocuments({ source: 'google', approved: true }),
      Feedback.aggregate([
        { $match: { approved: true } },
        { $group: { _id: null, avg: { $avg: '$rating' } } },
      ]),
    ]);
    const avgRating = ratingAgg.length
      ? Math.round(ratingAgg[0].avg * 10) / 10
      : null;
    return res.status(200).json({ success: true, data: { googleApproved, avgRating } });
  } catch (error) {
    return next(error);
  }
};
```

- [ ] **Step 4: Wire the route (BEFORE the `/:id` routes)**

In `src/routes/feedback.routes.js`, add under Public, and place it above any `/:id` route so `stats` is not captured as an id:
```js
router.get('/stats', getFeedbackStats);
```
Add `getFeedbackStats` to the controller import.

- [ ] **Step 5: Run — expect PASS**

Run: `npx cross-env NODE_ENV=test jest tests/integration/feedback/feedback.controller.test.js --runInBand --forceExit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/controllers/feedback.controller.js src/routes/feedback.routes.js tests/integration/feedback/feedback.controller.test.js
git commit -m "feat(feedback): public GET /feedback/stats (google count + avg rating)"
```

---

### Task 5 [BE]: Seed data + idempotent seed function

**Files:**
- Create: `src/data/googleReviews.seed.js`
- Create: `scripts/seedGoogleReviews.js`
- Test: `tests/integration/feedback/seedGoogleReviews.test.js`

**Interfaces:**
- `src/data/googleReviews.seed.js` exports `GOOGLE_REVIEWS_SEED: Array<{ name, rating, message }>` and `TEST_ENTRY_NAMES: string[]`.
- `scripts/seedGoogleReviews.js` exports `async function seedGoogleReviews(FeedbackModel)` → `{ inserted, skipped, removed }`, and self-runs when executed directly.

- [ ] **Step 1: Create the seed data file**

`src/data/googleReviews.seed.js`:
```js
// Real Google reviews for VitalPaws, copied verbatim from
// https://share.google/hthxT0N5smL9uGAba (truncated "…More" ones trimmed to
// their last complete sentence). Do not invent or embellish.
const GOOGLE_REVIEWS_SEED = [
  { name: "Nal Raj Sharma Seetohul", rating: 5, message: "Great place. They've just opened. The staff are very helpful." },
  { name: "Altaaf Auleear", rating: 5, message: "Excellent service from the team at VitalPaws Veterinary Clinic. The vet was friendly, professional, and took great care of my dog. The consultation was thorough, and everything was explained clearly." },
  { name: "Parwez Ahmad", rating: 5, message: "I had an excellent experience at VitalPaws Veterinary Clinic. The veterinarian was professional, knowledgeable, and genuinely cared about my dog's health. The consultation was thorough, and everything was explained clearly." },
  { name: "Mohammad Juneid Abdur-Rahman", rating: 5, message: "Amazing service. Took both of my cats there. Very professional and friendly. They make you feel at ease and explain you clearly. Would highly recommend." },
  { name: "Jeson Bégué", rating: 5, message: "Excellent veterinary clinic! The staff is incredibly professional, caring, and welcoming. The facility is very clean. Highly recommended for anyone looking for top-notch care for their pets!" },
  { name: "Yushnamudhoo 19", rating: 5, message: "Amazing care from the team at VitalPaws Veterinary Clinic. My pet was vomiting foam and bile, had a hard stomach, a fever, and black stools. They treated him quickly and with so much compassion." },
  { name: "Aftab Alam", rating: 5, message: "Amazing care for my dog! I took my dog to this clinic and had a really positive experience. The vets and staff were friendly, patient, and explained everything clearly." },
  { name: "Zuhair Moedine", rating: 5, message: "I brought my cat to VitalPaws Veterinary Clinic, and I couldn't be happier with the care we received. The vet was gentle, patient, and handled my cat with so much kindness, which made the whole visit stress-free." },
  { name: "Zakee Khameery", rating: 5, message: "I contacted VitalPaws Veterinary Clinic for help with exporting my two cats." },
  { name: "Rajnat Mansi", rating: 5, message: "Great veterinary clinic with friendly staff and excellent care for pets." },
  { name: "Viren Tharnvithian", rating: 5, message: "Had a very good experience. Staffs are friendly and they explain things clearly." },
  { name: "Ayush R", rating: 5, message: "Reasonable price. Excellent service." },
  { name: "Utashna Seegoolam", rating: 5, message: "Highly recommended. Friendly and generous services. They came to my place on a Sunday to treat my dog. Am so grateful to them. Thank you a lot. My mom really appreciate your services. Thank you." },
  { name: "Cathryn Gush", rating: 5, message: "Dr Karina is a wonderful combination of professionalism and empathy. We felt confident that our dogs were getting the best care." },
  { name: "Hassan Hossen", rating: 5, message: "Extremely reliable. Punctual also. Hasnat has been very helpful and also compared to any other veterinary clinic, VitalPaws's services are a lot better and cheaper as well as efficient!" },
  { name: "Goshima Rajnat", rating: 5, message: "Very good service.. Highly recommended 👍" },
  { name: "Poniah Pankaj Kumar", rating: 5, message: "Very good job they take a good care of my puppy 🐶 thank you very much." },
  { name: "Mookshma Goburdhun", rating: 5, message: "A heartfelt thank you to Dr Rajnat for exceptional care given of my cat during his critical time." },
  { name: "Arfa Soydan", rating: 5, message: "Great service. My cats were well taken care of. Dr Rajnat is very gentle and professional. Highly recommended." },
  { name: "Suf Yaan", rating: 5, message: "Cosy place. Helpful staffs." },
];

// Known seeded/test junk to remove from the collection.
const TEST_ENTRY_NAMES = ["TestUser", "Moisa"];

module.exports = { GOOGLE_REVIEWS_SEED, TEST_ENTRY_NAMES };
```

- [ ] **Step 2: Write the failing seed test**

`tests/integration/feedback/seedGoogleReviews.test.js`:
```js
const Feedback = require("../../../src/models/feedback.model");
const { seedGoogleReviews } = require("../../../scripts/seedGoogleReviews");
const { GOOGLE_REVIEWS_SEED } = require("../../../src/data/googleReviews.seed");

describe("seedGoogleReviews", () => {
  it("inserts all reviews as approved google source, and is idempotent", async () => {
    const first = await seedGoogleReviews(Feedback);
    expect(first.inserted).toBe(GOOGLE_REVIEWS_SEED.length);
    const count = await Feedback.countDocuments({ source: "google", approved: true });
    expect(count).toBe(GOOGLE_REVIEWS_SEED.length);

    const second = await seedGoogleReviews(Feedback);
    expect(second.inserted).toBe(0);
    expect(second.skipped).toBe(GOOGLE_REVIEWS_SEED.length);
    expect(await Feedback.countDocuments({ source: "google" })).toBe(GOOGLE_REVIEWS_SEED.length);
  });

  it("removes known test entries", async () => {
    await Feedback.create({ name: "TestUser", rating: 5, message: "test entry to remove", approved: true });
    await Feedback.create({ name: "Moisa", rating: 5, message: "another test entry here", approved: true });
    const res = await seedGoogleReviews(Feedback);
    expect(res.removed).toBe(2);
    expect(await Feedback.countDocuments({ name: { $in: ["TestUser", "Moisa"] } })).toBe(0);
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

Run: `npx cross-env NODE_ENV=test jest tests/integration/feedback/seedGoogleReviews.test.js --runInBand --forceExit`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement the seed**

`scripts/seedGoogleReviews.js` (mirror `src/config/seedDatabase.js` for the self-run connect):
```js
const mongoose = require('mongoose');
const { GOOGLE_REVIEWS_SEED, TEST_ENTRY_NAMES } = require('../src/data/googleReviews.seed');

// Idempotent: skip a review already present (same name + message + google source).
async function seedGoogleReviews(FeedbackModel) {
  let inserted = 0;
  let skipped = 0;
  for (const r of GOOGLE_REVIEWS_SEED) {
    const exists = await FeedbackModel.findOne({ source: 'google', name: r.name, message: r.message });
    if (exists) { skipped += 1; continue; }
    await FeedbackModel.create({ ...r, source: 'google', approved: true });
    inserted += 1;
  }
  const del = await FeedbackModel.deleteMany({ name: { $in: TEST_ENTRY_NAMES } });
  return { inserted, skipped, removed: del.deletedCount || 0 };
}

module.exports = { seedGoogleReviews };

// Self-run: `node scripts/seedGoogleReviews.js`
if (require.main === module) {
  (async () => {
    const Feedback = require('../src/models/feedback.model');
    await mongoose.connect(process.env.MONGODB_URI);
    const res = await seedGoogleReviews(Feedback);
    // eslint-disable-next-line no-console
    console.log('Seed complete:', res);
    await mongoose.connection.close();
    process.exit(0);
  })().catch((e) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', e);
    process.exit(1);
  });
}
```

- [ ] **Step 5: Run — expect PASS**

Run: `npx cross-env NODE_ENV=test jest tests/integration/feedback/seedGoogleReviews.test.js --runInBand --forceExit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/googleReviews.seed.js scripts/seedGoogleReviews.js tests/integration/feedback/seedGoogleReviews.test.js
git commit -m "feat(feedback): idempotent Google reviews seed + test-entry cleanup"
```

> After merge/deploy, run once against the real DB: `node scripts/seedGoogleReviews.js` (removes TestUser/Moisa, inserts the 20 reviews). This is a manual ops step, not part of the test suite.

---

### Task 6 [FE]: feedbackApi — admin create + stats

**Files:**
- Modify: `src/Services/api/feedbackApi.js`
- Test: `src/Services/api/feedbackApi.test.js` (extend, mirror existing style)

**Interfaces:**
- Produces: `feedbackApi.createFeedbackAdmin(data)` → `POST /feedback/admin`; `feedbackApi.getStats()` → `GET /feedback/stats`, returns `response.data`.

**Do this task on a NEW frontend branch:** `git checkout main && git pull --ff-only && git checkout -b feat/merge-google-reviews` (in the frontend repo).

- [ ] **Step 1: Add failing tests**

Read `src/Services/api/feedbackApi.test.js` to match how it mocks the `api` client. Add tests asserting `createFeedbackAdmin` POSTs to `/feedback/admin` with the payload, and `getStats` GETs `/feedback/stats` and returns the body. Use the file's existing mock pattern.

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/Services/api/feedbackApi.test.js`
Expected: FAIL (methods undefined).

- [ ] **Step 3: Implement**

In `src/Services/api/feedbackApi.js`, add to the object (mirror existing methods):
```js
  // Admin: create an approved review directly (e.g. a Google review)
  createFeedbackAdmin: async (data) => {
    const response = await api.post("/feedback/admin", data);
    return response.data;
  },

  // Public: homepage counts (google review count + avg rating)
  getStats: async () => {
    const response = await api.get("/feedback/stats");
    return response.data;
  },
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/Services/api/feedbackApi.test.js`

- [ ] **Step 5: Commit**

```bash
git add src/Services/api/feedbackApi.js src/Services/api/feedbackApi.test.js
git commit -m "feat(feedback): api client createFeedbackAdmin + getStats"
```

---

### Task 7 [FE]: StatsSection — badge from DB source, drop curated list

**Files:**
- Modify: `src/Pages/HomePage/HomePageSections/StatsSection.jsx`
- Modify: `src/Pages/HomePage/HomePageSections/StatsSection.test.jsx`

**Interfaces:**
- Consumes: `GET /feedback` items now include `source`.

- [ ] **Step 1: Update the test**

In `StatsSection.test.jsx`: remove the `vi.mock("./googleReviews", …)` block. Change the "via Google" test so the mocked `feedbackApi.getFeedback` resolves an item carrying `source: "google"`, then assert both the message and `via Google` render:
```js
it("badges a google-source review", async () => {
  feedbackApi.getFeedback.mockResolvedValue({ data: [
    { _id: "g1", name: "Nal Raj", rating: 5, message: "Great place, very helpful.", source: "google" },
  ] });
  render(<StatsSection />);
  expect(await screen.findByText(/Great place, very helpful/i)).toBeInTheDocument();
  expect(screen.getByText(/via Google/i)).toBeInTheDocument();
});
```
Keep the existing feedback-based tests (Amina/Kevin/Priya) unchanged — they still exercise the wall.

- [ ] **Step 2: Run — expect FAIL** (the old `./googleReviews` mock removal + new assertion)

Run: `npx vitest run src/Pages/HomePage/HomePageSections/StatsSection.test.jsx`

- [ ] **Step 3: Edit StatsSection.jsx**

- Remove `import { GOOGLE_REVIEWS } from "./googleReviews";`.
- Revert the testimonials initial state to the generic fallback:
```js
  const [testimonials, setTestimonials] = useState(TESTIMONIALS);
```
- In the `feedbackApi` `.then` mapping, add `source` passthrough:
```js
              source: fb.source,
```
(add it as a field alongside `author`, `text`, `rating`, `photos`).
- Change the badge condition from `=== "Google"` to lowercase:
```js
  {featured?.source === "google" && (
    <span className="ts-source" aria-label="Review from Google">via Google</span>
  )}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/Pages/HomePage/HomePageSections/StatsSection.test.jsx`

- [ ] **Step 5: Commit**

```bash
git add src/Pages/HomePage/HomePageSections/StatsSection.jsx src/Pages/HomePage/HomePageSections/StatsSection.test.jsx
git commit -m "feat(home): testimonials wall badges google reviews from the DB"
```

---

### Task 8 [FE]: TrustStrip — live count from the API, delete curated list

**Files:**
- Modify: `src/Pages/HomePage/HomePageSections/TrustStrip/TrustStrip.jsx`
- Modify: `src/Pages/HomePage/HomePageSections/TrustStrip/TrustStrip.test.jsx`
- Delete: `src/Pages/HomePage/HomePageSections/googleReviews.js`, `googleReviews.test.js`

**Interfaces:**
- Consumes: `feedbackApi.getStats()` (Task 6).

- [ ] **Step 1: Update the test**

Rewrite `TrustStrip.test.jsx` to mock `feedbackApi`:
```js
vi.mock("../../../../Services/api/feedbackApi", () => ({
  default: { getStats: vi.fn() },
}));
import feedbackApi from "../../../../Services/api/feedbackApi";
```
(Confirm the relative depth to `Services/api/feedbackApi` from the TrustStrip folder and adjust the `../` count.) Keep the reduced-motion render test, but drive the count via the mock:
```js
it("shows the live google review count from the API", async () => {
  feedbackApi.getStats.mockResolvedValue({ data: { googleApproved: 20, avgRating: 5 } });
  stubReducedMotion();
  render(<TrustStrip />);
  expect(await screen.findAllByText(/20\+/)).not.toHaveLength(0);
  expect(screen.getByText(/Licensed Veterinarian/i)).toBeInTheDocument();
});

it("still renders labels when the stats call fails", async () => {
  feedbackApi.getStats.mockRejectedValue(new Error("boom"));
  stubReducedMotion();
  render(<TrustStrip />);
  expect(await screen.findByText(/Happy Pets Treated/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/Pages/HomePage/HomePageSections/TrustStrip/TrustStrip.test.jsx`

- [ ] **Step 3: Edit TrustStrip.jsx**

- Remove `import { reviewCountLabel } from "../googleReviews";`.
- Add `import { useState, useEffect } from "react";` (already imported) and `import feedbackApi from "../../../../Services/api/feedbackApi";` (verify depth).
- Add state + fetch, with a fallback label so it never shows `undefined+`:
```js
  const [countLabel, setCountLabel] = useState("20+"); // fallback until stats load
  useEffect(() => {
    let active = true;
    feedbackApi.getStats()
      .then((res) => {
        const n = res?.data?.googleApproved;
        if (active && Number.isFinite(n) && n > 0) setCountLabel(`${n}+`);
      })
      .catch(() => { /* keep fallback */ });
    return () => { active = false; };
  }, []);
```
- Replace the two `reviewCountLabel()` usages in the `TRUST` and `STATS` arrays with `countLabel`. Because `TRUST`/`STATS` are currently module-level constants that call `reviewCountLabel()`, move them INSIDE the component (or build them from `countLabel` in render) so they use the state value. Keep `TrustFace`/`StatsFace` receiving the arrays (pass as props or define inline in the component).

- [ ] **Step 4: Delete the retired curated files**

```bash
git rm src/Pages/HomePage/HomePageSections/googleReviews.js src/Pages/HomePage/HomePageSections/googleReviews.test.js
```
Then confirm nothing imports them: search `googleReviews` under `src` — expect no matches outside this deletion.

- [ ] **Step 5: Run — expect PASS**

Run: `npx vitest run src/Pages/HomePage/HomePageSections/TrustStrip/TrustStrip.test.jsx`
Then the whole homepage group: `npx vitest run src/pages/HomePage/`
Expected: PASS (no dangling `googleReviews` imports).

- [ ] **Step 6: Commit**

```bash
git add src/Pages/HomePage/HomePageSections/TrustStrip/ src/Pages/HomePage/HomePageSections/
git commit -m "feat(home): strip reads live google review count; retire curated list"
```

---

### Task 9 [FE]: AdminFeedback — add-review form + source badge

**Files:**
- Modify: `src/Pages/Admin/Feedback/AdminFeedback.jsx`
- Modify: `src/Pages/Admin/Feedback/AdminFeedback.css` (badge style)

**Interfaces:**
- Consumes: `feedbackApi.createFeedbackAdmin` (Task 6); rows now carry `source`.

- [ ] **Step 1: Add a source badge/column**

Read `AdminFeedback.jsx` columns. Add a column (or inline tag next to the name) rendering `item.source === "google" ? "Google" : "Organic"` as a small badge. Add a `.af-source-badge` style in the CSS (Google = blue-ish, Organic = neutral). This is presentational — verify visually in the preview.

- [ ] **Step 2: Add an "Add review" form**

Add an "Add review" button near the header that opens a modal (reuse the file's existing modal/edit pattern) with fields: name, role (optional), rating (1–5), message, source (select: Google default / Organic). On submit:
```js
await feedbackApi.createFeedbackAdmin({ name, role, rating: Number(rating), message, source });
addToast("Review added", "success");
// close modal + refetch the admin list (reuse existing fetch fn)
```
Handle the error path with `addToast(..., "error")` (mirror `toggleApproved`/delete handlers).

- [ ] **Step 3: Verify in the browser preview**

Start the frontend dev server. In the admin feedback screen: add a Google review → it appears in the list with a Google badge and is approved; the homepage "What Our Clients Say" shows it with "via Google"; the strip count reflects it. Capture a screenshot.

- [ ] **Step 4: Commit**

```bash
git add src/Pages/Admin/Feedback/AdminFeedback.jsx src/Pages/Admin/Feedback/AdminFeedback.css
git commit -m "feat(admin): add-review form + source badge in feedback management"
```

---

## Self-Review

**Spec coverage:**
- source field → Task 1 ✓
- admin create endpoint (+validator allowing source) → Tasks 2, 3 ✓
- seed script + test-entry cleanup → Task 5 ✓
- counts endpoint → Task 4 ✓
- StatsSection badge from DB + drop curated list → Task 7 ✓
- TrustStrip live count → Task 8 ✓
- retire googleReviews.js → Task 8 ✓
- AdminFeedback add-form + source badge → Task 9 ✓
- test entries "TestUser"/"Moisa" removed → Task 5 (seed) ✓

**Placeholder scan:** No TBDs. Tasks 6/9 say "read the file to match existing style" for the api-mock and modal patterns — that is following an established local pattern, with the exact new code given; not a placeholder.

**Type consistency:** `source` is the lowercase enum `'organic'|'google'` in the model (T1), validator (T2), controller create (T3), stats query (T4), seed (T5), StatsSection badge (T7). `getStats()` returns `{ data: { googleApproved, avgRating } }` in T4 (backend) and is consumed with that exact shape in T8 (`res.data.googleApproved`). `createFeedbackAdmin(data)` signature matches between T6 (api) and T9 (admin caller).

**Cross-repo ordering:** Tasks 1–5 (backend) precede 6–9 (frontend). The frontend branch is created at the start of Task 6. The one-time production seed run is called out as a manual ops step after deploy.
