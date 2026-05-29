# PetStore Backend — Full Code Audit

> Generated: 2026-05-29  
> Branch: `main` | Stack: Node.js / Express / MongoDB / Passport (sessions)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [What's Implemented & Working](#2-whats-implemented--working)
3. [Bugs — Will Crash at Runtime](#3-bugs--will-crash-at-runtime)
4. [Bugs — Silent / Logic Errors](#4-bugs--silent--logic-errors)
5. [Missing Features / TODOs](#5-missing-features--todos)
6. [Security Issues](#6-security-issues)
7. [Code Quality / Dead Code](#7-code-quality--dead-code)
8. [Fix Priority Roadmap](#8-fix-priority-roadmap)

---

## 1. Architecture Overview

```
src/
├── app.js                  # Express setup, middleware, route mounting
├── server.js               # HTTP server entry point
├── config/                 # DB, passport, swagger, seed
├── controllers/            # Route handlers
├── middlewares/            # auth, error, upload, validation
├── models/                 # Mongoose schemas
├── routes/                 # Express routers
├── services/               # Business logic layer
├── utils/                  # Email, cloudinary, logger, validation
├── validators/             # Joi validators
└── templates/              # Handlebars email templates
```

**Auth strategy:** Passport.js local strategy + express-session (session-based). JWT code exists in User model methods and `auth.controller.js` but is only partially wired up.

**Payment:** Stripe + PayPal — both services are **entirely commented out**.

---

## 2. What's Implemented & Working

### ✅ Auth (`/api/auth`)
| Route | Status |
|---|---|
| `POST /register` | Working |
| `POST /login` | Working |
| `POST /logout` | Working |
| `POST /forgot-password` | Mostly working (URL bug — see §3) |
| `PATCH /reset-password` | Working |
| `PATCH /verify-email` | Broken (wrong param source — see §3) |
| `GET /me` (getCurrentUser) | Implemented but **not registered in routes** |
| `POST /refresh-token` | Implemented but **not registered in routes** |
| `POST /resend-verification` | Implemented but **not registered in routes** |

### ✅ Users (`/api/users`)
| Route | Status |
|---|---|
| `GET /me` | Working |
| `PATCH /update-profile` | Working |
| `PATCH /change-password` | Working |
| `DELETE /delete-account` | Working (hard delete, no soft delete) |

### ✅ Products (`/api/products`)
| Route | Status |
|---|---|
| `GET /` | Working (filtering, pagination, search) |
| `GET /:id` | Working |
| `GET /category/:category` | Working |
| `GET /analytics/overview` | Working (admin only, but route ordering bug — see §3) |
| `POST /` | Working (admin, Cloudinary upload) |
| `PATCH /:id` | Working (admin, Cloudinary update) |
| `DELETE /:id` | Working (admin, Cloudinary cleanup) |

### ✅ Cart (`/api/cart`)
| Route | Status |
|---|---|
| `GET /` | Working |
| `POST /` | Working |
| `PATCH /:id` | Working |
| `DELETE /:id` | Working |
| `POST /apply-discount` | Skeleton only — always returns 0 discount |
| `DELETE /clear` | Route ordering conflict (see §3) |

### ✅ Orders (`/api/orders`)
| Route | Status |
|---|---|
| `GET /my-orders` | Working |
| `POST /` | Broken — field name mismatch with Product model (see §3) |
| `GET /:id` | Working |
| `PATCH /:id/cancel` | Working (stock restored, email broken — see §4) |
| `GET /` (admin all orders) | No admin guard applied (see §3) |
| `PATCH /:id/status` | Email bug (see §4) |
| `PATCH /:id/payment` | Working |

### ✅ Appointments (`/api/appointments`)
| Route | Status |
|---|---|
| `GET /professional/:professionalId` | Working (public) |
| `POST /` | Working |
| `GET /my-appointments` | Working |
| `GET /professional-appointments` | Working |
| `GET /:appointmentId` | Broken — wrong field names (see §3) |
| `PATCH /:appointmentId/status` | Partially working — auth logic bug (see §4) |
| `DELETE /:appointmentId` | Working |

### ✅ Professionals (`/api/professionals`)
| Route | Status |
|---|---|
| `GET /` | Working |
| `GET /available` | Working |
| `GET /role/:role` | Working |
| `GET /:id` | Working |
| `PATCH /:id/profile` | Working (no ownership check — see §6) |
| `PATCH /:id/availability` | Working |
| `PATCH /:id/status` | Working |
| `PATCH /:id/rating` | Working (admin only) |
| `PATCH /:id` (admin update) | Working |

### ✅ Pets (`/api/pets`)
| Route | Status |
|---|---|
| `POST /` | Working |
| `GET /` | Working |
| `GET /:id` | Working |
| `PATCH /:id` | Working |
| `DELETE /:id` | Working |

### ✅ Reviews (`/api/reviews`)
| Route | Status |
|---|---|
| `POST /` | Broken — missing auth + missing `:productId` param (see §3) |
| `GET /product/:productId` | Working (no auth required — ok) |
| `PATCH /:id` | No auth enforced (see §3) |
| `DELETE /:id` | No auth enforced (see §3) |

### ✅ Payments (`/api/payments`)
| Route | Status |
|---|---|
| `POST /webhook/stripe` | Wired up but PaymentService is commented out |
| `POST /webhook/paypal` | Wired up but PayPalService is commented out |
| `POST /orders/:orderId/initialize` | Will crash — PaymentService null (see §3) |
| `POST /orders/:orderId/confirm` | Will crash — PaymentService null |
| `POST /orders/:orderId/refund` | Will crash — PaymentService null |

### ✅ Admin (`/api/admin`)
| Route | Status |
|---|---|
| `GET /dashboard` | Partially working — wrong appointment field names (see §3) |
| `GET /analytics/sales` | Working |
| `GET /analytics/products` | Working |
| `GET /analytics/users` | Working |
| `GET /analytics/appointments` | Wrong field names (see §3) |

### ✅ Search (`/api/search`)
| Route | Status |
|---|---|
| `GET /products` | **Never mounted in app.js** (see §3) |
| `GET /suggestions` | **Never mounted in app.js** |

---

## 3. Bugs — Will Crash at Runtime

### BUG-01 · Payment services entirely commented out
**Files:** `src/services/payment.service.js`, `src/services/paypal.service.js`  
Both files are 100% block-commented. `module.exports` inside the comment means both modules export `undefined`.  
`payment.controller.js` calls `PaymentService.createPaymentIntent(...)` which will throw `TypeError: Cannot read properties of undefined`.  
**Impact:** All payment endpoints crash immediately.

---

### BUG-02 · `review.routes.js` imports from deprecated/dead middleware
**File:** `src/routes/review.routes.js:2`
```js
const { protect } = require('../middlewares/auth');
```
`auth.js` is entirely commented out and exports nothing. `protect` is `undefined`. Because it's never actually called via `router.use(protect)`, the routes don't crash on startup — but they also have **zero authentication**. Anyone can create, edit, or delete reviews without logging in.

---

### BUG-03 · `createReview` — missing `:productId` route param
**Files:** `src/controllers/review.controller.js:9`, `src/routes/review.routes.js:15`  
Controller reads `req.params.productId` but the POST route is `router.post('/', ...)` — no param. `productId` will always be `undefined`, causing a Mongoose cast error.

---

### BUG-04 · `professionalController.js` — references undefined `Professional` and `createError`
**File:** `src/controllers/professionalController.js:67,100`
```js
const professional = await Professional.create(req.body);    // Professional is undefined
return next(createError(404, 'Professional not found'));      // createError is not imported
```
`createProfessional` and `deleteProfessional` will throw `ReferenceError` at runtime. Neither is registered in routes, so they don't currently cause startup failure.

---

### BUG-05 · `getAppointmentById` — wrong populate path and field reference
**File:** `src/controllers/appointment.controller.js:351,360`
```js
// populate uses 'user' but model field is 'userId'
{ path: 'user', select: 'name email phoneNumber address' }

// Then later:
const isProfessional = appointment.professional._id.toString() === ...
// 'professional' doesn't exist — model field is 'professionalId'
```
This endpoint will throw `TypeError: Cannot read properties of undefined (reading '_id')`.

---

### BUG-06 · `appointment.model.js` — ref fields typed as `String` not `ObjectId`
**File:** `src/models/appointment.model.js:13,29,67`
```js
professionalId: { type: String, ref: 'User', required: true }
petId:          { type: String, ref: 'Pet',  required: true }
userId:         { type: String, ref: 'User', required: true }
```
All three should be `mongoose.Schema.Types.ObjectId`. Using `String` means:
- `.populate()` silently returns null for these fields
- Mongoose ObjectId validators don't fire
- Query comparisons with `ObjectId` values will fail silently

---

### BUG-07 · `createOrder` — Product model field name mismatch
**File:** `src/controllers/order.controller.js:44-50, 99-104`
```js
// Controller reads:
if (product.stock < item.quantity) ...    // ❌ model uses 'quantity', not 'stock'
return new AppError(`Product ${product.title} is not available`) // ❌ model uses 'name'

// Controller writes:
$inc: { stock: -item.quantity }           // ❌ should be 'quantity'
```
Stock check always passes (undefined < N is false), stock is never decremented, and the error message throws on `.title` access. Orders silently allow purchases of out-of-stock items.

---

### BUG-08 · `admin.controller.js` — wrong field names for appointments
**File:** `src/controllers/admin.controller.js:66-73, 262`
```js
// getDashboardStats queries:
{ date: { $gte: startOfDay } }           // ❌ model field is 'dateTime'
{ status: { $in: ['pending', 'accepted'] } } // ❌ model uses uppercase: 'PENDING', 'CONFIRMED'
.populate('user', ...)                   // ❌ field is 'userId'
.populate('serviceProvider', ...)        // ❌ field is 'professionalId'

// getAppointmentAnalytics:
{ $eq: ['$status', 'completed'] }        // ❌ should be 'COMPLETED'
{ _id: '$serviceProvider' }              // ❌ should be '$professionalId'
```
Dashboard upcoming appointments will always return 0, and appointment analytics will always show 0 completed.

---

### BUG-09 · Search routes never mounted
**File:** `src/app.js` (missing import)  
`src/routes/search.routes.js` exists and has a controller, but is never imported or mounted in `app.js`. The `/api/search` prefix does not exist. Search is dead.

---

### BUG-10 · `DELETE /api/cart/clear` route swallowed by `DELETE /api/cart/:id`
**File:** `src/routes/cart.routes.js:26-27`
```js
router.delete('/:id', removeCartItem);    // registered first
router.delete('/clear', clearCart);       // registered after — never reached
```
`DELETE /api/cart/clear` hits `removeCartItem` with `productId = 'clear'`, gets a 404 "Item not found in cart". Clear cart is unreachable. Fix: move `/clear` before `/:id`.

---

### BUG-11 · `getOrders` (admin — all orders) has no admin authorization
**File:** `src/routes/order.routes.js:30`
```js
router.use(isAuthenticated);  // only checks login, not role
router.get('/', getOrders);   // any authenticated user can list ALL orders
```
Any logged-in customer can call `GET /api/orders/` and receive every order in the database.

---

### BUG-12 · `product.routes.js` — analytics route shadowed by `:id`
**File:** `src/routes/product.routes.js:32`  
`GET /analytics/overview` is registered **after** `router.use(isAuthenticated, isAdmin)` which is fine, but it uses the same router instance where `GET /:id` was already registered above it on line 19. Express will match `GET /analytics/overview` as `id = 'analytics'` before it gets to the analytics route. Fix: move analytics route above `/:id` or add an explicit non-`/:id` prefix.

---

### BUG-13 · `verifyEmail` reads token from wrong source
**File:** `src/controllers/auth.controller.js:213`, `src/routes/auth.routes.js:19`  
The route is `PATCH /verify-email` (no param), but the controller reads `req.params.token`. Token will always be `undefined`, query will find nothing, always returns "Invalid or expired token".  
Fix: change route to `PATCH /verify-email/:token` or read from `req.body`.

---

## 4. Bugs — Silent / Logic Errors

### BUG-14 · `forgotPassword` builds a backend URL, not a frontend URL
**File:** `src/controllers/auth.controller.js:161`
```js
const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;
```
Email link points to the backend API URL, not the frontend page. User gets a raw JSON response if they click it. Should use `process.env.FRONTEND_URL`.

---

### BUG-15 · `updateOrderStatus` and `cancelOrder` — populate missing before email
**File:** `src/controllers/order.controller.js:212, 317`
```js
const order = await Order.findById(req.params.id);  // user NOT populated
// ...
await sendEmail({ email: order.user.email, ... });   // order.user is an ObjectId, not a document
```
`order.user.email` and `order.user.name` will be `undefined`. Email is sent to `undefined` (Nodemailer will silently fail or throw).

---

### BUG-16 · `updateAppointmentStatus` — incorrect auth check
**File:** `src/controllers/appointment.controller.js:274-278`
```js
const isProfessionalAssigned = req.user._id.toString() === appointment.professionalId.toString();
const isProfessional = req.user.role === appointment.appointmentType;
const isAdmin = req.user.role === 'admin';
if (!isProfessionalAssigned && !isProfessional) {   // isAdmin not included in guard
  return next(new AppError('Access denied', 403));
}
```
Admin is checked for business rules but excluded from the access guard. An admin will receive 403 unless they happen to be the assigned professional.

---

### BUG-17 · Mixed auth strategy — JWT and sessions coexisting
**Files:** `src/models/user.model.js:138-149`, `src/controllers/auth.controller.js:114-142`  
User model generates JWT access/refresh tokens. `refreshToken` endpoint is implemented. Login and auth middleware use Passport sessions. The two strategies are never unified — JWT tokens are generated but never validated anywhere. `refreshToken` endpoint generates tokens nobody uses.

---

### BUG-18 · `professionalController.js` — `console.log` left in production
**File:** `src/controllers/professionalController.js:38`
```js
console.log('result', result);
```
Debug log in the professionals list endpoint. Logs full user data (including emails) to stdout.

---

### BUG-19 · `search.controller.js` — queries wrong fields
**File:** `src/controllers/search.controller.js:28, 64`
```js
searchQuery.category = category;        // model uses 'categories' (array)
.populate('category', 'name')           // no Category ref on Product model
searchQuery.rating = { $gte: ... }      // 'rating' field doesn't exist on Product model
```
Category filter and rating filter silently return wrong results.

---

### BUG-20 · Email verification never enforced at login
**File:** `src/config/passport.js`  
`isEmailVerified` field exists on the User model, but Passport's local strategy never checks it. Unverified users can login and use the entire API.

---

### BUG-21 · `routes/index.js` references non-existent `category.routes`
**File:** `src/routes/index.js:7`
```js
const categoryRoutes = require('./category.routes');
```
`src/routes/category.routes.js` does not exist. This file would crash if loaded. However, `app.js` does not `require('./routes/index.js')` — it imports each route file directly — so this dead file never actually crashes anything. It's misleading dead code.

---

## 5. Missing Features / TODOs

### MISS-01 · Discount / coupon system — skeleton only
**File:** `src/controllers/cart.controller.js:156`  
`applyDiscount` stores any string as `discountCode` but never validates it or calculates a real discount — always `0`. In `order.controller.js` only the hardcoded string `'SUMMER10'` gets 10% off. No DB model, no admin management, no expiry.

---

### MISS-02 · Payment is entirely non-functional
Both `PaymentService` and `PayPalService` are block-commented. See BUG-01. There is no working payment flow end-to-end.

---

### MISS-03 · `petTaxi` role excluded from professional auth middleware
**File:** `src/middlewares/auth.middleware.js:13`
```js
['veterinarian', 'groomer', 'trainer'].includes(req.user.role)
```
`petTaxi` is a valid role in the User model and Appointment type enum, but `isServiceProvider` excludes it. PetTaxi users can't access professional appointment routes.

---

### MISS-04 · Profile image upload for users and professionals
`profileImage` field exists on the User model. Cloudinary utilities exist. But there is no route or controller action to upload/update a profile image.

---

### MISS-05 · Admin user management
Admin can see analytics dashboards but has no routes to:
- List users
- Ban / deactivate a user
- Promote a user role
- Delete a user

---

### MISS-06 · No admin guard on order status / payment updates
`PATCH /api/orders/:id/status` and `PATCH /api/orders/:id/payment` are supposed to be admin-only but any authenticated user can call them.

---

### MISS-07 · Pet model missing medical history
Pet model only has name/breed/age/type/color/gender. No vaccination records, medical history, or vet notes — referenced in the appointment controller populate (`medicalHistory`) but the field doesn't exist.

---

### MISS-08 · Email verification not triggered on signup
`signup` controller creates a user but never generates an `emailVerificationToken` or sends a verification email. `resendVerificationEmail` is implemented but `verifyEmail` is broken (BUG-13) and not part of the signup flow.

---

### MISS-09 · No pagination on admin `GET /api/orders/`
`getOrders` in `order.controller.js` returns all orders with `.find()` with no limit/skip. Will become a performance issue with large datasets.

---

### MISS-10 · `getOrders` and `getOrder` — no filter/search for admin
Admin has no way to filter orders by status, date range, user, etc. beyond what's in the analytics endpoints.

---

### MISS-11 · `professionalController.createProfessional` and `deleteProfessional` — dead stubs
Both functions reference undefined variables (BUG-04) and are not wired into any route. Registering a professional is done via `signup` directly with a professional role. There's no admin workflow to create/delete professionals.

---

### MISS-12 · Appointment payment flow — status enum exists but no implementation
Appointment statuses include `PENDING_PAYMENT`, `PAID` etc. but there's no payment route or logic tied to appointments.

---

## 6. Security Issues

### SEC-01 · Any authenticated user can list ALL orders (BUG-11)
`GET /api/orders/` has no `isAdmin` guard. Medium-high severity: leaks customer PII (names, addresses, order history).

---

### SEC-02 · Review routes have zero authentication (BUG-02, BUG-03)
Unauthenticated users can create, edit, and delete any review. However, `createReview` also checks for a delivered order (which requires a valid user ID from `req.user.id` — so it'll crash before doing damage).

---

### SEC-03 · Professional can update any other professional's profile
**File:** `src/routes/professional.routes.js:24-28`  
`PATCH /:id/profile` requires `isServiceProvider` but never checks that `req.user._id === req.params.id`. Any professional can overwrite another professional's bio/services/specialization.

---

### SEC-04 · `SESSION_SECRET` falls back to hardcoded value
**File:** `src/app.js:92`
```js
secret: process.env.SESSION_SECRET || 'your-secret-key',
```
If `SESSION_SECRET` is not set in production, sessions are signed with a well-known string.

---

### SEC-05 · Hard delete on user account — no cascade
`deleteAccount` hard-deletes the user document but leaves orphaned: orders, cart, appointments, pets, reviews. Could cause populate errors and stale data.

---

### SEC-06 · Rate limiting is very permissive
300 requests/minute per IP. For a pet store this is likely fine, but auth endpoints (login, forgot-password) should have a tighter, separate limiter to prevent brute-force / enumeration.

---

## 7. Code Quality / Dead Code

| File | Issue |
|---|---|
| `src/routes/index.js` | Entirely unused — app.js mounts routes directly. References non-existent `category.routes.js`. |
| `src/middlewares/auth.js` | Fully commented out (deprecated). Safe to delete. |
| `src/services/payment.service.js` | Entirely block-commented. Uncomment or delete. |
| `src/services/paypal.service.js` | Entirely block-commented. Uncomment or delete. |
| `src/controllers/professionalController.js:38` | `console.log('result', result)` — remove. |
| `src/utils/migrateProfessionals.js` | One-time migration script committed to the repo. Should be in a `scripts/` folder or removed post-migration. |
| `src/config/mockData.js` | Mock data config committed alongside production config. |
| `src/services/userService.js` | Exists but nothing imports it — check if needed. |
| `src/services/ProductService.js` | Exists but nothing imports it — check if needed. |
| `server.js` (root) vs `src/server.js` | Two server files at different paths. `package.json` points to `src/server.js`. Root `server.js` is dead code. |

---

## 8. Fix Priority Roadmap

### 🔴 P0 — Crashes / Security (Fix before any production traffic)

| ID | Fix |
|---|---|
| BUG-01 | Uncomment `payment.service.js` and `paypal.service.js` |
| BUG-07 | Fix `order.controller.js`: `product.stock` → `product.quantity`, `product.title` → `product.name` |
| BUG-11 | Add `isAdmin` guard to `GET /api/orders/` |
| SEC-01 | Same as BUG-11 |
| BUG-02 | Add `router.use(isAuthenticated)` in `review.routes.js` (after fixing import) |
| BUG-03 | Fix `review.routes.js`: `POST /` → `POST /:productId` |
| BUG-06 | Fix appointment model: change `professionalId`, `petId`, `userId` types to `ObjectId` |
| BUG-10 | Move `DELETE /clear` above `DELETE /:id` in cart routes |
| BUG-09 | Mount search routes in `app.js` |

### 🟠 P1 — Broken Endpoints (Fix for feature completeness)

| ID | Fix |
|---|---|
| BUG-05 | Fix `getAppointmentById`: correct populate paths and field references |
| BUG-08 | Fix admin controller appointment queries: `dateTime`, uppercase status, `userId`/`professionalId` |
| BUG-13 | Fix `verifyEmail`: route param or body token |
| BUG-14 | Fix `forgotPassword` reset URL to use `process.env.FRONTEND_URL` |
| BUG-15 | Populate `user` on order before sending email in `updateOrderStatus` and `cancelOrder` |
| BUG-16 | Fix `updateAppointmentStatus` admin access guard |
| BUG-12 | Move `GET /analytics/overview` above `GET /:id` in product routes |
| MISS-06 | Add `isAdmin` to `PATCH /:id/status` and `PATCH /:id/payment` in order routes |

### 🟡 P2 — Missing Features

| ID | Fix |
|---|---|
| MISS-03 | Add `petTaxi` to `isServiceProvider` middleware |
| MISS-08 | Generate + send verification email on signup |
| MISS-04 | Add profile image upload endpoint (Cloudinary already configured) |
| MISS-05 | Add admin user management routes |
| MISS-09 | Add pagination to admin `getOrders` |
| MISS-01 | Implement real discount code system |
| SEC-03 | Add ownership check to `PATCH /:id/profile` for professionals |

### 🟢 P3 — Cleanup / Quality

| ID | Fix |
|---|---|
| BUG-17 | Decide: session OR JWT — remove the dead strategy |
| BUG-18 | Remove `console.log` from `professionalController.js` |
| BUG-19 | Fix `search.controller.js` field names (`categories`, remove `rating`) |
| BUG-20 | Enforce email verification at login if desired |
| SEC-04 | Ensure `SESSION_SECRET` is required in production startup check |
| SEC-05 | Add cascade delete or soft-delete for user accounts |
| — | Delete `src/routes/index.js`, root `server.js`, `src/middlewares/auth.js` |
| — | Move `migrateProfessionals.js` out of `src/utils` |
| — | Add auth guard to forgot-password (rate limit per email) |
