# Recurring Orders (Subscriptions) — Design Spec

**Date:** 2026-06-14
**Status:** Approved (design) — pending spec review
**Sub-project:** #4A of the 2026-06-14 feature batch (the other half of "Recurring Orders + Benefits/Loyalty"; #4B Sale Announcements already implemented).

## Summary

Let customers set products (or a whole cart) to auto-reorder on a custom interval. A daily Vercel Cron job generates a **pending order** for each due subscription, applies a subscription discount, reserves stock, and emails the customer a "pay now" link — reusing the existing checkout/payment flow. Auto-charging a saved card is explicitly deferred (phase 2); the order-generation step is built as a seam so it can be added later without reworking the scheduler.

## Goals

- Customers can subscribe to **a single product** ("Subscribe & Save" on the product page) and to **a whole cart** ("make this order recurring" at checkout).
- Custom interval cadence (every N days/weeks), with a minimum interval guard.
- Each due cycle auto-creates a **pending order** (stock reserved), applies an admin-set **subscription discount %**, and emails a pay-now link.
- Customers manage subscriptions: pause/resume, skip next, change interval/next date/quantity, cancel.
- Admin can list/view/pause/cancel all subscriptions and adjust a subscription's discount.
- Runs reliably on Vercel serverless with no always-on process.

## Non-Goals (phase 2 / out of scope)

- **Off-session auto-charge** (Stripe Customers + SetupIntents + off-session PaymentIntents; PayPal billing agreements). The current payment service only does on-session PaymentIntents.
- Proration, trials, gift subscriptions, subscription-only bundles.
- A global admin-settings subsystem (the discount default lives in an env var, snapshotted per subscription).

## Architecture

A new **`Subscription`** resource (model + validator + controller + routes). A daily **Vercel Cron** (configured in `backend/vercel.json`) calls a secured internal endpoint that processes all due subscriptions:

1. Find `status: 'active'` subscriptions with `nextRunAt <= now`.
2. For each, build a **pending order** via a shared order-builder, apply the subscription discount, reserve stock, link the order to the subscription, email the customer.
3. Advance `nextRunAt` by the interval; set `lastRunAt`.

The charge step is a seam: today it produces a `paymentStatus: 'pending'` order the customer pays manually (reusing the existing payment page). A future auto-charge strategy can replace just that step.

### Shared order-builder

The cart→order logic in `order.controller.js#createOrder` (validate products active + in stock, compute `effectivePrice`, build order items, decrement stock via `$inc`, write `StockMovement` rows, transactional `session`) is extracted into `src/services/order.service.js` exposing `buildOrder({ userId, items, shippingAddress, paymentMethod, discount, discountCode, source, session })`. Both `createOrder` and the subscription runner call it, guaranteeing identical order/stock behavior (DRY). `createOrder` is refactored to delegate to it (its existing tests must still pass).

### Data model — `Subscription` (`src/models/subscription.model.js`)

| Field | Type | Notes |
|---|---|---|
| `user` | ObjectId → User, required | Owner |
| `items` | `[{ product: ObjectId→Product, quantity: Number≥1 }]`, required, ≥1 | Subscribed items |
| `shippingAddress` | object (street/city/state/country/zipCode) | Snapshot, same shape as Order |
| `paymentMethod` | String enum `credit_card`\|`paypal`\|`stripe`, required | Matches Order enum |
| `intervalUnit` | String enum `day`\|`week`, required | |
| `intervalCount` | Number, required, min 1 | Combined min enforced: ≥7 days (see validation) |
| `discountPercent` | Number 0–100, default from env | Snapshot at creation; admin-editable |
| `status` | String enum `active`\|`paused`\|`cancelled`, default `active` | |
| `nextRunAt` | Date, required | Next generation time |
| `lastRunAt` | Date | Set after each run |
| `source` | String enum `product`\|`checkout`, required | How it was created |
| `createdOrders` | `[ObjectId → Order]`, default [] | Generated-order history |
| timestamps | | |

Indexes: `{ user: 1 }`, `{ status: 1, nextRunAt: 1 }` (the runner's query).

### Backend endpoints — `/api/subscriptions`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/subscriptions` | customer | Create a subscription (product or checkout source) |
| `GET` | `/api/subscriptions/mine` | customer | The caller's subscriptions |
| `PATCH` | `/api/subscriptions/:id` | customer (owner) | Pause/resume, skip next, change interval/nextRunAt/quantity/items |
| `DELETE` | `/api/subscriptions/:id` | customer (owner) | Cancel (soft → `status: 'cancelled'`) |
| `GET` | `/api/subscriptions/admin/all` | admin | All subscriptions |
| `PATCH` | `/api/subscriptions/admin/:id` | admin | Pause/cancel/adjust discountPercent |
| `GET`/`POST` | `/api/subscriptions/process-due` | **cron secret** | Process all due subscriptions |

- **Ownership:** customer PATCH/DELETE verify `subscription.user === req.user.id` (404 otherwise).
- **`process-due` auth:** a `verifyCronSecret` middleware checks `Authorization: Bearer ${process.env.CRON_SECRET}` (Vercel Cron's native mechanism — Vercel injects this header when `CRON_SECRET` is set in project env); rejects 401 otherwise. Not user-authenticated. Both GET (Vercel cron) and POST (manual/local) are registered to the same handler. Returns `{ processed, failed, skipped }`.
- **Skip next:** PATCH with `{ action: 'skip' }` advances `nextRunAt` by one interval without generating an order.
- **Create:** `nextRunAt` defaults to now + one interval (first order is the manual checkout the customer just did, or — for `product` source — the first cycle is the interval out; confirmed below in Open Questions as "first recurring order fires one interval after creation").

### Scheduler — Vercel Cron

`backend/vercel.json` gains:

```json
{ "crons": [ { "path": "/api/subscriptions/process-due", "schedule": "0 6 * * *" } ] }
```

Vercel Cron issues a **GET** to that path and (when `CRON_SECRET` is set in the project env) includes an `Authorization: Bearer ${CRON_SECRET}` header. The `verifyCronSecret` middleware validates that header. The same handler is registered for GET (Vercel) and POST (manual/local testing with the header). No user authentication is involved.

### Runner logic (`process-due`)

For each due active subscription (in its own try/catch — one failure never aborts the batch):
1. Resolve items; if a product is missing/inactive/out of stock → **skip this cycle**, email the customer "we couldn't reorder X", still advance `nextRunAt`, increment `skipped`. (Stock is reserved at generation per the approved decision, so insufficient stock means skip, not partial.)
2. Else `buildOrder(...)` with `discount = round(subtotal * discountPercent/100)`, `source: 'subscription'`, inside a transaction → pending order, stock decremented, `StockMovement` written.
3. Push the order id to `createdOrders`, set `lastRunAt = now`, advance `nextRunAt += interval`.
4. Email the pay-now link (`subscription-reorder.html`).

### Order model touch

Add an optional `source: String enum ['manual','subscription'] default 'manual'` to the Order model so subscription-generated orders are identifiable in admin/history. (Additive, no migration needed.)

### Email — `src/templates/subscription-reorder.html`

Handlebars: greeting, the items with quantities and MUR prices, the subscription discount line, total, a **Pay now** CTA → `${FRONTEND_URL}/payment/{orderId}`, and a **Manage subscription** link → `${FRONTEND_URL}/my-subscriptions`.

## Frontend

- **`subscriptionsApi.js`** — `create`, `getMine`, `update(id, data)`, `cancel(id)`, plus admin `getAllAdmin`, `updateAdmin`.
- **Subscribe & Save widget** on the product page: interval picker (count + unit), "Save X%" badge from the configured rate, "Subscribe" button → creates a `product` subscription with that single item.
- **Checkout toggle**: "Make this a recurring order" with an interval picker; on successful checkout also creates a `checkout` subscription from the ordered items.
- **My Subscriptions page** (`/my-subscriptions`, ProtectedRoute): list each subscription (items, interval, next date, status), with pause/resume, skip next, edit interval/next date/quantity, cancel. Nav/profile entry point.
- **Admin Subscriptions page** (`/admin/subscriptions`): DataTable (customer, items count, interval, next run, status, # orders generated), view modal with generated-order history, pause/cancel, edit discount %. Sidebar item + route.

## Data flow

1. Customer subscribes (product page or checkout) → `POST /api/subscriptions` → `nextRunAt` set one interval out.
2. Daily cron → `process-due` → for each due sub: build pending order (stock reserved, discount applied) → email pay-now link → advance `nextRunAt`.
3. Customer pays via the existing payment page → existing flow marks the order paid and auto-generates invoice/transaction (unchanged).
4. Customer/admin manage subscriptions via the respective pages.

## Error handling

- Per-subscription failures in the runner are caught, counted (`failed`), logged `warn`, never abort the batch.
- Missing/inactive/out-of-stock product → skip cycle, notify customer, advance `nextRunAt` (counted `skipped`).
- Min interval (≥7 days) enforced in the validator (400 on violation).
- Ownership enforced on customer PATCH/DELETE (404 on mismatch).
- `process-due` without the correct `Authorization: Bearer ${CRON_SECRET}` → 401.
- Email failures are non-fatal (logged), consistent with the rest of the codebase.

## Testing

**Backend (Jest/supertest, `sendEmail` mocked):**
- Create subscription (customer): valid create sets `nextRunAt`; min-interval violation → 400; unauthenticated → 401.
- Ownership: another user's PATCH/DELETE → 404; owner can pause/resume/skip/cancel.
- Runner: a due active subscription generates one pending order with the discount applied, decrements stock, advances `nextRunAt`, links the order; paused/cancelled subs are ignored; not-yet-due subs are ignored.
- Runner skip: out-of-stock product → no order, `nextRunAt` still advanced, `skipped` counted.
- `process-due` guard: wrong/missing `Authorization: Bearer` secret → 401; correct secret → 200 with summary.
- Regression: existing `order.controller.test.js` still passes after the `buildOrder` extraction.

**Frontend (Vitest):**
- Subscribe & Save widget submits a create with the chosen interval + product.
- My Subscriptions list renders and a cancel/pause action calls the api.

## Implementation notes / reuse

- Mirror the existing resource shape (model + validator + controller + routes) used by tips/feedback/announcements.
- Extract `order.service.js#buildOrder` from `createOrder`; refactor `createOrder` to use it (keep its tests green).
- Reuse `sendEmail` + Handlebars; reuse admin `DataTable` + `AnimatePresence` modal patterns and `AdminLayout` sidebar; reuse `useCurrency().formatPrice` for the widget.
- Discount default: `SUBSCRIPTION_DISCOUNT_PERCENT` env (default 10), snapshotted to `Subscription.discountPercent` at creation.
- Cron secret: `CRON_SECRET` env.

## Open questions (resolved defaults; none blocking)

- **First recurring order timing:** fires one interval after creation (the customer's initial purchase, if any, is the manual checkout). Confirmed sensible default.
- **Admin global discount editing:** done per-subscription (no settings subsystem); the env var sets the default for new subscriptions.
- **Cron cadence:** daily at 06:00 UTC; subscriptions due any time that day are processed on that run.
