<!-- Mirror copy for root-level discovery. Canonical: docs/superpowers/specs/2026-06-21-subscriptions-admin-analytics-design.md — keep both in sync. -->

# Subscriptions — Admin Views, Product Flag & Inventory Prediction — Design Spec (Epic 12)

**Date:** 2026-06-21
**Repos:** backend (`petstore-backend`) — analytics service, enrichment, endpoints; frontend (`petstore-frontend`) — admin Subscriptions + analytics pages, product-list flag, user My Subscriptions detail.
**Status:** ✅ Approved design, pending implementation plan.
**Depends on:** Epic 6c (`formatMUR`, variant pricing), Epic 2 (`ui/Select`, tokens). Uses the product `effectivePrice`/`priceForVariant` virtuals.
**Backlog:** `docs/BACKLOG-2026-06-21.md` Epic 12.

## Goal

Make subscriptions fully manageable and predictable: enriched admin + user views, flag products with active subscriptions, and a variant-aware **inventory-demand prediction** engine that flags restock-needed items.

## Current state (from code)

- `subscription.model.js`: `user`, `items[{ product, variantId, variantLabel, quantity }]`, `shippingAddress`, `paymentMethod`, `intervalUnit (day|week)`, `intervalCount`, `discountPercent`, `status (active|paused|cancelled)`, `nextRunAt`, `lastRunAt`, `source`, `createdOrders[]`.
- `subscription.controller.js`: `createSubscription`, `getMySubscriptions` (populates name/price/images), `updateSubscription` (owner pause/skip/resume/edit), `cancelSubscription`, `getSubscriptionsAdmin` (populates user + name/price), `updateSubscriptionAdmin`, `processDue` (cron reorder; pre-checks stock; skips when out of stock; `addInterval` cadence).
- Routes: cron `/process-due`; admin `/admin`, `/admin/:id` (PATCH); customer `/`, `/mine`, `/:id` (PATCH/DELETE).

## Decisions (locked in brainstorm)

- **Variant-aware** demand prediction (per product + variant; product-level when no variant).
- **Horizon + shortfall** restock rule (selectable 30/60/90 days; configurable safety margin).
- Analytics in **both** a dedicated admin Subscriptions analytics page **and** a summary folded into the existing product analytics overview; plus a product-list flag.

## Design

### Shared backend pieces

`services/subscription.analytics.service.js`:

- **`enrichSubscription(sub)`** (used by admin + user controllers): returns the subscription plus computed fields:
  - `perCycleTotal` = Σ over items of `unitEffectivePrice × quantity × (1 − discountPercent/100)`, where `unitEffectivePrice` is variant-aware (`product.priceForVariant(variantId)` when a variant, else `product.effectivePrice`).
  - `savings` = pre-discount cycle subtotal − `perCycleTotal`.
  - `cadenceLabel` (e.g. "every 2 weeks" from `intervalUnit`/`intervalCount`), `nextRunInDays` (from `nextRunAt`).
  - `orderHistory` = populated `createdOrders` (id, date, total, status).
- **`runsInHorizon(sub, horizonDays, now)`**: count occurrences of `nextRunAt + k·interval` within `[now, now+horizonDays]` (k ≥ 0) using `intervalUnit`/`intervalCount`.
- **`predictDemand({ horizonDays = 30, safetyMargin = 0 })`**:
  1. Load **active** subscriptions (excludes paused/cancelled; skips already advanced `nextRunAt`).
  2. For each item, `key = product + (variantId || '')`; `projectedDemand[key] += quantity × runsInHorizon(sub, horizonDays)`.
  3. For each key, fetch current stock (variant `quantity` if `variantId`, else product `quantity`).
  4. `shortfall = projectedDemand − stock`; `restockNeeded = projectedDemand ≥ stock × (1 + safetyMargin)`. Optional secondary `daysOfCover = stock / (projectedDemand / horizonDays)`.
  5. Return rows: `{ productId, name, variantId, variantLabel, currentStock, projectedDemand, shortfall, restockNeeded, activeSubCount, earliestNextRunAt }`, plus a summary `{ horizonDays, productsAtRisk, totalActiveSubscriptions }`.
- **`productCoverage()`**: aggregate active subscriptions → `Map(productId → { activeSubCount, unitsPerCycle })` for the product-list flag.

### Endpoints (subscription.routes.js, admin-guarded unless noted)

- `GET /api/subscriptions/admin/analytics?horizon=30` → `predictDemand`.
- `GET /api/subscriptions/admin/product-coverage` → `productCoverage`.
- `GET /api/subscriptions/admin/:id` → single subscription, `enrichSubscription`.
- Enrich existing `GET /admin` (filters: `status`, `dueSoon`, pagination) and `GET /mine` with `enrichSubscription`; add `GET /mine/:id` (owner) enriched.
- Extend **`getProductAnalytics`** (`/api/products/analytics/overview`) with a `subscriptions` block: `{ totalActiveSubscriptions, productsWithSubscriptions, productsNeedingRestock }` (default horizon) — reuses the analytics service.

(Register the `/admin/analytics`, `/admin/product-coverage`, `/admin/:id` GETs before any `/:id` patterns to avoid shadowing.)

### Frontend

- **Admin Subscriptions analytics page** (new, e.g. `/admin/subscriptions/analytics` or a tab): demand-vs-stock table (product/variant, current stock, projected demand, shortfall, restock badge), restock-alerts list, and a **horizon selector** (`ui/Select` 30/60/90). Token-styled.
- **Admin Subscriptions list/detail** (enrich the existing AdminSubscriptions page): status + due-soon filters (`ui/Select`), detail drawer showing items (variant + image), cadence, `perCycleTotal` + `savings` (`formatMUR`), `nextRunInDays`, order history, and admin status edit.
- **Admin product list flag (12b):** consume `product-coverage`; show a "Subscribed (N)" badge/column on products with active subscriptions.
- **User "My Subscriptions" detail (12d):** items (variant + image), next delivery date, cadence, `perCycleTotal` + `savings`, pause/skip/resume/cancel, order history — reuses `ui/*` + `formatMUR`.

## Reuse (DRY)
`enrichSubscription` + the analytics service are shared across admin and user controllers and the product-overview summary. FE reuses `ui/Select`, `formatMUR`, and table patterns. Variant-aware pricing reuses the product virtuals.

## Testing
Run suites individually.
- **`predictDemand`:** `runsInHorizon` counts correctly for day/week intervals and various `nextRunAt`; variant-aware accumulation (same product, two variants tracked separately); `shortfall`/`restockNeeded` flags with/without safety margin; **paused/cancelled excluded**; skipped subs (advanced `nextRunAt`) counted from their new date.
- **`productCoverage`:** aggregates active subs per product (+ variant units).
- **`enrichSubscription`:** `perCycleTotal`/`savings` correct (variant + discount), `cadenceLabel`, `nextRunInDays`, order history.
- **Product analytics overview** includes the subscriptions summary.
- **FE:** analytics page renders rows + restock badges + horizon switch; admin list filters + enriched detail; product list shows the subscribed flag; My Subscriptions detail renders + manage actions work.

## Acceptance criteria
- Variant-aware demand prediction over a selectable horizon (30/60/90) flags restock-needed via projected-demand-vs-stock + a configurable safety margin; paused/cancelled excluded; skips respected.
- A dedicated admin Subscriptions analytics page shows demand vs stock + restock alerts; the product analytics overview includes a subscription summary; the admin product list flags products with active subscriptions (+ count).
- Admin subscription list/detail is enriched (items, cadence, per-cycle total + savings, next-run, order history) with status + due-soon filters.
- Users see their own subscriptions with granular detail (items + variant + image, next delivery, cadence, totals + savings, manage actions, order history).
- A shared `enrichSubscription` + analytics service backs both admin and user views (DRY); amounts via `formatMUR`.
- Build + existing/new tests pass.

## Out of scope
- Changing the `processDue` cron reorder logic (only consumed for order history).
- Automated purchase-order generation from predicted shortfalls (a possible future step).
- Forecasting beyond active subscriptions (no ML / historical-sales modelling).
