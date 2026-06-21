# Import/Export Service — Functional Rebuild — Design Spec (Epic 13)

**Date:** 2026-06-21
**Repos:** backend (`petstore-backend`) — new application resource + emails; frontend (`petstore-frontend`) — merged page + rebuilt form + admin view.
**Status:** ✅ Approved design, pending implementation plan.
**Depends on:** Epic 2 (design-system `ui/*`, tokens) and Epic 10 (email `_layout`). Implement after both.
**Backlog:** `docs/BACKLOG-2026-06-21.md` Epic 13. Reuses `ui/*`, Breadcrumb, the email layout, admin table patterns.

## Problem

The import/export feature is broken and duplicated:
- **The form submits to nothing.** `ImportPage.jsx` (920-line, react-bootstrap, 4-step wizard) `handleSubmit` only `setSubmitted(true)` — **no API call, no email, no persistence.** Collected data is discarded.
- **No backend** import/export resource exists (no model/controller/route).
- **Two overlapping pages + broken routing:** `ImportExportServicePage.jsx` (marketing hero + service cards + an "Apply" button revealing the wizard inline) is imported but **not routed**; the `/import-export-service` route renders the **bare wizard** (`ExportImportForm`) instead.
- Form state captures only contact/address fields across 4 steps (half-wired).

## Decisions (locked in brainstorm)

- **Full functional rebuild** (FE + backend): persist applications, admin view, applicant + admin email confirmations.
- **One page** at `/import-export-service`: intro + inline multi-step form; delete the duplicate wizard; fix routing.
- **Comprehensive pet-travel application** data.

## Design

### Backend — new `ImportExportApplication` resource

- **Model `import_export_application.model.js`:**
  - `user` (ObjectId ref User, required — login required to apply).
  - applicant: `firstName, lastName, email, phone, address, city, country, zip`.
  - `direction`: enum `['import','export']`.
  - `originCountry`, `destinationCountry`.
  - `pet`: `{ name, species (enum dog|cat|bird|fish|rabbit|reptile|other), breed, age (Number), microchipNumber, weight (Number) }`.
  - `preferredTravelDate`: Date.
  - `healthCertStatus`: enum `['none','in_progress','complete']`.
  - `vaccinationStatus`: enum `['none','in_progress','complete']`.
  - `notes`: String.
  - `status`: enum `['new','reviewing','approved','in_progress','completed','rejected']`, default `'new'`.
  - timestamps. Indexes `{ user: 1 }`, `{ status: 1, createdAt: -1 }`.
- **Validator** (Joi): required core fields (direction, countries, applicant name/email/phone, pet name/species); enum validation; date sanity.
- **Controller:**
  - `createApplication` (auth) — builds from `req.body` + `req.user`; persists; sends **applicant confirmation** + **admin notification** emails (non-fatal). Returns the created application.
  - `getMyApplications` (auth) — the caller's applications.
  - `getApplicationsAdmin` (admin) — list, filter by `status`, paginated.
  - `getApplicationAdmin` (admin) — single.
  - `updateApplicationStatus` (admin) — set `status` (+ optional admin note); optional status-update email to the applicant.
- **Routes** `/api/import-export`: `POST /` (auth + validator), `GET /mine` (auth), `GET /admin/all` (admin), `GET /admin/:id` (admin), `PATCH /admin/:id` (admin). Mounted in `app.js`.
- **Emails** (body-only fragments under the Epic 10 `_layout`): `import-export-received.html` (applicant), `import-export-admin.html` (admin); optional `import-export-status.html` (status change). Amounts/dates via shared helpers (none expected; dates via the shared formatter).

### Frontend — single merged page

- **Delete** `src/Pages/ImportExport/Import/ImportPage.jsx` (the 920-line wizard) and the duplicate marketing rendering. Build a single page (reuse/repurpose `ImportExportServicePage.jsx` or a new `ImportExportPage.jsx`) at **`/import-export-service`**: hero/intro + service info cards + the rebuilt multi-step application form inline (revealed by "Apply"; login-gated as today).
- **Fix routing** in `main.jsx`: `/import-export-service` → the merged page; remove the `ExportImportForm` import/route.
- **Rebuild the form on the design system** (`ui/Select` for direction/species/country, `ui/*` inputs, tokens) — **remove react-bootstrap**. Decompose into step components + a small reusable **`<Stepper>`**:
  1. Direction (import/export) + origin/destination countries.
  2. Applicant details (prefilled from `useAuth` user; editable).
  3. Pet details (name/species/breed/age/microchip/weight).
  4. Travel date + health-cert + vaccination status + notes.
  5. Review + submit.
- Submit → `POST /api/import-export` via a new **`importExportApi`**; success screen; inline validation + error handling; login guard (existing behavior).
- **Admin page `/admin/import-export`**: list applications (status filter via `ui/Select`), detail view, and status update. Reuse the admin DataTable patterns.
- (Optional) surface "My applications" in the user profile via `getMyApplications`.

## Reuse / dependencies
`ui/*` primitives + tokens (Epic 2), the email `_layout` (Epic 10), the shared `<Breadcrumb>`, and the admin table patterns. The new `<Stepper>` is a small reusable component (candidate for the DRY register if reused later).

## Testing
Run suites individually.
- **Backend:** `createApplication` persists + triggers applicant/admin emails (mocked); validation (required fields, enums, bad date → 400); `getMyApplications` scoping; admin list/filter/status update; auth (non-auth POST → 401) and admin guards (non-admin admin routes → 403).
- **Frontend:** multi-step navigation + per-step validation; applicant prefill from the logged-in user; submit posts to the API and shows success; error handling; admin list renders + status update persists; old wizard removed and `/import-export-service` renders the merged page.

## Acceptance criteria
- A single `/import-export-service` page combines the intro + a rebuilt multi-step application form (design system, no react-bootstrap); the duplicate `ImportPage.jsx` is deleted and the routing fixed.
- Submitting while logged in **persists** an `ImportExportApplication` via the new backend resource and sends applicant + admin confirmation emails (under the Epic 10 layout).
- The application captures comprehensive pet-travel data (applicant, direction, origin/destination, pet details, travel date, health/vaccination status, notes) with an admin-managed status.
- Admin can view and manage (status) applications; users can view their own.
- Build + existing/new tests pass.

## Out of scope
- Payments for the service (separate, if ever needed).
- Document/file uploads for certificates (could be a follow-on using the shared ImageManager/upload pattern).
- Multi-pet-per-application (single pet per application for now).
