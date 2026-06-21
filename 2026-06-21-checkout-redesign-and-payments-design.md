<!-- Mirror copy for root-level discovery. Canonical: docs/superpowers/specs/2026-06-21-checkout-redesign-and-payments-design.md — keep both in sync. -->

# Checkout Redesign + Payment Methods — Design Spec (Epic 15)

**Date:** 2026-06-21
**Repos:** backend (`petstore-backend`) — order enum, createOrder, payment provider abstraction, new Juice service; frontend (`petstore-frontend`) — `CartCheckOutPage` rebuild + payment-result page.
**Status:** ✅ Approved design, pending implementation plan.
**Depends on:** Epic 11 (shipping/tax + `StoreSettings`, `order.grandTotal`), Epic 2 (`ui/*`, tokens), Epic 6c (`formatMUR`).
**⚠️ External prerequisite:** MCB **Juice** merchant credentials + API documentation (merchant id, API key, base URL, webhook secret, and the init/redirect/callback/refund contract). The real gateway integration is **blocked until these are provided**; build everything else behind the provider abstraction so Juice drops in when creds arrive.
**Backlog:** `docs/BACKLOG-2026-06-21.md` Epic 15.

## Problem

- The checkout (`CartCheckOutPage.jsx`) is a multi-step wizard that **hardcodes `paymentMethod: "stripe"`** and shows "via Stripe" — there is **no payment-method choice**. After placing, it routes to `/payment/:orderId` for the Stripe flow.
- Backend payments support **stripe + paypal** only; `order.paymentMethod` enum = `credit_card|paypal|stripe`.
- Requirement: **one full responsive checkout page** with **Cash on Delivery, Card, and Juice by MCB**; surface Epic 11 shipping/tax.

## Current state (from code)

- `payment.controller.js`: `initializePayment`/`confirmPayment`/`processRefund`/`handleWebhook` branch on `stripe`/`paypal`. Routes: `/payments/orders/:orderId/initialize|confirm|refund`, `/payments/webhook/stripe|paypal`.
- `order.model.js`: `paymentMethod` enum `['credit_card','paypal','stripe']`; `paymentStatus` `pending|completed|failed|refunded`.
- `@stripe/react-stripe-js` is installed (inline card entry is available).

## Decisions (locked in brainstorm)

- **Single responsive page** + sticky order summary (no step wizard).
- **Real MCB Juice gateway** (behind a provider abstraction; gated on creds).
- **Drop PayPal.** Methods = COD, Card (Stripe-backed), Juice by MCB.

## Design

### Backend

- **Enum:** `order.paymentMethod` → `['cod','card','juice_mcb']`. Existing `stripe`/`paypal` docs remain readable (Mongoose enum validates on save only); new orders use the new set. (Optional display mapping: legacy `stripe`→"Card".)
- **`createOrder`** (order.controller) accepts the chosen method; payable amount = **`order.grandTotal`** (Epic 11):
  - **`cod`** → place order, `paymentStatus: 'pending'`, status `processing`; **no gateway**; send order-confirmation email. Admin marks paid on delivery (existing `updatePaymentStatus`).
  - **`card`** → create order pending, then Stripe initialize/confirm.
  - **`juice_mcb`** → create order pending, then Juice initialize → returns a redirect URL.
- **Provider abstraction:** replace the `stripe`/`paypal` `if` branches with a provider map `{ card: StripeService, juice_mcb: JuiceService }`. `initializePayment`, `confirmPayment`, `handleWebhook`, `processRefund` dispatch by method. `cod` has a no-op initialize (nothing to capture) and manual/admin refund. Remove PayPal branches (keep a legacy read path for old paypal orders' refunds only if needed).
- **`juice.service.js`** (new, MCB Juice): `createPayment(order)` → `{ redirectUrl, reference }`; `verifyPayment(referenceOrCallback)` → status; `verifyWebhook(rawBody, signature)`; `refund(order)`. Reads env `MCB_JUICE_MERCHANT_ID`, `MCB_JUICE_API_KEY`, `MCB_JUICE_API_URL`, `MCB_JUICE_WEBHOOK_SECRET`. Implemented against MCB's documented contract (init/redirect/callback/webhook/refund). Add route `POST /payments/webhook/juice` (raw body + signature verify).
- On successful payment (card confirm or juice webhook/callback), set `paymentStatus: 'completed'`, persist `paymentDetails`, and the existing invoice/transaction generation runs (as today for completed payments).

### Frontend — rebuild `CartCheckOutPage` as one responsive page

- **Layout:** single page, **two columns on desktop / stacked on mobile**, on the design system (`ui/*`, tokens, **no react-bootstrap**, no hardcoded Stripe):
  - **Left:** cart review (items + qty), shipping address form, and **payment-method selection** (COD / Card / Juice as selectable cards/radios with `ui/*`).
  - **Right:** a **sticky order summary** — items, subtotal, discount (+ code), **shipping + tax + grand total from Epic 11**, all via `formatMUR`; a free-shipping nudge ("add Rs X for free shipping") when under the threshold.
- **Per method on "Place order":**
  - **COD** → `createOrder({ paymentMethod: 'cod' })` → success/confirmation screen.
  - **Card** → `createOrder({ paymentMethod: 'card' })` → initialize → **Stripe Elements inline** on the page → confirm → success. (Replaces the separate PaymentPage hop for a true single-page checkout; the old `/payment/:id` page can be retired or kept as a fallback.)
  - **Juice** → `createOrder({ paymentMethod: 'juice_mcb' })` → initialize → **redirect to the MCB checkout** (`redirectUrl`) → return to a **payment-result/callback page** that confirms status.
- `ordersApi.createOrder` sends the real chosen method (remove the Stripe hardcode). A `paymentApi` wraps initialize/confirm.
- A **payment-result page** handles the Juice return + card confirmation outcomes (success / failed / pending).

## Reuse
`ui/*` (Epic 2), `formatMUR` + `StoreSettings`/shipping-tax (Epics 6c/11), the payment-provider abstraction (Stripe + Juice + COD). 

## Testing
Run suites individually.
- **Order enum** accepts `cod|card|juice_mcb`.
- **`createOrder`:** COD → pending, no init; card → Stripe init; juice → init returns `redirectUrl`; amount = `grandTotal`.
- **Provider abstraction** dispatches to the right service; `handleWebhook` verifies the Juice signature and completes the order; refund routes per method.
- **`juice.service`** `createPayment`/`verifyPayment`/`verifyWebhook` (MCB API mocked).
- **FE:** single page renders all sections + sticky summary; method selection; COD places order; card inline confirm; juice redirect + return; summary shows Epic-11 shipping/tax/grand total.

## Acceptance criteria
- Checkout is **one full responsive page** (cart review + shipping + Epic-11 shipping/tax summary + payment-method selection + sticky order summary), on the design system, **no react-bootstrap, no hardcoded Stripe**.
- Three working methods: **COD** (order placed pending, pay on delivery), **Card** (Stripe-backed, inline), **Juice by MCB** (real gateway: initialize → redirect → webhook/callback → confirm). **PayPal removed.**
- `order.paymentMethod` enum = `cod|card|juice_mcb`; `createOrder` + the payment provider abstraction handle each; the Juice webhook is signature-verified.
- Payment amount equals `order.grandTotal` (Epic 11 shipping/tax included); on completion, invoice/transaction generation runs.
- Build + existing/new tests pass.

## Prerequisites / dependencies
- **MCB Juice merchant credentials + API docs** (tracked prerequisite — the real Juice integration is blocked on these; everything else ships behind the abstraction, with Juice selectable once configured).
- Epic 11 (shipping/tax) and Epic 2 (design system) implemented first.

## Out of scope
- Saved cards / tokenized repeat payments.
- Multi-currency at checkout (MUR-only per 6c).
- Replacing the subscription reorder payment flow (separate).
