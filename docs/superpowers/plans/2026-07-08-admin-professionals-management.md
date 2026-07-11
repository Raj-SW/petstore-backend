# Admin Professionals Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the admin Professionals surface — list/search/filter, create-with-invite, promote-existing, edit (incl. weekly availability + services + photo), deactivate, and offboard — backed by a dedicated `/admin/professionals` API.

**Architecture:** Approach B — a dedicated `adminProfessional.controller.js` mounted on the existing `/admin/*` router (which already applies `isAuthenticated` + `isAdmin`), delegating data work to new methods on the shared `professionalService`. Professionals remain `User` documents (`role ∈ {veterinarian, groomer, trainer, petTaxi}` + `professionalInfo`); no schema changes. Frontend adds an `AdminProfessionals` list page and an `AdminProfessionalForm`, following the `AdminUsers` / `AdminProductForm` patterns.

**Tech Stack:** Node/Express + Mongoose (backend), Jest + supertest + in-memory Mongo (backend tests), React + Vite + react-router (frontend), Vitest + Testing Library (frontend tests), Cloudinary uploads, Joi validation.

## Global Constraints

- Professionals are `User` docs with a `professionalInfo` sub-doc; **no schema changes**.
- `professionalInfo.profileImage` / `User.profileImage` shape is `{ url, publicId }`.
- Admin list roles: `ADMIN_PROFESSIONAL_ROLES = ['veterinarian', 'groomer', 'trainer', 'petTaxi']`. Public browse roles stay `['veterinarian', 'groomer', 'trainer']` (petTaxi is "coming soon" — do not change public behavior except the `isActive` fix below).
- **Never handle a raw password.** Create-invite generates a random password (auto-hashed by the model's `pre('save')` hook) and emails a set-password link using the existing `passwordResetToken` / `passwordResetExpires` fields.
- Rating is **read-only** (derived from reviews). Drop the manual rating route/handler.
- Email in integration tests is mocked: `jest.mock('../../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));`
- `sendEmail` signature: `sendEmail({ to, subject, template, data })`. Frontend URLs via `require('../config/urls').frontendUrl(path)`.
- API JSON envelope: `{ success, data, pagination? }`. Frontend API client: `import { api } from "../../core/api/apiClient"`.
- Backend unit tests are co-located (`src/**/*.test.js`) and must **not** touch the DB. Anything hitting Mongo goes in `tests/integration/**` with the shared in-memory setup.
- Cloudinary upload helper: `const { uploadToCloudinary, validateImageFile } = require('../utils/cloudinary')`; `uploadToCloudinary(file, folder)` resolves to `{ url, publicId }`.

---

## File Structure

**Backend**
- `src/validators/adminProfessionalValidator.js` — Joi schemas (create / promote / update / list-query). Pure logic → co-located unit test.
- `src/validators/adminProfessionalValidator.test.js` — unit tests (no DB).
- `src/services/professionalService.js` — add `ADMIN_PROFESSIONAL_ROLES`, `adminListProfessionals`, `createProfessionalAccount`, `promoteUserToProfessional`, `offboardProfessional`; fix public `getAllProfessionals`/`getProfessionalById` to exclude `professionalInfo.isActive: false`.
- `src/controllers/adminProfessional.controller.js` — HTTP handlers (list / create / promote / update / toggleStatus / offboard / uploadImage).
- `src/templates/professional-invite.html` — invite email body fragment (Epic 10 `_layout.html` shell).
- `src/routes/admin.routes.js` — mount the professional routes.
- `src/controllers/professionalController.js` — delete dead `createProfessional` / `deleteProfessional`.
- `src/routes/professional.routes.js` — drop the manual rating route.
- `tests/integration/professionals/professionalService.admin.test.js` — service-level integration tests (direct calls, in-memory Mongo).
- `tests/integration/professionals/adminProfessionals.test.js` — HTTP integration tests (supertest).

**Frontend**
- `src/Services/api/adminProfessionalsApi.js` — API client.
- `src/Services/api/adminProfessionalsApi.test.js` — request-shape tests.
- `src/Pages/Admin/Professionals/AdminProfessionals.jsx` (+ `.css`) — list page.
- `src/Pages/Admin/Professionals/AdminProfessionals.test.jsx` — list page test.
- `src/Pages/Admin/Professionals/AdminProfessionalForm.jsx` — create/edit/promote form.
- `src/Pages/Admin/Professionals/AdminProfessionalForm.test.jsx` — form test.
- `src/main.jsx` — register the three routes (lazy).

---

### Task 1: Backend — admin professional validators

**Files:**
- Create: `src/validators/adminProfessionalValidator.js`
- Test: `src/validators/adminProfessionalValidator.test.js`

**Interfaces:**
- Consumes: nothing (pure Joi).
- Produces: `module.exports = { createProfessionalSchema, promoteSchema, updateProfessionalInfoSchema, listQuerySchema }`. Each is a Joi schema used via the existing `validateRequest(schema, source)` middleware (`source` defaults to `'body'`, or `'query'`).
  - `PROFESSIONAL_ROLES_ENUM = ['veterinarian', 'groomer', 'trainer', 'petTaxi']`.
  - `createProfessionalSchema` (body): `{ name, email, phoneNumber, address, role, professionalInfo }`.
  - `promoteSchema` (body): `{ userId, role, professionalInfo }`.
  - `updateProfessionalInfoSchema` (body): `{ professionalInfo }` (partial).
  - `listQuerySchema` (query): `{ search?, role?, status?, page?, limit?, sortBy?, sortOrder? }`.

- [ ] **Step 1: Write the failing test**

```js
// src/validators/adminProfessionalValidator.test.js
const {
  createProfessionalSchema,
  promoteSchema,
  updateProfessionalInfoSchema,
  listQuerySchema,
} = require('./adminProfessionalValidator');

const validProfessionalInfo = {
  specialization: 'Feline surgery',
  experience: 6,
  qualifications: ['BVSc'],
  bio: 'Cats only.',
  services: [{ name: 'Checkup', price: 500, duration: 30, description: 'Routine' }],
  availability: { monday: { startTime: '09:00', endTime: '17:00', isAvailable: true } },
};

describe('createProfessionalSchema', () => {
  const base = {
    name: 'Dr Lee',
    email: 'lee@example.com',
    phoneNumber: '12345678',
    address: '1 Vet Lane',
    role: 'veterinarian',
    professionalInfo: validProfessionalInfo,
  };

  it('accepts a valid create payload', () => {
    const { error } = createProfessionalSchema.validate(base);
    expect(error).toBeUndefined();
  });

  it('rejects a non-professional role', () => {
    const { error } = createProfessionalSchema.validate({ ...base, role: 'customer' });
    expect(error).toBeDefined();
  });

  it('requires specialization and experience', () => {
    const { error } = createProfessionalSchema.validate({
      ...base,
      professionalInfo: { bio: 'x' },
    });
    expect(error).toBeDefined();
  });

  it('rejects a malformed availability time', () => {
    const { error } = createProfessionalSchema.validate({
      ...base,
      professionalInfo: {
        ...validProfessionalInfo,
        availability: { monday: { startTime: '9am', endTime: '17:00', isAvailable: true } },
      },
    });
    expect(error).toBeDefined();
  });
});

describe('promoteSchema', () => {
  it('requires a userId and professional role', () => {
    const ok = promoteSchema.validate({
      userId: '507f1f77bcf86cd799439011',
      role: 'groomer',
      professionalInfo: validProfessionalInfo,
    });
    expect(ok.error).toBeUndefined();
    const bad = promoteSchema.validate({ role: 'groomer', professionalInfo: validProfessionalInfo });
    expect(bad.error).toBeDefined();
  });
});

describe('updateProfessionalInfoSchema', () => {
  it('accepts a partial professionalInfo update', () => {
    const { error } = updateProfessionalInfoSchema.validate({ professionalInfo: { bio: 'New bio' } });
    expect(error).toBeUndefined();
  });
});

describe('listQuerySchema', () => {
  it('defaults page/limit and rejects an unknown status', () => {
    const { value } = listQuerySchema.validate({});
    expect(value.page).toBe(1);
    expect(value.limit).toBe(20);
    const { error } = listQuerySchema.validate({ status: 'archived' });
    expect(error).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/validators/adminProfessionalValidator.test.js`
Expected: FAIL — `Cannot find module './adminProfessionalValidator'`.

- [ ] **Step 3: Write the implementation**

```js
// src/validators/adminProfessionalValidator.js
const Joi = require('joi');

const PROFESSIONAL_ROLES_ENUM = ['veterinarian', 'groomer', 'trainer', 'petTaxi'];

const TIME_RE = /^([0-1]?\d|2[0-3]):[0-5]\d$/;

const availabilityDaySchema = Joi.object({
  startTime: Joi.string().pattern(TIME_RE).required().messages({
    'string.pattern.base': 'Start time must be in HH:MM format',
  }),
  endTime: Joi.string().pattern(TIME_RE).required().messages({
    'string.pattern.base': 'End time must be in HH:MM format',
  }),
  isAvailable: Joi.boolean().default(true),
});

const availabilitySchema = Joi.object({
  monday: availabilityDaySchema,
  tuesday: availabilityDaySchema,
  wednesday: availabilityDaySchema,
  thursday: availabilityDaySchema,
  friday: availabilityDaySchema,
  saturday: availabilityDaySchema,
  sunday: availabilityDaySchema,
});

const serviceSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  price: Joi.number().min(0).required(),
  duration: Joi.number().min(15).max(480).required(),
  description: Joi.string().trim().max(500).allow('').optional(),
});

const profileImageSchema = Joi.object({
  url: Joi.string().uri().allow('').optional(),
  publicId: Joi.string().allow('').optional(),
});

// Full professionalInfo — used on create (specialization + experience required).
const professionalInfoCreate = Joi.object({
  specialization: Joi.string().trim().min(2).max(100).required(),
  experience: Joi.number().min(0).max(50).required(),
  qualifications: Joi.array().items(Joi.string().trim()).optional(),
  bio: Joi.string().trim().max(500).allow('').optional(),
  services: Joi.array().items(serviceSchema).optional(),
  availability: availabilitySchema.optional(),
  profileImage: profileImageSchema.optional(),
});

// Partial professionalInfo — used on edit (every field optional).
const professionalInfoUpdate = Joi.object({
  specialization: Joi.string().trim().min(2).max(100).optional(),
  experience: Joi.number().min(0).max(50).optional(),
  qualifications: Joi.array().items(Joi.string().trim()).optional(),
  bio: Joi.string().trim().max(500).allow('').optional(),
  services: Joi.array().items(serviceSchema).optional(),
  availability: availabilitySchema.optional(),
  profileImage: profileImageSchema.optional(),
  isActive: Joi.boolean().optional(),
}).min(1);

const createProfessionalSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email().trim().lowercase().required(),
  phoneNumber: Joi.string().trim().required(),
  address: Joi.string().trim().required(),
  role: Joi.string().valid(...PROFESSIONAL_ROLES_ENUM).required(),
  professionalInfo: professionalInfoCreate.required(),
});

const promoteSchema = Joi.object({
  userId: Joi.string().hex().length(24).required(),
  role: Joi.string().valid(...PROFESSIONAL_ROLES_ENUM).required(),
  professionalInfo: professionalInfoCreate.required(),
});

const updateProfessionalInfoSchema = Joi.object({
  professionalInfo: professionalInfoUpdate.required(),
});

const listQuerySchema = Joi.object({
  search: Joi.string().trim().allow('').optional(),
  role: Joi.string().valid(...PROFESSIONAL_ROLES_ENUM).optional(),
  status: Joi.string().valid('all', 'active', 'inactive').default('all'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string()
    .valid('createdAt', 'name', 'professionalInfo.rating', 'professionalInfo.experience')
    .default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

module.exports = {
  PROFESSIONAL_ROLES_ENUM,
  createProfessionalSchema,
  promoteSchema,
  updateProfessionalInfoSchema,
  listQuerySchema,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/validators/adminProfessionalValidator.test.js`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/validators/adminProfessionalValidator.js src/validators/adminProfessionalValidator.test.js
git commit -m "feat(professionals): admin professional validators"
```

---

### Task 2: Backend — professionalService admin methods + public isActive fix

**Files:**
- Modify: `src/services/professionalService.js`
- Test: `tests/integration/professionals/professionalService.admin.test.js`

**Interfaces:**
- Consumes: `User` model, `AppError`, `escapeRegExp` (already imported in the service); `crypto` (`node:crypto`, add require).
- Produces (methods on the exported `professionalService` singleton):
  - `adminListProfessionals(filters, pagination, sorting)` → `{ professionals: Array, pagination: { total, page, pages, hasNext, hasPrev } }`. `filters = { search?, role?, status? }` where `status ∈ 'all'|'active'|'inactive'`. Each professional is a lean user object with sensitive fields stripped.
  - `createProfessionalAccount({ name, email, phoneNumber, address, role, professionalInfo })` → `{ user, rawToken }`. Throws `AppError('Email already exists', 400)` on duplicate.
  - `promoteUserToProfessional(userId, { role, professionalInfo })` → updated user (sensitive fields stripped). Throws `AppError('User not found', 404)`; `AppError('User is already a professional or admin', 400)` if `role !== 'customer'`.
  - `offboardProfessional(id)` → updated user. Sets `role: 'customer'`, `professionalInfo.isActive: false`. Throws `AppError('Professional not found', 404)`.
  - Also exports the constant `ADMIN_PROFESSIONAL_ROLES` (attach to the service instance or module) for the controller/tests.

- [ ] **Step 1: Write the failing test**

```js
// tests/integration/professionals/professionalService.admin.test.js
jest.mock('../../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const professionalService = require('../../../src/services/professionalService');
const User = require('../../../src/models/user.model');

const proInfo = { specialization: 'Surgery', experience: 5 };

async function makePro(overrides = {}) {
  return User.create({
    name: 'Vet A',
    email: `vet-${Date.now()}-${Math.random()}@example.com`,
    phoneNumber: '12345678',
    address: '1 Vet Lane',
    password: 'Password123*',
    role: 'veterinarian',
    isActive: true,
    professionalInfo: { ...proInfo, isActive: true },
    ...overrides,
  });
}

async function makeCustomer(overrides = {}) {
  return User.create({
    name: 'Cust',
    email: `cust-${Date.now()}-${Math.random()}@example.com`,
    phoneNumber: '12345678',
    address: '2 Home Rd',
    password: 'Password123*',
    role: 'customer',
    ...overrides,
  });
}

describe('professionalService admin methods', () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('adminListProfessionals', () => {
    it('includes petTaxi and strips sensitive fields', async () => {
      await makePro({ role: 'petTaxi', professionalInfo: { ...proInfo, isActive: true } });
      const res = await professionalService.adminListProfessionals({}, {}, {});
      expect(res.professionals).toHaveLength(1);
      expect(res.professionals[0]).not.toHaveProperty('password');
      expect(res.professionals[0]).not.toHaveProperty('passwordResetToken');
    });

    it('filters by status=inactive', async () => {
      await makePro({ professionalInfo: { ...proInfo, isActive: true } });
      await makePro({ professionalInfo: { ...proInfo, isActive: false } });
      const res = await professionalService.adminListProfessionals({ status: 'inactive' }, {}, {});
      expect(res.professionals).toHaveLength(1);
      expect(res.professionals[0].professionalInfo.isActive).toBe(false);
    });

    it('searches by name/email/specialization', async () => {
      await makePro({ name: 'Findme Vet' });
      await makePro({ name: 'Other Vet' });
      const res = await professionalService.adminListProfessionals({ search: 'Findme' }, {}, {});
      expect(res.professionals).toHaveLength(1);
      expect(res.professionals[0].name).toBe('Findme Vet');
    });
  });

  describe('createProfessionalAccount', () => {
    it('creates a hashed-password user with a reset token', async () => {
      const { user, rawToken } = await professionalService.createProfessionalAccount({
        name: 'New Vet',
        email: 'newvet@example.com',
        phoneNumber: '12345678',
        address: '3 Clinic St',
        role: 'veterinarian',
        professionalInfo: proInfo,
      });
      expect(rawToken).toHaveLength(64);
      const stored = await User.findById(user._id).select('+password');
      expect(stored.password).not.toBe(rawToken);
      expect(stored.passwordResetToken).toBe(rawToken);
      expect(stored.role).toBe('veterinarian');
    });

    it('rejects a duplicate email', async () => {
      await makePro({ email: 'dupe@example.com' });
      await expect(
        professionalService.createProfessionalAccount({
          name: 'X', email: 'dupe@example.com', phoneNumber: '12345678',
          address: 'y', role: 'groomer', professionalInfo: proInfo,
        })
      ).rejects.toThrow('Email already exists');
    });
  });

  describe('promoteUserToProfessional', () => {
    it('promotes a customer', async () => {
      const c = await makeCustomer();
      const updated = await professionalService.promoteUserToProfessional(c._id.toString(), {
        role: 'groomer',
        professionalInfo: proInfo,
      });
      expect(updated.role).toBe('groomer');
      expect(updated.professionalInfo.specialization).toBe('Surgery');
    });

    it('rejects promoting an existing professional', async () => {
      const p = await makePro();
      await expect(
        professionalService.promoteUserToProfessional(p._id.toString(), {
          role: 'groomer', professionalInfo: proInfo,
        })
      ).rejects.toThrow('already a professional or admin');
    });
  });

  describe('offboardProfessional', () => {
    it('demotes to customer and deactivates', async () => {
      const p = await makePro();
      const updated = await professionalService.offboardProfessional(p._id.toString());
      expect(updated.role).toBe('customer');
      expect(updated.professionalInfo.isActive).toBe(false);
    });
  });

  describe('public getAllProfessionals hides deactivated', () => {
    it('excludes professionalInfo.isActive:false', async () => {
      await makePro({ professionalInfo: { ...proInfo, isActive: false } });
      const res = await professionalService.getAllProfessionals({}, {}, {});
      expect(res.professionals).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/integration/professionals/professionalService.admin.test.js`
Expected: FAIL — `professionalService.adminListProfessionals is not a function`.

- [ ] **Step 3: Write the implementation**

At the top of `src/services/professionalService.js` add `const crypto = require('node:crypto');` (below the existing requires) and, after the existing `PROFESSIONAL_ROLES` constant, add:

```js
const ADMIN_PROFESSIONAL_ROLES = ['veterinarian', 'groomer', 'trainer', 'petTaxi'];

const SENSITIVE_FIELDS =
  '-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires -__v';
```

In the public `getAllProfessionals`, change the base query so deactivated professionals never show. Replace the existing block:

```js
    const query = {
      role: { $in: ['veterinarian', 'groomer', 'trainer'] },
      isActive: true,
    };
```
with:
```js
    const query = {
      role: { $in: ['veterinarian', 'groomer', 'trainer'] },
      isActive: true,
      'professionalInfo.isActive': { $ne: false },
    };
```
And in the public `getProfessionalById`, add the same `'professionalInfo.isActive': { $ne: false }` to its `findOne` filter.

Add these methods to the `ProfessionalService` class (before the closing brace):

```js
  async adminListProfessionals(filters = {}, pagination = {}, sorting = {}) {
    const { search, role, status = 'all' } = filters;
    const { page = 1, limit = 20 } = pagination;
    const { sortBy = 'createdAt', sortOrder = 'desc' } = sorting;

    const query = { role: { $in: ADMIN_PROFESSIONAL_ROLES } };
    if (role && ADMIN_PROFESSIONAL_ROLES.includes(role)) {
      query.role = role;
    }
    if (status === 'active') query['professionalInfo.isActive'] = true;
    if (status === 'inactive') query['professionalInfo.isActive'] = false;
    if (search) {
      const rx = new RegExp(escapeRegExp(search), 'i');
      query.$or = [{ name: rx }, { email: rx }, { 'professionalInfo.specialization': rx }];
    }

    const safeSortBy = ALLOWED_PROFESSIONAL_SORT_FIELDS.includes(sortBy) ? sortBy : 'createdAt';
    const skip = (page - 1) * limit;

    const [professionals, total] = await Promise.all([
      User.find(query)
        .sort({ [safeSortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(Number.parseInt(limit, 10))
        .select(SENSITIVE_FIELDS)
        .lean(),
      User.countDocuments(query),
    ]);

    const pages = Math.ceil(total / limit) || 1;
    return {
      professionals,
      pagination: { total, page: Number.parseInt(page, 10), pages, hasNext: page < pages, hasPrev: page > 1 },
    };
  }

  async createProfessionalAccount({ name, email, phoneNumber, address, role, professionalInfo }) {
    if (!ADMIN_PROFESSIONAL_ROLES.includes(role)) {
      throw new AppError('Invalid professional role', 400);
    }
    const rawToken = crypto.randomBytes(32).toString('hex');
    const randomPassword = `${crypto.randomBytes(24).toString('hex')}Aa1*`;
    try {
      const user = await User.create({
        name,
        email,
        phoneNumber,
        address,
        password: randomPassword, // hashed by the model pre('save') hook
        role,
        professionalInfo: { ...professionalInfo, isActive: true },
        passwordResetToken: rawToken,
        passwordResetExpires: Date.now() + 24 * 60 * 60 * 1000, // 24h invite window
      });
      user.password = undefined;
      return { user, rawToken };
    } catch (error) {
      if (error.code === 11000) {
        throw new AppError('Email already exists', 400);
      }
      throw error;
    }
  }

  async promoteUserToProfessional(userId, { role, professionalInfo }) {
    validateObjectId(userId, 'User ID');
    if (!ADMIN_PROFESSIONAL_ROLES.includes(role)) {
      throw new AppError('Invalid professional role', 400);
    }
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    if (user.role !== 'customer') {
      throw new AppError('User is already a professional or admin', 400);
    }
    user.role = role;
    user.professionalInfo = { ...professionalInfo, isActive: true };
    await user.save();
    return User.findById(userId).select(SENSITIVE_FIELDS).lean();
  }

  async offboardProfessional(id) {
    validateObjectId(id, 'Professional ID');
    const user = await User.findOneAndUpdate(
      { _id: id, role: { $in: ADMIN_PROFESSIONAL_ROLES } },
      { role: 'customer', 'professionalInfo.isActive': false },
      { new: true }
    ).select(SENSITIVE_FIELDS).lean();
    if (!user) throw new AppError('Professional not found', 404);
    return user;
  }
```

At the bottom, ensure the constant is reachable from the controller. Where the singleton is exported (`module.exports = new ProfessionalService();`), replace with:

```js
const professionalServiceInstance = new ProfessionalService();
professionalServiceInstance.ADMIN_PROFESSIONAL_ROLES = ADMIN_PROFESSIONAL_ROLES;
module.exports = professionalServiceInstance;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/integration/professionals/professionalService.admin.test.js`
Expected: PASS. Then run `npx jest tests/integration/professionals/professional.security.test.js` to confirm the public-query change didn't break existing security tests.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/professionalService.js tests/integration/professionals/professionalService.admin.test.js
git commit -m "feat(professionals): admin service methods + hide deactivated from public browse"
```

---

### Task 3: Backend — admin professional controller, routes, invite email, photo upload

**Files:**
- Create: `src/controllers/adminProfessional.controller.js`
- Create: `src/templates/professional-invite.html`
- Modify: `src/routes/admin.routes.js`
- Test: `tests/integration/professionals/adminProfessionals.test.js`

**Interfaces:**
- Consumes: `professionalService` (Task 2 methods), the validators (Task 1), `sendEmail`, `frontendUrl`, `uploadToCloudinary` + `validateImageFile`, `AppError`, `logger`.
- Produces the router-mounted endpoints (all under `/api/admin`, already `isAuthenticated` + `isAdmin`):
  - `GET /admin/professionals` → `{ success, data: professionals, pagination }`
  - `POST /admin/professionals` → `201 { success, data: user, warning? }`
  - `POST /admin/professionals/promote` → `{ success, data: user }`
  - `PATCH /admin/professionals/:id` → `{ success, data: user }`
  - `PATCH /admin/professionals/:id/status` → `{ success, data: user }`
  - `DELETE /admin/professionals/:id` → `{ success, data: user }`
  - `POST /admin/professionals/upload-image` → `{ success, data: { url, publicId } }`

- [ ] **Step 1: Write the failing test**

```js
// tests/integration/professionals/adminProfessionals.test.js
jest.mock('../../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request = require('supertest');
const app = require('../../../src/app');
const User = require('../../../src/models/user.model');
const { sendEmail } = require('../../../src/utils/email');
const { makeUser, signupAndLogin } = require('../../helpers/factories');

const proInfo = { specialization: 'Surgery', experience: 5 };

async function adminToken() {
  await User.create(makeUser({ email: 'admin-pro@test.com', role: 'admin', password: 'Password123*' }));
  const res = await request(app).post('/api/auth/login').send({ email: 'admin-pro@test.com', password: 'Password123*' });
  return res.body.data.accessToken;
}

describe('Admin professionals API', () => {
  beforeEach(async () => {
    await User.deleteMany({});
    sendEmail.mockClear();
  });

  it('rejects non-admins', async () => {
    const { token } = await signupAndLogin();
    const res = await request(app).get('/api/admin/professionals').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('creates a professional + sends an invite, no password leak', async () => {
    const token = await adminToken();
    const res = await request(app)
      .post('/api/admin/professionals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Dr New', email: 'drnew@example.com', phoneNumber: '12345678',
        address: '1 Clinic', role: 'veterinarian', professionalInfo: proInfo,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.password).toBeUndefined();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const stored = await User.findOne({ email: 'drnew@example.com' });
    expect(stored.passwordResetToken).toBeDefined();
  });

  it('promotes an existing customer', async () => {
    const token = await adminToken();
    const cust = await User.create(makeUser({ email: 'promote@test.com', role: 'customer' }));
    const res = await request(app)
      .post('/api/admin/professionals/promote')
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: cust._id.toString(), role: 'groomer', professionalInfo: proInfo });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('groomer');
  });

  it('lists, toggles status, and offboards', async () => {
    const token = await adminToken();
    const pro = await User.create(makeUser({
      email: 'listpro@test.com', role: 'trainer',
      professionalInfo: { ...proInfo, isActive: true },
    }));

    const list = await request(app).get('/api/admin/professionals').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBe(1);

    const toggle = await request(app)
      .patch(`/api/admin/professionals/${pro._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });
    expect(toggle.status).toBe(200);
    expect(toggle.body.data.professionalInfo.isActive).toBe(false);

    const off = await request(app)
      .delete(`/api/admin/professionals/${pro._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(off.status).toBe(200);
    expect(off.body.data.role).toBe('customer');
  });

  it('edits professionalInfo', async () => {
    const token = await adminToken();
    const pro = await User.create(makeUser({
      email: 'editpro@test.com', role: 'groomer',
      professionalInfo: { ...proInfo, isActive: true },
    }));
    const res = await request(app)
      .patch(`/api/admin/professionals/${pro._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ professionalInfo: { bio: 'Updated bio' } });
    expect(res.status).toBe(200);
    expect(res.body.data.professionalInfo.bio).toBe('Updated bio');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/integration/professionals/adminProfessionals.test.js`
Expected: FAIL — routes return 404 (not mounted).

- [ ] **Step 3: Write the implementation**

```js
// src/controllers/adminProfessional.controller.js
const professionalService = require('../services/professionalService');
const { AppError } = require('../middlewares/errorHandler');
const { sendEmail } = require('../utils/email');
const { frontendUrl } = require('../config/urls');
const { uploadToCloudinary, validateImageFile } = require('../utils/cloudinary');
const logger = require('../utils/logger');

exports.listProfessionals = async (req, res, next) => {
  try {
    const { search, role, status, page, limit, sortBy, sortOrder } = req.query;
    const result = await professionalService.adminListProfessionals(
      { search, role, status },
      { page, limit },
      { sortBy, sortOrder }
    );
    res.status(200).json({ success: true, data: result.professionals, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
};

exports.createProfessional = async (req, res, next) => {
  try {
    const { user, rawToken } = await professionalService.createProfessionalAccount(req.body);

    const inviteUrl = frontendUrl(`reset-password/${rawToken}`);
    let warning;
    try {
      await sendEmail({
        to: user.email,
        subject: 'You have been added as a VitalPaws professional',
        template: 'professional-invite',
        data: { name: user.name, role: user.role, inviteUrl },
      });
    } catch (emailErr) {
      logger.warn('Professional invite email failed', { error: emailErr.message });
      warning = 'Account created but the invite email could not be sent. The professional can use "Forgot password" to set their password.';
    }

    res.status(201).json({ success: true, data: user, ...(warning ? { warning } : {}) });
  } catch (error) {
    next(error);
  }
};

exports.promoteProfessional = async (req, res, next) => {
  try {
    const { userId, role, professionalInfo } = req.body;
    const user = await professionalService.promoteUserToProfessional(userId, { role, professionalInfo });
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

exports.updateProfessional = async (req, res, next) => {
  try {
    const user = await professionalService.updateProfessional(req.params.id, req.body);
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

exports.toggleStatus = async (req, res, next) => {
  try {
    const isActive = req.body.isActive === true || req.body.isActive === 'true';
    const user = await professionalService.updateProfessional(req.params.id, {
      professionalInfo: { isActive },
    });
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

exports.offboardProfessional = async (req, res, next) => {
  try {
    const user = await professionalService.offboardProfessional(req.params.id);
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

exports.uploadImage = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('No image file provided', 400));
    validateImageFile(req.file);
    const result = await uploadToCloudinary(req.file, 'professionals');
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
```

Confirm `src/utils/logger` exists (it is used in `auth.controller.js`). If the require path differs there, match it.

Note: `updateProfessional` in the service restricts updates to `role ∈ ['veterinarian','groomer','trainer']`. Update its filter to use `ADMIN_PROFESSIONAL_ROLES` so petTaxi professionals are editable. In `src/services/professionalService.js`, inside `updateProfessional`, change the `findOneAndUpdate` filter:

```js
      {
        _id: professionalId,
        role: { $in: ADMIN_PROFESSIONAL_ROLES },
      },
```

Create the invite email template:

```html
<!-- src/templates/professional-invite.html -->
<h1 style="margin:0 0 16px;font-size:22px;color:#001c10;">Welcome to VitalPaws, {{name}}!</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3a3a3a;">
  An administrator has added you to VitalPaws as a <strong>{{role}}</strong>. To activate your
  account and start managing your appointments, set your password using the button below.
</p>
<p style="margin:0 0 24px;">
  <a href="{{inviteUrl}}"
     style="display:inline-block;background:#001c10;color:#f6ece3;text-decoration:none;padding:12px 28px;border-radius:999px;font-weight:600;font-size:15px;">
    Set your password
  </a>
</p>
<p style="margin:0 0 8px;font-size:13px;color:#6b6055;">
  This link is valid for 24 hours. If it expires, use "Forgot password" on the login page.
</p>
<p style="margin:0;font-size:13px;color:#6b6055;">
  If you weren't expecting this, you can safely ignore this email.
</p>
```

Mount the routes in `src/routes/admin.routes.js`. Add near the top with the other controller imports:

```js
const {
  listProfessionals,
  createProfessional,
  promoteProfessional,
  updateProfessional: updateProfessionalAdmin,
  toggleStatus: toggleProfessionalStatus,
  offboardProfessional,
  uploadImage: uploadProfessionalImage,
} = require('../controllers/adminProfessional.controller');
const { validateRequest } = require('../middlewares/validateRequest');
const {
  createProfessionalSchema,
  promoteSchema,
  updateProfessionalInfoSchema,
  listQuerySchema,
} = require('../validators/adminProfessionalValidator');
const { upload } = require('../middlewares/upload');
```

(If `validateRequest` / `upload` are already imported in this file, don't duplicate.) Then register the routes (place the static `promote` and `upload-image` paths before the `:id` params to avoid shadowing):

```js
// Professional management routes
router.get('/professionals', validateRequest(listQuerySchema, 'query'), listProfessionals);
router.post('/professionals', validateRequest(createProfessionalSchema), createProfessional);
router.post('/professionals/promote', validateRequest(promoteSchema), promoteProfessional);
router.post('/professionals/upload-image', upload.single('image'), uploadProfessionalImage);
router.patch('/professionals/:id', validateRequest(updateProfessionalInfoSchema), updateProfessionalAdmin);
router.patch('/professionals/:id/status', toggleProfessionalStatus);
router.delete('/professionals/:id', offboardProfessional);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/integration/professionals/adminProfessionals.test.js`
Expected: PASS (all six cases).

- [ ] **Step 5: Commit**

```bash
git add src/controllers/adminProfessional.controller.js src/templates/professional-invite.html src/routes/admin.routes.js src/services/professionalService.js tests/integration/professionals/adminProfessionals.test.js
git commit -m "feat(professionals): admin professionals API — create/invite, promote, edit, toggle, offboard, photo upload"
```

---

### Task 4: Backend — remove dead code + manual rating route

**Files:**
- Modify: `src/controllers/professionalController.js` (delete `createProfessional` + `deleteProfessional`)
- Modify: `src/routes/professional.routes.js` (remove the `PATCH /:id/rating` route + its `ratingSchema` import)

**Interfaces:**
- Consumes: nothing new.
- Produces: no new surface; removes broken/unused handlers.

- [ ] **Step 1: Confirm nothing references the removed handlers**

Run: `grep -rn "createProfessional\|deleteProfessional\|updateProfessionalRating\|ratingSchema" src/ tests/ | grep -v node_modules`
Expected: the only matches are the definitions themselves in `professionalController.js` / `professional.routes.js` / `professionalValidator.js` (no external callers, no tests). If a test references `updateProfessionalRating`, delete that test too.

- [ ] **Step 2: Delete the dead controller methods**

In `src/controllers/professionalController.js`, delete the entire `exports.createProfessional = ...` block and the entire `exports.deleteProfessional = ...` block.

- [ ] **Step 3: Remove the manual rating route**

In `src/routes/professional.routes.js`, delete the route block:

```js
router.patch(
  '/:id/rating',
  isAdmin, // Only admin or system can update ratings directly
  validateRequest(ratingSchema),
  professionalController.updateProfessionalRating
);
```

and remove `ratingSchema` from the `require('../validators/professionalValidator')` destructure. Then delete `exports.updateProfessionalRating` from `professionalController.js`.

- [ ] **Step 4: Run the full backend suite to verify nothing broke**

Run: `npx jest`
Expected: no new failures attributable to this task. (The integration suite has known pre-existing E11000 failures per STATUS.md — compare against the baseline; the professional suites and all unit suites must be green.)

- [ ] **Step 5: Commit**

```bash
git add src/controllers/professionalController.js src/routes/professional.routes.js
git commit -m "chore(professionals): remove dead createProfessional/deleteProfessional + manual rating route"
```

---

### Task 5: Frontend — adminProfessionalsApi client

**Files:**
- Create: `src/Services/api/adminProfessionalsApi.js`
- Test: `src/Services/api/adminProfessionalsApi.test.js`

**Interfaces:**
- Consumes: `import { api } from "../../core/api/apiClient"`.
- Produces: `adminProfessionalsApi` with `list(params)`, `create(payload)`, `promote(payload)`, `update(id, professionalInfo)`, `toggleStatus(id, isActive)`, `offboard(id)`, `uploadImage(file)`, `searchUsers(search)`.

- [ ] **Step 1: Write the failing test**

```js
// src/Services/api/adminProfessionalsApi.test.js
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/core/api/apiClient", () => {
  const m = { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() };
  return { api: m, default: m };
});

import { api } from "@/core/api/apiClient";
import adminProfessionalsApi from "./adminProfessionalsApi";

beforeEach(() => vi.clearAllMocks());

describe("adminProfessionalsApi", () => {
  it("list builds a query string", async () => {
    api.get.mockResolvedValue({ data: { data: [], pagination: {} } });
    await adminProfessionalsApi.list({ role: "groomer", status: "active" });
    expect(api.get).toHaveBeenCalledWith("/admin/professionals?role=groomer&status=active");
  });

  it("create posts to the collection", async () => {
    api.post.mockResolvedValue({ data: { data: {} } });
    await adminProfessionalsApi.create({ name: "A" });
    expect(api.post).toHaveBeenCalledWith("/admin/professionals", { name: "A" });
  });

  it("promote posts to /promote", async () => {
    api.post.mockResolvedValue({ data: { data: {} } });
    await adminProfessionalsApi.promote({ userId: "1", role: "groomer", professionalInfo: {} });
    expect(api.post).toHaveBeenCalledWith("/admin/professionals/promote", { userId: "1", role: "groomer", professionalInfo: {} });
  });

  it("update patches professionalInfo", async () => {
    api.patch.mockResolvedValue({ data: { data: {} } });
    await adminProfessionalsApi.update("42", { bio: "x" });
    expect(api.patch).toHaveBeenCalledWith("/admin/professionals/42", { professionalInfo: { bio: "x" } });
  });

  it("toggleStatus patches /status", async () => {
    api.patch.mockResolvedValue({ data: { data: {} } });
    await adminProfessionalsApi.toggleStatus("42", false);
    expect(api.patch).toHaveBeenCalledWith("/admin/professionals/42/status", { isActive: false });
  });

  it("offboard deletes", async () => {
    api.delete.mockResolvedValue({ data: { data: {} } });
    await adminProfessionalsApi.offboard("42");
    expect(api.delete).toHaveBeenCalledWith("/admin/professionals/42");
  });

  it("searchUsers hits the admin users endpoint", async () => {
    api.get.mockResolvedValue({ data: { data: [] } });
    await adminProfessionalsApi.searchUsers("jane");
    expect(api.get).toHaveBeenCalledWith("/admin/users?search=jane&role=customer");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/Services/api/adminProfessionalsApi.test.js`
Expected: FAIL — cannot resolve `./adminProfessionalsApi`.

- [ ] **Step 3: Write the implementation**

```js
// src/Services/api/adminProfessionalsApi.js
import { api } from "../../core/api/apiClient";

const adminProfessionalsApi = {
  list: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const res = await api.get(`/admin/professionals${qs ? "?" + qs : ""}`);
    return res.data; // { success, data, pagination }
  },

  create: async (payload) => {
    const res = await api.post("/admin/professionals", payload);
    return res.data;
  },

  promote: async (payload) => {
    const res = await api.post("/admin/professionals/promote", payload);
    return res.data;
  },

  update: async (id, professionalInfo) => {
    const res = await api.patch(`/admin/professionals/${id}`, { professionalInfo });
    return res.data;
  },

  toggleStatus: async (id, isActive) => {
    const res = await api.patch(`/admin/professionals/${id}/status`, { isActive });
    return res.data;
  },

  offboard: async (id) => {
    const res = await api.delete(`/admin/professionals/${id}`);
    return res.data;
  },

  uploadImage: async (file) => {
    const form = new FormData();
    form.append("image", file);
    const res = await api.post("/admin/professionals/upload-image", form);
    return res.data; // { success, data: { url, publicId } }
  },

  // Reuse the admin users endpoint to find customers to promote.
  searchUsers: async (search) => {
    const qs = new URLSearchParams({ search, role: "customer" }).toString();
    const res = await api.get(`/admin/users?${qs}`);
    return res.data;
  },
};

export default adminProfessionalsApi;
```

Note: the test expects `searchUsers` to build `search=jane&role=customer` in that order — `URLSearchParams({ search, role })` preserves insertion order, so declare `search` first.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/Services/api/adminProfessionalsApi.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/Services/api/adminProfessionalsApi.js src/Services/api/adminProfessionalsApi.test.js
git commit -m "feat(professionals): admin professionals API client"
```

---

### Task 6: Frontend — AdminProfessionals list page + route

**Files:**
- Create: `src/Pages/Admin/Professionals/AdminProfessionals.jsx`
- Create: `src/Pages/Admin/Professionals/AdminProfessionals.css`
- Test: `src/Pages/Admin/Professionals/AdminProfessionals.test.jsx`
- Modify: `src/main.jsx`

**Interfaces:**
- Consumes: `adminProfessionalsApi` (Task 5), `DataTable`, shadcn `Select`, `useToast`.
- Produces: default-exported `AdminProfessionals` page; navigates to `/admin/professionals/new` and `/admin/professionals/:id/edit`.

- [ ] **Step 1: Write the failing test**

```jsx
// src/Pages/Admin/Professionals/AdminProfessionals.test.jsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/Services/api/adminProfessionalsApi", () => ({
  default: {
    list: vi.fn(),
    toggleStatus: vi.fn(),
    offboard: vi.fn(),
  },
}));
vi.mock("@/context/ToastContext", () => ({ useToast: () => ({ addToast: vi.fn() }) }));

import adminProfessionalsApi from "@/Services/api/adminProfessionalsApi";
import AdminProfessionals from "./AdminProfessionals";

beforeEach(() => vi.clearAllMocks());

describe("AdminProfessionals", () => {
  it("renders professional rows from the API", async () => {
    adminProfessionalsApi.list.mockResolvedValue({
      data: [
        { _id: "1", name: "Dr Lee", email: "lee@x.com", role: "veterinarian",
          professionalInfo: { specialization: "Feline", experience: 8, rating: 4.5, isActive: true } },
      ],
      pagination: { total: 1, page: 1, pages: 1 },
    });
    render(<MemoryRouter><AdminProfessionals /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Dr Lee")).toBeInTheDocument());
    expect(screen.getByText("Feline")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/Pages/Admin/Professionals/AdminProfessionals.test.jsx`
Expected: FAIL — cannot resolve `./AdminProfessionals`.

- [ ] **Step 3: Write the implementation**

```jsx
// src/Pages/Admin/Professionals/AdminProfessionals.jsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FiPlus, FiUserX, FiUserCheck } from "react-icons/fi";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/Components/ui/select";
import DataTable from "../../../Components/Admin/DataTable/DataTable";
import adminProfessionalsApi from "../../../Services/api/adminProfessionalsApi";
import { useToast } from "../../../context/ToastContext";
import "./AdminProfessionals.css";

const ROLE_FILTERS = ["all", "veterinarian", "groomer", "trainer", "petTaxi"];
const STATUS_FILTERS = ["all", "active", "inactive"];

const columns = [
  {
    key: "name",
    label: "Name",
    render: (row) => (
      <div className="apro-name-cell">
        <img
          className="apro-avatar"
          src={row.professionalInfo?.profileImage?.url || row.profileImage?.url || "/placeholder-avatar.svg"}
          alt={row.name}
          onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
        />
        <div>
          <div className="apro-name">{row.name}</div>
          <div className="apro-email">{row.email}</div>
        </div>
      </div>
    ),
  },
  { key: "role", label: "Role", render: (row) => <span className="apro-role-badge">{row.role}</span> },
  { key: "specialization", label: "Specialization", render: (row) => row.professionalInfo?.specialization || "—" },
  { key: "experience", label: "Exp.", render: (row) => `${row.professionalInfo?.experience ?? 0} yr` },
  { key: "rating", label: "Rating", render: (row) => `★ ${(row.professionalInfo?.rating ?? 0).toFixed(1)}` },
  {
    key: "status",
    label: "Status",
    render: (row) => (
      <span className={`apro-status ${row.professionalInfo?.isActive ? "is-active" : "is-inactive"}`}>
        {row.professionalInfo?.isActive ? "Active" : "Inactive"}
      </span>
    ),
  },
];

const AdminProfessionals = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const { addToast } = useToast();
  const navigate = useNavigate();

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const params = { limit: 1000 };
      if (roleFilter !== "all") params.role = roleFilter;
      if (statusFilter !== "all") params.status = statusFilter;
      const res = await adminProfessionalsApi.list(params);
      setRows(res.data || []);
    } catch (err) {
      addToast("Failed to load professionals", "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [roleFilter, statusFilter, addToast]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const handleToggle = async (row) => {
    const next = !row.professionalInfo?.isActive;
    try {
      await adminProfessionalsApi.toggleStatus(row._id, next);
      setRows((prev) => prev.map((r) =>
        r._id === row._id ? { ...r, professionalInfo: { ...r.professionalInfo, isActive: next } } : r));
      addToast(next ? "Professional activated" : "Professional deactivated", "success");
    } catch {
      addToast("Failed to update status", "error");
    }
  };

  const handleOffboard = async (row) => {
    if (!window.confirm(`Offboard ${row.name}? They will be demoted to a customer.`)) return;
    try {
      await adminProfessionalsApi.offboard(row._id);
      setRows((prev) => prev.filter((r) => r._id !== row._id));
      addToast("Professional offboarded", "success");
    } catch {
      addToast("Failed to offboard", "error");
    }
  };

  return (
    <div className="apro-page">
      <div className="apro-header">
        <h1>Professionals</h1>
        <button className="apro-add-btn" onClick={() => navigate("/admin/professionals/new")}>
          <FiPlus /> Add professional
        </button>
      </div>

      <div className="apro-filters">
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="apro-filter"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            {ROLE_FILTERS.map((r) => <SelectItem key={r} value={r}>{r === "all" ? "All roles" : r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="apro-filter"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All statuses" : s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        data={rows}
        columns={columns}
        loading={loading}
        onEdit={(row) => navigate(`/admin/professionals/${row._id}/edit`)}
        onDelete={handleOffboard}
        customActions={(row) => (
          <button
            className="apro-toggle-btn"
            title={row.professionalInfo?.isActive ? "Deactivate" : "Activate"}
            onClick={() => handleToggle(row)}
          >
            {row.professionalInfo?.isActive ? <FiUserX /> : <FiUserCheck />}
          </button>
        )}
      />
    </div>
  );
};

export default AdminProfessionals;
```

```css
/* src/Pages/Admin/Professionals/AdminProfessionals.css */
.apro-page { padding: 1.5rem; }
.apro-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
.apro-header h1 { font-size: 1.5rem; font-weight: 700; margin: 0; }
.apro-add-btn { display: inline-flex; align-items: center; gap: 6px; padding: 0.55rem 1.1rem; border: none; border-radius: 999px; background: #001c10; color: #f6ece3; font-weight: 600; cursor: pointer; }
.apro-filters { display: flex; gap: 0.75rem; margin-bottom: 1rem; }
.apro-filter { min-width: 160px; }
.apro-name-cell { display: flex; align-items: center; gap: 0.6rem; }
.apro-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; background: #f0ebe4; }
.apro-name { font-weight: 600; }
.apro-email { font-size: 0.78rem; color: #8a7d6e; }
.apro-role-badge { text-transform: capitalize; font-size: 0.75rem; font-weight: 700; padding: 2px 10px; border-radius: 8px; background: rgba(116,180,155,0.18); color: #2e7d4f; }
.apro-status.is-active { color: #2e7d4f; font-weight: 600; }
.apro-status.is-inactive { color: #c0392b; font-weight: 600; }
.apro-toggle-btn { background: none; border: none; cursor: pointer; color: #6b6055; padding: 4px; }
```

Before wiring the route, verify the `DataTable` `columns` prop supports a `render(row)` function and that `customActions` is invoked per row. If the real `DataTable` API differs (e.g. `accessor` instead of `render`, or `customActions` is a node not a function), adapt the columns/actions to match — check `src/Components/Admin/DataTable/DataTable.jsx` and mirror how `AdminUsers.jsx` uses it.

Register the route in `src/main.jsx`. Add the lazy imports next to the other admin pages (around line 68):

```js
const AdminProfessionals    = lazy(() => import("./Pages/Admin/Professionals/AdminProfessionals"));
const AdminProfessionalForm = lazy(() => import("./Pages/Admin/Professionals/AdminProfessionalForm"));
```

And add child routes inside the `/admin` children array (next to the `users` route):

```js
      { path: "professionals", element: P(<AdminProfessionals />) },
      { path: "professionals/new", element: P(<AdminProfessionalForm />) },
      { path: "professionals/:id/edit", element: P(<AdminProfessionalForm />) },
```

`AdminProfessionalForm` doesn't exist until Task 7 — to keep this task's build green, create a one-line stub now and flesh it out in Task 7:

```jsx
// src/Pages/Admin/Professionals/AdminProfessionalForm.jsx  (stub — replaced in Task 7)
const AdminProfessionalForm = () => null;
export default AdminProfessionalForm;
```

- [ ] **Step 4: Run test + build to verify**

Run: `npx vitest run src/Pages/Admin/Professionals/AdminProfessionals.test.jsx`
Expected: PASS. Then `npm run build` to confirm the new routes/imports resolve.
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/Pages/Admin/Professionals/AdminProfessionals.jsx src/Pages/Admin/Professionals/AdminProfessionals.css src/Pages/Admin/Professionals/AdminProfessionals.test.jsx src/Pages/Admin/Professionals/AdminProfessionalForm.jsx src/main.jsx
git commit -m "feat(professionals): admin professionals list page + routes"
```

---

### Task 7: Frontend — AdminProfessionalForm (create / edit / promote)

**Files:**
- Modify: `src/Pages/Admin/Professionals/AdminProfessionalForm.jsx` (replace the Task 6 stub)
- Test: `src/Pages/Admin/Professionals/AdminProfessionalForm.test.jsx`

**Interfaces:**
- Consumes: `adminProfessionalsApi`, `ImageManager`, shadcn `Select`, `useToast`, `useParams`/`useNavigate`.
- Produces: default-exported `AdminProfessionalForm` handling three modes — create (`/new`), edit (`/:id/edit`), and promote (create page, "Promote existing" tab).

**Behavior:**
- **Edit mode** (`id` present): fetch the professional via `adminProfessionalsApi.list({ ... })` is wasteful — instead read from route state if provided, else fetch the single record. Since there is no single-GET admin endpoint, pass the row through router state on navigation (`navigate(..., { state: { professional } })`) OR fetch the list once and find by id. Use router state with a list-fetch fallback.
- **Create mode**: two tabs — "Create new" (name/email/phone/address + professionalInfo → `create`) and "Promote existing" (user search via `searchUsers`, pick one, fill professionalInfo → `promote`).
- Fields: role `Select`, specialization, experience, qualifications (comma-separated → array), bio, photo (`ImageManager` max 1, `uploadUrl="/admin/professionals/upload-image"`), services (repeatable rows), weekly availability (7 rows: available toggle + two `<input type="time">`). Rating shown read-only in edit mode.
- On submit: build `professionalInfo`, call the right API method, toast, navigate back to `/admin/professionals`.

- [ ] **Step 1: Write the failing test**

```jsx
// src/Pages/Admin/Professionals/AdminProfessionalForm.test.jsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("@/Services/api/adminProfessionalsApi", () => ({
  default: { create: vi.fn(), promote: vi.fn(), update: vi.fn(), list: vi.fn(), searchUsers: vi.fn() },
}));
vi.mock("@/context/ToastContext", () => ({ useToast: () => ({ addToast: vi.fn() }) }));
vi.mock("@/Components/Admin/ImageManager/ImageManager", () => ({ default: () => <div data-testid="image-manager" /> }));

import adminProfessionalsApi from "@/Services/api/adminProfessionalsApi";
import AdminProfessionalForm from "./AdminProfessionalForm";

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/professionals/new" element={<AdminProfessionalForm />} />
        <Route path="/admin/professionals/:id/edit" element={<AdminProfessionalForm />} />
        <Route path="/admin/professionals" element={<div>list</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => vi.clearAllMocks());

describe("AdminProfessionalForm — create", () => {
  it("submits a create payload with professionalInfo", async () => {
    adminProfessionalsApi.create.mockResolvedValue({ data: {} });
    renderAt("/admin/professionals/new");

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Dr New" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "new@x.com" } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "12345678" } });
    fireEvent.change(screen.getByLabelText(/address/i), { target: { value: "1 St" } });
    fireEvent.change(screen.getByLabelText(/specialization/i), { target: { value: "Feline" } });
    fireEvent.change(screen.getByLabelText(/experience/i), { target: { value: "5" } });

    fireEvent.click(screen.getByRole("button", { name: /save|create/i }));

    await waitFor(() => expect(adminProfessionalsApi.create).toHaveBeenCalledTimes(1));
    const payload = adminProfessionalsApi.create.mock.calls[0][0];
    expect(payload.name).toBe("Dr New");
    expect(payload.professionalInfo.specialization).toBe("Feline");
    expect(payload.professionalInfo.experience).toBe(5);
  });

  it("blocks submit when required fields are missing", async () => {
    renderAt("/admin/professionals/new");
    fireEvent.click(screen.getByRole("button", { name: /save|create/i }));
    await waitFor(() => expect(adminProfessionalsApi.create).not.toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/Pages/Admin/Professionals/AdminProfessionalForm.test.jsx`
Expected: FAIL — the stub renders `null`, so `getByLabelText(/name/i)` throws.

- [ ] **Step 3: Write the implementation**

```jsx
// src/Pages/Admin/Professionals/AdminProfessionalForm.jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/Components/ui/select";
import ImageManager from "@/Components/Admin/ImageManager/ImageManager";
import adminProfessionalsApi from "@/Services/api/adminProfessionalsApi";
import { useToast } from "@/context/ToastContext";

const ROLES = ["veterinarian", "groomer", "trainer", "petTaxi"];
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const emptyAvailability = () =>
  DAYS.reduce((acc, d) => ({ ...acc, [d]: { startTime: "09:00", endTime: "17:00", isAvailable: false } }), {});

const AdminProfessionalForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  const isEdit = Boolean(id);

  const [mode, setMode] = useState("create"); // 'create' | 'promote'
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Account fields (create mode)
  const [account, setAccount] = useState({ name: "", email: "", phoneNumber: "", address: "" });
  // Promote mode
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  // professionalInfo fields
  const [role, setRole] = useState("veterinarian");
  const [specialization, setSpecialization] = useState("");
  const [experience, setExperience] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [bio, setBio] = useState("");
  const [photo, setPhoto] = useState([]); // ImageManager value: [{url, publicId}]
  const [services, setServices] = useState([]);
  const [availability, setAvailability] = useState(emptyAvailability());
  const [rating, setRating] = useState(0);

  // Edit: hydrate from router state, else from a list fetch.
  useEffect(() => {
    if (!isEdit) return;
    const hydrate = (p) => {
      setRole(p.role || "veterinarian");
      const info = p.professionalInfo || {};
      setSpecialization(info.specialization || "");
      setExperience(info.experience ?? "");
      setQualifications((info.qualifications || []).join(", "));
      setBio(info.bio || "");
      setPhoto(info.profileImage?.url ? [info.profileImage] : (p.profileImage?.url ? [p.profileImage] : []));
      setServices(info.services || []);
      setAvailability({ ...emptyAvailability(), ...(info.availability || {}) });
      setRating(info.rating || 0);
      setAccount({ name: p.name || "", email: p.email || "", phoneNumber: p.phoneNumber || "", address: p.address || "" });
    };
    if (location.state?.professional) {
      hydrate(location.state.professional);
    } else {
      adminProfessionalsApi.list({ limit: 1000 }).then((res) => {
        const found = (res.data || []).find((r) => r._id === id);
        if (found) hydrate(found);
      });
    }
  }, [isEdit, id, location.state]);

  const runUserSearch = async () => {
    if (!userQuery.trim()) return;
    const res = await adminProfessionalsApi.searchUsers(userQuery.trim());
    setUserResults(res.data || []);
  };

  const buildProfessionalInfo = () => ({
    specialization: specialization.trim(),
    experience: Number(experience),
    qualifications: qualifications.split(",").map((q) => q.trim()).filter(Boolean),
    bio: bio.trim(),
    services,
    availability,
    ...(photo[0] ? { profileImage: photo[0] } : {}),
  });

  const validate = () => {
    const e = {};
    if (!specialization.trim()) e.specialization = "Required";
    if (experience === "" || Number.isNaN(Number(experience))) e.experience = "Required";
    if (!isEdit && mode === "create") {
      if (!account.name.trim()) e.name = "Required";
      if (!account.email.trim()) e.email = "Required";
      if (!account.phoneNumber.trim()) e.phoneNumber = "Required";
      if (!account.address.trim()) e.address = "Required";
    }
    if (!isEdit && mode === "promote" && !selectedUser) e.user = "Pick a user";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const professionalInfo = buildProfessionalInfo();
      if (isEdit) {
        await adminProfessionalsApi.update(id, professionalInfo);
        addToast("Professional updated", "success");
      } else if (mode === "promote") {
        await adminProfessionalsApi.promote({ userId: selectedUser._id, role, professionalInfo });
        addToast("User promoted to professional", "success");
      } else {
        await adminProfessionalsApi.create({ ...account, role, professionalInfo });
        addToast("Professional created — invite sent", "success");
      }
      navigate("/admin/professionals");
    } catch (err) {
      addToast(err?.response?.data?.message || "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const setDay = (day, patch) =>
    setAvailability((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));

  const addService = () => setServices((s) => [...s, { name: "", price: 0, duration: 30, description: "" }]);
  const setService = (i, patch) => setServices((s) => s.map((sv, j) => (j === i ? { ...sv, ...patch } : sv)));
  const removeService = (i) => setServices((s) => s.filter((_, j) => j !== i));

  return (
    <form className="apro-form" onSubmit={handleSubmit} style={{ padding: "1.5rem", maxWidth: 760 }}>
      <h1>{isEdit ? "Edit professional" : "Add professional"}</h1>

      {!isEdit && (
        <div className="apro-mode-tabs" style={{ display: "flex", gap: 8, margin: "1rem 0" }}>
          <button type="button" onClick={() => setMode("create")} aria-pressed={mode === "create"}>Create new</button>
          <button type="button" onClick={() => setMode("promote")} aria-pressed={mode === "promote"}>Promote existing</button>
        </div>
      )}

      {!isEdit && mode === "promote" && (
        <div className="apro-user-search">
          <label htmlFor="apro-user-q">Find user</label>
          <input id="apro-user-q" value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="name or email" />
          <button type="button" onClick={runUserSearch}>Search</button>
          {errors.user && <span className="apro-err">{errors.user}</span>}
          <ul>
            {userResults.map((u) => (
              <li key={u._id}>
                <button type="button" aria-pressed={selectedUser?._id === u._id} onClick={() => setSelectedUser(u)}>
                  {u.name} — {u.email}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isEdit && mode === "create" && (
        <fieldset style={{ border: "none", padding: 0 }}>
          <div><label htmlFor="f-name">Name</label>
            <input id="f-name" value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} />
            {errors.name && <span className="apro-err">{errors.name}</span>}</div>
          <div><label htmlFor="f-email">Email</label>
            <input id="f-email" type="email" value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} />
            {errors.email && <span className="apro-err">{errors.email}</span>}</div>
          <div><label htmlFor="f-phone">Phone</label>
            <input id="f-phone" value={account.phoneNumber} onChange={(e) => setAccount({ ...account, phoneNumber: e.target.value })} />
            {errors.phoneNumber && <span className="apro-err">{errors.phoneNumber}</span>}</div>
          <div><label htmlFor="f-address">Address</label>
            <input id="f-address" value={account.address} onChange={(e) => setAccount({ ...account, address: e.target.value })} />
            {errors.address && <span className="apro-err">{errors.address}</span>}</div>
        </fieldset>
      )}

      <div><label>Role</label>
        <Select value={role} onValueChange={setRole} disabled={isEdit}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div><label htmlFor="f-spec">Specialization</label>
        <input id="f-spec" value={specialization} onChange={(e) => setSpecialization(e.target.value)} />
        {errors.specialization && <span className="apro-err">{errors.specialization}</span>}</div>

      <div><label htmlFor="f-exp">Experience (years)</label>
        <input id="f-exp" type="number" min="0" value={experience} onChange={(e) => setExperience(e.target.value)} />
        {errors.experience && <span className="apro-err">{errors.experience}</span>}</div>

      <div><label htmlFor="f-qual">Qualifications (comma-separated)</label>
        <input id="f-qual" value={qualifications} onChange={(e) => setQualifications(e.target.value)} /></div>

      <div><label htmlFor="f-bio">Bio</label>
        <textarea id="f-bio" maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)} /></div>

      {isEdit && <p className="apro-readonly">Rating: ★ {rating.toFixed(1)} (read-only, from customer reviews)</p>}

      <div><label>Profile photo</label>
        <ImageManager value={photo} onChange={setPhoto} uploadUrl="/admin/professionals/upload-image" max={1} label="Photo" />
      </div>

      <div className="apro-services">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <label>Services</label>
          <button type="button" onClick={addService}>+ Add service</button>
        </div>
        {services.map((sv, i) => (
          <div key={i} className="apro-service-row" style={{ display: "flex", gap: 8 }}>
            <input aria-label={`service-name-${i}`} placeholder="Name" value={sv.name} onChange={(e) => setService(i, { name: e.target.value })} />
            <input aria-label={`service-price-${i}`} type="number" min="0" placeholder="Rs" value={sv.price} onChange={(e) => setService(i, { price: Number(e.target.value) })} />
            <input aria-label={`service-duration-${i}`} type="number" min="15" placeholder="min" value={sv.duration} onChange={(e) => setService(i, { duration: Number(e.target.value) })} />
            <button type="button" onClick={() => removeService(i)}>✕</button>
          </div>
        ))}
      </div>

      <div className="apro-availability">
        <label>Weekly availability</label>
        {DAYS.map((day) => (
          <div key={day} className="apro-avail-row" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ width: 110, textTransform: "capitalize" }}>
              <input type="checkbox" checked={availability[day].isAvailable} onChange={(e) => setDay(day, { isAvailable: e.target.checked })} /> {day}
            </label>
            <input type="time" aria-label={`${day}-start`} value={availability[day].startTime} onChange={(e) => setDay(day, { startTime: e.target.value })} disabled={!availability[day].isAvailable} />
            <input type="time" aria-label={`${day}-end`} value={availability[day].endTime} onChange={(e) => setDay(day, { endTime: e.target.value })} disabled={!availability[day].isAvailable} />
          </div>
        ))}
      </div>

      <div className="apro-actions" style={{ marginTop: "1.5rem", display: "flex", gap: 12 }}>
        <button type="submit" disabled={saving}>{saving ? "Saving…" : isEdit ? "Save changes" : "Create"}</button>
        <button type="button" onClick={() => navigate("/admin/professionals")}>Cancel</button>
      </div>
    </form>
  );
};

export default AdminProfessionalForm;
```

When navigating from the list's edit action (Task 6), pass the row so edit mode hydrates without a fetch. In `AdminProfessionals.jsx`, change the `onEdit` handler to:

```js
        onEdit={(row) => navigate(`/admin/professionals/${row._id}/edit`, { state: { professional: row } })}
```

Confirm the `ImageManager` import path and props (`value`, `onChange`, `uploadUrl`, `max`, `label`) match the real component (`src/Components/Admin/ImageManager/ImageManager.jsx`); adjust if the prop is `maxImages` rather than `max`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/Pages/Admin/Professionals/AdminProfessionalForm.test.jsx`
Expected: PASS (both cases). Then `npm run build`.
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/Pages/Admin/Professionals/AdminProfessionalForm.jsx src/Pages/Admin/Professionals/AdminProfessionalForm.test.jsx src/Pages/Admin/Professionals/AdminProfessionals.jsx
git commit -m "feat(professionals): admin professional create/edit/promote form"
```

---

### Task 8: Docs + status update

**Files:**
- Modify: `backend/.claude/memory/STATUS.md`

- [ ] **Step 1: Update STATUS.md**

Move the Epic 4 "Professionals admin" work to Done (or add a new row): note the new `/admin/professionals` API + AdminProfessionals page, the public-browse `isActive` visibility fix, petTaxi inclusion in admin lists, and the dead-code removal. Add a rollout note: "Deactivated professionals (`professionalInfo.isActive:false`) now disappear from public browse — verify none are unintentionally deactivated before deploy."

- [ ] **Step 2: Run the relevant suites once more**

Run (backend): `npx jest src/validators/adminProfessionalValidator.test.js tests/integration/professionals`
Run (frontend): `npx vitest run src/Pages/Admin/Professionals src/Services/api/adminProfessionalsApi.test.js`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add backend/.claude/memory/STATUS.md
git commit -m "docs: record admin professionals management in STATUS"
```

---

## Self-Review

**Spec coverage:**
- Data model / no schema change → Task 2 (reuse User), constraints. ✓
- petTaxi in admin list → Task 2 `ADMIN_PROFESSIONAL_ROLES`. ✓
- Public `isActive` visibility fix → Task 2 (getAllProfessionals + getProfessionalById). ✓
- Delete dead code + rating route → Task 4. ✓
- Six endpoints (list/create/promote/edit/status/offboard) + upload → Task 3. ✓
- Create+invite via reset token, no raw password → Task 2 `createProfessionalAccount` + Task 3 email. ✓
- Promote existing → Task 2/3 + Task 7 UI. ✓
- Edit form (specialization, qualifications, experience, bio, photo, services, availability), rating read-only → Task 7. ✓
- Frontend list page + route registration (kills dead link) → Task 6. ✓
- API client → Task 5. ✓
- Tests: validator unit (Task 1), service integration (Task 2), HTTP integration (Task 3), FE api + pages (Tasks 5–7). ✓
- Error handling (dup email, promote non-customer, invite-failure warning) → Tasks 2/3. ✓

**Placeholder scan:** No TBD/TODO; every code step has full code. ✓

**Type consistency:** `professionalInfo.profileImage = {url, publicId}` consistent across service, controller upload, form. `adminProfessionalsApi.update(id, professionalInfo)` wraps in `{ professionalInfo }` matching `updateProfessionalInfoSchema`. `status ∈ all|active|inactive` consistent between `listQuerySchema`, service, and UI filters. Method names (`adminListProfessionals`, `createProfessionalAccount`, `promoteUserToProfessional`, `offboardProfessional`) identical in Task 2 definitions and Task 3 consumers. ✓

**Known integration points to verify during execution (flagged inline, not placeholders):** `DataTable` column/action prop shape (Task 6), `ImageManager` `max` vs `maxImages` prop name (Tasks 6–7), `logger` require path (Task 3), and `main.jsx` child-route object shape (Task 6) — each step says to check the real file and mirror it.
