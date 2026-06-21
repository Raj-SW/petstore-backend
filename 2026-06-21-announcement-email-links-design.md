<!-- Mirror copy for root-level discovery. Canonical: docs/superpowers/specs/2026-06-21-announcement-email-links-design.md — keep both in sync. -->

# Announcement Email Links + Email URL Hardening — Design Spec (Epic 9a)

**Date:** 2026-06-21
**Repo:** backend (`petstore-backend`). Template + controller live here; consumes the frontend's existing routes (`/product/:id`, `/petshop`) — no frontend code change required.
**Status:** Approved design, pending implementation plan.
**Backlog:** `docs/BACKLOG-2026-06-21.md` Epic 9a; brainstorm in `docs/BACKLOG-2026-06-21-PHASE1-BRAINSTORM.md`.

## Problem

Product-sale announcement emails send recipients to a wrong/unhelpful URL:

1. **No per-product link.** `sale-announcement.html` renders a card per product (image, name, price) with **no link**; the only CTA is a single "Shop the sale" button to a generic `/petshop`. A recipient who clicks expecting the on-sale product lands on the generic shop.
2. **Unsubscribe link broken in prod.** The unsubscribe URL uses `process.env.API_PUBLIC_URL`, which is **not set in any env file**, so it falls back to `http://localhost:5000/api/announcements/unsubscribe` — dead in production.
3. **Inconsistent frontend base URL.** Emails read `process.env.FRONTEND_URL`; CORS reads `CLIENT_URL`/`VERCEL_FRONTEND_URL`. If prod sets one but not the other, links break across **all** transactional emails (`auth` reset/verify/welcome, `subscription` reorder, `paypal` return/cancel), not just announcements.

## Verified facts (from code)

- Frontend routes (from `frontend/src/main.jsx`): product detail `product/:id` (uses product `_id`), shop `petshop`. `ProductCardV2` navigates to `/product/<id>`.
- `announcement.controller.js`: `buildProductRows()` returns `{ name, image, priceLabel, salePriceLabel, discountLabel }` — no `link`. `unsubscribeUrl = ${API_PUBLIC_URL}/announcements/unsubscribe?token=...`; `shopUrl = ${FRONTEND_URL}/petshop`.
- `sale-announcement.html`: product cards have no `href`; `<a href="{{shopUrl}}">Shop the sale</a>` and `<a href="{{unsubscribeUrl}}">Unsubscribe…</a>`.
- `.env` sets `FRONTEND_URL` and `CLIENT_URL`; **no** `API_PUBLIC_URL` anywhere. Emails everywhere use `FRONTEND_URL` directly.

## Design

### 1. URL config module — single source of truth

Create `src/config/urls.js`:

- `FRONTEND_BASE` = first set of `FRONTEND_URL → CLIENT_URL → VERCEL_FRONTEND_URL → 'http://localhost:5173'`, trailing slashes stripped.
- `API_BASE` = `API_PUBLIC_URL → 'http://localhost:5000/api'`, trailing slashes stripped.
- Builders (all slash-safe):
  - `frontendUrl(path)` → `${FRONTEND_BASE}/${path}`
  - `productUrl(id)` → `frontendUrl('product/<id>')`
  - `shopUrl()` → `frontendUrl('petshop')`
  - `apiUrl(path)` → `${API_BASE}/${path}`
- `validateUrlConfig()` — when `NODE_ENV === 'production'`, `logger.warn` if no frontend-base var is set, and if `API_PUBLIC_URL` is unset. Does not throw (degraded links are better than a crashed boot). Called once at startup.

Rationale: one resolver makes the base URL robust to which env var prod actually sets, and makes the failure mode loud (startup warning) instead of silent (localhost in an email).

### 2. Announcement controller

- Remove the local `FRONTEND_URL` / `API_PUBLIC_URL` constants; import the builders.
- `buildProductRows(products)` adds `link: productUrl(p._id)` to each row.
- `unsubscribeUrl = ${apiUrl('announcements/unsubscribe')}?token=<token>`.
- `shopUrl` data = `shopUrl()`.

### 3. Template (`sale-announcement.html`)

- Inside the `{{#each products}}` card, add an accessible per-product link:
  `<a href="{{this.link}}" class="product-link">View product →</a>`.
  A distinct link (not a block-wrapped card) is used because email clients handle block-level `<a>` wrapping inconsistently. Style with the existing inline CSS conventions in the file.
- Keep the "Shop the sale" button (`{{shopUrl}}`) and the unsubscribe link (`{{unsubscribeUrl}}`).

### 4. Email URL hardening (latent-bug fix)

Refactor the other email link builders to use `frontendUrl(...)` instead of raw `process.env.FRONTEND_URL`, so they inherit the fallback chain + slash-safety:

- `auth.controller.js`: welcome `shopUrl`, login `resetUrl`, forgot `resetUrl`, verify `verificationUrl`.
- `subscription.controller.js`: `payUrl` (`profile/orders`).
- `paypal.service.js`: `returnUrl` (`payment/success`), `cancelUrl` (`payment/cancel`).

Wire `validateUrlConfig()` into startup (`src/server.js`, after env load / before listen).

**Out of scope (deferred to Epic 10 — email template unification):** restyling templates, the verification-uses-password-reset-template issue (security F5), currency consistency. This epic only touches URL construction.

## Testing

Run suites individually (`npx cross-env NODE_ENV=test jest --runInBand --forceExit <file>`).

- **`tests/urls.config.test.js` (new):** builder output and slash-safety (`frontendUrl('/x/')`, trailing slash on base); `productUrl(id)` → `<base>/product/<id>`; `shopUrl()` → `<base>/petshop`; fallback precedence (`FRONTEND_URL` wins over `CLIENT_URL`; `CLIENT_URL` used when `FRONTEND_URL` unset). Set/restore `process.env` within the test; require the module fresh (`jest.resetModules`) since it reads env at load.
- **Announcement controller test (extend existing announcement suite):** assert the object passed to `sendEmail` contains, for each product, a `link` of `<FRONTEND_BASE>/product/<id>`, plus `shopUrl` ending `/petshop` and `unsubscribeUrl` containing the API base + `/announcements/unsubscribe?token=`. (`sendEmail` is already mocked in tests.)
- **Auth email test (light):** assert reset/verify URLs are built from the resolved frontend base (no `localhost` when `FRONTEND_URL` is set in the test env).

## Acceptance criteria

- Each product card in a sale-announcement email links to `<frontend>/product/<id>`; the Shop CTA links to `<frontend>/petshop`.
- The unsubscribe link resolves to the real deployed API base (no `localhost`) and still unsubscribes the user.
- All transactional email links are built via the shared resolver; with only `CLIENT_URL` set (no `FRONTEND_URL`), email links still resolve correctly.
- In production with email-critical URL env vars unset, a startup warning is logged.
- Existing announcement send flow and its tests still pass; per-recipient failures remain non-fatal.

## Deploy note (not code)

Ensure `FRONTEND_URL` (or `CLIENT_URL`) and `API_PUBLIC_URL` are set in the backend's production environment (Render). `API_PUBLIC_URL` must include the `/api` prefix and the real host, e.g. `https://<backend-host>/api`.
