# Sale Announcements — Design Spec

**Date:** 2026-06-14
**Status:** Approved (design) — pending spec review
**Sub-project:** #4B of the 2026-06-14 feature batch (originally framed as "Benefits/Loyalty"; re-scoped during brainstorming to a sale-announcement / customer-notification feature).

## Summary

Let admins notify registered customers by **email** when products go on sale. Two triggers feed one send routine: a quick **inline** "notify customers" checkbox on the product form (single product), and a dedicated **composer** page for multi-item campaigns. Every send is recorded as a `SaleAnnouncement`. Customers receive emails by default and can opt out via a profile toggle or a one-click unsubscribe link in every email.

This is **not** a points/tiers loyalty program. The discount/on-sale capability itself already exists (sub-project #3). This feature adds the *broadcast* on top of it.

## Goals

- Admin can broadcast a sale announcement email featuring one or more on-sale products.
- Two entry points: inline checkbox (one product) and a composer (many products + custom subject/message).
- A persisted history of announcements (what was sent, to how many, when).
- Customers control whether they receive sale emails (default on, with opt-out + unsubscribe).
- Reuse existing infrastructure: Resend SMTP `sendEmail`, Handlebars templates, MUR currency formatting, admin DataTable + modal patterns.

## Non-Goals (explicitly out of scope)

- Scheduled / recurring sends (belongs to sub-project #4A, which carries the serverless-scheduler decision).
- In-app notifications, SMS, or push.
- Open/click tracking or per-product email analytics.
- Audience segmentation beyond "all opted-in customers".
- Resend Broadcasts/Audiences API integration (kept in-app for control + history).

## Architecture

A new **`SaleAnnouncement`** resource (model + validator + controller + routes), one new Handlebars email template, an opt-out flag on the User model, and a public tokenized unsubscribe endpoint. Both triggers funnel into a single `sendAnnouncement` routine so behavior and the recorded history are identical regardless of entry point.

### Data model

**User (modify)** — add an email-preferences sub-document:

```js
emailPreferences: {
  sales: { type: Boolean, default: true },
}
```

- Drives the recipient audience and the opt-out.
- Default `true` (all customers in by default, per the agreed audience decision).
- Backfill: existing users without the field are treated as `true` (default applies on read; a one-time migration is unnecessary because Mongoose returns the schema default for missing paths).

**SaleAnnouncement (new)** — `src/models/saleAnnouncement.model.js`:

| Field | Type | Notes |
|---|---|---|
| `subject` | String, required, 2–150 | Email subject line |
| `message` | String, optional, ≤1000 | Admin note shown above the product grid |
| `products` | [ObjectId → Product], required, ≥1 | Featured products |
| `audienceCount` | Number, default 0 | Opted-in recipients at send time |
| `sentCount` | Number, default 0 | Successful sends |
| `failedCount` | Number, default 0 | Failed sends (non-fatal) |
| `source` | String enum `inline` \| `composer`, required | Which trigger created it |
| `createdBy` | ObjectId → User, required | Admin who sent it |
| `sentAt` | Date | Set when send completes |
| timestamps | | `createdAt` / `updatedAt` |

### Backend endpoints

All under `/api/announcements`. Mounted in `app.js`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/announcements` | admin | Create + send an announcement |
| `GET` | `/api/announcements` | admin | Campaign history (sorted `-createdAt`) |
| `GET` | `/api/announcements/unsubscribe?token=…` | **public** | Flip `emailPreferences.sales=false` for the token's user |

**`POST /api/announcements`** — body `{ subject, message?, productIds: [] }`:
1. Validate (Joi): subject required 2–150, message optional ≤1000, productIds non-empty array of valid ObjectIds.
2. Load the featured products; 400 if none resolve.
3. Load audience: `User.find({ role: 'customer', 'emailPreferences.sales': true })` selecting `name email`.
4. For each recipient: render `sale-announcement.html` with products + a signed unsubscribe link, `sendEmail` sequentially inside try/catch; tally `sentCount` / `failedCount`. One failure never aborts the batch.
5. Safety cap: a configurable max recipients per send (`ANNOUNCEMENT_MAX_RECIPIENTS`, default e.g. 500) to stay within the Vercel request budget; if the audience exceeds the cap, send to the cap and report the remainder in the response message. (Queuing/batching across requests is out of scope — see Non-Goals.)
6. Persist the `SaleAnnouncement` with counts, `source`, `sentAt`, `createdBy`.
7. Respond `201` with `{ success, message, data: announcement }`.

**`GET /api/announcements/unsubscribe`** — public:
- Verify a signed JWT (`JWT_SECRET`, dedicated purpose claim, long expiry) carrying the user id.
- Set `emailPreferences.sales=false`; idempotent if already off.
- Return a minimal HTML confirmation page (no login required). Invalid/expired token → friendly error page, not a stack trace.

**Inline trigger** — the existing product update path:
- AdminProductForm sends an optional `notifyOnSale` boolean alongside the product update.
- When a product is saved **on sale** with `notifyOnSale=true`, the product controller calls the shared send routine with that single product and a default subject (e.g. `"{ProductName} is now on sale at VitalPaws"`), `source:'inline'`.
- Implementation note: extract the send logic into a small service (`announcement.service.js`) so both the announcement controller and the product controller call it without duplication.

### Email template — `src/templates/sale-announcement.html`

- Branded header (matches existing templates).
- Optional admin `message` block.
- Responsive grid/list of featured products: image, name, **was** price (struck through) and **now** sale price, both formatted in MUR consistent with the site.
- "Shop the sale" CTA button → frontend `/petshop`.
- Footer with an **unsubscribe** link (`{{unsubscribeUrl}}`) — required in every send.

### Frontend

- **`announcementsApi.js`** — `createAnnouncement({subject,message,productIds})`, `getAnnouncements()`.
- **Composer** `/admin/announcements` (`Pages/Admin/Announcements/AdminAnnouncements.jsx`):
  - Multi-select of products, defaulting the picker to currently on-sale items (`onSale:true`).
  - Subject input, optional message textarea.
  - Live preview of the email (products + prices).
  - Send button with a confirm modal (shows audience size).
  - Table of past announcements: subject, # products, audience/sent/failed counts, source, date.
  - Sidebar item (admin layout) + route in `main.jsx`.
- **Inline**: "Notify customers of this sale" checkbox in the AdminProductForm sale/discount section (only meaningful when the product is on sale).
- **Profile**: a "Sale & promo emails" toggle in the user profile that flips `emailPreferences.sales` via the existing user-update path.

## Data flow

1. Admin sets products on sale (#3) → opens composer (or ticks inline checkbox).
2. Composer/inline → `POST /api/announcements` → audience loaded → per-recipient email rendered with a personal unsubscribe link → sent via Resend SMTP → counts tallied → `SaleAnnouncement` saved.
3. Customer receives email → clicks product CTA (→ `/petshop`) or unsubscribe (→ public endpoint flips their flag).
4. Admin reviews history in the composer's table.

## Error handling

- Per-recipient send failures are caught, counted in `failedCount`, logged `warn`, never abort the batch (same pattern as existing non-fatal email logging).
- No featured products resolve → `400`.
- Unsubscribe with invalid/expired token → friendly error page.
- Validation failures → `400` via the existing `AppError` + Joi pattern.
- Admin-only mutations guarded by `isAuthenticated` + `isAdmin`; unsubscribe is intentionally public.

## Testing

**Backend (Jest/supertest):**
- `POST /api/announcements` sends to opted-in customers only, skips opted-out, records `audienceCount`/`sentCount`, returns 201. (`sendEmail` mocked.)
- Validation: missing subject → 400; empty productIds → 400; non-admin → 403; unauthenticated → 401.
- Unsubscribe: valid token flips `emailPreferences.sales` to false and is idempotent; invalid token handled gracefully.
- History: `GET /api/announcements` returns records newest-first (admin only).
- Inline path: saving an on-sale product with `notifyOnSale` creates an `inline` announcement and sends (service-level or controller test).

**Frontend (Vitest):**
- Composer renders, requires a subject + ≥1 product, calls `announcementsApi.createAnnouncement` on submit (api + toast mocked).
- Profile toggle calls the user-update path with the new preference.

## Implementation notes / reuse

- Mirror the existing resource shape (model + validator + controller + routes) used by tips / feedback / gallery.
- Reuse `sendEmail` (Resend SMTP) and the Handlebars template loader (`renderTemplate`).
- Reuse the admin `DataTable` + `AnimatePresence` modal patterns and `AdminLayout` sidebar wiring.
- Reuse MUR currency formatting in both the composer preview and the email (server-side formatting helper or precomputed strings passed to the template).
- xss-clean: announcement create is admin-only JSON; if the message field ever carries HTML it must follow the same bypass/sanitize approach used for tip/gallery bodies — but `message` here is plain text, so standard sanitization is sufficient (no bypass needed).

## Open questions (none blocking)

- Exact `ANNOUNCEMENT_MAX_RECIPIENTS` default — start at 500, revisit if the customer base grows.
- Whether to also expose the unsubscribe preference in a future account-settings page beyond the simple profile toggle (deferred).
