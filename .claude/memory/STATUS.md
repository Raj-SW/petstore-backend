# Project Status

**Active branch:** `main` — `feat/admin-professionals-management` merged in both repos 2026-07-14 (backend PR #14, frontend PR #24)
**Last updated:** 2026-07-14

---

## Done

| Epic | Description | Scope |
|------|-------------|-------|
| 1 | Nav/layout — About in navbar, mobile header, gallery breadcrumbs | FE |
| 2 | Design system foundation — shadcn/ui token binding, SearchBar generalized, RTE img overflow fix; 17 native `<select>` → shadcn `Select` migrations; `/admin/ui-gallery` verification page | FE ✅ |
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
| 17 | Variant option matrix — products support up to 4 option axes (`options: [{name, values}]`), variants stay flat with `optionValues` per combination (one variantId each → cart/orders/inventory/subscriptions untouched). Server derives labels ("5kg · Chicken") + validates the matrix on both save and findByIdAndUpdate paths. Admin form: axes editor + auto-generated combination table (`utils/variantMatrix.js`); product page: per-axis pill selectors. `GET /products/filter-options` gains `optionNames`; admin form category/color/suitable-for quick-picks now merge distinct values from existing products. Rate limiter skipped under NODE_ENV=test (supertest 429s poisoned integration logins). Spec: `docs/superpowers/specs/2026-07-10-variant-option-matrix-design.md`. | BE + FE ✅ |
| 16 | Admin professionals management — `/admin/professionals` API (list/search/filter, create+invite, promote-existing, edit, toggle-active, offboard, photo upload) + `AdminProfessionals` list page + `AdminProfessionalForm` (create/edit/promote, weekly availability, services, photo). Rating read-only. petTaxi included in admin lists. Public browse now hides `professionalInfo.isActive:false`. Dead `createProfessional`/`deleteProfessional`/manual-rating code removed. | BE + FE ✅ |
| 18 | Homepage redesign — mobile nav drawer fixed (100svh clipping + body scroll lock); Hero rebuilt with 4 CTAs (Book Appointment/Mobile Vet/Pet Travel/Shop) + new shared `AppointmentModal` (WhatsApp deep-link, clinic hours) reused by a new bottom `FinalCtaStrip`; Services rebuilt to the 4 live cards (dropped permanent "coming soon" placeholders); new static `PetTravelBand`; new `VetRecommendedSection` (new `vetRecommended` product flag, separate from `isFeatured`) — the original `FeaturedProductSection` (category-tabbed carousel) is kept alongside it; new `VetNetworkSection` (reuses existing public `GET /professionals` + `ProfessionalCard`) and `PetCareTipsSection` (reuses existing public `GET /tips` + `TipCard`, `readTime` was already auto-computed on the model — no BE change needed there). CreatableTagSelect combobox added for product Categories/Suitable For/Colors (filterable, "Create: X" option, backed by `filter-options` distinct-value API). | BE + FE ✅ |
| 19 | Mobile responsiveness pass + Pet Travel page (FE only) — fixed site-wide horizontal scroll caused by the off-canvas nav drawer (`html { overflow-x: clip }`, keeps sticky working); drawer now opens from the right to match the hamburger. Product/tip/professional cards fit ≥2 per row on phones and shrink fluidly; `ProductCardV2` is a full-height flex column (uniform card heights regardless of image size). `ProfessionalList` refactored to role-independent `pro-list-*` classes (every appointment tab now responsive). Vet Recommended is a native scroll-snap carousel on phones. New premium **Pet Relocation landing page** at `/import-export-service` (`src/Pages/PetTravel/`): reusable section components (PtHero/PtProcess/PtDestinations/PtTrustBar/PtFinalCta), content in one `petTravelContent.js`, 8-step responsive timeline, WhatsApp/consultation CTAs via `AppointmentModal`; old `ImportExportServicePage` removed (application form still at `/import-page`). | FE ✅ |
| 20 | Hero remediation — booking requests captured, not just messaged. Two new public models (`AppointmentRequest`, `MobileVetRequest`) sharing a status + intervention-notes lifecycle via `serviceRequestCommon.js`; generated admin CRUD in `serviceRequest.controller.js`; routes under `/api/requests/*` with a 5-per-15-min per-IP cap on the two unauthenticated submits (mobile vet takes an optional Cloudinary pet photo). The existing `Appointment` model was unusable here — it requires `userId`/`petId`/`professionalId`, none of which an anonymous visitor has. FE: `AppointmentModal` became a preset-driven step engine — Book Appointment is 3 steps (trust box, owner details, visit details) with an animated paw progress bar and a reason dropdown; Mobile Vet is an unnumbered intro screen (service cards, coverage, emergency box) then 2 steps (pet + optional photo, then location with one-click GPS, date/time, emergency flag), ending on a success screen with WhatsApp/Call/Directions. Pet travel stays a single-screen WhatsApp handoff. New `/admin/requests` page (kind toggle, status filter + counts, inline status change, detail modal for corrections, running notes). TrustStrip carries the Phase 2 "QR Pet ID Included" badge behind `SHOW_QR_BADGE`. Source doc: `Homepage Hero (2).docx`. | BE + FE ✅ |
| 21 | Section 3 rebuild — homepage services section becomes the VitalPaws ecosystem: headline "Everything Your Pet Needs. One Trusted Platform." (old title demoted to eyebrow), sub-line + intro paragraph, four cards renamed with blurbs (Veterinary Care / Mobile Veterinary Care / International Pet Travel / Pet Store), per-card CTAs replacing the single "View Details" hover overlay — Book Appointment and Book Home Visit open the Epic 20 modals, Learn More and Start Shopping navigate. Card layout is image-over-body with the icon badge on the seam; blurbs flex so CTAs share a baseline. Five-item trust row + tiled inline-SVG paw wash. Travel card reuses the Pet Travel page hero photo. **Deferred by the doc (NOT NOW):** the "Not sure where to start?" band and the whole VitalPaws Assistant concept. Source doc: `Section 3 - The VitalPAws Eco system (3).docx`. Note: a separate `ServicesSection.png` mockup showing Grooming/Boarding/Training/Adoption was NOT followed — the doc supersedes it and keeps the four live services. | FE ✅ |

---

## Remaining

| Epic | What's left | Notes |
|------|-------------|-------|
| 4 | ProfessionalCard visual rebuild on design system (done on branch); appointment list SearchBar | FE |
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
