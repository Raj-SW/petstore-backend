# Full Test Suite Design
**Date:** 2026-06-05  
**Project:** VitalPaws Backend  
**Status:** Approved

---

## Overview

Build a comprehensive unit + integration test suite covering all 15 controllers, 3 services, 1 middleware module, and 2 utility modules. Tests live in a new `tests/unit/` and `tests/integration/` folder structure alongside the existing 3 passing test files (which are not touched).

---

## Technology Stack

| Tool | Role |
|------|------|
| **Jest** | Test runner, assertions, mocking (`jest.fn()`, `jest.spyOn()`, `jest.mock()`) — already installed |
| **Supertest** | HTTP integration tests against Express app — already installed |
| **mongodb-memory-server** | In-memory MongoMemoryReplSet for integration tests — already installed |
| **@faker-js/faker** | Realistic test data generation — new dependency |
| **nock** | Intercept outbound HTTP (Stripe, PayPal, Cloudinary, email) — new dependency |
| **jest-extended** | 70+ additional Jest matchers — new dependency |

---

## Folder Structure

```
tests/
  unit/
    controllers/
      auth.test.js
      user.test.js
      product.test.js
      cart.test.js
      order.test.js
      appointment.test.js
      review.test.js
      pet.test.js
      professional.test.js
      search.test.js
      admin.test.js
      inventory.test.js
      invoice.test.js
      transaction.test.js
      payment.test.js
    services/
      payment.service.test.js
      paypal.service.test.js
      invoice.service.test.js
    middlewares/
      auth.middleware.test.js
    utils/
      dateUtils.test.js
      email.test.js

  integration/
    auth.test.js
    user.test.js
    product.test.js
    cart.test.js
    order.test.js
    appointment.test.js
    review.test.js
    pet.test.js
    professional.test.js
    search.test.js
    admin.test.js
    inventory.test.js
    invoice.test.js
    transaction.test.js
    payment.test.js

  fixtures/
    user.fixture.js
    product.fixture.js
    order.fixture.js
    appointment.fixture.js
    pet.fixture.js

  helpers/
    auth.helper.js
    db.helper.js

  setup.js          (existing — MongoMemoryReplSet start)
  teardown.js       (existing — replica set stop)
  env-setup.js      (existing — URI injection)
  order.controller.test.js     (existing — do not touch)
  admin.user-management.test.js (existing — do not touch)
  user.avatar.test.js           (existing — do not touch)
```

---

## Unit Test Approach

- **No real DB** — all Mongoose model methods mocked via `jest.mock()`
- **No HTTP** — controller functions called directly with mocked `req`, `res`, `next`
- **No external services** — Cloudinary, Stripe, PayPal, nodemailer all mocked
- Focus: pure **business logic**, **validation**, **error paths**, **edge cases**
- Every `it()` tests exactly one behaviour

### Unit Test Scope Per Module

#### `controllers/auth.test.js`
- `signup`: success, duplicate email → 400, missing name/email/password/phone/address → 400, password too short → 400
- `login`: success returns user + token, wrong password → 401, unknown email → 401, inactive account → 401
- `logout`: always returns 200
- `forgotPassword`: known email sends reset (mock email), unknown email → 404, email send failure handled gracefully
- `resetPassword`: valid token success, expired token → 400, invalid token → 400, token already used → 400
- `verifyEmail`: valid token success, expired → 400, invalid → 400
- `resendVerificationEmail`: already verified → 400, unknown email → 404, send success

#### `controllers/user.test.js`
- `getProfile`: returns user without sensitive fields
- `updateProfile`: valid partial update, no-op (empty body), invalid phone format → 400
- `changePassword`: correct old password success, wrong old password → 400, new password same as old → 400
- `uploadAvatar`: valid file triggers Cloudinary upload + DB save, no file → 400, old image deleted when replacing
- `deleteAccount`: deletes authenticated user

#### `controllers/product.test.js`
- `getProducts`: returns paginated list, empty collection returns `[]`
- `getProduct`: found → 200, not found → 404, inactive product not shown to non-admin
- `createProduct`: valid payload success, missing required fields → 400, negative price → 400, negative quantity → 400
- `updateProduct`: valid update, product not found → 404
- `deleteProduct`: found → 200, not found → 404
- `getProductsByCategory`: returns filtered list, empty category returns `[]`
- `getProductAnalytics`: returns aggregation result

#### `controllers/cart.test.js`
- `getCart`: returns cart for user, creates empty cart if none exists
- `addToCart`: success, product not found → 404, product inactive → 400, quantity exceeds stock → 400, quantity ≤ 0 → 400
- `updateCartItem`: success, item not in cart → 404, zero quantity removes item
- `removeCartItem`: success, item not in cart → 404
- `clearCart`: empties items array, returns updated cart
- `applyDiscount`: valid code applies discount, invalid code → 400, empty cart → 400

#### `controllers/order.test.js`
- `createOrder`: success, empty cart → 400, inactive product → 400, insufficient stock → 400, price taken from DB not cart
- `getOrders`: admin sees all, includes pagination metadata
- `getMyOrders`: returns only own orders
- `getOrder`: owner can access, other user → 403, admin can access, not found → 404
- `updateOrderStatus`: valid transition, invalid status value → 400, non-admin → 403
- `cancelOrder`: owner cancels pending order, cannot cancel shipped/delivered → 400
- `updatePaymentStatus`: admin updates, user populated for email

#### `controllers/appointment.test.js`
- `createAppointment`: success, past dateTime → 400, missing required fields → 400
- `getUserAppointments`: returns only authenticated user's appointments
- `getProfessionalAppointments`: returns professional's appointments, non-professional → 403
- `getAppointmentById`: owner access, professional access, admin access, other user → 403
- `updateAppointmentStatus`: customer cancel → CANCELLED, professional confirm → CONFIRMED, complete → COMPLETED, admin override, invalid transition → 400
- `deleteAppointment`: owner deletes, non-owner → 403, admin deletes any

#### `controllers/review.test.js`
- `createReview`: success, rating < 1 → 400, rating > 5 → 400, product not found → 404, duplicate review for same product → 400
- `getProductReviews`: returns reviews for product, empty → `[]`
- `updateReview`: owner success, non-owner → 403, invalid rating → 400
- `deleteReview`: owner success, non-owner → 403, admin can delete any

#### `controllers/pet.test.js`
- `createPet`: valid data success, missing required fields → 400
- `getMyPets`: returns only owner's pets
- `getPet`: owner access, other user → 403, not found → 404
- `updatePet`: owner success, non-owner → 403
- `deletePet`: owner success, non-owner → 403

#### `controllers/professional.test.js`
- `getAllProfessionals`: returns list, role filter applied, pagination works
- `getAvailableProfessionals`: returns only isActive=true professionals
- `getProfessionalsByRole`: valid role filters correctly, invalid role → 400
- `getProfessional`: found → 200, not found → 404
- `updateProfessional`: owner can update own profile, non-owner non-admin → 403, admin can update any
- `setProfessionalAvailability`: valid schedule saves, invalid time format → 400
- `toggleProfessionalStatus`: flips isActive, non-owner → 403
- `updateProfessionalRating`: admin success, non-admin → 403, rating out of 0-5 → 400

#### `controllers/search.test.js`
- `searchProducts`: keyword match, category filter builds `$in` query, minPrice/maxPrice filter, pagination, no results returns `[]`, empty query returns all
- `getSuggestions`: prefix match returns names, empty query returns `[]`, short query (< 2 chars) returns `[]`

#### `controllers/admin.test.js`
- `getDashboardStats`: returns correct shape with sales/orders/products/appointments
- `listUsers`: pagination, role filter, sensitive fields excluded
- `updateUserRole`: valid role updates, self-demotion → 400, invalid role → 400, not found → 404
- `deleteUser`: cascade verified (cart/reviews/pets/appointments/orders deleted), self-delete → 400, not found → 404

#### `controllers/inventory.test.js`
- `stockStatus()`: qty=0 → 'out', qty=-1 → 'out', qty=5 threshold=10 → 'low', qty=10 threshold=10 → 'low', qty=11 → 'in', custom threshold respected
- `resolveQty()`: has quantity → uses quantity, no quantity has stock → uses stock, neither → 0, both present → prefers quantity
- `getInventory`: status filter, category filter, search filter, threshold param, pagination, low-stock boundary exact match
- `adjustStock`: valid increment/decrement, result would go negative → 400, product not found → 404
- `getLowStockAlerts`: returns products below threshold, custom threshold param

#### `controllers/invoice.test.js`
- `getInvoices`: paginated list, status filter, dateFrom filter, dateTo filter, combined date range
- `getInvoice`: found → 200 with invoice + transaction data, not found → 404
- `generateInvoiceForOrder`: order found → invoice created, order not found → 404, already has invoice → returns existing

#### `controllers/transaction.test.js`
- `getTransactions`: paginated list, type filter, paymentMethod filter, status filter, date range filter, combined filters
- `getTransaction`: found → 200, not found → 404

#### `controllers/payment.test.js`
- `initializePayment`: Stripe path called for stripe method, PayPal path for paypal, order not found → 404, already paid → 400
- `confirmPayment`: delegates to correct service, order updated on success
- `processRefund`: admin can refund, already refunded → 400, order not found → 404
- `handleWebhook`: stripe webhook calls stripe service, paypal webhook calls paypal service

#### `services/payment.service.test.js`
- `createPaymentIntent`: calls Stripe with correct amount/currency, returns client secret
- `confirmPayment`: calls Stripe confirm, returns payment intent
- `processRefund`: calls Stripe refund with correct charge ID and amount
- `handleWebhookEvent`: valid signature verified, invalid signature → error, payment_intent.succeeded updates order

#### `services/paypal.service.test.js`
- `createOrder`: calls PayPal OrdersController with correct amount
- `captureOrder`: calls PayPal capture, returns capture ID
- `refundPayment`: calls PayPal refund endpoint
- `verifyWebhook`: valid verification → true, failed verification → false

#### `services/invoice.service.test.js`
- `generateInvoice`: assembles correct invoice data from order, calculates totals correctly
- `generatePDF`: calls PDF library, returns buffer, handles template errors

#### `middlewares/auth.middleware.test.js`
- `isAuthenticated`: no Authorization header → 401, wrong format (no Bearer) → 401, valid token → sets `req.user` and calls `next()`, expired token → 401, tampered token → 401, valid token but user deleted from DB → 401
- `isAdmin`: admin role → calls `next()`, customer role → 403, no `req.user` → 403
- `isServiceProvider`: veterinarian/groomer/trainer/petTaxi → calls `next()`, customer → 403, admin → 403

#### `utils/dateUtils.test.js`
- `getStartDate('daily')`: returns start of today
- `getStartDate('weekly')`: returns 7 days ago
- `getStartDate('monthly')`: returns start of current month
- `getStartDate('yearly')`: returns start of current year
- `getStartDate(unknown)`: falls back to monthly
- `getDateFormat('daily')`: returns `%Y-%m-%d`
- `getDateFormat('monthly')`: returns `%Y-%m`

#### `utils/email.test.js`
- `renderTemplate`: compiles Handlebars template with data, missing template file → throws
- `sendEmail`: calls nodemailer transporter with correct options, SMTP failure caught and logged (does not throw to caller)

---

## Integration Test Approach

- Real Express app via `supertest`
- Real MongoMemoryReplSet (transactions supported)
- Each `describe` block owns its DB state — `beforeEach` clears collections and re-seeds minimal data
- Auth via JWT Bearer token (login helper returns token)
- External services (email, Cloudinary, Stripe, PayPal) intercepted via `nock` or `jest.mock()`
- Every test asserts HTTP status code + response body shape + DB state (where relevant)

### Integration Test Scope Per Module

#### `auth.test.js`
- POST /signup: valid → 201 + user in DB, duplicate email → 400, missing each required field → 400, password < 8 chars → 400
- POST /login: valid → 200 + accessToken in body, wrong password → 401, unknown email → 401
- POST /logout: → 200
- POST /forgot-password: known email → 200 (email mock called), unknown email → 404
- PATCH /reset-password: valid token → 200 + password changed in DB, expired token → 400, invalid token → 400
- PATCH /verify-email: valid token → 200 + isEmailVerified=true in DB, invalid → 400
- POST /resend-verification: unverified user → 200, already verified → 400

#### `user.test.js`
- GET /users/me: authenticated → 200, no token → 401
- PATCH /users/update-profile: valid → 200 + DB updated, invalid phone → 400, no token → 401
- PATCH /users/change-password: correct old password → 200, wrong old → 400, no token → 401
- PATCH /users/upload-avatar: valid image → 200 + profileImage in DB, no file → 400, wrong mime type → 400, no token → 401
- DELETE /users/delete-account: authenticated → 200 + user removed from DB, no token → 401

#### `product.test.js`
- GET /products: → 200 + array, pagination params respected
- GET /products/category/:cat: matching → 200, no match → 200 + empty array
- GET /products/analytics/overview: admin → 200, non-admin → 403, no token → 401
- GET /products/:id: found → 200, not found → 404
- POST /products: admin → 201 + product in DB, customer → 403, missing name → 400
- PATCH /products/:id: admin → 200 + DB updated, customer → 403, not found → 404
- DELETE /products/:id: admin → 200 + removed from DB, customer → 403, not found → 404

#### `cart.test.js`
- GET /cart: empty → 200 + empty items, with items → 200 + items, no token → 401
- POST /cart: adds item → 200, inactive product → 400, insufficient stock → 400, no token → 401
- PATCH /cart/:id: updates quantity → 200, item not in cart → 404
- DELETE /cart/clear: → 200 + empty cart in DB
- DELETE /cart/:id: removes item → 200, not in cart → 404
- POST /cart/apply-discount: valid code → 200 + discount applied, invalid → 400

#### `order.test.js`
- POST /orders: success → 201 + stock decremented in DB + cart cleared, empty cart → 400, insufficient stock → 400
- GET /orders/my-orders: → 200 + own orders only
- GET /orders/:id: owner → 200, other user → 403, admin → 200, not found → 404
- PATCH /orders/:id/cancel: own pending order → 200, shipped order → 400, other user's order → 403
- GET /orders: admin → 200 + all orders + pagination, non-admin → 403
- PATCH /orders/:id/status: admin valid transition → 200, invalid status → 400, non-admin → 403
- PATCH /orders/:id/payment: admin → 200 + paymentStatus in DB, non-admin → 403

#### `appointment.test.js`
- GET /appointments/professional/:id: → 200 (public, no auth needed)
- POST /appointments: authenticated → 201, past date → 400, missing fields → 400, no token → 401
- GET /appointments/my-appointments: → 200 + own only, no token → 401
- GET /appointments/professional-appointments: service provider → 200, customer → 403
- GET /appointments/:id: owner → 200, other user → 403, admin → 200, not found → 404
- PATCH /appointments/:id/status: customer cancel → 200, professional confirm → 200, invalid transition → 400, non-owner → 403
- DELETE /appointments/:id: owner → 200, non-owner → 403, admin → 200

#### `review.test.js`
- POST /reviews/:productId: authenticated → 201, duplicate → 400, rating out of range → 400, no token → 401
- GET /reviews/product/:productId: → 200 (public), no reviews → empty array
- PATCH /reviews/:id: owner → 200, non-owner → 403, no token → 401
- DELETE /reviews/:id: owner → 200, non-owner → 403, admin → 200

#### `pet.test.js`
- POST /pets: valid → 201, missing fields → 400, no token → 401
- GET /pets: → 200 + own pets only, no token → 401
- GET /pets/:id: owner → 200, other user → 403, not found → 404
- PATCH /pets/:id: owner → 200, non-owner → 403
- DELETE /pets/:id: owner → 200, non-owner → 403

#### `professional.test.js`
- GET /professionals: → 200 + list (public)
- GET /professionals/available: → 200 + only active ones
- GET /professionals/role/:role: valid role → 200, no match → empty array
- GET /professionals/:id: found → 200, not found → 404
- PATCH /professionals/:id/profile: owner → 200, non-owner non-admin → 403
- PATCH /professionals/:id/availability: valid schedule → 200, invalid → 400
- PATCH /professionals/:id/status: owner → 200, non-owner → 403
- PATCH /professionals/:id/rating: admin → 200, non-admin → 403
- PATCH /professionals/:id: admin → 200, non-admin → 403

#### `search.test.js`
- GET /search/products: keyword match → 200, category filter → 200, price range → 200, no results → 200 + empty, no query → 200 + all
- GET /search/suggestions: prefix match → 200 + names array, empty query → 200 + empty, single char → 200 + empty

#### `admin.test.js`
- GET /admin/dashboard: admin → 200 + correct shape, non-admin → 403, no token → 401
- GET /admin/analytics/sales: admin + period params → 200, non-admin → 403
- GET /admin/analytics/products: admin → 200, non-admin → 403
- GET /admin/analytics/users: admin → 200, non-admin → 403
- GET /admin/analytics/appointments: admin + period params → 200, non-admin → 403
- GET /admin/users: admin → 200 + paginated, role filter works, sensitive fields absent, non-admin → 403
- PATCH /admin/users/:id/role: valid role → 200, self-demotion → 400, invalid role → 400, not found → 404
- DELETE /admin/users/:id: → 200 + user+cart+reviews+pets+appointments+orders gone from DB, self-delete → 400
- GET /admin/appointments: admin → 200 + all, status filter works, non-admin → 403

#### `inventory.test.js`
- GET /admin/inventory: admin → 200, status=out filter, status=low filter, status=in filter, category filter, search filter, threshold param changes low boundary, pagination, non-admin → 403
- PATCH /admin/inventory/:id/adjust: valid increment → 200 + quantity updated, decrement below 0 → 400, not found → 404, non-admin → 403
- GET /admin/inventory/low-stock: admin → 200 + only low/out products, custom threshold → 200

#### `invoice.test.js`
- GET /admin/invoices: admin → 200 + paginated, status filter, date range filter, non-admin → 403
- GET /admin/invoices/:id: found → 200, not found → 404
- POST /admin/invoices/order/:orderId: order exists → 201 + invoice in DB, order not found → 404, duplicate → returns existing

#### `transaction.test.js`
- GET /admin/transactions: admin → 200 + paginated, type filter, paymentMethod filter, status filter, date range, combined filters, non-admin → 403
- GET /admin/transactions/:id: found → 200, not found → 404

#### `payment.test.js`
- POST /payments/orders/:orderId/initialize (stripe): authenticated → 200 + clientSecret, order not found → 404, already paid → 400
- POST /payments/orders/:orderId/initialize (paypal): → 200 + approvalUrl
- POST /payments/orders/:orderId/confirm: → 200 + order paymentStatus updated
- POST /payments/orders/:orderId/refund: admin → 200, already refunded → 400, order not found → 404
- POST /payments/webhook/stripe: valid signature → 200, invalid signature → 400
- POST /payments/webhook/paypal: valid payload → 200

---

## Fixtures

All fixtures use `@faker-js/faker`. Each factory function accepts an `overrides` object.

```js
// fixtures/user.fixture.js
userFixture(overrides = {}) → { name, email, phoneNumber, address, password, role: 'customer', ...overrides }

// fixtures/product.fixture.js
productFixture(overrides = {}) → { name, description, price, quantity, categories, images, isActive: true, ...overrides }

// fixtures/order.fixture.js
orderFixture(overrides = {}) → { shippingAddress: { street, city, state, country, zipCode }, paymentMethod: 'stripe', ...overrides }

// fixtures/appointment.fixture.js
appointmentFixture(overrides = {}) → { dateTime (future), service, notes, status: 'PENDING', ...overrides }

// fixtures/pet.fixture.js
petFixture(overrides = {}) → { name, species, breed, age, weight, ...overrides }
```

---

## Helpers

```js
// helpers/auth.helper.js
loginAs(app, role)           // creates user with given role, logs in, returns { agent, token, user }
createAndLogin(app, data)    // registers specific user data, logs in, returns { token, user }

// helpers/db.helper.js
clearCollections(...models)  // User.deleteMany(), Product.deleteMany(), etc.
seedMinimal()                // 1 admin + 1 customer + 1 product — baseline for integration tests
```

---

## Package.json Changes

### New dev dependencies
```json
"@faker-js/faker": "^8.0.0",
"nock": "^13.3.0",
"jest-extended": "^4.0.0"
```

### New scripts
```json
"test:unit":        "jest --testPathPattern=tests/unit --coverage",
"test:integration": "jest --testPathPattern=tests/integration --runInBand --forceExit",
"test:all":         "jest --runInBand --forceExit --coverage",
"test:coverage":    "jest --coverage --coverageReporters=text-summary lcov"
```

### Jest config additions
```json
"coverageDirectory": "coverage",
"collectCoverageFrom": [
  "src/controllers/**/*.js",
  "src/services/**/*.js",
  "src/middlewares/**/*.js",
  "src/utils/**/*.js"
],
"coverageThreshold": {
  "global": {
    "branches":   70,
    "functions":  80,
    "lines":      80,
    "statements": 80
  }
},
"setupFilesAfterFramework": ["jest-extended/all"]
```
> Note: Jest config key for jest-extended setup is `setupFilesAfterFramework` (Jest 24+). Verify exact key during implementation — older versions used `setupTestFrameworkScriptFile`.
```

---

## Implementation Order

Tasks will be executed in this order:

1. Install new packages + update package.json config
2. Create `tests/fixtures/` — all 5 fixture files
3. Create `tests/helpers/` — auth.helper.js + db.helper.js
4. Unit tests: middlewares + utils (foundational, no controller deps)
5. Unit tests: controllers (auth → user → product → cart → order → appointment → review → pet → professional → search → admin → inventory → invoice → transaction → payment)
6. Unit tests: services (payment → paypal → invoice)
7. Integration tests (same order as controllers)
8. Run full suite, fix failures, verify coverage thresholds

---

## Success Criteria

- All new tests pass (`npm test`)
- Zero regressions in existing 3 test files
- Coverage ≥ 80% lines/functions/statements, ≥ 70% branches on covered modules
- Each `it()` is independent — can run in any order without side effects
- No hardcoded credentials or real external API calls
