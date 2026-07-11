# Admin Professionals Management — Design

**Date:** 2026-07-08
**Status:** Approved (design), pending implementation plan
**Scope:** Full-stack — backend (`backend/`) + admin frontend (`frontend/`)
**Approach:** B — dedicated `adminProfessional.controller.js` on the existing `/admin/*` surface, delegating to the shared `professionalService`.

---

## Problem

The admin sidebar ("Professionals" → `/admin/professionals`) and a dashboard tile both link to a route that does not exist — there is no page and no route registered in `main.jsx`. Admins currently have no dedicated surface to onboard, edit, or offboard professionals. Professionals can only be created by manually changing a user's role from the generic Users table, and there is no way to edit their `professionalInfo` (specialization, availability, services, photo, bio) through the admin UI.

This feature builds the missing admin Professionals surface and its supporting backend.

## Key facts about the existing system

- **Professionals are not a separate collection.** They are `User` documents with `role ∈ {veterinarian, groomer, trainer, petTaxi}` plus a `professionalInfo` sub-document:
  `specialization`, `qualifications: [String]`, `experience: Number`, `rating: Number` (0–5), `reviewCount`, `availability: Map<day, {startTime, endTime, isAvailable}>`, `isActive: Boolean`, `bio`, `services: [{name, price, duration, description}]`.
  `specialization` and `experience` are **required** for any non-customer/non-admin role.
- **No self-registration as a professional.** `auth.controller.register` hard-codes `role: 'customer'`. There is **no approval / pending / verified flag** anywhere. Professionals exist the moment an admin sets the role.
- **Existing admin user management** (`admin.routes.js` → `admin.controller`): `GET /admin/users` (role filter), `PATCH /admin/users/:id/role`, `PATCH /admin/users/:id/status`, `DELETE /admin/users/:id`. This stays as the generic account surface.
- **Dead/broken code:** `professionalController.createProfessional` and `deleteProfessional` reference an undefined `Professional` model (there is none) and an unimported `createError`. They are wired to no route. They will be deleted.
- **`petTaxi` exclusion:** `professionalService.PROFESSIONAL_ROLES = ['veterinarian','groomer','trainer']` — petTaxi is excluded from public browse. This is intentional (Pet Taxi is "coming soon" on the service page) and is preserved for public browse, but the admin list includes petTaxi.
- **Token infra to reuse:** the `User` model already has `passwordResetToken` / `passwordResetExpires`. The invite flow reuses this rather than introducing new fields.
- **Frontend admin pattern:** pages use the reusable `Components/Admin/DataTable/DataTable` (props: `data`, `columns`, `onEdit`, `onDelete`, `onView`, `loading`, `itemsPerPage`, pagination, optional row selection), shadcn `Select`, `context/ToastContext`, and `Components/Admin/ImageManager`. `AdminUsers.jsx` and `AdminProductForm.jsx` are the reference pages. Admin routes are lazy-loaded and registered in `main.jsx`.

## Non-goals (YAGNI)

- No approval / verification workflow (none requested; no such flag today).
- No hard account deletion here — that stays in the Users admin.
- No manual rating editing — rating becomes read-only, derived from reviews.
- No change to the public professional browse behavior except the one `isActive` visibility fix below.

---

## Design

### 1. Data model — no schema changes

Reuse `User` + `professionalInfo`. Three targeted fixes ship with this work:

1. **Admin list includes `petTaxi`.** Define `ADMIN_PROFESSIONAL_ROLES = ['veterinarian','groomer','trainer','petTaxi']` for admin queries. Public `PROFESSIONAL_ROLES` is unchanged.
2. **Deactivate actually hides from public browse.** `professionalService.getAllProfessionals` (public) will always exclude `professionalInfo.isActive: false`. Today the `professionalInfo.isActive` filter is only applied when an `isActive` query param is passed, so deactivating a professional does not hide them. After the fix, admin "deactivate" is meaningful.
3. **Delete dead code:** remove `createProfessional` and `deleteProfessional` from `professionalController` and drop the now-unused manual rating route/handler (`PATCH /professionals/:id/rating` + `updateProfessionalRating`).

### 2. Backend — `adminProfessional.controller.js` + `professionalService` methods

New controller mounted in `admin.routes.js` (inherits `isAuthenticated` + `isAdmin` from the router-level guards):

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/admin/professionals` | List: search (name/email/specialization), filter by `role` + `status` (`all`/`active`/`inactive`), paginated, sorted |
| POST | `/admin/professionals` | Create + invite (new account, random password, set-password email) |
| POST | `/admin/professionals/promote` | Promote existing user: `{ userId, role, professionalInfo }` |
| PATCH | `/admin/professionals/:id` | Edit `professionalInfo` |
| PATCH | `/admin/professionals/:id/status` | Toggle `professionalInfo.isActive` |
| DELETE | `/admin/professionals/:id` | Offboard = demote to `customer` + set `professionalInfo.isActive: false` |

New/changed `professionalService` methods (the controller stays thin; logic lives in the service):

- `adminListProfessionals(filters, pagination, sorting)` — roles = `ADMIN_PROFESSIONAL_ROLES`; supports `search` (case-insensitive regex over `name`, `email`, `professionalInfo.specialization`, using the existing `escapeRegExp`), `role`, `status`, pagination, whitelisted sort. Excludes sensitive fields (`-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires`).
- `createProfessionalAccount({ name, email, role, professionalInfo })` — creates a `User` with a cryptographically random password, generates a password-reset token, returns `{ user, rawToken }` so the controller can send the invite. Throws `AppError(400)` on duplicate email (`code === 11000`).
- `promoteUserToProfessional(userId, { role, professionalInfo })` — validates the target exists and is currently `customer` (reject if already a professional or admin), sets `role` + `professionalInfo`, `runValidators: true`.
- `offboardProfessional(id)` — sets `role: 'customer'` and `professionalInfo.isActive: false`; leaves the rest of `professionalInfo` intact so a re-promote is lossless.
- Reuse existing `updateProfessional(id, data)` for `PATCH /:id` (admin-scoped; the controller enforces admin, so the ownership check in the public handler is not on this path).

**Validation:** a new `adminProfessionalValidator.js` (Joi) with `createProfessionalSchema`, `promoteSchema`, `updateProfessionalInfoSchema`, `listQuerySchema`, applied via the existing `validateRequest` middleware. `professionalInfo.availability` validated as an object keyed by weekday with `{ startTime, endTime, isAvailable }`; `services` as an array of `{ name, price>=0, duration>=0, description }`.

### 3. Onboarding flows

**Create + invite.** Admin submits name, email, role, and `professionalInfo`. Backend:
1. Creates the `User` (`isActive: true`, random password the admin never sees).
2. Generates a set-password token (reuses `passwordResetToken` / `passwordResetExpires`).
3. Sends `professional-invite.html` (Epic 10 layout shell; base URL via `config/urls.js`) linking to the existing reset-password page. The professional sets their own password.

No raw password is ever entered into a field or returned in an API response.

**Promote.** A modal in the UI searches existing users via `GET /admin/users?search=`, admin selects one, then fills `professionalInfo`. Name/email are read from the existing account (locked in the form). Backend rejects promoting a user who is already a professional or admin.

### 4. Edit form scope (`professionalInfo`)

Fields: `specialization` · `qualifications` (tag input) · `experience` · `bio` (≤500 chars) · profile photo (`ImageManager`, single image) · `services` (repeatable rows: name / price / duration / description) · **weekly availability editor** — Mon–Sun, each row = an "available" toggle + native `<input type="time">` start/end, mapped to the `availability` Map. `rating` + `reviewCount` are shown **read-only** on edit.

### 5. Frontend — follows AdminUsers / AdminProductForm

- **`AdminProfessionals`** list page. Register the missing `/admin/professionals` route in `main.jsx` (lazy-loaded), removing the dead link. `DataTable` columns: photo + name, email, role badge, specialization, experience, read-only rating (stars), status, row actions (edit / deactivate / offboard). Filters: role `Select`, status `Select`, search box. "Add professional" button → choose **Create new** or **Promote existing**.
- **`AdminProfessionalForm`** page for create/edit (`/admin/professionals/new`, `/admin/professionals/:id/edit`), mirroring `AdminProductForm`.
- **`adminProfessionalsApi.js`** service (list / create / promote / update / toggleStatus / offboard). Reuses `ToastContext`, shadcn `Select`, `ImageManager`, existing admin CSS.
- Loading states use the shared skeleton pattern already adopted across admin/list pages.

### 6. Error handling

- Duplicate email on create → `400` "Email already exists" (surfaced as a toast on the form).
- Promote a non-customer → `400` with a clear message.
- Invalid ObjectId / not found → `400` / `404` via the existing `AppError` + `errorHandler` path.
- Invite email send failure must not silently swallow: if the account is created but the email fails, the API returns success with a warning field so the admin can trigger a resend (resend reuses the same create-token path via a follow-up; a dedicated resend endpoint is out of scope — admin can use the standard "forgot password" flow as the fallback, noted in the UI).

### 7. Testing

**Backend (Jest, in-memory Mongo):**
- `professionalService` **unit tests**: `adminListProfessionals` (role/status/search filters, pagination, sensitive-field exclusion), `createProfessionalAccount` (random password set, token generated, duplicate-email rejection), `promoteUserToProfessional` (happy path, reject already-professional, reject admin, not-found), `offboardProfessional` (demotes + deactivates, preserves professionalInfo).
- **Integration tests** for all six `/admin/professionals` endpoints: admin-guard enforcement (401/403 for non-admin), create + invite (asserts token persisted, no password leaked in response), promote, list filters, status toggle, offboard, plus the public-browse `isActive` visibility fix (deactivated professional disappears from `GET /professionals`).
- `adminProfessionalValidator` unit tests (Joi schemas + availability/services shape).

**Frontend (Vitest):**
- `AdminProfessionals` list renders rows, applies role/status/search filters, wires row actions.
- `AdminProfessionalForm` validation (required specialization/experience, services rows, availability mapping) and create-vs-edit modes.
- `adminProfessionalsApi` request-shape tests.

## Files

**Backend**
- Create: `src/controllers/adminProfessional.controller.js`
- Create: `src/validators/adminProfessionalValidator.js` (+ `.test.js`)
- Create: `src/templates/professional-invite.html`
- Modify: `src/routes/admin.routes.js` (mount the six routes)
- Modify: `src/services/professionalService.js` (new admin methods + `ADMIN_PROFESSIONAL_ROLES` + public `isActive` visibility fix) (+ `.test.js` / integration)
- Modify: `src/controllers/professionalController.js` (delete dead `createProfessional`/`deleteProfessional`)
- Modify: `src/routes/professional.routes.js` (drop manual rating route)
- Create: `tests/integration/professionals/adminProfessionals.test.js`

**Frontend**
- Create: `src/Pages/Admin/Professionals/AdminProfessionals.jsx` (+ `.css`, + test)
- Create: `src/Pages/Admin/Professionals/AdminProfessionalForm.jsx` (+ test)
- Create: `src/Services/api/adminProfessionalsApi.js` (+ test)
- Modify: `src/main.jsx` (register the three routes, lazy-loaded)

## Rollout notes

- Update `backend/.claude/memory/STATUS.md` when shipped (this closes the "Professionals" admin gap and part of the Epic 4 remainder).
- The public-browse `isActive` fix is a behavior change: any professional currently carrying `professionalInfo.isActive: false` will disappear from public browse. Verify none are unintentionally deactivated before deploy.
