<!-- Mirror copy for root-level discovery. Canonical: docs/BACKLOG-2026-06-21-PHASE1-BRAINSTORM.md — keep both in sync. -->

# Backlog Phase-1 Brainstorm — 2026-06-21

Self-driven first pass over all 13 epics from `BACKLOG-2026-06-21.md`. For each: **current state / root-cause hypothesis** (grounded in code where BE), **recommended approach** (+ alternatives where meaningful), **my added ideas**, **open questions for phase 2**, and **draft acceptance criteria**. These ACs are drafts — phase 2 with the user finalizes them. Nothing is implemented.

Repo legend: BE = `petstore-backend` (this repo), FE = `petstore-frontend`.

---

## Epic 1 — Navigation & layout (FE)

### 1a. About Us not in navbar
- **State:** `/about` route exists; just no nav link. Trivial.
- **Approach:** add "About" to the primary nav config + mobile drawer. Decide placement (recommend: between "Home" and "Pet Shop", or under a "Company" group).
- **Open Q (P2):** top-level link vs. nested under a menu? Footer already links it — keep both?
- **Draft AC:** About Us reachable from the navbar on desktop and mobile; active-route highlight works; no layout shift.

### 1b. Mobile header breaks (overflow)
- **State:** too many items (logo + wordmark + nav + currency + cart + auth) overflow on small screens.
- **Recommended approach:** responsive header — below `md`: hide the "VitalPaws" wordmark (keep the paw logo), collapse nav into the hamburger drawer, and **move the currency switcher into the drawer**. Keep only logo + cart + hamburger on the mobile bar.
- **My added ideas:** sticky condensed header on scroll; ensure the cart badge and hamburger have ≥44px tap targets; put currency + auth + nav all in one scrollable drawer with sections.
- **Open Q (P2):** which items stay on the mobile bar (logo, cart, hamburger) vs. drawer-only? Keep currency visible as an icon, or fully in drawer?
- **Draft AC:** at 360–414px width nothing overflows or wraps awkwardly; wordmark hidden < `md`; currency reachable in the drawer; tap targets ≥44px; no horizontal scroll.

### 1c. Breadcrumbs missing on Pet Gallery
- **State:** breadcrumb strip (added app-wide in a prior session) is absent on gallery list/detail.
- **Hypothesis:** the gallery pages were built before/around the breadcrumb redesign and never got the component, or render it conditionally.
- **Approach:** add the shared Breadcrumb component to gallery list (`Home / Gallery`) and detail (`Home / Gallery / <post title>`).
- **Draft AC:** breadcrumbs render on both gallery pages, match the app-wide style, last crumb is the current page (non-link), links navigate correctly.

---

## Epic 2 — Design-system UI overhaul (FE) — UMBRELLA

**Framing (my recommendation):** treat this as a **program**, not one task. Establish the foundation first, then migrate components. Don't "scrap everything at once" — that risks a long broken state. Strangler-pattern: introduce the new primitives, migrate page-by-page behind the existing routes.

### 2a. Design-system foundation
- **Recommended approach:** adopt **Radix UI primitives** (unstyled, accessible) styled with **our existing design tokens** (the project already has a token system per prior sessions). Use React Bits / 21st.dev for richer composed pieces (animated cards, etc.) selectively — wrap them so tokens drive color/spacing. Build a small `ui/` primitive layer (Button, Select/Dropdown, Dialog, Popover, Tabs, Tooltip, Input) as the single source of truth.
- **Alternative:** full component-library swap (e.g., shadcn-style generated components). Heavier, but gives a consistent base. Trade-off: more upfront churn.
- **My added ideas:** a Storybook-or-equivalent gallery page (admin-only route) to eyeball every primitive in light/dark; a token audit to kill hardcoded hex/px before migrating.
- **Open Q (P2):** Radix-as-primitives + tokens (recommended) vs. adopting a generator like shadcn? Light/dark both in scope? Migration order (which page first)?

### 2b. Style all dropdowns with design tokens
- **State:** native `<select>` used throughout (sort, filters, qty, forms, currency).
- **Approach:** build one `<Select>` on Radix Select bound to tokens; replace all native selects. Keep keyboard + screen-reader behavior.
- **Draft AC:** zero native `<select>` in the app; the custom Select matches tokens, supports keyboard nav, disabled/placeholder/grouped options; mobile-friendly.

### 2c. Reuse the custom search component
- **State:** prior sessions noted a gimmicky purple/pink particle SearchBar hardwired to `/petshop` nav; reuse was deferred.
- **Approach:** generalize it into a reusable `<SearchBar onSearch>` (configurable placeholder + submit handler + optional nav target), tone down the styling to match tokens, then drop it into Service, Appointments, and Pet Care Tips (Epics 3, 4, 8).
- **Draft AC:** one SearchBar component used on ≥4 pages; each page passes its own placeholder + handler; styling on-brand (no gimmick); accessible (label, clear button).

### 2d. Rich-text-editor images don't break layout
- **State:** RTE-inserted images overflow containers on tip/gallery detail and possibly the editor.
- **Approach:** in `RichTextRenderer` (DOMPurify render path) enforce `img { max-width:100%; height:auto; border-radius }`; in the editor, constrain preview; optionally store/serve responsive Cloudinary URLs.
- **Draft AC:** images in RTE body never exceed container width on mobile/desktop; aspect ratio preserved; no horizontal scroll.

---

## Epic 3 — Service page (FE)

- **State:** service cards may link to dead/placeholder routes; no "coming soon" affordance.
- **Approach:** drive cards from a config array `{ title, slug, status: 'live'|'coming-soon', href }`. Live → real link; coming-soon → disabled card with a "Coming Soon" badge (no navigation, cursor default, aria-disabled). Add the reusable SearchBar (2c).
- **My added ideas:** optional "Notify me" capture on coming-soon cards (reuse newsletter subscriber model) — flag for P2, may be YAGNI.
- **Open Q (P2):** which services are live vs coming-soon today? Exact target routes per card?
- **Draft AC:** every live card routes to the correct existing page; coming-soon cards show the badge and don't navigate; search works on the page.

---

## Epic 4 — Professionals & Appointments (FE)

- **State:** appointments rebuilt as a directory (prior session); professional card styling pre-dates the directory polish.
- **Approach:** (a) new **professional card** — avatar, name, role/specialty chip, experience, short bio, rating-less (reviews were descoped), primary "View profile" action; responsive grid; on-brand with tokens. (b) Appointments page uses the reusable SearchBar (2c) instead of the local search.
- **My added ideas:** skeleton loading states; category color-coding (Vet/Groomer/Trainer/PetTaxi); hover elevation; empty-state when a filter yields nothing.
- **Open Q (P2):** card fields/priority? Show availability summary on the card or only on detail? Grid density (3-up vs 4-up)?
- **Draft AC:** redesigned card renders responsively (1/2/3-4 cols by breakpoint); maps to `/appointments/professional/:id`; appointments page search uses the shared component; loading + empty states present.

---

## Epic 5 — Pet Shop (FE, maybe BE)

### 5a. Side-panel filtering broken
- **State (BE is fine):** `GET /api/products` supports `categories`, `minPrice`, `maxPrice`, `colors`, `genders`, `search`, `isFeatured`, pagination, `sort`. So filtering should work server-side.
- **Hypothesis:** FE bug — the side panel isn't passing params correctly (e.g., array params not serialized as repeated keys, or state not wired to the query, or filtering done client-side on a single page of results). Needs FE debugging.
- **Approach:** wire the side panel to the existing query params; serialize arrays correctly (`?categories=a&categories=b`); reset to page 1 on filter change; reflect filters in the URL for shareability.
- **Draft AC:** selecting any filter (category/price/color/gender) updates results from the API; multiple filters combine (AND across types, OR within a type); clearing resets; pagination respects filters; URL reflects state.

### 5b. Remove filter strip after hero
- **Approach:** delete the horizontal filter strip below the hero; rely on the side panel (5a) + toolbar sort. Confirm nothing else depends on it.
- **Draft AC:** strip gone; spacing/layout clean; side-panel + sort still cover all filtering.

---

## Epic 6 — Product images, variants & pricing (BE + FE)

### 6a. Sort which product image displays first — ✅ ALREADY SPECED
- See `docs/superpowers/specs/2026-06-21-product-bulk-actions-and-image-ordering-design.md` (Feature 2: `imageOrder` manifest + set-primary). No re-brainstorm needed.

### 6b. Variant-specific images — NEW
- **State:** `variants[]` subdoc currently `{ label, price, quantity }`; product images are product-level only.
- **Recommended approach:** add an optional `images: [{ url, publicId }]` to the variant subschema. Product detail: when a variant is selected, swap the gallery to that variant's images (fall back to product images if the variant has none). Admin form: per-variant image uploader.
- **Alternative:** a flat `images[]` with an optional `variantLabel` tag per image (one pool, filtered by variant). Simpler schema, messier UX. Recommend the nested approach.
- **My added ideas:** reuse the same `imageOrder`/set-primary pattern (6a) per variant so variant galleries are also orderable; cap images per variant (e.g., 6); cleanup variant images on variant removal.
- **Open Q (P2):** required or optional per variant? Fallback to product images when empty (recommended yes)? Max images per variant? Reuse imageOrder per variant?
- **Draft AC:** admin uploads/reorders images on each variant; product detail shows variant images on selection (falls back to product images); removing a variant deletes its Cloudinary images; create/update validators accept variant images.

### 6c. Products default to MUR — NEW
- **State:** `Product.price` (and `variants[].price`) is a bare `Number` with **no currency field**; the app renders MUR (`Rs`) purely via frontend formatting, while the invoice PDF hardcodes `$`. Currency is implicit and inconsistent.
- **Recommended approach:** make **MUR the explicit default**. Minimal: label the admin price/variant-price inputs with `Rs` (MUR) and document that all stored prices are MUR. Fuller (if multi-currency is ever wanted): add `currency` (default `'MUR'`) to the product model and carry it through cart/order/invoice/email formatting. Recommend the explicit-default approach now, with a single shared `formatMUR` used everywhere (already exists in announcement/subscription controllers) and the invoice currency fixed under Epic 11.
- **My added ideas:** one shared currency util (`formatMUR`) imported by controllers + PDF so there's a single source of truth; a guard/test asserting no `$` leaks into invoices/emails.
- **Open Q (P2):** is the store ever multi-currency, or MUR-only? (If MUR-only, skip the `currency` field and just standardize formatting + input labels.)
- **Draft AC:** admin product create/edit shows prices in MUR (Rs) by default on every price input (incl. variants); all customer-facing prices, invoices, and emails render MUR consistently (no `$`); if a `currency` field is added, it defaults to MUR and flows through orders/invoices.

---

## Epic 7 — Feedback / testimonials (BE + FE)

### 7a. 🐛 Photos don't match their feedback (homepage "What Our Clients Say")
- **State (BE is correct):** `submitFeedback` uploads files in order and stores `photos` (URLs) on that feedback doc; `getFeedback` returns approved feedback each with its own `photos`. Data integrity is sound — each doc owns its photos.
- **Leading hypothesis (FE):** the homepage testimonial component mis-maps photos to cards — e.g., using array index as React key while items reorder, a shared/global image carousel pool, or rendering `photos[0]` from the wrong item in a slider. **This is a frontend render bug, not a data bug.**
- **Approach:** debug the FE testimonial render (systematic-debugging skill); ensure each card renders only its own `feedback.photos`, keyed by `feedback._id`, photos keyed by URL/index within that card.
- **Open Q (P2):** confirm with a reproduction — which feedback shows which wrong photo? Is it a slider/carousel? (Get a screenshot + the offending component.)
- **Draft AC:** each testimonial displays only the photos submitted with it; reordering/approval changes don't cross-wire photos; verified against a known submission.

### 7b. Admin reorders feedback images
- **State:** `updateFeedback` already does `findByIdAndUpdate(id, req.body)` — so a reordered `photos` array would persist today. The gap is the admin UI + validation.
- **Approach:** admin feedback editor with drag-reorder of `photos`; PATCH sends the reordered array. (Same UX pattern as product image reorder.)
- **Draft AC:** admin can reorder a feedback's photos; order persists and is reflected on the homepage; first photo is the "primary".

---

## Epic 8 — Pet Care Tips (BE + FE)

- **State:** tips already have text `sections[]` (heading + body) from a prior session; no cover image, no per-section images, RTE body images break layout (Epic 2d).
- **Recommended approach (BE schema):** add `coverImage: { url, publicId }` to the tip model; add `image: { url, publicId }` to each `sections[]` entry. Upload endpoints reuse `uploadBannerToCloudinary` (wide, no square crop) for cover, `uploadToCloudinary` for section images. RTE-body images use the existing tip image-upload endpoint; rendering fixed by 2d.
- **Approach (FE):** AdminTipForm gains a cover uploader + per-section image uploader; detail page renders cover at top, section image with each section; reuse SearchBar (2c) on the tips list.
- **My added ideas:** cover image used as the card thumbnail + OG/social meta; alt-text fields for accessibility/SEO; same `coverImage`/sections pattern likely wanted for gallery posts later (keep the schema shape consistent).
- **Open Q (P2):** is cover required? One image per section or many? Cover aspect ratio? Mirror to gallery posts now or later?
- **Draft AC:** admin sets a cover image + a per-section image + can embed images in RTE body; tip detail renders all three without layout breakage; tips list has working search; cover shows as the card thumbnail.

---

## Epic 9 — Announcements (BE + FE) — generalize beyond sales

### 9a. 🐛 Email redirect link wrong URL — ROOT CAUSE FOUND
- **Finding:** `API_PUBLIC_URL` is **not set** in any env file → the unsubscribe link defaults to `http://localhost:5000/api/announcements/unsubscribe` in production. Separately, the codebase is **inconsistent about the frontend base URL**: CORS reads `CLIENT_URL`/`VERCEL_FRONTEND_URL`, but every email (`announcement`, `auth`, `subscription`, `paypal`) reads `FRONTEND_URL`. If prod sets one but not the other, email CTAs (`shopUrl`, reset, verify, payUrl) point to localhost or 404.
- **Approach:** (1) standardize on one frontend-base env var (recommend `FRONTEND_URL`) and one public-API base (`API_PUBLIC_URL`); document both as required in deploy config; add a startup warning if unset in production. (2) Ensure the unsubscribe URL base includes `/api` exactly once (route is mounted at `/api/announcements`). (3) Audit all email link builders for the same base.
- **Draft AC:** in production, the unsubscribe link and all email CTAs resolve to the real deployed hosts; a missing-env startup check warns; verified by sending a test announcement and clicking through.

### 9b. Generalize SaleAnnouncement → typed Announcements
- **State:** `SaleAnnouncement` is hard-wired to `products[]` + `source: inline|composer`; email template is `sale-announcement`.
- **Recommended approach:** introduce an announcement **`type`** with a discriminated target:
  - `sale` → products (existing behavior)
  - `new_product` → products (highlight new arrivals)
  - `new_tip` / `new_post` → a `petCareTip` / `galleryPost` reference
  - `event` → structured event fields (title, date/time, location, description, optional link)
  - `restock` / `back_in_stock` → products (subscribe-to-restock candidates)
  - `general` → free-form rich message + optional CTA link
  - **My additional candidates:** `price_drop`, `service_launch`, `holiday_hours`/closure, `newsletter`/digest, `loyalty_promo`.
  - Per-type email template (or one flexible template with type-driven blocks). Rename model to `Announcement` (keep `SaleAnnouncement` alias/migration). Audience targeting could later vary by type (e.g., restock → only users who opted into that product).
- **Alternative:** keep one model with a loose `payload` object. Faster but weaker validation. Recommend typed targets with per-type validators.
- **Open Q (P2):** which types ship first? One template with blocks vs. per-type templates? Should audience differ by type (e.g., per-topic email preferences beyond `sales`)? Schedule/queue sends vs. send-now?
- **Draft AC:** admin composer picks a type; each type validates its own target; the right template renders; history shows type; existing sale flow unchanged; `emailPreferences` respected (and possibly extended per-type).

---

## Epic 10 — Email templates (BE)

- **State:** many Handlebars templates (welcome, login-notification, password-reset, order-confirmation, order-status-update, payment-status-update, order-cancelled, contact-reply, sale-announcement, subscription-reorder). Known issues: `resendVerification` reuses `password-reset` (security F5); currency inconsistency (invoice PDF uses `$`, emails use `Rs`); the URL/env issue (9a).
- **Recommended approach:** a shared layout partial (header with logo, footer with address + unsubscribe/support, consistent typography + token-driven colors) that all templates extend; a dedicated verification template; consistent currency (MUR `Rs`) and date formatting; a preview/test harness (admin route or script that renders each template with sample data).
- **My added ideas:** dark-mode-safe email styles (inline CSS, table layout); a single source for brand colors shared with the app tokens; plaintext fallbacks.
- **Open Q (P2):** adopt MJML or hand-rolled responsive HTML? One brand layout for all? Include a render/preview tool?
- **Draft AC:** all emails share one branded layout; consistent currency/date; verification email uses its own template; a preview tool renders every template; links resolve (depends on 9a).

---

## Epic 11 — Invoices (BE) — granular detail

- **State:** invoice line items = `{ name, quantity, unitPrice, total }`; invoice = subtotal/discount/total + shipping address + paymentMethod + transactionId + paidAt + status. PDF **hardcodes `$`** (app is MUR `Rs`) — a real inconsistency. No variant label, no sale/original price, no per-line or coded discount, no shipping fee, no tax, no billing-vs-shipping split, no order date, no subscription origin.
- **Recommended approach (expand model + service + PDF):** line item → `{ name, variantLabel, quantity, unitPrice, originalUnitPrice, lineDiscount, total }`; invoice adds `currency` (default MUR), `discountCode`, `shippingFee`, `tax`, `grandTotal`, `billingAddress` (default = shipping), `customer { name, email, phone }`, `orderDate`, `source` (manual/subscription), and keep `invoiceNumber`. PDF: render variant labels, original-vs-sale prices, discount line(s), shipping, tax, grand total; switch currency formatting to MUR (reuse `formatMUR`).
- **My added ideas:** show "You saved Rs X" when sale/discount applied; QR or link to the order; consistent invoice numbering already exists (`INV-YYYY-NNNN`) — keep; store a snapshot so later product edits don't change historical invoices (invoices already snapshot names/prices — extend the snapshot to variants/sale).
- **Open Q (P2):** is there tax/VAT in scope (MUR/Mauritius VAT)? Shipping fee modeled anywhere yet (orders don't currently carry one)? Billing address ever differs from shipping? Fix currency to MUR everywhere (recommended)?
- **Draft AC:** invoice (data + PDF) shows per-line variant + original/sale price + line discount, plus subtotal, discount(+code), shipping, tax, grand total in MUR, billing + shipping, payment method, txn id, dates, source; historical invoices remain stable after product edits.

---

## Epic 12 — Subscriptions (BE + FE) — largest BE epic

- **State:** endpoints exist — `GET /admin` (all, populates user + item product name/price), `GET /mine` (own, populates name/price/images), owner PATCH/DELETE, admin PATCH, cron `process-due`. Items store product + variantId + variantLabel + quantity. So **basic list views exist**; the real gaps are flagging, analytics, and richer FE detail.
- **Sub-items & approach:**
  - **12a. Admin view (enrich):** add a detail endpoint / enrich list with computed fields — next-run countdown, per-cycle total (after `discountPercent`), cycle cadence label, order history (`createdOrders`), status. FE: admin Subscriptions page with filters (status, due-soon) + detail drawer.
  - **12b. Flag subscribed products in admin:** **NEW.** Aggregate active-subscription items → map `productId → { activeSubs, unitsPerCycle }`. Surface as a badge/column in the admin product list. Approach: a `GET /api/subscriptions/admin/product-coverage` aggregation, or fold counts into the admin product list response.
  - **12c. Analytics + inventory prediction:** **NEW, the big piece.** For a horizon (e.g., next 30/60/90 days), for each product/variant compute projected subscription demand = Σ over active subs of `quantity × runsInHorizon(interval)`; compare to current stock → `daysOfCover`, `restockBy`, `shortfall`. Surface as an admin analytics view + low-cover alerts. Reuse the `addInterval` cadence logic.
  - **12d. User view (enrich):** FE "My Subscriptions" detail — items (with variant + image), next delivery date, cadence, per-cycle total + savings, pause/skip/resume/cancel, edit address/items, order history.
- **My added ideas:** "due soon" admin filter; CSV export of upcoming demand; email/admin alert when predicted shortfall crosses a threshold; show on the product detail "X customers subscribe to this"; predicted demand could later feed reorder POs.
- **Open Q (P2):** prediction horizon + low-cover threshold defaults? Per-variant or per-product granularity (recommend per-variant since stock is per-variant)? Should prediction account for skips/pauses? Where do analytics live (existing product analytics overview vs. a new subscriptions analytics page)?
- **Draft AC:** admin sees each subscription's full detail + items; admin product list flags products with active subscriptions (+ count); an analytics view projects per-product/variant subscription demand vs stock over a horizon and flags restock-needed; users see their own subscriptions with granular detail and can manage them.

---

## Epic 13 — Import / Export (FE) — big rebuild

- **State:** `ImportPage.jsx` is a ~920-line 3-step wizard; a separate import-export-service page form exists. User wants them merged and rebuilt ("delete and redo everything").
- **Recommended approach:** brainstorm as its own project (it's large). First map the two flows' actual requirements (what data, steps, validation, file formats) before deleting. Rebuild as a single page with a clean step model + the new design-system primitives (Epic 2), decomposed into small components (step nav, each step form, review, submit). Don't delete until the new flow reaches parity.
- **My added ideas:** keep a feature flag / parallel route during rebuild to avoid a long broken state; capture the current wizard's validation rules so nothing regresses.
- **Open Q (P2):** what exactly does each of the two pages do today, and what's the merged target UX? Is this a customer-facing service request form, or data import/export tooling? (Name is ambiguous.) What file formats / fields?
- **Draft AC:** single consolidated import/export flow replaces both; feature parity with the old wizard's validation; built on new design system; old pages removed only after parity is verified.

---

## Cross-cutting observations (my additions)

- **Image reorder / set-primary is a recurring pattern** across products (6a), variants (6b), feedback (7b), and tips/gallery (8). Build it **once** as a reusable drag-reorder gallery component (FE) + a consistent ordered-array convention (BE) and reuse everywhere. Recommend doing the product version (already speced) first, then generalizing.
- **Env-var/URL hygiene (9a)** affects every transactional email, not just announcements — fix centrally (one frontend-base var, one public-API var, startup validation) and it resolves latent bugs in reset/verify/order/subscription emails too.
- **Currency consistency:** the app is MUR (`Rs`) but the invoice PDF is `$`, and product prices carry no currency at all. Standardize on **MUR by default** — explicit on admin product inputs (Epic 6c), one shared `formatMUR` util across controllers + PDF, fixed invoice currency (Epic 11). Decide MUR-only vs. multi-currency in phase 2.
- **Search-component reuse (2c)** unblocks Epics 3, 4, and 8 — sequence it early in the design-system work.
- **Reorder dependency:** Epics 3/4/8 search items and 2d RTE-image fix all depend on the Epic-2 foundation; doing Epic 2 foundation first reduces rework.

---

## Epic 14 — Variant-aware inventory management (BE + FE)
- **State:** product stock for variant products lives on `variants[].quantity` (sum rolls up to product `quantity` via the derive hook); `buildOrder`/cancel already reserve/restore **variant** stock with positional `$inc`. But the **admin inventory layer** (`inventory.controller.js`, `AdminInventory.jsx`, `stockMovement.model`) predates variants and operates on product-level `quantity`.
- **Recommended approach:** make the inventory tooling variant-aware — admin stock list shows per-variant rows (with product roll-up), manual adjustments target a specific variant, low-stock alerts evaluate per variant, and `StockMovement` records a `variantId`/`variantLabel`. Reuse the variant pricing/labeling already on the product model.
- **My added ideas:** a per-variant low-stock threshold; surface the Epic-12 demand-prediction shortfall alongside current variant stock in the same admin view (one inventory-health screen).
- **Open Q (P2):** per-variant low-stock threshold (global default vs per-product)? Should the inventory view merge in subscription demand (Epic 12)? Does `StockMovement` need backfilling for historical product-level moves?
- **Draft AC:** admin can view/adjust stock per variant (product as roll-up); low-stock alerts fire per variant; `StockMovement` logs the variant; existing product-level (no-variant) flow unchanged.

## Epic 15 — Checkout redesign + payment methods (FE + BE)
- **State:** `CartCheckOutPage.jsx` is the current checkout; `order.paymentMethod` enum = `credit_card|paypal|stripe`. Epic 11 computes shipping + tax from `StoreSettings` but nothing yet displays/collects them on a unified page.
- **Recommended approach:** rebuild checkout as **one full responsive page** (design system, Epic 2): address + order summary + shipping/tax (from Epic 11 `StoreSettings`) + payment selection. Expand `paymentMethod` to **`cod` (Cash on Delivery), `card`, `juice_mcb`**. COD = place order, mark payment pending, pay on delivery (no online capture). Card = existing/stripe card flow. **Juice by MCB** = new Mauritian MCB gateway — likely a redirect/callback flow; the integration specifics (API, sandbox, webhook) are the main unknown to resolve in its own brainstorm.
- **My added ideas:** COD may warrant an order cap or address verification; show the shipping/free-shipping-threshold nudge ("add Rs X for free shipping"); persist the chosen method on the order; a success/confirmation step.
- **Open Q (P2):** is Juice by MCB a real gateway integration now or a manual/instructions flow first? Which card processor (Stripe is wired) backs "Card"? Single-page vs lightly-stepped within one page? COD eligibility rules?
- **Draft AC:** checkout is one responsive page showing items, address, shipping + tax (Epic 11), and a payment choice of COD / Card / Juice by MCB; the order persists the method and the Epic-11 amounts; each method completes its flow (COD → pending; Card → capture; Juice → gateway); build + tests pass.

## Reusable components register (DRY — build once, reuse everywhere)

Standing rule (user, 2026-06-21): wherever a component/pattern repeats across epics, design it **once as a shared, reusable unit** and consume it — don't re-implement per page. Each spec must call out which of these it builds or reuses.

| Shared unit | Build in | Reused by | Notes |
|---|---|---|---|
| **ImageManager** (drag-reorder + set-primary + delete + add upload, Cloudinary cleanup) FE component + the **`imageOrder` manifest** BE upload helper | Epic 6 (products) | Epic 6b (variants), Epic 7b (feedback), Epic 8 (tip cover/section images), gallery | One `<ImageManager>` + one backend `applyImageOrder()` util used by every multi-image resource. |
| **SearchBar** (reusable, `onSearch`/target prop, token-styled) | Epic 2 (2c) | Epic 3 (Service), Epic 4 (Appointments), Epic 8 (Tips), Petshop | De-gimmicked; the single search input app-wide. |
| **Select / Dialog / Popover / Tooltip** primitives | Epic 2 | All admin + customer pages (17 selects, modals, menus) | The `src/Components/ui/` set bound to tokens. |
| **Breadcrumb** | already shared | Epic 1 (gallery), all pages | Ensure every page (incl. gallery) uses it. |
| **SectionsEditor** (heading + rich body + optional image, drag-order) | reuse existing `atf-sections` editor | Epic 8 (tips), gallery posts, product `sections[]` | One editor for all "sections[]" authoring. |
| **RichTextEditor / RichTextRenderer** (incl. the image-overflow fix 2d) | already shared | Tips, gallery, Announcements `general` body (9b) | Single renderer; fix images once. |
| **Email layout partial** (branded header/footer) | Epic 10 | every template incl. `announcement.html` (9b), 9a | All emails extend one layout. |
| **`urls.js` resolver** (frontend/API base + builders + startup check) | Epic 9a | 9b, auth, subscription, paypal emails | Single source for all email/link URLs. |
| **`formatMUR` currency util** | Epic 11 / 6c | controllers + invoice PDF + emails | One currency formatter; kills the `$`/MUR split. |
| **Card** base primitive | Epic 2 (`ui/card`) | product card, professional card (Epic 4), testimonial (Epic 7) | Compose page-specific cards from one base. |

When writing each epic's plan, prefer extracting/reusing the row above over a local copy. If a needed shared unit doesn't exist yet, the first epic to need it builds it as reusable from the start.

## Suggested phase-2 agenda (per epic: finalize approach + lock acceptance criteria)
Recommended order for phase 2: **9a (URL bug, with 10), 1, 5, 7a** (high-value bugs) → **2 foundation + 2c/2d** → **6b, 8, 11, 12, 9b** (features) → **4, 3** (UI) → **13** (own project). Quick wins build momentum; design-system foundation unblocks the rest.
