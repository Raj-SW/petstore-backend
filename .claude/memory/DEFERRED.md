# Deferred Items

Things explicitly parked — not forgotten, not in scope right now.

---

## BUG — Subscription Reorder Ignores Product `isActive`

**Severity:** Medium
**File:** `src/controllers/subscription.controller.js` — recurring reorder handler
**Found:** 2026-06-23

**Problem:** When a scheduled subscription reorder fires, the controller does not check whether the product is still active before attempting to build the order. `buildOrder` in `order.service.js` does throw `"Product X is not available"` when `!product.isActive`, but the subscription controller likely swallows that error silently — the customer gets no notification, the reorder fails quietly, and the subscription keeps scheduling future attempts.

**Fix (when ready):**
1. In the subscription reorder handler, check `product.isActive` before calling `buildOrder`. If inactive, skip the reorder and send the customer an email notifying them the product is no longer available on their subscription.
2. Optionally flag the subscription line item as `unavailable` so the admin can see it.

**When to fix:** During Epic 12 FE — the admin subscription detail view should surface these failed reorders anyway, making this the natural time to harden the reorder path.

---

## MCB Juice Payment Gateway (blocks Epic 15)

Epic 15 (checkout redesign) is fully designed and the abstraction layer is ready (`PaymentProvider` interface with `card: StripeService`, `juice_mcb: JuiceService`, `cod: no-op`). Everything except the Juice integration can ship.

**Blocked on:** MCB Juice merchant credentials and API documentation from the client.

Until those arrive, Epic 15 ships without Juice — COD and Card (Stripe) will work; the Juice option is hidden or disabled in the UI.

---

## Order Fulfillment — Tracking / Transaction ID Capture

When an order transitions to `shipped` or `delivered`, there is currently no field to capture a courier tracking number or payment transaction reference. This was discussed as a future enhancement.

**Parked because:** No courier integration is in scope; admins currently update order status manually.
**When to revisit:** When a shipping provider integration is added or when admins request it.

---

## Orphaned Cloudinary Asset Sweep

The immediate-upload pattern means that uploading an image and then cancelling the form (without saving) leaves the asset on Cloudinary with no DB reference. Over time this wastes storage.

**Parked because:** Low priority; Cloudinary's free tier has ample headroom.
**When to revisit:** When storage cost becomes meaningful, or before any production launch.
**Approach when ready:** A scheduled script that lists all publicIds in each Cloudinary folder, compares against all `{url, publicId}` refs in MongoDB, and deletes orphans.

---

## Security Findings F1–F5

The five findings in `SECURITY.md` are intentionally deferred pending QA sign-off. Do not fix them unilaterally — they need to be tested and confirmed before a fix ships.

---

## DESIGN GAP — Cart Checkout Subscription Discount (needs decision)

**Found:** 2026-06-24
**Severity:** UX / trust issue — misleading pricing shown at checkout

**Problem:** `SubscriptionChooser` on the cart/checkout page displays the discounted price (e.g. Rs 270) and "You save Rs 30!" but the order placed today is charged at **full price**. The `discountPercent` stored on the subscription record is only applied by the backend on future recurring reorder runs — `createOrder` has no discount logic. A customer who sees "Rs 270" at checkout but gets charged Rs 300 will feel deceived.

**Three options — pick one before this surface ships:**

**Option A — Fix the copy (minimal change):**
Keep the chooser UI. Change the savings text inside the subscribe card to read "Save 10% from your 2nd delivery." Make the discounted price line say "Next deliveries: Rs 270" rather than implying today's price. No backend change needed.

**Option B — Apply discount to first order too (correct the promise):**
When `makeRecurring` is true, pass `discountPercent` to `createOrder`. Backend `order.service.js` `buildOrder` applies the discount to line items before totalling. Customer is actually charged Rs 270 on checkout. Most honest — the UI matches the bill.
- Files: `backend/src/services/order.service.js` (accept + apply `discountPercent`), `backend/src/controllers/order.controller.js` (pass it when `subscription` flag present), `frontend/src/Pages/CartCheckoutPage/CartCheckOutPage.jsx` (pass `makeRecurring`/`discountPercent` to order creation).

**Option C — Remove chooser from cart, keep plain checkbox:**
Cart reverts to a simple "Make this a recurring order (10% off from 2nd delivery)" checkbox + interval row. The `SubscriptionChooser` stays on the product page only, where the flow is correct (subscribing directly bypasses the cart and no first-order price confusion exists).

**When to decide:** Before Epic 15 (checkout redesign) — that epic will rework this page anyway, making it the natural time to finalise the subscription UX at checkout.

---

## PRIORITY — Epic 12 FE Now Urgent (Admin Inventory Prediction)

**Raised:** 2026-06-24
**Why it moved up:** The subscription savings chooser (shipped 2026-06-24) makes subscribing significantly more visible and frictionless on both the product page and cart. More customers will subscribe. The backend (`predictDemand`, `productCoverage`, `runsInHorizon` — Epic 12 BE ✅) can already forecast how much stock subscriptions will consume and when — but the admin has **no UI to see any of it**.

**What the admin is blind to right now:**
- Which products have subscription demand building up
- Whether current stock levels will cover upcoming scheduled reorders
- Which subscriptions are active, paused, or silently failing
- Per-product "N customers subscribed" signal at a glance

**What Epic 12 FE must surface (already in STATUS.md Remaining):**
1. Admin subscription list/detail — active, paused, failed reorders, `enrichSubscription` data (perCycleTotal, nextRunInDays, cadenceLabel)
2. Analytics dashboard — `predictDemand` output per product: units needed in next 30/60/90 days vs current stock, shortfall warnings
3. "Subscribed(N)" badge on admin product list — instant signal of subscription demand
4. Product coverage widget on admin inventory — already partially wired via `getProductCoverage()`, needs visual treatment

**When to build:** Next after resolving the cart checkout discount gap above. The subscription reorder `isActive` bug (top of this file) should be fixed in the same sprint — the admin detail view will surface failed reorders, making it the natural place to harden that path.

---

## Subscription `enrichSubscription` Detail View

The analytics service has `predictDemand` and `productCoverage` but `enrichSubscription` (per-subscription enrichment: perCycleTotal, savings, cadenceLabel, nextRunInDays, order history) is partially implemented. The admin subscription detail page and the user "My Subscriptions" view both depend on it — these are tracked as Epic 12 FE remaining work.
