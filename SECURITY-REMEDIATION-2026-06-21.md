<!-- Mirror copy for root-level discovery. Canonical: docs/SECURITY-REMEDIATION-2026-06-21.md — keep both in sync. -->

# Security & Bug Remediation — 2026-06-21

Audit of the backend on `main` (post PR #5, commit `dac9bbb`). Each item below has: **what's wrong**, **how to confirm it (manual QA)**, and the **proposed fix**. Nothing is fixed yet — this is the work queue. Dependency/CVE work is intentionally **out of scope** for now (user decision).

Priority order: **F1 → F2 → F3 → F4 → F5**.

---

## F1 — 🔴 Password reset double-hashes → login permanently broken after reset

**Where:** `src/controllers/auth.controller.js` `resetPassword` (~L211-241) + `src/models/user.model.js` `pre('save')` (L132-137).

**What's wrong:** `resetPassword` manually bcrypt-hashes the new password:
```js
const salt = await bcrypt.genSalt(10);
const hashedPassword = await bcrypt.hash(password, salt);
user.password = hashedPassword;
await user.save();        // <-- pre('save') hook hashes it AGAIN (cost 12)
```
The model's `pre('save')` hook hashes any modified `password`, so the stored value becomes `bcrypt(bcrypt(plaintext))`. On next login, `comparePassword(plaintext)` compares plaintext against the double-hash and **always fails**. A user who resets their password is locked out permanently.

**Why CI didn't catch it:** `tests/auth.controller.test.js:205` only asserts `200` + token cleared. It never logs in with the new password.

**Manual QA to confirm:**
1. Sign up / pick a test account.
2. Trigger `POST /api/auth/forgot-password` with that email (or seed `passwordResetToken` + future `passwordResetExpires` directly in Atlas).
3. `PATCH /api/auth/reset-password` with `{ token, password: "NewPassword99*" }` → expect `200`.
4. `POST /api/auth/login` with the **new** password → **observe `401 Invalid email or password`** (the bug). Old password also fails. Account is locked out.

**Proposed fix:** assign the plaintext and let the hook hash once.
```js
user.password = password;          // hook hashes once
user.passwordResetToken = undefined;
user.passwordResetExpires = undefined;
await user.save();
```
Remove the `crypto`/`bcrypt` manual hashing here if no longer used. **Add a regression test** that logs in successfully after reset (the missing assertion).

---

## F2 — 🔴 IDOR: any authenticated user can cancel anyone's order

**Where:** `src/routes/order.routes.js:29` (`router.patch('/:id/cancel', cancelOrder)`) + `src/controllers/order.controller.js` `cancelOrder` (L286-353).

**What's wrong:** The cancel route is behind `isAuthenticated` only (no `isAdmin`, no ownership check). `cancelOrder` loads the order by `:id` and cancels it **without verifying `order.user === req.user.id`**. Compare `getOrder` (L138) which *does* check ownership — the inconsistency confirms this is an oversight. Impact: any logged-in user can cancel any other user's `pending`/`processing` order by ID (Mongo ObjectIds are semi-enumerable), which restores stock and emails the victim a cancellation notice.

**Manual QA to confirm:**
1. User A places an order (status `pending`) — note its `_id`.
2. Log in as User B (different account, non-admin).
3. As B, `PATCH /api/orders/<A's order id>/cancel`.
4. **Observe `200` and the order flips to `cancelled`** — A's order cancelled by B (the bug). A also receives a cancellation email.

**Proposed fix:** add the same guard `getOrder` uses, right after loading the order:
```js
if (order.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
  return next(new AppError('Not authorized to cancel this order', 403));
}
```
(`order.user` is populated, so use `order.user._id`.) Add a test: B cancelling A's order → `403`; A (owner) and admin → allowed.

---

## F3 — 🟠 User / email enumeration

**Where:** `src/controllers/auth.controller.js` — `forgotPassword` (L173 `404 "No user found with that email"`), `resendVerificationEmail` (L278), and `signup` (L22 `"Email already registered"`).

**What's wrong:** Distinct responses for "email exists" vs "doesn't" let an attacker enumerate which emails have accounts (privacy leak, aids credential-stuffing/phishing).

**Manual QA to confirm:**
1. `POST /api/auth/forgot-password` with a **registered** email → `200 "Password reset email sent"`.
2. Same with a **random unregistered** email → **`404 "No user found with that email"`** (the difference is the leak).

**Proposed fix:** return a generic success regardless of existence (do the real work only if the user exists):
```js
// forgotPassword: if no user, still return 200 with the same message
return res.status(200).json({ success: true,
  message: 'If an account exists for that email, a reset link has been sent.' });
```
Apply the same idea to `resendVerificationEmail`. For `signup`, the 400 is harder to hide (unique email) — lower priority; acceptable to leave, or rate-limit signup. **Note:** the frontend may branch on these messages/status codes — check `forgot-password` / `resend-verification` UI flows when fixing.

---

## F4 — 🟡 Reset & verification tokens stored in plaintext

**Where:** `src/controllers/auth.controller.js` — `forgotPassword` (L178), `resendVerificationEmail` (L288); lookups in `resetPassword` (L215) and `verifyEmail` (L248).

**What's wrong:** `passwordResetToken` / `emailVerificationToken` are stored raw. A DB read (leak, backup, log) lets an attacker use a live token to take over an account during its validity window. Best practice: store `sha256(token)`, email the raw token, hash-on-lookup.

**Manual QA to confirm:** trigger forgot-password, then inspect the user doc in Atlas — `passwordResetToken` equals the value in the emailed reset URL verbatim.

**Proposed fix:**
```js
const resetToken = crypto.randomBytes(32).toString('hex');     // emailed (raw)
user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex'); // stored
```
And in `resetPassword`, hash the incoming `token` the same way before the `findOne`. Mirror for email verification. **Do F4 together with F1** (same function) to avoid touching it twice.

---

## F5 — 🟡 resendVerificationEmail uses the wrong email template

**Where:** `src/controllers/auth.controller.js:300` — sends `template: 'password-reset'` for an email-verification action.

**What's wrong:** Cosmetic but confusing — a user resending verification gets a "reset your password" email body (the verify URL is passed as `resetUrl`). No security impact.

**Manual QA to confirm:** call `POST /api/auth/resend-verification` for an unverified account; the received email is the password-reset template, not a verification one.

**Proposed fix:** create/point to a dedicated `email-verification` template and pass `verificationUrl` accordingly.

---

## Out of scope this session (tracked, fix later)
- **Dependency CVEs** (`npm audit`): handlebars 4.7.8 **critical**, cloudinary <2.7.0 high (v2 major bump), axios high (transitive), form-data, brace-expansion. User opted to skip all dep work for now.
- **Order fulfillment tracking** capture (tracking/transaction IDs) — pre-existing deferred design item, separate from this audit.

## Verification after fixes (when we do them)
Run affected suites individually (full `npm test` flakes under load):
```bash
npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/auth.controller.test.js
npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/order.controller.test.js
```
