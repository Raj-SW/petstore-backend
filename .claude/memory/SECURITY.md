# Security Findings

Audit conducted 2026-06-21. All five findings are **open** — awaiting QA sign-off before fixing. Do not close these without explicit confirmation.

---

## F1 — Broken Password Reset (Double-Hash)

**Severity:** High
**File:** `src/controllers/auth.controller.js` — `resetPassword`
**Problem:** The reset handler hashes the incoming password, then saves it to the user. The `User` model's `pre('save')` hook hashes the password again on every save — so the stored hash is a hash-of-a-hash. The user's new password can never authenticate.
**Fix:** Either remove the manual hash in `resetPassword` and let the pre-save hook handle it, or use `updateOne` with `$set` to bypass the hook (then hash manually, once).

---

## F2 — Order Cancel IDOR

**Severity:** High
**File:** `src/controllers/order.controller.js` — `cancelOrder`
**Problem:** The cancellation endpoint verifies the order exists but does not check that `order.user` matches the authenticated user's ID. Any authenticated user can cancel any other user's order by guessing the order ID.
**Fix:** Add `if (order.user.toString() !== req.user._id.toString()) return res.status(403)...` before processing the cancellation.

---

## F3 — User Enumeration via Auth Endpoints

**Severity:** Medium
**Files:** `src/controllers/auth.controller.js` — `login`, `forgotPassword`
**Problem:** Login returns `"User not found"` for unknown emails and `"Invalid credentials"` for wrong passwords — distinct messages allow enumeration. `forgotPassword` similarly reveals whether an email is registered.
**Fix:** Return identical generic messages regardless of whether the email exists. For `forgotPassword`, always respond with `"If that email is registered, you'll receive a reset link"`.

---

## F4 — Dependency CVEs

**Severity:** Medium (known CVEs in pinned versions)
**Packages:**
- `handlebars` — prototype pollution / RCE in older versions
- `cloudinary` — check for updates; SDK has had auth-bypass patches
- `axios` — SSRF in older versions

**Fix:** Run `npm audit fix` and review any breaking changes. Pin to patched versions.

---

## F5 — Missing Email Verification Template

**Severity:** Low–Medium
**File:** `src/controllers/auth.controller.js` — `resendVerificationEmail`
**Problem:** `resendVerificationEmail` has no email template — it either sends a bare link or silently fails. There is no `email-verification.html` template in `src/templates/`.
**Fix:** Create the template (part of Epic 10 email unification). Wire `resendVerificationEmail` to it. This is the primary deliverable of Epic 10.
