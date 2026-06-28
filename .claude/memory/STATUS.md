# Project Status

**Active branch:** `feat/backlog-impl-2026-06-22` (both `backend/` and `frontend/` repos)
**Last updated:** 2026-06-28 (testing architecture + CI)

---

## Done

| Epic | Description | Scope |
|------|-------------|-------|
| 1 | Nav/layout — About in navbar, mobile header, gallery breadcrumbs | FE |
| 2 | Design system foundation — shadcn/ui token binding, SearchBar generalized, RTE img overflow fix | FE (partial — see Remaining) |
| 3 | Service page — Coming Soon badges, live card links | FE |
| 5 | Petshop filter — case-insensitive category match, DB-driven filter options, remove dead rating filter | BE + FE |
| 6 | Product bulk actions — `POST /products/bulk` (activate/feature/sale/delete) + admin toolbar UI | BE + FE |
| 6b | Variant images — `ImageManager` component; per-variant images in AdminProductForm; variant gallery swap on product detail page | BE + FE |
| 6c | MUR-only pricing — shared `src/utils/currency.js formatMUR`; Rs labels on price inputs; no $ leaks | BE + FE |
| 7a | Feedback photo fix — homepage testimonial renders each feedback's own photos, not hardcoded stock images | FE |
| 7b | Feedback photos BE — `Feedback.photos` → `[{url, publicId}]`; admin upload endpoint; mass-assignment fix | BE |
| 8 | Tips/gallery cover + section images — `coverImage {url,publicId}`; `sections[].images`; admin forms use ImageManager | BE + FE |
| 9a | Announcement email URLs — `src/config/urls.js` resolver; all transactional emails use correct frontend base URL | BE |
| 9b | Typed announcements — `Announcement` model (sale/event/content/general), buckets, typed target fields | BE |
| 10 | Email template unification — `_layout.html` shell, all templates body-only fragments, `{{mur}}`/`{{fmtDate}}` helpers, `email-verification.html` (F5 closed), preview harness, 7/7 tests | BE ✅ |
| 11 | StoreSettings + shipping/tax — `StoreSettings` singleton; `buildOrder` adds shippingFee/tax; granular invoice line items | BE |
| 12 | Subscription analytics BE — `predictDemand`, `productCoverage`, `runsInHorizon`; admin `/analytics` + `/product-coverage` endpoints | BE |
| 12 FE | Subscription enrichment + detail views — `enrichSubscription` service (per-cycle total, savings, cadence, next-run-in-days, order history), enriched `/mine` + `/admin` lists, `/mine/:id` + `/admin/:id` detail endpoints, product-analytics subscriptions block, admin detail drawer + status/due-soon filters, My Subscriptions financials/image/history | BE + FE |
| 14 | Variant-aware inventory — per-variant rows in inventory table; restock/adjust/history all variant-scoped | BE + FE |

---

## Remaining

| Epic | What's left | Notes |
|------|-------------|-------|
| 2 | 17 native `<select>` → shadcn `Select` migrations + `/admin/ui-gallery` verification page | FE; unblocks Epic 4 |
| 4 | ProfessionalCard visual rebuild on design system; appointment list SearchBar | FE; depends Epic 2 |
| 9b FE | Typed announcements admin UI — type picker, event fields, CTA fields, content ref picker | FE |
| 11 FE | `AdminSettings` StoreSettings page (shippingFee, freeShippingThreshold, taxRate toggles); checkout displays shipping/tax | FE; depends Epic 11 BE ✅ |
| ~~12 FE~~ | ~~Subscriptions analytics dashboard; enriched admin list/detail; user My Subscriptions view~~ | **DONE 2026-06-24** |
| 13 | Import/Export full-stack rebuild — `ImportExportApplication` model + routes + admin/applicant emails + FE multi-step form + admin page | BE + FE; depends Epics 2 + 10 |
| 15 | Checkout redesign + COD/Card/Juice payment method selection; Juice MCB gateway integration | BE + FE; **blocked — MCB Juice merchant credentials not yet provided** |

---

## Notes

- **Frontend URL** — `.env` `FRONTEND_URL`/`CLIENT_URL` = `https://petstore-frontend-ixll.vercel.app`. Update this in the hosting platform env vars dashboard if deploying.
- **Orphan** — `src/templates/sale-announcement.html` still on disk, not referenced by any controller (superseded by `announcement.html`). Safe to delete anytime.
- **Subscription savings chooser (2026-06-24)** — Product page + cart now use a shared `SubscriptionChooser` component (two radio cards, "Save N%" pill, strikethrough→green savings math, conditional frequency dropdown). Product page merged Add to Cart + Subscribe into one smart button. Savings math + 7-day rule live in `frontend/src/utils/subscriptionPricing.js`.
- **DESIGN GAP — Cart checkout subscription discount (2026-06-24):** The `SubscriptionChooser` on the cart page shows a discounted price (e.g. Rs 270 instead of Rs 300) but the actual order placed today is at **full price**. The 10% discount only applies from the 2nd recurring delivery onward (the subscription's `discountPercent` is applied by the backend on future reorder runs, not on `createOrder`). Three options to resolve — needs a decision before this surface is considered done: (A) fix copy to say "Save from your 2nd delivery"; (B) apply the discount to the first checkout order too (backend `createOrder` change); (C) remove chooser from cart, keep a plain "Make recurring" checkbox with honest wording. See DEFERRED.md for full analysis.
- **Epic 12 completed (2026-06-24)** — The "FE" label was a misnomer: it required building the shared server-side `enrichSubscription` function (never built despite Epic 12 BE being marked done). Financials are server-side because the FE payload lacks variant/sale prices. Demand forecast, admin list, and "Subscribed (N)" badge were already shipped in the prior merge. New in this epic: `enrichSubscription` service, enriched list responses, `/mine/:id` + `/admin/:id` detail endpoints, subscriptions block in product analytics overview, admin enriched detail drawer + status/due-soon filters, My Subscriptions financials + item image + order history. Branch: `feat/epic12-subscription-enrichment` (both repos).
- **Bug fix (2026-06-24)** — Admin products page was silently hiding inactive products. `GET /products` now accepts `isActive=all` to skip the filter; admin fetch passes it. Client-side filter chip works correctly.

## Testing architecture & CI (2026-06-28)

Branch `docs/testing-architecture-cicd` (local, unpushed). Spec: `docs/superpowers/specs/2026-06-28-backend-testing-architecture-cicd-design.md`.

**Done (Phase 1):**
- Runner stays **Jest** (Vitest evaluated and rejected — too much churn). Jest `projects` split: `unit` (co-located `src/**/*.test.js`, no DB) + `integration` (`tests/integration/**/*.test.js`, in-memory Mongo via `tests/helpers/setup.js`).
- Unit tests co-located next to source (7 files); integration tests organized into domain folders under `tests/integration/` (products/orders/subscriptions/cart/auth/content/feedback/announcements/misc). Setup moved to `tests/helpers/`; shared `tests/helpers/factories.js` added. `tests/e2e/` scaffolded.
- Coverage scope corrected to all business logic (controllers, services, models, middlewares, validators, utils). **Real baseline: 58.3% lines / 46.5% branches.**
- CI: `.github/workflows/ci.yml` — two jobs (`unit`, then `integration` via `needs:`), on push/PR to main|develop. No lint gate (1268 pre-existing eslint errors). No service container (in-memory Mongo).
- Removed dead services `ProductService.js` + `userService.js` (zero references).
- Suite: 42 suites / 311 tests green.

**Done (Phase 1b — unit-test backfill, 2026-06-28):**
- Added co-located unit tests for **all 18 validators** (Joi schemas + cross-field rules), 5 utils (`validation`/ValidationUtils, `dateUtils`, `productVariants`, `unsubscribeToken`, `contentImages`), and 2 middlewares (`errorHandler`, `validateRequest`). **+234 unit tests → unit project now 32 suites / 263 tests, all green.**
- Fixed latent bug: `errorHandler` never exported `createError` although `validateRequest` + `professionalController` imported it → validation failures threw a `TypeError` (500) instead of a clean 4xx. Added the `createError(statusCode, message)` factory.

**Open (Phases 2–3):**
- Coverage is **58%, not 90%.** Ratchet gate NOT enabled yet (would block all PRs).
- ⚠️ **Integration suite is currently RED (pre-existing, not from the unit work).** ~178/282 integration tests fail with `E11000 duplicate key` on fixed emails (`admin@test.com` / `admin@example.com`): per-file `beforeEach` `deleteMany` is not effectively isolating state, so setup aborts and `res.body.data.accessToken` is undefined downstream. Root cause is the connect-per-file + manual-cleanup pattern across all 35 files. Needs a shared connect-once + global collection-clear setup (`setupFilesAfterEach`) and removal of per-file `mongoose.connect`/`close`. **This blocks the CI `integration` job.**
- Untested service/feature areas: **payments** (`payment.service` 14%, `paypal.service` 17% — `payment.controller` has no tests) and **professionals** (`professionalService` 5% — `professionalController` has no tests). These are the biggest coverage wins.
- E2E layer (black-box API) not built — only scaffolded.
- 35 integration files still carry inline `makeUser`/`signupAndLogin`; migrate to `tests/helpers/factories.js` incrementally.
- Per-job CI coverage is partial; a coverage-merge step is needed before a real combined gate.

## Security

F5 (missing verification template) closed by Epic 10. Four findings remain open. See `SECURITY.md`. Awaiting QA sign-off before fixing.
