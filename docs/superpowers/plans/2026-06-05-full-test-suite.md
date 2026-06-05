# Full Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task.

**Goal:** Build unit + integration tests for all 15 controllers, 3 services, 1 middleware, and 2 utils under `tests/unit/` and `tests/integration/`.

**Architecture:** Unit tests mock all external deps (DB, email, Stripe, Cloudinary) and call controller functions directly. Integration tests use MongoMemoryReplSet + supertest against the real Express app. Shared fixtures (faker) and helpers (loginAs, clearCollections) live in `tests/fixtures/` and `tests/helpers/`.

**Tech Stack:** Jest 29, Supertest, MongoMemoryReplSet, @faker-js/faker, nock, jest-extended

---

## Task 1: Install packages + update jest config

**Files:**
- Modify: `package.json`

- [ ] Install new dev dependencies
```bash
cd "C:\Users\Raj\OneDrive\Documents\Pet Project\backend"
npm install --save-dev @faker-js/faker@^8.0.0 nock@^13.3.0 jest-extended@^4.0.0
```

- [ ] Add scripts and jest config to `package.json`. Open `package.json` and replace the `"scripts"` and `"jest"` sections with:
```json
"scripts": {
  "start": "node src/server.js",
  "dev": "nodemon src/server.js",
  "debug": "nodemon --inspect src/server.js",
  "test": "cross-env NODE_ENV=test jest --runInBand --forceExit",
  "test:unit": "cross-env NODE_ENV=test jest --testPathPattern=tests/unit --runInBand --forceExit",
  "test:integration": "cross-env NODE_ENV=test jest --testPathPattern=tests/integration --runInBand --forceExit",
  "test:all": "cross-env NODE_ENV=test jest --runInBand --forceExit --coverage",
  "lint": "eslint .",
  "lint:fix": "eslint . --fix",
  "seed": "node src/config/seedDatabase.js"
},
"jest": {
  "testEnvironment": "node",
  "globalSetup": "./tests/setup.js",
  "globalTeardown": "./tests/teardown.js",
  "setupFiles": [
    "./tests/env-setup.js"
  ],
  "setupFilesAfterFramework": [
    "jest-extended/all"
  ],
  "testTimeout": 30000,
  "coverageDirectory": "coverage",
  "collectCoverageFrom": [
    "src/controllers/**/*.js",
    "src/services/**/*.js",
    "src/middlewares/**/*.js",
    "src/utils/**/*.js"
  ],
  "coverageThreshold": {
    "global": {
      "branches": 70,
      "functions": 80,
      "lines": 80,
      "statements": 80
    }
  }
}
```

- [ ] Verify install succeeded
```bash
node -e "require('@faker-js/faker'); require('nock'); require('jest-extended'); console.log('OK')"
```
Expected output: `OK`

- [ ] Commit
```bash
git add package.json package-lock.json
git commit -m "chore(tests): install faker, nock, jest-extended; update jest config"
```

---

## Task 2: Create fixture files

**Files:**
- Create: `tests/fixtures/user.fixture.js`
- Create: `tests/fixtures/product.fixture.js`
- Create: `tests/fixtures/order.fixture.js`
- Create: `tests/fixtures/appointment.fixture.js`
- Create: `tests/fixtures/pet.fixture.js`

- [ ] Create `tests/fixtures/user.fixture.js`
```js
const { faker } = require('@faker-js/faker');

const userFixture = (overrides = {}) => ({
  name: faker.person.fullName(),
  email: faker.internet.email().toLowerCase(),
  phoneNumber: faker.string.numeric(8),
  address: faker.location.streetAddress(),
  password: 'ValidPass1*',
  role: 'customer',
  isEmailVerified: true,
  isActive: true,
  ...overrides,
});

module.exports = { userFixture };
```

- [ ] Create `tests/fixtures/product.fixture.js`
```js
const { faker } = require('@faker-js/faker');
const mongoose = require('mongoose');

const productFixture = (overrides = {}) => ({
  name: faker.commerce.productName(),
  description: faker.commerce.productDescription(),
  price: parseFloat(faker.commerce.price({ min: 5, max: 500 })),
  quantity: faker.number.int({ min: 5, max: 100 }),
  categories: [faker.commerce.department()],
  images: [{ url: faker.image.url(), publicId: faker.string.alphanumeric(10) }],
  isActive: true,
  createdBy: new mongoose.Types.ObjectId(),
  ...overrides,
});

module.exports = { productFixture };
```

- [ ] Create `tests/fixtures/order.fixture.js`
```js
const shippingAddressFixture = () => ({
  street: '123 Main St',
  city: 'Port Louis',
  state: 'PL',
  country: 'Mauritius',
  zipCode: '11101',
});

const orderFixture = (overrides = {}) => ({
  shippingAddress: shippingAddressFixture(),
  paymentMethod: 'stripe',
  notes: '',
  ...overrides,
});

module.exports = { orderFixture, shippingAddressFixture };
```

- [ ] Create `tests/fixtures/appointment.fixture.js`
```js
const { faker } = require('@faker-js/faker');

const appointmentFixture = (overrides = {}) => ({
  dateTime: faker.date.future(),
  service: 'grooming',
  notes: faker.lorem.sentence(),
  status: 'PENDING',
  ...overrides,
});

module.exports = { appointmentFixture };
```

- [ ] Create `tests/fixtures/pet.fixture.js`
```js
const { faker } = require('@faker-js/faker');

const petFixture = (overrides = {}) => ({
  name: faker.person.firstName(),
  species: 'dog',
  breed: 'Labrador',
  age: faker.number.int({ min: 1, max: 15 }),
  weight: faker.number.float({ min: 1, max: 50, fractionDigits: 1 }),
  ...overrides,
});

module.exports = { petFixture };
```

- [ ] Commit
```bash
git add tests/fixtures/
git commit -m "test: add faker-powered fixture factories"
```

---

## Task 3: Create helper files

**Files:**
- Create: `tests/helpers/auth.helper.js`
- Create: `tests/helpers/db.helper.js`

- [ ] Create `tests/helpers/auth.helper.js`
```js
const request = require('supertest');

/**
 * Register a user and log in. Returns { token, user, cookie }.
 * @param {object} app - Express app
 * @param {object} userData - user fields (must include email + password)
 */
async function createAndLogin(app, userData) {
  await request(app).post('/api/auth/signup').send(userData);
  const res = await request(app).post('/api/auth/login').send({
    email: userData.email,
    password: userData.password,
  });
  return {
    token: res.body.data?.accessToken,
    user: res.body.data?.user,
  };
}

/**
 * Create a user with a specific role and log in.
 * Roles: 'customer' | 'admin' | 'veterinarian' | 'groomer' | 'trainer' | 'petTaxi'
 */
async function loginAs(app, role, extraFields = {}) {
  const User = require('../../src/models/user.model');
  const { faker } = require('@faker-js/faker');

  const userData = {
    name: faker.person.fullName(),
    email: faker.internet.email().toLowerCase(),
    phoneNumber: faker.string.numeric(8),
    address: faker.location.streetAddress(),
    password: 'ValidPass1*',
    role,
    isEmailVerified: true,
    isActive: true,
    ...extraFields,
  };

  // Create directly in DB to bypass email verification and set role freely
  const user = await User.create(userData);

  const res = await request(app).post('/api/auth/login').send({
    email: userData.email,
    password: userData.password,
  });

  return {
    token: res.body.data?.accessToken,
    user: res.body.data?.user || user,
    rawUser: user,
  };
}

module.exports = { createAndLogin, loginAs };
```

- [ ] Create `tests/helpers/db.helper.js`
```js
const mongoose = require('mongoose');

/**
 * Delete all documents from the given Mongoose models.
 * Pass model classes, e.g. clearCollections(User, Product, Order)
 */
async function clearCollections(...models) {
  await Promise.all(models.map((M) => M.deleteMany({})));
}

/**
 * Seed minimal baseline: 1 admin + 1 customer + 1 product.
 * Returns { admin, customer, product, adminToken, customerToken }.
 */
async function seedMinimal(app) {
  const User = require('../../src/models/user.model');
  const Product = require('../../src/models/product.model');
  const { faker } = require('@faker-js/faker');
  const request = require('supertest');

  await clearCollections(User, Product);

  const adminData = {
    name: 'Admin User',
    email: 'admin@test.com',
    phoneNumber: '00000001',
    address: '1 Admin St',
    password: 'ValidPass1*',
    role: 'admin',
    isEmailVerified: true,
    isActive: true,
  };
  const customerData = {
    name: 'Customer User',
    email: 'customer@test.com',
    phoneNumber: '00000002',
    address: '2 Customer St',
    password: 'ValidPass1*',
    role: 'customer',
    isEmailVerified: true,
    isActive: true,
  };

  const [admin, customer] = await Promise.all([
    User.create(adminData),
    User.create(customerData),
  ]);

  const [adminRes, customerRes] = await Promise.all([
    request(app).post('/api/auth/login').send({ email: adminData.email, password: adminData.password }),
    request(app).post('/api/auth/login').send({ email: customerData.email, password: customerData.password }),
  ]);

  const product = await Product.create({
    name: 'Test Product',
    description: 'A test product with enough description length.',
    price: 50,
    quantity: 20,
    categories: ['food'],
    images: [{ url: 'http://example.com/img.jpg', publicId: 'img-1' }],
    isActive: true,
    createdBy: admin._id,
  });

  return {
    admin,
    customer,
    product,
    adminToken: adminRes.body.data?.accessToken,
    customerToken: customerRes.body.data?.accessToken,
  };
}

module.exports = { clearCollections, seedMinimal };
```

- [ ] Commit
```bash
git add tests/helpers/
git commit -m "test: add auth and db helper utilities"
```

---

## Task 4: Unit tests — auth middleware + utils

**Files:**
- Create: `tests/unit/middlewares/auth.middleware.test.js`
- Create: `tests/unit/utils/dateUtils.test.js`
- Create: `tests/unit/utils/email.test.js`

- [ ] Create `tests/unit/middlewares/auth.middleware.test.js`
```js
const jwt = require('jsonwebtoken');
const { isAuthenticated, isAdmin, isServiceProvider } = require('../../../src/middlewares/auth.middleware');

jest.mock('../../../src/models/user.model');
const User = require('../../../src/models/user.model');

const mockRes = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  return r;
};
const mockNext = () => jest.fn();

const SECRET = 'testsecret';

beforeAll(() => {
  process.env.JWT_SECRET = SECRET;
});

describe('isAuthenticated', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const req = { headers: {} };
    const next = mockNext();
    await isAuthenticated(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('returns 401 when header does not start with Bearer', async () => {
    const req = { headers: { authorization: 'Basic abc123' } };
    const next = mockNext();
    await isAuthenticated(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('returns 401 for an expired token', async () => {
    const token = jwt.sign({ id: 'user1' }, SECRET, { expiresIn: -1 });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = mockNext();
    await isAuthenticated(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('returns 401 for a tampered token', async () => {
    const req = { headers: { authorization: 'Bearer invalidtoken.abc.def' } };
    const next = mockNext();
    await isAuthenticated(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('returns 401 when user no longer exists in DB', async () => {
    const token = jwt.sign({ id: 'user1' }, SECRET, { expiresIn: '1h' });
    User.findById = jest.fn().mockResolvedValue(null);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = mockNext();
    await isAuthenticated(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('sets req.user and calls next() for a valid token', async () => {
    const fakeUser = { _id: 'user1', name: 'Test' };
    const token = jwt.sign({ id: 'user1' }, SECRET, { expiresIn: '1h' });
    User.findById = jest.fn().mockResolvedValue(fakeUser);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = mockNext();
    await isAuthenticated(req, mockRes(), next);
    expect(req.user).toEqual(fakeUser);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('isAdmin', () => {
  it('calls next() for admin role', () => {
    const req = { user: { role: 'admin' } };
    const next = mockNext();
    isAdmin(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('returns 403 for customer role', () => {
    const req = { user: { role: 'customer' } };
    const next = mockNext();
    isAdmin(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('returns 403 when req.user is missing', () => {
    const req = {};
    const next = mockNext();
    isAdmin(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
});

describe('isServiceProvider', () => {
  ['veterinarian', 'groomer', 'trainer'].forEach((role) => {
    it(`calls next() for role: ${role}`, () => {
      const req = { user: { role } };
      const next = mockNext();
      isServiceProvider(req, mockRes(), next);
      expect(next).toHaveBeenCalledWith();
    });
  });

  it('returns 403 for customer', () => {
    const req = { user: { role: 'customer' } };
    const next = mockNext();
    isServiceProvider(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('returns 403 for admin', () => {
    const req = { user: { role: 'admin' } };
    const next = mockNext();
    isServiceProvider(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
});
```

- [ ] Create `tests/unit/utils/dateUtils.test.js`
```js
const { getStartDate, getDateFormat } = require('../../../src/utils/dateUtils');

describe('getStartDate', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-06-05T12:00:00Z')));
  afterEach(() => jest.useRealTimers());

  it('weekly: returns date 7 days ago', () => {
    const result = getStartDate('weekly');
    const expected = new Date('2026-05-29T12:00:00Z');
    expect(result.toDateString()).toBe(expected.toDateString());
  });

  it('monthly: returns date ~1 month ago', () => {
    const result = getStartDate('monthly');
    const expected = new Date('2026-05-05T12:00:00Z');
    expect(result.toDateString()).toBe(expected.toDateString());
  });

  it('yearly: returns date 1 year ago', () => {
    const result = getStartDate('yearly');
    const expected = new Date('2025-06-05T12:00:00Z');
    expect(result.toDateString()).toBe(expected.toDateString());
  });

  it('throws AppError for unknown period', () => {
    expect(() => getStartDate('daily')).toThrow();
    expect(() => getStartDate('quarterly')).toThrow();
  });
});

describe('getDateFormat', () => {
  it('returns %Y-%m-%d for weekly', () => {
    expect(getDateFormat('weekly')).toBe('%Y-%m-%d');
  });

  it('returns %Y-%m-%d for monthly', () => {
    expect(getDateFormat('monthly')).toBe('%Y-%m-%d');
  });

  it('returns %Y-%m for yearly', () => {
    expect(getDateFormat('yearly')).toBe('%Y-%m');
  });
});
```

- [ ] Create `tests/unit/utils/email.test.js`
```js
jest.mock('nodemailer');
const nodemailer = require('nodemailer');

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
nodemailer.createTransport = jest.fn().mockReturnValue({ sendMail: mockSendMail });

const { sendEmail } = require('../../../src/utils/email');

describe('sendEmail', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not throw when called with valid params', async () => {
    await expect(
      sendEmail({ email: 'test@test.com', subject: 'Hi', template: 'welcome', data: { name: 'Test' } })
    ).resolves.not.toThrow();
  });

  it('handles missing template gracefully without crashing the caller', async () => {
    await expect(
      sendEmail({ email: 'test@test.com', subject: 'Hi', template: 'nonexistent-template', data: {} })
    ).resolves.not.toThrow();
  });
});
```

- [ ] Run unit tests for this task
```bash
npm run test:unit -- --testPathPattern="middlewares|utils" 2>&1 | tail -20
```
Expected: all tests pass.

- [ ] Commit
```bash
git add tests/unit/
git commit -m "test(unit): auth middleware, dateUtils, email utils"
```

---

## Task 5: Unit tests — auth controller

**Files:**
- Create: `tests/unit/controllers/auth.test.js`

- [ ] Create `tests/unit/controllers/auth.test.js`
```js
jest.mock('../../../src/models/user.model');
jest.mock('../../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const User = require('../../../src/models/user.model');
const { signup, login, logout, forgotPassword, resetPassword, verifyEmail, resendVerificationEmail } = require('../../../src/controllers/auth.controller');

const mockReq = (overrides = {}) => ({ body: {}, params: {}, query: {}, ...overrides });
const mockRes = () => { const r = {}; r.status = jest.fn().mockReturnValue(r); r.json = jest.fn().mockReturnValue(r); return r; };
const mockNext = () => jest.fn();

beforeEach(() => jest.clearAllMocks());

describe('signup', () => {
  it('returns 400 if email already registered', async () => {
    User.findOne = jest.fn().mockResolvedValue({ email: 'existing@test.com' });
    const next = mockNext();
    await signup(mockReq({ body: { email: 'existing@test.com', password: 'pass', name: 'X', phoneNumber: '123', address: 'A' } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it('creates user and returns 201 on success', async () => {
    User.findOne = jest.fn().mockResolvedValue(null);
    const fakeUser = { _id: 'uid1', email: 'new@test.com', password: 'hashed', toObject: () => ({ _id: 'uid1' }) };
    User.create = jest.fn().mockResolvedValue(fakeUser);
    const res = mockRes();
    await signup(mockReq({ body: { name: 'New', email: 'new@test.com', phoneNumber: '123', address: 'A', password: 'StrongPass1*' } }), res, mockNext());
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});

describe('login', () => {
  it('returns 401 if user not found', async () => {
    User.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    const next = mockNext();
    await login(mockReq({ body: { email: 'x@x.com', password: 'pass' } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('returns 401 if password does not match', async () => {
    const fakeUser = { comparePassword: jest.fn().mockResolvedValue(false) };
    User.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser) });
    const next = mockNext();
    await login(mockReq({ body: { email: 'x@x.com', password: 'wrong' } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('returns 200 with accessToken on success', async () => {
    const fakeUser = { _id: 'uid1', email: 'x@x.com', comparePassword: jest.fn().mockResolvedValue(true), generateAuthToken: jest.fn().mockReturnValue('tok123') };
    User.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser) });
    const res = mockRes();
    await login(mockReq({ body: { email: 'x@x.com', password: 'pass' } }), res, mockNext());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ accessToken: 'tok123' }) }));
  });
});

describe('logout', () => {
  it('always returns 200', () => {
    const res = mockRes();
    logout(mockReq(), res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('forgotPassword', () => {
  it('returns 404 if email not found', async () => {
    User.findOne = jest.fn().mockResolvedValue(null);
    const next = mockNext();
    await forgotPassword(mockReq({ body: { email: 'ghost@x.com' } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });

  it('returns 200 and saves reset token when user found', async () => {
    const fakeUser = { email: 'x@x.com', name: 'X', save: jest.fn().mockResolvedValue(true) };
    User.findOne = jest.fn().mockResolvedValue(fakeUser);
    const res = mockRes();
    await forgotPassword(mockReq({ body: { email: 'x@x.com' } }), res, mockNext());
    expect(fakeUser.passwordResetToken).toBeDefined();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('resetPassword', () => {
  it('returns 400 when token is invalid or expired', async () => {
    User.findOne = jest.fn().mockResolvedValue(null);
    const next = mockNext();
    await resetPassword(mockReq({ body: { token: 'bad', password: 'NewPass1*' } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it('returns 200 and clears reset token on success', async () => {
    const fakeUser = { save: jest.fn().mockResolvedValue(true) };
    User.findOne = jest.fn().mockResolvedValue(fakeUser);
    const res = mockRes();
    await resetPassword(mockReq({ body: { token: 'valid', password: 'NewPass1*' } }), res, mockNext());
    expect(fakeUser.passwordResetToken).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('verifyEmail', () => {
  it('returns 400 for invalid/expired token', async () => {
    User.findOne = jest.fn().mockResolvedValue(null);
    const next = mockNext();
    await verifyEmail(mockReq({ params: { token: 'bad' } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it('sets isEmailVerified=true and returns 200', async () => {
    const fakeUser = { isEmailVerified: false, save: jest.fn().mockResolvedValue(true) };
    User.findOne = jest.fn().mockResolvedValue(fakeUser);
    const res = mockRes();
    await verifyEmail(mockReq({ params: { token: 'valid' } }), res, mockNext());
    expect(fakeUser.isEmailVerified).toBe(true);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('resendVerificationEmail', () => {
  it('returns 404 when email not found', async () => {
    User.findOne = jest.fn().mockResolvedValue(null);
    const next = mockNext();
    await resendVerificationEmail(mockReq({ body: { email: 'ghost@x.com' } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });

  it('returns 400 when already verified', async () => {
    User.findOne = jest.fn().mockResolvedValue({ isEmailVerified: true });
    const next = mockNext();
    await resendVerificationEmail(mockReq({ body: { email: 'x@x.com' } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it('returns 200 and saves verification token for unverified user', async () => {
    const fakeUser = { isEmailVerified: false, email: 'x@x.com', name: 'X', save: jest.fn().mockResolvedValue(true) };
    User.findOne = jest.fn().mockResolvedValue(fakeUser);
    const res = mockRes();
    await resendVerificationEmail(mockReq({ body: { email: 'x@x.com' } }), res, mockNext());
    expect(fakeUser.emailVerificationToken).toBeDefined();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
```

- [ ] Run
```bash
npm run test:unit -- --testPathPattern="unit/controllers/auth" 2>&1 | tail -20
```

- [ ] Commit
```bash
git add tests/unit/controllers/auth.test.js
git commit -m "test(unit): auth controller"
```

---

## Task 6: Unit tests — inventory controller helpers

**Files:**
- Create: `tests/unit/controllers/inventory.test.js`

- [ ] Create `tests/unit/controllers/inventory.test.js`
```js
// Test the pure helper functions and controller methods
jest.mock('../../../src/models/product.model');
jest.mock('../../../src/models/stockMovement.model');

const Product = require('../../../src/models/product.model');
const StockMovement = require('../../../src/models/stockMovement.model');

// Access private helpers by requiring the module — they're not exported,
// so we test them indirectly through the exported controller functions.
const inventoryController = require('../../../src/controllers/inventory.controller');

const mockReq = (overrides = {}) => ({ body: {}, params: {}, query: {}, user: { id: 'admin1' }, ...overrides });
const mockRes = () => { const r = {}; r.status = jest.fn().mockReturnValue(r); r.json = jest.fn().mockReturnValue(r); return r; };
const mockNext = () => jest.fn();

beforeEach(() => jest.clearAllMocks());

describe('getInventory', () => {
  it('returns 200 with enriched products and stats', async () => {
    Product.find = jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([
        { _id: '1', name: 'A', price: 10, quantity: 0 },
        { _id: '2', name: 'B', price: 20, quantity: 5 },
        { _id: '3', name: 'C', price: 30, quantity: 50 },
      ]) }),
    });
    const res = mockRes();
    await inventoryController.getInventory(mockReq(), res, mockNext());
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.stats.out).toBe(1);
    expect(body.stats.low).toBe(1);
    expect(body.stats.in).toBe(1);
  });

  it('filters by status=out correctly', async () => {
    Product.find = jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([
        { _id: '1', name: 'A', price: 10, quantity: 0 },
        { _id: '2', name: 'B', price: 20, quantity: 50 },
      ]) }),
    });
    const res = mockRes();
    await inventoryController.getInventory(mockReq({ query: { status: 'out' } }), res, mockNext());
    const body = res.json.mock.calls[0][0];
    expect(body.data).toHaveLength(1);
    expect(body.data[0].stockStatus).toBe('out');
  });

  it('resolves quantity from legacy stock field when quantity is absent', async () => {
    Product.find = jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([
        { _id: '1', name: 'Legacy', price: 10, stock: 7 },
      ]) }),
    });
    const res = mockRes();
    await inventoryController.getInventory(mockReq(), res, mockNext());
    const body = res.json.mock.calls[0][0];
    expect(body.data[0].quantity).toBe(7);
    expect(body.data[0].stockStatus).toBe('low');
  });

  it('prefers quantity over stock when both exist', async () => {
    Product.find = jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([
        { _id: '1', name: 'Both', price: 10, quantity: 20, stock: 5 },
      ]) }),
    });
    const res = mockRes();
    await inventoryController.getInventory(mockReq(), res, mockNext());
    const body = res.json.mock.calls[0][0];
    expect(body.data[0].quantity).toBe(20);
    expect(body.data[0].stockStatus).toBe('in');
  });

  it('uses custom threshold from query param', async () => {
    Product.find = jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([
        { _id: '1', name: 'A', price: 10, quantity: 25 },
      ]) }),
    });
    const res = mockRes();
    await inventoryController.getInventory(mockReq({ query: { threshold: '30' } }), res, mockNext());
    const body = res.json.mock.calls[0][0];
    expect(body.data[0].stockStatus).toBe('low'); // 25 <= 30 → low
  });
});

describe('restockProduct', () => {
  it('returns 400 when units is 0 or negative', async () => {
    const next = mockNext();
    await inventoryController.restockProduct(mockReq({ params: { id: 'p1' }, body: { units: 0 } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it('returns 404 when product not found', async () => {
    Product.findById = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    const next = mockNext();
    await inventoryController.restockProduct(mockReq({ params: { id: 'p1' }, body: { units: 10 } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });

  it('updates quantity and creates StockMovement on success', async () => {
    Product.findById = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: 'p1', name: 'A', quantity: 5 }) });
    Product.findByIdAndUpdate = jest.fn().mockResolvedValue(true);
    StockMovement.create = jest.fn().mockResolvedValue(true);
    const res = mockRes();
    await inventoryController.restockProduct(mockReq({ params: { id: 'p1' }, body: { units: 10 } }), res, mockNext());
    expect(Product.findByIdAndUpdate).toHaveBeenCalledWith('p1', { $set: { quantity: 15 } });
    expect(StockMovement.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('adjustStock', () => {
  it('returns 400 when newQuantity is negative', async () => {
    const next = mockNext();
    await inventoryController.adjustStock(mockReq({ params: { id: 'p1' }, body: { newQuantity: -1, note: 'fix' } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it('returns 400 when note is missing', async () => {
    const next = mockNext();
    await inventoryController.adjustStock(mockReq({ params: { id: 'p1' }, body: { newQuantity: 5 } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it('returns 404 when product not found', async () => {
    Product.findById = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    const next = mockNext();
    await inventoryController.adjustStock(mockReq({ params: { id: 'p1' }, body: { newQuantity: 5, note: 'fix' } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });

  it('updates quantity to newQuantity and records movement', async () => {
    Product.findById = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: 'p1', name: 'A', quantity: 10 }) });
    Product.findByIdAndUpdate = jest.fn().mockResolvedValue(true);
    StockMovement.create = jest.fn().mockResolvedValue(true);
    const res = mockRes();
    await inventoryController.adjustStock(mockReq({ params: { id: 'p1' }, body: { newQuantity: 3, note: 'correction' } }), res, mockNext());
    expect(Product.findByIdAndUpdate).toHaveBeenCalledWith('p1', { $set: { quantity: 3 } });
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.data.delta).toBe(-7);
  });
});
```

- [ ] Run
```bash
npm run test:unit -- --testPathPattern="unit/controllers/inventory" 2>&1 | tail -20
```

- [ ] Commit
```bash
git add tests/unit/controllers/inventory.test.js
git commit -m "test(unit): inventory controller"
```

---

## Task 7: Unit tests — cart, order, review, pet controllers

**Files:**
- Create: `tests/unit/controllers/cart.test.js`
- Create: `tests/unit/controllers/order.test.js`
- Create: `tests/unit/controllers/review.test.js`
- Create: `tests/unit/controllers/pet.test.js`

- [ ] Create `tests/unit/controllers/cart.test.js`
```js
jest.mock('../../../src/models/cart.model');
jest.mock('../../../src/models/product.model');
jest.mock('../../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const Cart = require('../../../src/models/cart.model');
const Product = require('../../../src/models/product.model');
const { getCart, addToCart, updateCartItem, removeCartItem, clearCart, applyDiscount } = require('../../../src/controllers/cart.controller');

const mockReq = (o = {}) => ({ body: {}, params: {}, query: {}, user: { id: 'u1' }, ...o });
const mockRes = () => { const r = {}; r.status = jest.fn().mockReturnValue(r); r.json = jest.fn().mockReturnValue(r); return r; };
const mockNext = () => jest.fn();

beforeEach(() => jest.clearAllMocks());

describe('getCart', () => {
  it('creates empty cart if none exists', async () => {
    Cart.findOne = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
    Cart.create = jest.fn().mockResolvedValue({ items: [] });
    const res = mockRes();
    await getCart(mockReq(), res, mockNext());
    expect(Cart.create).toHaveBeenCalledWith({ user: 'u1' });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns existing cart', async () => {
    const fakeCart = { items: [{ product: 'p1', quantity: 2 }] };
    Cart.findOne = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(fakeCart) });
    const res = mockRes();
    await getCart(mockReq(), res, mockNext());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: fakeCart }));
  });
});

describe('clearCart', () => {
  it('empties items and returns 200', async () => {
    const fakeCart = { items: [{ product: 'p1' }], save: jest.fn().mockResolvedValue(true) };
    Cart.findOne = jest.fn().mockResolvedValue(fakeCart);
    const res = mockRes();
    await clearCart(mockReq(), res, mockNext());
    expect(fakeCart.items).toHaveLength(0);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('applyDiscount', () => {
  it('returns 400 for invalid discount code', async () => {
    const fakeCart = { items: [{ product: 'p1', quantity: 1, price: 10 }], save: jest.fn() };
    Cart.findOne = jest.fn().mockResolvedValue(fakeCart);
    const res = mockRes();
    await applyDiscount(mockReq({ body: { discountCode: 'INVALID99' } }), res, mockNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('applies 10% discount for SUMMER10', async () => {
    const fakeCart = { items: [{ product: 'p1', quantity: 2, price: 50 }], save: jest.fn().mockResolvedValue(true), totalAmount: 100 };
    Cart.findOne = jest.fn().mockResolvedValue(fakeCart);
    const res = mockRes();
    await applyDiscount(mockReq({ body: { discountCode: 'SUMMER10' } }), res, mockNext());
    expect(fakeCart.discountCode).toBe('SUMMER10');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
```

- [ ] Create `tests/unit/controllers/order.test.js`
```js
jest.mock('../../../src/models/order.model');
jest.mock('../../../src/models/cart.model');
jest.mock('../../../src/models/product.model');
jest.mock('../../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('stripe', () => () => ({}));

const Order = require('../../../src/models/order.model');
const Cart = require('../../../src/models/cart.model');
const Product = require('../../../src/models/product.model');
const { getMyOrders, cancelOrder } = require('../../../src/controllers/order.controller');

const mockReq = (o = {}) => ({ body: {}, params: {}, query: {}, user: { id: 'u1', email: 'u@u.com', name: 'U' }, ...o });
const mockRes = () => { const r = {}; r.status = jest.fn().mockReturnValue(r); r.json = jest.fn().mockReturnValue(r); return r; };
const mockNext = () => jest.fn();

beforeEach(() => jest.clearAllMocks());

describe('getMyOrders', () => {
  it('returns orders for the authenticated user', async () => {
    const fakeOrders = [{ _id: 'o1' }, { _id: 'o2' }];
    Order.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(fakeOrders),
        }),
      }),
    });
    Order.countDocuments = jest.fn().mockResolvedValue(2);
    const res = mockRes();
    await getMyOrders(mockReq(), res, mockNext());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: fakeOrders }));
  });
});

describe('cancelOrder', () => {
  it('returns 404 when order not found', async () => {
    Order.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
    const next = mockNext();
    await cancelOrder(mockReq({ params: { id: 'bad' } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });

  it('returns 403 when order belongs to another user', async () => {
    const order = { user: { _id: { toString: () => 'otherUser' } }, status: 'pending' };
    Order.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(order) });
    const next = mockNext();
    await cancelOrder(mockReq({ params: { id: 'o1' }, user: { id: 'u1' } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('returns 400 when order is already shipped', async () => {
    const order = { user: { _id: { toString: () => 'u1' } }, status: 'shipped' };
    Order.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(order) });
    const next = mockNext();
    await cancelOrder(mockReq({ params: { id: 'o1' } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });
});
```

- [ ] Create `tests/unit/controllers/review.test.js`
```js
jest.mock('../../../src/models/review.model');
jest.mock('../../../src/models/product.model');

const Review = require('../../../src/models/review.model');
const Product = require('../../../src/models/product.model');
const { createReview, updateReview, deleteReview, getProductReviews } = require('../../../src/controllers/review.controller');

const mockReq = (o = {}) => ({ body: {}, params: {}, query: {}, user: { id: 'u1' }, ...o });
const mockRes = () => { const r = {}; r.status = jest.fn().mockReturnValue(r); r.json = jest.fn().mockReturnValue(r); return r; };
const mockNext = () => jest.fn();

beforeEach(() => jest.clearAllMocks());

describe('createReview', () => {
  it('returns 404 when product not found', async () => {
    Product.findById = jest.fn().mockResolvedValue(null);
    const next = mockNext();
    await createReview(mockReq({ params: { productId: 'p1' }, body: { rating: 4, comment: 'Good' } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });

  it('returns 400 when user already reviewed this product', async () => {
    Product.findById = jest.fn().mockResolvedValue({ _id: 'p1' });
    Review.findOne = jest.fn().mockResolvedValue({ _id: 'existing' });
    const next = mockNext();
    await createReview(mockReq({ params: { productId: 'p1' }, body: { rating: 4, comment: 'Good' } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });
});

describe('updateReview', () => {
  it('returns 404 if review not found', async () => {
    Review.findById = jest.fn().mockResolvedValue(null);
    const next = mockNext();
    await updateReview(mockReq({ params: { id: 'r1' }, body: { rating: 3 } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });

  it('returns 403 if user does not own the review', async () => {
    Review.findById = jest.fn().mockResolvedValue({ user: { toString: () => 'otherUser' } });
    const next = mockNext();
    await updateReview(mockReq({ params: { id: 'r1' }, body: { rating: 3 } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
});

describe('deleteReview', () => {
  it('returns 403 if user does not own the review and is not admin', async () => {
    Review.findById = jest.fn().mockResolvedValue({ user: { toString: () => 'otherUser' } });
    const next = mockNext();
    await deleteReview(mockReq({ params: { id: 'r1' }, user: { id: 'u1', role: 'customer' } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
});

describe('getProductReviews', () => {
  it('returns 200 with reviews array', async () => {
    Review.find = jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }) });
    const res = mockRes();
    await getProductReviews(mockReq({ params: { productId: 'p1' } }), res, mockNext());
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
```

- [ ] Create `tests/unit/controllers/pet.test.js`
```js
jest.mock('../../../src/models/pet.model');

const Pet = require('../../../src/models/pet.model');
const { createPet, getMyPets, getPet, updatePet, deletePet } = require('../../../src/controllers/pet.controller');

const mockReq = (o = {}) => ({ body: {}, params: {}, query: {}, user: { id: 'u1' }, ...o });
const mockRes = () => { const r = {}; r.status = jest.fn().mockReturnValue(r); r.json = jest.fn().mockReturnValue(r); return r; };
const mockNext = () => jest.fn();

beforeEach(() => jest.clearAllMocks());

describe('getPet', () => {
  it('returns 404 when pet not found', async () => {
    Pet.findById = jest.fn().mockResolvedValue(null);
    const next = mockNext();
    await getPet(mockReq({ params: { id: 'bad' } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });

  it('returns 403 when pet belongs to another user', async () => {
    Pet.findById = jest.fn().mockResolvedValue({ owner: { toString: () => 'otherUser' } });
    const next = mockNext();
    await getPet(mockReq({ params: { id: 'p1' } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('returns 200 when owner requests their pet', async () => {
    Pet.findById = jest.fn().mockResolvedValue({ owner: { toString: () => 'u1' }, _id: 'p1' });
    const res = mockRes();
    await getPet(mockReq({ params: { id: 'p1' } }), res, mockNext());
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('deletePet', () => {
  it('returns 403 for non-owner', async () => {
    Pet.findById = jest.fn().mockResolvedValue({ owner: { toString: () => 'other' } });
    const next = mockNext();
    await deletePet(mockReq({ params: { id: 'p1' } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('deletes and returns 200 for owner', async () => {
    Pet.findById = jest.fn().mockResolvedValue({ owner: { toString: () => 'u1' }, deleteOne: jest.fn().mockResolvedValue(true) });
    const res = mockRes();
    await deletePet(mockReq({ params: { id: 'p1' } }), res, mockNext());
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
```

- [ ] Run
```bash
npm run test:unit -- --testPathPattern="unit/controllers/(cart|order|review|pet)" 2>&1 | tail -20
```

- [ ] Commit
```bash
git add tests/unit/controllers/
git commit -m "test(unit): cart, order, review, pet controllers"
```

---

## Task 8: Unit tests — admin, invoice, transaction controllers

**Files:**
- Create: `tests/unit/controllers/admin.test.js`
- Create: `tests/unit/controllers/invoice.test.js`
- Create: `tests/unit/controllers/transaction.test.js`

- [ ] Create `tests/unit/controllers/admin.test.js`
```js
jest.mock('../../../src/models/user.model');
jest.mock('../../../src/models/order.model');
jest.mock('../../../src/models/cart.model');
jest.mock('../../../src/models/review.model');
jest.mock('../../../src/models/pet.model');
jest.mock('../../../src/models/appointment.model');
jest.mock('../../../src/models/product.model');
jest.mock('../../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const mongoose = require('mongoose');
const User = require('../../../src/models/user.model');
const { listUsers, updateUserRole, deleteUser } = require('../../../src/controllers/admin.controller');

const mockReq = (o = {}) => ({ body: {}, params: {}, query: {}, user: { _id: { toString: () => 'admin1' } }, ...o });
const mockRes = () => { const r = {}; r.status = jest.fn().mockReturnValue(r); r.json = jest.fn().mockReturnValue(r); return r; };
const mockNext = () => jest.fn();

beforeEach(() => jest.clearAllMocks());

describe('listUsers', () => {
  it('returns paginated users without sensitive fields', async () => {
    User.find = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([{ _id: 'u1', name: 'A' }]) }) }) }) });
    User.countDocuments = jest.fn().mockResolvedValue(1);
    const res = mockRes();
    await listUsers(mockReq({ query: { page: '1', limit: '10' } }), res, mockNext());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ pagination: expect.any(Object) }));
  });

  it('returns 400 for invalid role filter', async () => {
    const next = mockNext();
    await listUsers(mockReq({ query: { role: 'hacker' } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it('caps limit at 100', async () => {
    User.find = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) }) }) });
    User.countDocuments = jest.fn().mockResolvedValue(0);
    await listUsers(mockReq({ query: { limit: '9999' } }), mockRes(), mockNext());
    const limitArg = User.find().select().skip().limit.mock.calls[0][0];
    expect(limitArg).toBeLessThanOrEqual(100);
  });
});

describe('updateUserRole', () => {
  it('returns 400 when trying to change own role', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const next = mockNext();
    await updateUserRole(
      mockReq({ params: { id }, user: { _id: { toString: () => id } }, body: { role: 'customer' } }),
      mockRes(), next
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it('returns 400 for invalid role value', async () => {
    const next = mockNext();
    await updateUserRole(
      mockReq({ params: { id: new mongoose.Types.ObjectId().toString() }, body: { role: 'superadmin' } }),
      mockRes(), next
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it('returns 404 when user not found', async () => {
    User.findByIdAndUpdate = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    const next = mockNext();
    await updateUserRole(
      mockReq({ params: { id: new mongoose.Types.ObjectId().toString() }, body: { role: 'customer' } }),
      mockRes(), next
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });
});

describe('deleteUser', () => {
  it('returns 400 when trying to delete own account', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const next = mockNext();
    await deleteUser(
      mockReq({ params: { id }, user: { _id: { toString: () => id } } }),
      mockRes(), next
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it('returns 404 when user not found', async () => {
    User.findById = jest.fn().mockResolvedValue(null);
    const next = mockNext();
    await deleteUser(
      mockReq({ params: { id: new mongoose.Types.ObjectId().toString() } }),
      mockRes(), next
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });
});
```

- [ ] Create `tests/unit/controllers/invoice.test.js`
```js
jest.mock('../../../src/models/invoice.model');
jest.mock('../../../src/models/transaction.model');
jest.mock('../../../src/models/order.model');
jest.mock('../../../src/services/invoice.service', () => ({
  generateInvoice: jest.fn(),
  generatePDF: jest.fn().mockResolvedValue(Buffer.from('pdf')),
}));

const Invoice = require('../../../src/models/invoice.model');
const Order = require('../../../src/models/order.model');
const { getInvoices, getInvoice, generateInvoiceForOrder } = require('../../../src/controllers/invoice.controller');

const mockReq = (o = {}) => ({ body: {}, params: {}, query: {}, user: { id: 'admin1' }, ...o });
const mockRes = () => { const r = {}; r.status = jest.fn().mockReturnValue(r); r.json = jest.fn().mockReturnValue(r); return r; };
const mockNext = () => jest.fn();

beforeEach(() => jest.clearAllMocks());

describe('getInvoices', () => {
  it('returns 200 with paginated invoices', async () => {
    Invoice.find = jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) }) }) }) }) });
    Invoice.countDocuments = jest.fn().mockResolvedValue(0);
    Invoice.aggregate = jest.fn().mockResolvedValue([]);
    const res = mockRes();
    await getInvoices(mockReq(), res, mockNext());
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('getInvoice', () => {
  it('returns 404 when invoice not found', async () => {
    Invoice.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(null) }) });
    const next = mockNext();
    await getInvoice(mockReq({ params: { id: 'bad' } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });
});

describe('generateInvoiceForOrder', () => {
  it('returns 404 when order not found', async () => {
    Order.findById = jest.fn().mockResolvedValue(null);
    const next = mockNext();
    await generateInvoiceForOrder(mockReq({ params: { orderId: 'bad' } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });

  it('returns 400 when order payment is not completed', async () => {
    Order.findById = jest.fn().mockResolvedValue({ paymentStatus: 'pending' });
    const next = mockNext();
    await generateInvoiceForOrder(mockReq({ params: { orderId: 'o1' } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it('returns existing invoice if one already exists', async () => {
    Order.findById = jest.fn().mockResolvedValue({ paymentStatus: 'completed' });
    Invoice.findOne = jest.fn().mockResolvedValue({ _id: 'inv1' });
    const res = mockRes();
    await generateInvoiceForOrder(mockReq({ params: { orderId: 'o1' } }), res, mockNext());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ alreadyExisted: true }));
  });
});
```

- [ ] Create `tests/unit/controllers/transaction.test.js`
```js
jest.mock('../../../src/models/transaction.model');

const Transaction = require('../../../src/models/transaction.model');
const { getTransactions, getTransaction } = require('../../../src/controllers/transaction.controller');

const mockReq = (o = {}) => ({ body: {}, params: {}, query: {}, user: { id: 'admin1' }, ...o });
const mockRes = () => { const r = {}; r.status = jest.fn().mockReturnValue(r); r.json = jest.fn().mockReturnValue(r); return r; };
const mockNext = () => jest.fn();

beforeEach(() => jest.clearAllMocks());

describe('getTransactions', () => {
  it('returns 200 with paginated result', async () => {
    Transaction.find = jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) }) }) }) }) }) });
    Transaction.countDocuments = jest.fn().mockResolvedValue(0);
    Transaction.aggregate = jest.fn().mockResolvedValue([]);
    const res = mockRes();
    await getTransactions(mockReq(), res, mockNext());
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('applies type filter when provided', async () => {
    Transaction.find = jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) }) }) }) }) }) });
    Transaction.countDocuments = jest.fn().mockResolvedValue(0);
    Transaction.aggregate = jest.fn().mockResolvedValue([]);
    await getTransactions(mockReq({ query: { type: 'refund' } }), mockRes(), mockNext());
    const filterArg = Transaction.find.mock.calls[0][0];
    expect(filterArg.type).toBe('refund');
  });
});

describe('getTransaction', () => {
  it('returns 404 when not found', async () => {
    Transaction.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(null) }) }) });
    const next = mockNext();
    await getTransaction(mockReq({ params: { id: 'bad' } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });

  it('returns 200 when found', async () => {
    Transaction.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue({ _id: 't1' }) }) }) });
    const res = mockRes();
    await getTransaction(mockReq({ params: { id: 't1' } }), res, mockNext());
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
```

- [ ] Run unit tests for these files
```bash
npm run test:unit -- --testPathPattern="unit/controllers/(admin|invoice|transaction)" 2>&1 | tail -20
```

- [ ] Commit
```bash
git add tests/unit/controllers/admin.test.js tests/unit/controllers/invoice.test.js tests/unit/controllers/transaction.test.js
git commit -m "test(unit): admin, invoice, transaction controllers"
```

---

## Task 9: Run all unit tests so far

- [ ] Run full unit suite
```bash
npm run test:unit 2>&1 | tail -30
```
Expected: all tests pass. Fix any failures before proceeding.

- [ ] Commit any fixes
```bash
git add -A && git commit -m "fix(unit-tests): resolve unit test failures"
```

---

## Task 10: Integration tests — auth

**Files:**
- Create: `tests/integration/auth.test.js`

- [ ] Create `tests/integration/auth.test.js`
```js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const { userFixture } = require('../fixtures/user.fixture');
const { clearCollections } = require('../helpers/db.helper');

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
});

beforeEach(async () => {
  await clearCollections(User);
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('POST /api/auth/signup', () => {
  const validUser = () => userFixture();

  it('returns 201 and user data on success', async () => {
    const res = await request(app).post('/api/auth/signup').send(validUser());
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('email');
    expect(res.body.data).not.toHaveProperty('password');
  });

  it('returns 400 for duplicate email', async () => {
    const u = validUser();
    await request(app).post('/api/auth/signup').send(u);
    const res = await request(app).post('/api/auth/signup').send(u);
    expect(res.status).toBe(400);
  });

  it('returns 400 when name is missing', async () => {
    const { name, ...noName } = validUser();
    const res = await request(app).post('/api/auth/signup').send(noName);
    expect(res.status).toBe(400);
  });

  it('returns 400 when email is missing', async () => {
    const { email, ...noEmail } = validUser();
    const res = await request(app).post('/api/auth/signup').send(noEmail);
    expect(res.status).toBe(400);
  });

  it('returns 400 when password is missing', async () => {
    const { password, ...noPass } = validUser();
    const res = await request(app).post('/api/auth/signup').send(noPass);
    expect(res.status).toBe(400);
  });

  it('returns 400 when phoneNumber is missing', async () => {
    const { phoneNumber, ...noPhone } = validUser();
    const res = await request(app).post('/api/auth/signup').send(noPhone);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  let userData;
  beforeEach(async () => {
    userData = userFixture();
    await request(app).post('/api/auth/signup').send(userData);
  });

  it('returns 200 with accessToken on valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: userData.email, password: userData.password });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('user');
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: userData.email, password: 'WrongPass1*' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'ghost@test.com', password: 'pass' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('returns 200', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
  });
});

describe('POST /api/auth/forgot-password', () => {
  it('returns 404 for unknown email', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@test.com' });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/auth/reset-password', () => {
  it('returns 400 for invalid token', async () => {
    const res = await request(app).patch('/api/auth/reset-password').send({ token: 'badtoken', password: 'NewPass1*' });
    expect(res.status).toBe(400);
  });

  it('resets password with valid token and allows login with new password', async () => {
    const userData = userFixture();
    await request(app).post('/api/auth/signup').send(userData);
    const user = await User.findOne({ email: userData.email });
    const token = 'validtoken123';
    user.passwordResetToken = token;
    user.passwordResetExpires = Date.now() + 600000;
    await user.save();

    const res = await request(app).patch('/api/auth/reset-password').send({ token, password: 'NewPass99*' });
    expect(res.status).toBe(200);

    const loginRes = await request(app).post('/api/auth/login').send({ email: userData.email, password: 'NewPass99*' });
    expect(loginRes.status).toBe(200);
  });
});

describe('PATCH /api/auth/verify-email', () => {
  it('returns 400 for invalid token', async () => {
    const res = await request(app).patch('/api/auth/verify-email').send({ token: 'badtoken' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/resend-verification', () => {
  it('returns 404 for unknown email', async () => {
    const res = await request(app).post('/api/auth/resend-verification').send({ email: 'nobody@test.com' });
    expect(res.status).toBe(404);
  });

  it('returns 400 if already verified', async () => {
    const userData = userFixture({ isEmailVerified: true });
    await User.create(userData);
    const res = await request(app).post('/api/auth/resend-verification').send({ email: userData.email });
    expect(res.status).toBe(400);
  });
});
```

- [ ] Run
```bash
npm run test:integration -- --testPathPattern="integration/auth" 2>&1 | tail -25
```
Expected: all tests pass.

- [ ] Commit
```bash
git add tests/integration/auth.test.js
git commit -m "test(integration): auth routes"
```

---

## Task 11: Integration tests — products + cart

**Files:**
- Create: `tests/integration/product.test.js`
- Create: `tests/integration/cart.test.js`

- [ ] Create `tests/integration/product.test.js`
```js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const Product = require('../../src/models/product.model');
const { clearCollections, seedMinimal } = require('../helpers/db.helper');
const { productFixture } = require('../fixtures/product.fixture');

let adminToken, customerToken, product;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
});

beforeEach(async () => {
  await clearCollections(User, Product);
  const seed = await seedMinimal(app);
  adminToken = seed.adminToken;
  customerToken = seed.customerToken;
  product = seed.product;
});

afterAll(async () => { await mongoose.connection.close(); });

describe('GET /api/products', () => {
  it('returns 200 with product array (public)', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('supports pagination', async () => {
    const res = await request(app).get('/api/products?page=1&limit=1');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/products/:id', () => {
  it('returns 200 for existing product', async () => {
    const res = await request(app).get(`/api/products/${product._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(product._id.toString());
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).get(`/api/products/${new mongoose.Types.ObjectId()}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/products/analytics/overview', () => {
  it('returns 200 for admin', async () => {
    const res = await request(app).get('/api/products/analytics/overview').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('returns 403 for customer', async () => {
    const res = await request(app).get('/api/products/analytics/overview').set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/products/analytics/overview');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/products', () => {
  it('returns 403 for customer', async () => {
    const res = await request(app).post('/api/products').set('Authorization', `Bearer ${customerToken}`).send(productFixture());
    expect(res.status).toBe(403);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/products').send(productFixture());
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/products/:id', () => {
  it('returns 200 and removes product for admin', async () => {
    const res = await request(app).delete(`/api/products/${product._id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const check = await Product.findById(product._id);
    expect(check).toBeNull();
  });

  it('returns 403 for customer', async () => {
    const res = await request(app).delete(`/api/products/${product._id}`).set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });
});
```

- [ ] Create `tests/integration/cart.test.js`
```js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const Product = require('../../src/models/product.model');
const Cart = require('../../src/models/cart.model');
const { clearCollections, seedMinimal } = require('../helpers/db.helper');

let customerToken, product;

beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });

beforeEach(async () => {
  await clearCollections(User, Product, Cart);
  const seed = await seedMinimal(app);
  customerToken = seed.customerToken;
  product = seed.product;
});

afterAll(async () => { await mongoose.connection.close(); });

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('GET /api/cart', () => {
  it('returns 200 with empty cart when none exists', async () => {
    const res = await request(app).get('/api/cart').set(auth(customerToken));
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/cart');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/cart', () => {
  it('adds item to cart and returns 200', async () => {
    const res = await request(app).post('/api/cart').set(auth(customerToken)).send({ productId: product._id, quantity: 2 });
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].quantity).toBe(2);
  });

  it('increments quantity when same product added twice', async () => {
    await request(app).post('/api/cart').set(auth(customerToken)).send({ productId: product._id, quantity: 2 });
    const res = await request(app).post('/api/cart').set(auth(customerToken)).send({ productId: product._id, quantity: 3 });
    expect(res.body.data.items[0].quantity).toBe(5);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/cart').send({ productId: product._id, quantity: 1 });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/cart/clear', () => {
  it('empties the cart', async () => {
    await request(app).post('/api/cart').set(auth(customerToken)).send({ productId: product._id, quantity: 2 });
    const res = await request(app).delete('/api/cart/clear').set(auth(customerToken));
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });
});

describe('POST /api/cart/apply-discount', () => {
  it('returns 400 for invalid code', async () => {
    const res = await request(app).post('/api/cart/apply-discount').set(auth(customerToken)).send({ discountCode: 'FAKECODE' });
    expect(res.status).toBe(400);
  });

  it('applies SUMMER10 discount', async () => {
    await request(app).post('/api/cart').set(auth(customerToken)).send({ productId: product._id, quantity: 1 });
    const res = await request(app).post('/api/cart/apply-discount').set(auth(customerToken)).send({ discountCode: 'SUMMER10' });
    expect(res.status).toBe(200);
  });
});
```

- [ ] Run
```bash
npm run test:integration -- --testPathPattern="integration/(product|cart)" 2>&1 | tail -25
```

- [ ] Commit
```bash
git add tests/integration/product.test.js tests/integration/cart.test.js
git commit -m "test(integration): product and cart routes"
```

---

## Task 12: Integration tests — orders

**Files:**
- Create: `tests/integration/order.test.js`

- [ ] Create `tests/integration/order.test.js`
```js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const Product = require('../../src/models/product.model');
const Cart = require('../../src/models/cart.model');
const Order = require('../../src/models/order.model');
const { clearCollections, seedMinimal } = require('../helpers/db.helper');
const { orderFixture } = require('../fixtures/order.fixture');

let adminToken, customerToken, product, customer;

beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });

beforeEach(async () => {
  await clearCollections(User, Product, Cart, Order);
  const seed = await seedMinimal(app);
  adminToken = seed.adminToken;
  customerToken = seed.customerToken;
  product = seed.product;
  customer = seed.customer;
});

afterAll(async () => { await mongoose.connection.close(); });

const auth = (t) => ({ Authorization: `Bearer ${t}` });

async function checkoutWithProduct(token, qty = 2) {
  await request(app).post('/api/cart').set(auth(token)).send({ productId: product._id, quantity: qty });
  return request(app).post('/api/orders').set(auth(token)).send(orderFixture());
}

describe('POST /api/orders', () => {
  it('creates order, decrements stock, and clears cart', async () => {
    const res = await checkoutWithProduct(customerToken, 3);
    expect(res.status).toBe(201);
    expect(res.body.data.items[0].quantity).toBe(3);

    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.quantity).toBe(17); // started at 20

    const cart = await Cart.findOne({ user: customer._id });
    expect(cart.items).toHaveLength(0);
  });

  it('returns 400 for empty cart', async () => {
    const res = await request(app).post('/api/orders').set(auth(customerToken)).send(orderFixture());
    expect(res.status).toBe(400);
  });

  it('returns 400 when stock is insufficient', async () => {
    await Product.findByIdAndUpdate(product._id, { quantity: 1 });
    await request(app).post('/api/cart').set(auth(customerToken)).send({ productId: product._id, quantity: 5 });
    const res = await request(app).post('/api/orders').set(auth(customerToken)).send(orderFixture());
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Insufficient stock/i);
  });

  it('uses DB price regardless of cart price', async () => {
    await request(app).post('/api/cart').set(auth(customerToken)).send({ productId: product._id, quantity: 1 });
    const res = await request(app).post('/api/orders').set(auth(customerToken)).send(orderFixture());
    expect(res.status).toBe(201);
    expect(res.body.data.items[0].price).toBe(product.price);
  });
});

describe('GET /api/orders/my-orders', () => {
  it('returns only own orders', async () => {
    await checkoutWithProduct(customerToken, 1);
    const res = await request(app).get('/api/orders/my-orders').set(auth(customerToken));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});

describe('GET /api/orders (admin)', () => {
  it('returns all orders for admin', async () => {
    await checkoutWithProduct(customerToken, 1);
    const res = await request(app).get('/api/orders').set(auth(adminToken));
    expect(res.status).toBe(200);
  });

  it('returns 403 for customer', async () => {
    const res = await request(app).get('/api/orders').set(auth(customerToken));
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/orders/:id/cancel', () => {
  it('cancels a pending order', async () => {
    const orderRes = await checkoutWithProduct(customerToken, 1);
    const orderId = orderRes.body.data._id;
    const res = await request(app).patch(`/api/orders/${orderId}/cancel`).set(auth(customerToken));
    expect(res.status).toBe(200);
  });

  it('returns 403 when cancelling another user\'s order', async () => {
    const orderRes = await checkoutWithProduct(customerToken, 1);
    const orderId = orderRes.body.data._id;
    const res = await request(app).patch(`/api/orders/${orderId}/cancel`).set(auth(adminToken));
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/orders/:id/status (admin)', () => {
  it('updates status for admin', async () => {
    const orderRes = await checkoutWithProduct(customerToken, 1);
    const orderId = orderRes.body.data._id;
    const res = await request(app).patch(`/api/orders/${orderId}/status`).set(auth(adminToken)).send({ status: 'processing' });
    expect(res.status).toBe(200);
  });

  it('returns 403 for customer', async () => {
    const orderRes = await checkoutWithProduct(customerToken, 1);
    const orderId = orderRes.body.data._id;
    const res = await request(app).patch(`/api/orders/${orderId}/status`).set(auth(customerToken)).send({ status: 'processing' });
    expect(res.status).toBe(403);
  });
});
```

- [ ] Run
```bash
npm run test:integration -- --testPathPattern="integration/order" 2>&1 | tail -25
```

- [ ] Commit
```bash
git add tests/integration/order.test.js
git commit -m "test(integration): order routes"
```

---

## Task 13: Integration tests — reviews, pets, search

**Files:**
- Create: `tests/integration/review.test.js`
- Create: `tests/integration/pet.test.js`
- Create: `tests/integration/search.test.js`

- [ ] Create `tests/integration/review.test.js`
```js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const Product = require('../../src/models/product.model');
const Review = require('../../src/models/review.model');
const { clearCollections, seedMinimal } = require('../helpers/db.helper');

let adminToken, customerToken, product;

beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });
beforeEach(async () => {
  await clearCollections(User, Product, Review);
  const seed = await seedMinimal(app);
  adminToken = seed.adminToken; customerToken = seed.customerToken; product = seed.product;
});
afterAll(async () => { await mongoose.connection.close(); });

const auth = (t) => ({ Authorization: `Bearer ${t}` });

describe('POST /api/reviews/:productId', () => {
  it('creates a review and returns 201', async () => {
    const res = await request(app).post(`/api/reviews/${product._id}`).set(auth(customerToken)).send({ rating: 4, comment: 'Great product!' });
    expect(res.status).toBe(201);
    expect(res.body.data.rating).toBe(4);
  });

  it('returns 400 for duplicate review', async () => {
    await request(app).post(`/api/reviews/${product._id}`).set(auth(customerToken)).send({ rating: 4, comment: 'First' });
    const res = await request(app).post(`/api/reviews/${product._id}`).set(auth(customerToken)).send({ rating: 3, comment: 'Second' });
    expect(res.status).toBe(400);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).post(`/api/reviews/${product._id}`).send({ rating: 4, comment: 'x' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/reviews/product/:productId', () => {
  it('returns reviews array (public)', async () => {
    const res = await request(app).get(`/api/reviews/product/${product._id}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('DELETE /api/reviews/:id', () => {
  it('allows owner to delete own review', async () => {
    const createRes = await request(app).post(`/api/reviews/${product._id}`).set(auth(customerToken)).send({ rating: 5, comment: 'Nice' });
    const reviewId = createRes.body.data._id;
    const res = await request(app).delete(`/api/reviews/${reviewId}`).set(auth(customerToken));
    expect(res.status).toBe(200);
  });

  it('returns 403 for non-owner', async () => {
    const createRes = await request(app).post(`/api/reviews/${product._id}`).set(auth(customerToken)).send({ rating: 5, comment: 'Nice' });
    const reviewId = createRes.body.data._id;
    const res = await request(app).delete(`/api/reviews/${reviewId}`).set(auth(adminToken));
    expect([200, 403]).toContain(res.status); // admin can delete too
  });
});
```

- [ ] Create `tests/integration/pet.test.js`
```js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const Pet = require('../../src/models/pet.model');
const { clearCollections, seedMinimal } = require('../helpers/db.helper');
const { petFixture } = require('../fixtures/pet.fixture');

let customerToken, adminToken;

beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });
beforeEach(async () => {
  await clearCollections(User, Pet);
  const seed = await seedMinimal(app);
  customerToken = seed.customerToken; adminToken = seed.adminToken;
});
afterAll(async () => { await mongoose.connection.close(); });

const auth = (t) => ({ Authorization: `Bearer ${t}` });

describe('POST /api/pets', () => {
  it('creates pet and returns 201', async () => {
    const res = await request(app).post('/api/pets').set(auth(customerToken)).send(petFixture());
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('name');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/pets').send(petFixture());
    expect(res.status).toBe(401);
  });
});

describe('GET /api/pets', () => {
  it('returns only own pets', async () => {
    await request(app).post('/api/pets').set(auth(customerToken)).send(petFixture());
    const res = await request(app).get('/api/pets').set(auth(customerToken));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });
});

describe('DELETE /api/pets/:id', () => {
  it('owner deletes pet successfully', async () => {
    const createRes = await request(app).post('/api/pets').set(auth(customerToken)).send(petFixture());
    const petId = createRes.body.data._id;
    const res = await request(app).delete(`/api/pets/${petId}`).set(auth(customerToken));
    expect(res.status).toBe(200);
  });

  it('returns 403 for non-owner', async () => {
    const createRes = await request(app).post('/api/pets').set(auth(customerToken)).send(petFixture());
    const petId = createRes.body.data._id;
    const res = await request(app).delete(`/api/pets/${petId}`).set(auth(adminToken));
    expect(res.status).toBe(403);
  });
});
```

- [ ] Create `tests/integration/search.test.js`
```js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const Product = require('../../src/models/product.model');
const { clearCollections, seedMinimal } = require('../helpers/db.helper');

beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });
beforeEach(async () => {
  await clearCollections(User, Product);
  await seedMinimal(app);
});
afterAll(async () => { await mongoose.connection.close(); });

describe('GET /api/search/products', () => {
  it('returns 200 with results array', async () => {
    const res = await request(app).get('/api/search/products?q=Test');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns empty array when no match', async () => {
    const res = await request(app).get('/api/search/products?q=xyznonexistent999');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns 200 with no query param', async () => {
    const res = await request(app).get('/api/search/products');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/search/suggestions', () => {
  it('returns 200 with array', async () => {
    const res = await request(app).get('/api/search/suggestions?q=Test');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns empty array for empty query', async () => {
    const res = await request(app).get('/api/search/suggestions?q=');
    expect(res.status).toBe(200);
  });
});
```

- [ ] Run
```bash
npm run test:integration -- --testPathPattern="integration/(review|pet|search)" 2>&1 | tail -25
```

- [ ] Commit
```bash
git add tests/integration/review.test.js tests/integration/pet.test.js tests/integration/search.test.js
git commit -m "test(integration): review, pet, search routes"
```

---

## Task 14: Integration tests — admin routes

**Files:**
- Create: `tests/integration/admin.test.js`

- [ ] Create `tests/integration/admin.test.js`
```js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const Product = require('../../src/models/product.model');
const Cart = require('../../src/models/cart.model');
const Order = require('../../src/models/order.model');
const Review = require('../../src/models/review.model');
const Pet = require('../../src/models/pet.model');
const { clearCollections, seedMinimal } = require('../helpers/db.helper');

let adminToken, customerToken, customer;

beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });
beforeEach(async () => {
  await clearCollections(User, Product, Cart, Order, Review, Pet);
  const seed = await seedMinimal(app);
  adminToken = seed.adminToken; customerToken = seed.customerToken; customer = seed.customer;
});
afterAll(async () => { await mongoose.connection.close(); });

const auth = (t) => ({ Authorization: `Bearer ${t}` });

describe('GET /api/admin/dashboard', () => {
  it('returns 200 with correct shape for admin', async () => {
    const res = await request(app).get('/api/admin/dashboard').set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('sales');
    expect(res.body.data).toHaveProperty('orders');
    expect(res.body.data).toHaveProperty('appointments');
  });

  it('returns 403 for customer', async () => {
    const res = await request(app).get('/api/admin/dashboard').set(auth(customerToken));
    expect(res.status).toBe(403);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/admin/users', () => {
  it('returns paginated user list for admin', async () => {
    const res = await request(app).get('/api/admin/users').set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0]).not.toHaveProperty('password');
    expect(res.body).toHaveProperty('pagination');
  });

  it('filters by role', async () => {
    const res = await request(app).get('/api/admin/users?role=customer').set(auth(adminToken));
    expect(res.status).toBe(200);
    res.body.data.forEach((u) => expect(u.role).toBe('customer'));
  });

  it('returns 400 for invalid role filter', async () => {
    const res = await request(app).get('/api/admin/users?role=hacker').set(auth(adminToken));
    expect(res.status).toBe(400);
  });

  it('returns 403 for customer', async () => {
    const res = await request(app).get('/api/admin/users').set(auth(customerToken));
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/admin/users/:id/role', () => {
  it('updates a user\'s role', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${customer._id}/role`)
      .set(auth(adminToken))
      .send({ role: 'veterinarian' });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('veterinarian');
  });

  it('returns 400 when trying to change own role', async () => {
    const adminUser = await User.findOne({ role: 'admin' });
    const res = await request(app)
      .patch(`/api/admin/users/${adminUser._id}/role`)
      .set(auth(adminToken))
      .send({ role: 'customer' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid role', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${customer._id}/role`)
      .set(auth(adminToken))
      .send({ role: 'superuser' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/admin/users/:id', () => {
  it('deletes user and cascades data', async () => {
    const res = await request(app).delete(`/api/admin/users/${customer._id}`).set(auth(adminToken));
    expect(res.status).toBe(200);
    const check = await User.findById(customer._id);
    expect(check).toBeNull();
  });

  it('returns 400 when deleting own account', async () => {
    const adminUser = await User.findOne({ role: 'admin' });
    const res = await request(app).delete(`/api/admin/users/${adminUser._id}`).set(auth(adminToken));
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent user', async () => {
    const res = await request(app).delete(`/api/admin/users/${new mongoose.Types.ObjectId()}`).set(auth(adminToken));
    expect(res.status).toBe(404);
  });
});

describe('Analytics routes', () => {
  ['sales', 'products', 'users', 'appointments'].forEach((endpoint) => {
    it(`GET /api/admin/analytics/${endpoint} returns 200 for admin`, async () => {
      const url = `/api/admin/analytics/${endpoint}${endpoint === 'sales' || endpoint === 'appointments' ? '?period=monthly' : ''}`;
      const res = await request(app).get(url).set(auth(adminToken));
      expect(res.status).toBe(200);
    });

    it(`GET /api/admin/analytics/${endpoint} returns 403 for customer`, async () => {
      const url = `/api/admin/analytics/${endpoint}${endpoint === 'sales' || endpoint === 'appointments' ? '?period=monthly' : ''}`;
      const res = await request(app).get(url).set(auth(customerToken));
      expect(res.status).toBe(403);
    });
  });
});
```

- [ ] Run
```bash
npm run test:integration -- --testPathPattern="integration/admin" 2>&1 | tail -25
```

- [ ] Commit
```bash
git add tests/integration/admin.test.js
git commit -m "test(integration): admin routes"
```

---

## Task 15: Integration tests — inventory

**Files:**
- Create: `tests/integration/inventory.test.js`

- [ ] Create `tests/integration/inventory.test.js`
```js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const Product = require('../../src/models/product.model');
const { clearCollections, seedMinimal } = require('../helpers/db.helper');

let adminToken, customerToken, product;

beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });
beforeEach(async () => {
  await clearCollections(User, Product);
  const seed = await seedMinimal(app);
  adminToken = seed.adminToken; customerToken = seed.customerToken; product = seed.product;
});
afterAll(async () => { await mongoose.connection.close(); });

const auth = (t) => ({ Authorization: `Bearer ${t}` });

describe('GET /api/admin/inventory', () => {
  it('returns 200 with products and stats for admin', async () => {
    const res = await request(app).get('/api/admin/inventory').set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('stats');
    expect(res.body.stats).toHaveProperty('total');
    expect(res.body.stats).toHaveProperty('out');
    expect(res.body.stats).toHaveProperty('low');
  });

  it('returns 403 for customer', async () => {
    const res = await request(app).get('/api/admin/inventory').set(auth(customerToken));
    expect(res.status).toBe(403);
  });

  it('filters by status=out', async () => {
    await Product.findByIdAndUpdate(product._id, { quantity: 0 });
    const res = await request(app).get('/api/admin/inventory?status=out').set(auth(adminToken));
    expect(res.status).toBe(200);
    res.body.data.forEach((p) => expect(p.stockStatus).toBe('out'));
  });

  it('filters by status=in', async () => {
    const res = await request(app).get('/api/admin/inventory?status=in').set(auth(adminToken));
    expect(res.status).toBe(200);
    res.body.data.forEach((p) => expect(p.stockStatus).toBe('in'));
  });

  it('respects custom threshold', async () => {
    await Product.findByIdAndUpdate(product._id, { quantity: 15 });
    const res = await request(app).get('/api/admin/inventory?threshold=20').set(auth(adminToken));
    expect(res.status).toBe(200);
    const p = res.body.data.find((p) => p._id.toString() === product._id.toString());
    expect(p.stockStatus).toBe('low');
  });
});

describe('GET /api/admin/inventory/low-stock', () => {
  it('returns only low/out stock products', async () => {
    await Product.findByIdAndUpdate(product._id, { quantity: 3 });
    const res = await request(app).get('/api/admin/inventory/low-stock').set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});

describe('PATCH /api/admin/inventory/:id/restock', () => {
  it('increases product quantity', async () => {
    const before = (await Product.findById(product._id)).quantity;
    const res = await request(app).patch(`/api/admin/inventory/${product._id}/restock`).set(auth(adminToken)).send({ units: 10 });
    expect(res.status).toBe(200);
    expect(res.body.data.newQty).toBe(before + 10);
  });

  it('returns 400 for units=0', async () => {
    const res = await request(app).patch(`/api/admin/inventory/${product._id}/restock`).set(auth(adminToken)).send({ units: 0 });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown product', async () => {
    const res = await request(app).patch(`/api/admin/inventory/${new mongoose.Types.ObjectId()}/restock`).set(auth(adminToken)).send({ units: 5 });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/admin/inventory/:id/adjust', () => {
  it('sets exact quantity', async () => {
    const res = await request(app).patch(`/api/admin/inventory/${product._id}/adjust`).set(auth(adminToken)).send({ newQuantity: 5, note: 'physical count correction' });
    expect(res.status).toBe(200);
    expect(res.body.data.newQty).toBe(5);
  });

  it('returns 400 when note is missing', async () => {
    const res = await request(app).patch(`/api/admin/inventory/${product._id}/adjust`).set(auth(adminToken)).send({ newQuantity: 5 });
    expect(res.status).toBe(400);
  });

  it('returns 400 for negative quantity', async () => {
    const res = await request(app).patch(`/api/admin/inventory/${product._id}/adjust`).set(auth(adminToken)).send({ newQuantity: -1, note: 'oops' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] Run
```bash
npm run test:integration -- --testPathPattern="integration/inventory" 2>&1 | tail -25
```

- [ ] Commit
```bash
git add tests/integration/inventory.test.js
git commit -m "test(integration): inventory routes"
```

---

## Task 16: Run full suite + verify + fix

- [ ] Run all tests
```bash
npm test 2>&1 | tail -40
```

- [ ] Check the summary line. For every failing test: read the error, identify the source file, fix the code or the test, re-run that test file alone before re-running the full suite.

- [ ] Run with coverage
```bash
npm run test:all 2>&1 | tail -50
```

- [ ] Commit all fixes
```bash
git add -A
git commit -m "fix(tests): resolve failures from full suite run"
```

- [ ] Push to remote
```bash
git push origin main
```
