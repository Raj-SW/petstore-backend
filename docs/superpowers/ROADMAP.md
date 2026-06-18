# VitalPaws — Feature Roadmap (2026-06-14 batch)

A large batch of features was requested and **decomposed into independent sub-projects**, each built through its own design → plan → implementation cycle. This file tracks status so anyone can continue.

> Specs live in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/`. Backend + frontend are **separate repos** (`Raj-SW/petstore-backend`, `Raj-SW/petstore-frontend`); each has a `HANDOFF.md`.

## Status

| # | Sub-project | Status | Spec / Plan |
|---|-------------|--------|-------------|
| — | Featured Products carousel | ✅ on `main` | `*-featured-products-carousel-*` |
| — | Gallery (mini-blog) | ✅ on `main` | `*-gallery-*` |
| 1 | Contact Page + Map + Socials | ✅ branch `feature/contact-promo-admin-2026-06-14` (pushed) | `*-contact-page-*` |
| 1b | Promo banner → admin-managed (`hero`/`promo` adverts) | ✅ same branch | `*-promo-banner-admin-*` |
| 2 | Homepage Engagement: Question/Feedback tabs + Feedback testimonials | ✅ DONE on branch `feature/feedback-engagement-2026-06-14` (backend + frontend; not yet merged to main) | `*-feedback-engagement-*` |
| 3 | Discounts / On-Sale | ✅ DONE on branch `feature/feedback-engagement-2026-06-14` (not yet merged) | `*-discounts-on-sale-*` |
| 4 | Recurring Orders (subscriptions) | ✅ DONE on branch `feature/feedback-engagement-2026-06-14` (backend + frontend; not yet merged). Loyalty/benefits descoped. | `*-recurring-orders-*` |
| 4B | Sale Announcements (email broadcast; re-scope of "Loyalty") | ✅ DONE same branch (backend + frontend; not merged) | `*-sale-announcements-*` |

## Remaining work — details

### 2. Homepage Engagement ✅ DONE (branch, not merged)
Feedback resource (public submit, name/role/rating/message + up to 3 photos, **admin approval**), tabbed homepage section (Ask a Question | Leave Feedback, Featured-style tabs), and approved feedback driving the `StatsSection` "What Our Clients Say" carousel. Backend (model/validator/controller/routes/tests) + frontend (feedbackApi, EngagementSection tabs, FeedbackForm w/ stars+photos, StatsSection DB-driven w/ fallback, AdminFeedback moderation at `/admin/feedback`) all done, tested, build clean, live-verified. On branch `feature/feedback-engagement-2026-06-14` — **not yet merged to main**.

### 3. Discounts / On-Sale ✅ DONE (branch, not merged)
Product sale pricing (`onSale`/`discountType`/`discountValue`/`saleStartsAt`/`saleEndsAt` + virtuals `salePrice`/`isOnSaleNow`/`effectivePrice`/`discountPercentLabel`); checkout & cart charge `effectivePrice`; `ProductPrice`+`SaleBadge` on cards/detail/featured; admin sale section. 14/14 sale tests. Commit `e385709`.

### 4. Recurring Orders (subscriptions) ✅ DONE (branch, not merged)
Subscriptions / auto-reorder. **Backend** (commit `a334548`): subscription model + validator (7-day min interval) + controller (customer create/list/pause/skip/cancel, admin list/edit, transactional `process-due` cron runner that builds a discounted pending order, reserves stock via shared `order.service.buildOrder`, advances `nextRunAt`, emails a pay-now link; out-of-stock subs are skipped). `cronAuth.verifyCronSecret` Bearer guard; `subscription-reorder.html`; `/api/subscriptions` mounted; Vercel daily cron (06:00) in `vercel.json`. Tests 9/9. **Frontend** (commit `0d82f1d`): subscriptionsApi, My Subscriptions page + nav, Subscribe & Save product widget, checkout recurring toggle, Admin Subscriptions page + sidebar. MySubscriptions smoke test 2/2, build clean.

**Benefits/Loyalty (points/tiers) — descoped** (2026-06-18, user decision). The "Loyalty" ask was re-scoped to Sale Announcements (#4B, done); a points/tiers program is not planned for now.

## Already satisfied / not needed
- **Auto-identifiable currency** — `CurrencyContext` already auto-detects via browser locale (`detectCurrency()` → region→currency, default MUR). Only optional upgrade: IP geolocation.

## Smaller leftover items
- Open/merge the two pushed PRs (`feature/contact-promo-admin-2026-06-14`) — merging to `main` triggers production deploys.
- Data fix: one seeded advert's link is `/petstore` → should be `/petshop` (Admin → Adverts).
- Backend full-suite `npm test` is flaky under combined load (`User.findById` null) — suites pass individually; pre-existing.
- Older: browser walkthrough of Tips/Gallery; repo topology decision; remove duplicate `src/`/`tests/` at the parent root (pending confirmation).

## Conventions to reuse
- **Adverts** power promo/hero cards (placements: banner/sponsored/hero/promo).
- **Cloudinary**: `uploadToCloudinary` (square, products), `uploadBannerToCloudinary` (wide, banners), `uploadMultipleToCloudinary` (galleries/feedback).
- **Admin** pages: shared `DataTable` + `AnimatePresence` `admin-modal*` delete pattern; sidebar in `AdminLayout.jsx`.
- **RichText** `"blog"` preset has inline image upload.
