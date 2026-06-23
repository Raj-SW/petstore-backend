# Project Status

**Active branch:** `feat/backlog-impl-2026-06-22` (both `backend/` and `frontend/` repos)
**Last updated:** 2026-06-24

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
| 14 | Variant-aware inventory — per-variant rows in inventory table; restock/adjust/history all variant-scoped | BE + FE |

---

## Remaining

| Epic | What's left | Notes |
|------|-------------|-------|
| 2 | 17 native `<select>` → shadcn `Select` migrations + `/admin/ui-gallery` verification page | FE; unblocks Epic 4 |
| 4 | ProfessionalCard visual rebuild on design system; appointment list SearchBar | FE; depends Epic 2 |
| 9b FE | Typed announcements admin UI — type picker, event fields, CTA fields, content ref picker | FE |
| 11 FE | `AdminSettings` StoreSettings page (shippingFee, freeShippingThreshold, taxRate toggles); checkout displays shipping/tax | FE; depends Epic 11 BE ✅ |
| 12 FE | Subscriptions analytics dashboard; enriched admin list/detail; user My Subscriptions view; product-list "Subscribed(N)" badge | FE; depends Epic 12 BE ✅ **— NOW HIGH PRIORITY** (see Notes) |
| 13 | Import/Export full-stack rebuild — `ImportExportApplication` model + routes + admin/applicant emails + FE multi-step form + admin page | BE + FE; depends Epics 2 + 10 |
| 15 | Checkout redesign + COD/Card/Juice payment method selection; Juice MCB gateway integration | BE + FE; **blocked — MCB Juice merchant credentials not yet provided** |

---

## Notes

- **Frontend URL** — `.env` `FRONTEND_URL`/`CLIENT_URL` = `https://petstore-frontend-ixll.vercel.app`. Update this in the hosting platform env vars dashboard if deploying.
- **Orphan** — `src/templates/sale-announcement.html` still on disk, not referenced by any controller (superseded by `announcement.html`). Safe to delete anytime.
- **Subscription savings chooser (2026-06-24)** — Product page + cart now use a shared `SubscriptionChooser` component (two radio cards, "Save N%" pill, strikethrough→green savings math, conditional frequency dropdown). Product page merged Add to Cart + Subscribe into one smart button. Savings math + 7-day rule live in `frontend/src/utils/subscriptionPricing.js`.
- **DESIGN GAP — Cart checkout subscription discount (2026-06-24):** The `SubscriptionChooser` on the cart page shows a discounted price (e.g. Rs 270 instead of Rs 300) but the actual order placed today is at **full price**. The 10% discount only applies from the 2nd recurring delivery onward (the subscription's `discountPercent` is applied by the backend on future reorder runs, not on `createOrder`). Three options to resolve — needs a decision before this surface is considered done: (A) fix copy to say "Save from your 2nd delivery"; (B) apply the discount to the first checkout order too (backend `createOrder` change); (C) remove chooser from cart, keep a plain "Make recurring" checkbox with honest wording. See DEFERRED.md for full analysis.
- **Bug fix (2026-06-24)** — Admin products page was silently hiding inactive products. `GET /products` now accepts `isActive=all` to skip the filter; admin fetch passes it. Client-side filter chip works correctly.

## Security

F5 (missing verification template) closed by Epic 10. Four findings remain open. See `SECURITY.md`. Awaiting QA sign-off before fixing.
