# Batch 3 — Remaining Backlog Master Execution Plan

> **For agentic workers:** Detailed designs already exist per epic in `docs/superpowers/specs/2026-06-21-*.md`. This is the **execution order + file map + test target** roadmap. Each epic is built with TDD, committed on `feat/backlog-impl-2026-06-22`, and recorded in memory after completion. Backend + frontend are separate repos (`petstore-backend`, `petstore-frontend`).

**Date:** 2026-06-23
**Branch:** `feat/backlog-impl-2026-06-22` (both repos)
**Authorization:** User granted full autonomous commit authority for this session ("implement all remaining, commit after each, save to memory, don't ask").

**Goal:** Implement all remaining backlog epics that don't require external credentials or human visual sign-off, fully tested and committed.

**Convention:** Run affected Jest suites individually (full `npm test` flakes under combined auth load). Each commit must have green tests. Frontend must `npm run build` clean. Use shared utils (`formatMUR`, `urls.js`, Cloudinary helpers, `ImageManager`).

---

## Execution order (value × safety; backend-testable first, blocked/visual last)

| # | Epic | Repos | Why this slot |
|---|------|-------|---------------|
| 1 | **6b/7b FE + BE contract — shared ImageManager** | BE+FE | Active thread; unblocks 6b/7b/8 image UIs |
| 2 | **Epic 10 — email template unification (+ F5 verification template)** | BE | Self-contained, fully testable, resolves Security F5 |
| 3 | **Epic 11 — StoreSettings + shipping/tax + granular invoices** | BE (+ admin settings FE) | Backend-heavy, testable; feeds Epic 15 later |
| 4 | **Epic 9b — announcements generalization (types/targets/templates)** | BE+FE | Model rework, testable |
| 5 | **Epic 8 — tips/gallery cover + section images** | BE+FE | Reuses ImageManager from #1 |
| 6 | **Epic 12 FE — subscription admin/user granular views** | FE (+ enrich BE if needed) | Backend demand engine already done (Epic 12 BE) |
| 7 | **Epic 4 — professional card redesign** | FE (visual) | Lower-risk visual; build-verify |
| 8 | **Epic 2 tail — `<select>` migration, RTE image constrain, SearchBar reuse** | FE | Taste-heavy; do if budget remains |
| 9 | **Epic 13 — import/export rebuild** | FE (large) | Largest FE; do last |

**Explicitly deferred (cannot complete autonomously):**
- **Epic 15** (checkout + Juice by MCB) — blocked on MCB Juice gateway credentials.
- **Security F1–F4** — reserved for user QA per prior instruction (F5 lands via Epic 10).

---

## Epic 1 — Shared ImageManager (6b/7b FE + BE contract)

**Spec:** `2026-06-21-variant-images-and-mur-pricing-design.md` (Part 1 & 2), `2026-06-21-feedback-photos-fix-and-admin-reorder-design.md`.

**BE contract change (backward-compatible):**
- `product.controller.createProduct` / `updateProduct`: if `req.body.images` is a JSON array of `{url, publicId}` refs, use it directly; diff stored vs incoming publicIds → `deleteMultipleFromCloudinary(removed)`. Keep legacy multipart (`keepImages` + `req.files`) path as fallback.
- Variant images: parse `variants[].images` refs; diff across all variants (old vs new) for Cloudinary cleanup; removing a variant deletes its images. (Schema already has `variants[].images` from commit `6bd7956`.)
- Feedback admin update: accept `photos` JSON refs; diff cleanup. (`updateFeedback` mass-assignment already fixed in `11e66cb`.)

**FE:**
- Create `frontend/src/Components/Admin/ImageManager/ImageManager.jsx` (+ css). Props: `value` (`[{url,publicId}]`), `onChange`, `uploadUrl`, `max`. Behavior: select/drop → immediate upload → append ref; `@dnd-kit` drag-reorder; "Make cover" → index 0; delete. Upload limit + non-image rejection client-side.
- Wire into `AdminProductForm.jsx`: replace bespoke image grid with `<ImageManager uploadUrl="/products/upload-image">`; add per-variant `<ImageManager max={6}>`; submit `images` + `variants[].images` as JSON (drop `keepImages`/multipart). Fix price label `($)`→`(Rs)`.
- Wire into `AdminFeedback.jsx` view/edit modal: `<ImageManager uploadUrl="/feedback/upload-image">` for photo reorder/delete.
- `IndividualProductItemPage.jsx`: gallery swaps to `selectedVariant.images` when present, falls back to product images.

**Tests:** BE — extend `product.controller.test.js` / `product.images.test.js` (JSON refs accepted, diff deletes removed, variant images diff); feedback admin photo update. FE — `npm run build` + ImageManager smoke test if feasible.

**Commit:** BE then FE separately.

---

## Epic 2 — Email Template Unification (Epic 10)

**Spec:** `2026-06-21-email-template-unification-design.md`.

**Files:** Create `src/templates/_layout.html`, `src/templates/email-verification.html`; modify `src/utils/email.js` (`renderTemplate` wraps fragment in layout); migrate active templates to body-only fragments; delete orphaned `appointment*` templates (confirm `appointment.controller` no longer sends — it DOES still send `appointment-request`/`-confirmation`/`appointmentStatusUpdate*`, so audit live references and only delete truly-unreferenced ones: `appointment-confirmation`, `appointment-request`, `appointment-status` standalone). Add `scripts/preview-emails.js`. Point `resendVerificationEmail` (auth.controller) at `email-verification` (F5).

**Tests:** `tests/email.layout.test.js` — renderTemplate wraps fragment (header+footer+body); palette + `formatMUR`; unsubscribe footer only when `unsubscribeUrl`; verification template used; reference guard (every `sendEmail` template name resolves to a file).

**Commit:** single BE commit.

---

## Epic 3 — StoreSettings + Shipping/Tax + Granular Invoices (Epic 11)

**Spec:** `2026-06-21-invoices-granular-and-shipping-tax-design.md`.

**Files:** Create `src/models/storeSettings.model.js` (singleton + `getSettings()`), `src/controllers/settings.controller.js`, `src/routes/settings.routes.js` (`GET /api/settings` public, `PATCH` admin), `src/validators/settings.validator.js`. Modify `order.model.js` (+`shippingFee`,`tax`,`taxRate`,`taxInclusive`, item `originalPrice`), `order.service.js#buildOrder` (compute shipping/tax/originalPrice), `invoice.model.js` (expanded line items + fields), `invoice.service.js` (`generateInvoice` snapshot + `generatePDF` via `formatMUR`). FE: wire `AdminSettings.jsx` to `/api/settings`.

**Tests:** `tests/storeSettings.test.js`, extend `order.service` tests (shipping threshold, inclusive/exclusive tax, originalPrice snapshot, subscription orders), `invoice.service` tests (granular fields, MUR, no `$`).

**Commit:** BE; FE settings wiring separately.

---

## Epic 4 — Announcements Generalization (Epic 9b)

**Spec:** `2026-06-21-announcements-generalization-design.md`.

**Files:** Modify `announcement.model.js` (+`type`/`category` enum: sale/event/new_product/new_tip/restock/general; target refs per type; free-form fields). `announcement.controller.js` (build email per type, reuse `urls.js`). New/updated email fragment(s) under `_layout.html` (depends on Epic 2 — sequence after it). FE `AdminAnnouncements` type selector + target picker.

**Tests:** `tests/announcement.*.test.js` — each type builds correct target + email; backward compat with existing sale announcements.

**Commit:** BE; FE separately.

---

## Epic 5 — Tips/Gallery Authoring: cover + section images (Epic 8)

**Spec:** `2026-06-21-tips-gallery-authoring-design.md`.

**Files:** Tip + Gallery models gain `coverImage {url,publicId}` and `sections[].image`. Tip/Gallery controllers: cover/section image diff cleanup; mount `upload-image` on tips (gallery already has one). FE AdminTipForm / AdminGalleryForm: `<ImageManager max={1}>` for cover, per-section image; render cover + section images on detail pages. Reuse search component on tips list.

**Tests:** model + controller tests for cover/section image persistence + diff cleanup.

**Commit:** BE; FE separately.

---

## Epic 6 — Subscriptions FE granular views (Epic 12 FE)

**Spec:** `2026-06-21-subscriptions-admin-analytics-design.md` (BE demand engine done in `944f275`).

**Files:** FE `AdminSubscriptions` detail view (items: product+variant+qty+interval+nextRun+status); demand-prediction panel consuming the admin analytics endpoint; flag subscribed products in admin product list; `MySubscriptions` granular detail. Add `enrichSubscription` BE helper only if endpoints lack needed fields.

**Tests:** FE build + smoke tests; BE test if enrich helper added.

**Commit:** FE (+ BE if touched).

---

## Epic 7 — Professional card redesign (Epic 4 visual)

**Spec:** `2026-06-21-professional-card-and-appointments-search-design.md`.

**Files:** FE professional card component in appointments directory; responsive aesthetic redesign; appointments search via shared SearchBar.

**Tests:** build + existing appointment suite green.

**Commit:** FE.

---

## Epic 8 — Design-system tail (Epic 2 leftovers)

**Spec:** `2026-06-21-design-system-foundation-design.md`.

**Files:** Migrate native `<select>` → tokenized component across forms; constrain RTE images (CSS already partly done in `20df224`); reuse SearchBar on Service/Tips. (SearchBar generalization was reverted in `e96bc5c` — re-approach carefully so petshop search keeps working.)

**Commit:** FE incrementally.

---

## Epic 9 — Import/Export rebuild (Epic 13)

**Spec:** `2026-06-21-import-export-rebuild-design.md`.

**Files:** Merge `ImportPage.jsx` (920-line wizard) into `ImportExportServicePage.jsx` inline form; delete-and-redo per spec.

**Commit:** FE.

---

## After each epic
1. Run affected suites individually — green.
2. Frontend `npm run build` clean (for FE epics).
3. `git add` + commit on `feat/backlog-impl-2026-06-22` (each repo separately).
4. Update `graphify update .` is optional (AST-only) — skip unless cheap.
5. Update memory (`project_feature_roadmap.md` / a batch-3 memory) with commit hash + status.
6. Push at natural checkpoints.
