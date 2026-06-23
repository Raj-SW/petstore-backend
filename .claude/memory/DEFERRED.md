# Deferred Items

Things explicitly parked — not forgotten, not in scope right now.

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

## Subscription `enrichSubscription` Detail View

The analytics service has `predictDemand` and `productCoverage` but `enrichSubscription` (per-subscription enrichment: perCycleTotal, savings, cadenceLabel, nextRunInDays, order history) is partially implemented. The admin subscription detail page and the user "My Subscriptions" view both depend on it — these are tracked as Epic 12 FE remaining work.
