# Housekeeping & Performance Report — 2026-07-15

Scope: full-app review requested as the "last push" — page-value audit, breadcrumb
assessment, and performance analysis. Everything fixable this session was fixed on
`fix/audit-2026-07-14` (both repos); items needing product decisions are listed at
the end. All numbers below were **measured** (live browser, production build), not
estimated.

---

## 1. Fixed this pass (frontend commits 48a8f4e, 37c9681, 31861dd)

| Item | Root cause | Fix |
|---|---|---|
| Pages opened mid-scroll after navigation | React Router keeps prior scroll offset; no global reset | `ScrollToTop` in App.jsx (hash links still honoured). Verified live: 1779px → 0 after nav |
| Vet Recommended carousel arrows dead | Fetched `limit: 4` while desktop shows 4/view — Embla had nothing to scroll, arrows permanently disabled | Fetch 8; arrows hidden entirely when everything fits. Verified live (track translates on click) |
| Checkout "3 steps" | Already rebuilt earlier this branch as a true single page (shipping + notes + items + totals + VAT + subscription + card + one Place Order). Verified live — no wizard remains anywhere | — |
| Homepage section order | — | Hero → Services → Promo → **Vet Recommended → Pet Travel band → Vet Network → Pet Care Tips → Stats → Featured Products** → FAQ → CTA → Engagement |
| Pet Travel hero small / text-heavy | Split grid, image squeezed right | Full-cover image hero (Services-page structure); the 4 feature tiles moved to a strip below the image |
| Hero inconsistency across pages | 7 pages, 5 different header styles, none matching the Services standard | New shared **`PageHero`** component (cover photo + forest overlay + gold deco paw + display title + script subtitle + CTAs; `compact` variant). Applied to Pet Care Tips, Gallery, About, Contact, Pet Shop. Services + Pet Travel already conform |
| pettravel.png 1.99 MB (LCP image on 2 pages) | PNG for photographic content | Re-encoded JPEG q80 → **184 KB (−91%)** |
| Footer © 2024 | hardcoded | dynamic year |

Suite green after all of it: **102 files / 879 tests**.

## 2. Breadcrumb assessment

Breadcrumbs already exist on every deep route: product detail, gallery detail,
tip detail, professional detail, plus PetShop / Appointments / Import / Gallery /
Pet Travel / My Orders / Profile index pages. **No gaps.** They use one shared
component (`HelperComponents/Breadcrumb`) and consistently sit above the page hero.

Verdict on usefulness: keep them on detail pages (real navigation value: e.g.
`Home › Pet Shop` from a product deep-link). On top-level pages (Pet Shop, Pet
Travel, Gallery) they are one-level crumbs (`Home › X`) — harmless and they add
orientation, so I left them. Marketing pages (About/Contact/Services/Home) rightly
have none. No change needed.

## 3. Page value audit

**Keep as-is (earning their place):**
- **Home** — now ordered as a coherent funnel (services → shop → travel → trust → content → proof).
- **Pet Shop / Product detail / Checkout / Payment / My Orders / My Subscriptions / Profile** — the commerce core.
- **Pet Travel** — the clearest differentiator in the whole app; strong page.
- **Pet Care Tips (+detail)** — SEO + retention engine. *Content* is the gap: live DB has placeholder tips ("a tip"). The page is only as valuable as its articles.
- **Gallery (+detail)** — community trust/social proof, cheap to maintain.
- **Contact** — form + map + WhatsApp + socials; distinct from About now that its hero copy no longer talks about "mission and values".

**Improve (page is right, content undermines it):**
- **Stats claims are implausible** — "4.2M+ Pets Rehomed, 6.8M+ Pets Adopted, 500+ Professionals" (ServicePage `STATS`, homepage StatsSection). Mauritius has ~1.3M people; these numbers read as fake and actively damage trust on an otherwise premium site. Replace with honest, small numbers ("100+ relocations", "11 professionals", "since 20XX") — small-but-true beats big-but-false. *Needs your real figures.*
- **Services page** — 4 of 7 cards are "Coming Soon". A first-time visitor sees more promises than product. Suggest: 3 live services full-size, coming-soon collapsed into a slim "On the roadmap" strip.
- **About** — care rows + first-aid section are good; it partially duplicates Services. Fine to keep, but it's the weakest of the marketing pages; a real team/clinic photo section would give it a reason to exist.
- **Homepage EngagementSection** — question + feedback forms duplicate the Contact page at the bottom of an already-long homepage. Consider trimming to a single CTA row that links to Contact.

**Decide (genuine duplication):**
- **`/import-page` (ImportPage)** — a bare Bootstrap form with zero responsive CSS that duplicates the Pet Travel funnel (24 KB chunk, worst page in the app). Recommend **removing it** and pointing everything at Pet Travel's consultation/WhatsApp flow — or, if you want a structured application form, rebuild it *inside* the Pet Travel page. Not done without your call.
- **Two booking systems** — orphaned in-app `AppointmentForm`/`TimeSlotGrid` components vs the WhatsApp modal actually used. Dead code confuses future work; recommend deleting the orphaned in-app flow until real in-app booking is a roadmap item.
- **Legal pages don't exist** — footer "Terms of Service" and "Privacy Policy" link to `/`. For a site taking card payments this is a real gap (Stripe ToS expects a privacy policy). Needs content from you; I can scaffold pages once you have text.

## 4. Performance

### Measured (production build + live browser)

| Metric | Value | Verdict |
|---|---|---|
| Initial JS (index + react-vendor + ui-vendor + HomePage) | ~217 KB gzip | **Healthy** — route-level code splitting is already in place and working (every page and every admin screen is its own chunk; Tiptap's 398 KB editor loads only in admin) |
| Largest route chunks | HomePage 12.9 KB gzip, PetShop 8.1 KB gzip | Fine |
| CSS | `index.css` 280 KB raw (largest single asset) | **Bootstrap** — imported globally (and again in HomePage.jsx) while the app is almost entirely custom-styled |
| Images in bundle | 2.76 MB total; top: petshop-hero img1 336 KB, service cards ~200 KB each | OK-ish; biggest single offender (pettravel 2 MB) fixed this pass |
| API (local dev → Atlas) | products 412 ms, professionals 243 ms, settings 107 ms, tips 90 ms | Products is the slowest common call |
| DOMContentLoaded (dev) | ~400 ms | Dev-mode number, indicative only |

### Done this pass
- pettravel.png → jpg: **−1.8 MB** off the homepage band and the Pet Travel LCP.
- PageHero images are existing bundled assets (no new weight); heroes use `fetchpriority="high"` so LCP paints early.

### Recommended, in order of payoff (not done — need decisions/bigger surgery)
1. **Drop Bootstrap** (biggest win): `bootstrap.min.css` + react-bootstrap cost ~70 KB gzip CSS + 336 KB dev JS for a handful of usages (ImportPage's grid, a few legacy components). Audit usages, replace with existing custom CSS, delete the dependency. Halves the CSS bundle.
2. **Add MongoDB indexes for the product list**: `{ isActive: 1, category: 1 }`, `{ isActive: 1, vetRecommended: 1 }`, text index for search — the 412 ms products call runs on every shop visit and homepage.
3. **Cloudinary transformations**: product images come back up to 249 KB; add `f_auto,q_auto,w_600` to delivery URLs in one shared helper — free ~60-70% cut on every product image, no re-upload needed.
4. **Resize the biggest bundled images to their rendered size** (petshop hero 336 KB, nav mega-menu images ~1.6 MB combined, service cards). A small sharp script or vite-imagetools would automate this; env currently has no image tooling installed.
5. **HTTP caching headers on the API** for public GETs (products, tips, settings) — even `Cache-Control: max-age=60` removes repeat fetches during a session.

## 5. Open items (carried from the 2026-07-14 audit, still open)

Hover-gated controls on touch (ManagePhotosModal, PromoBannerCarousel arrows) ·
MyOrders timeline on mobile · admin DataTable <40 px touch targets · drawers at
100vw · checkout login bounce message/return-path · PetShop sort clears filters +
count shows page size · Buy Again drops variants · ghost "Product" line for deleted
products · SubscribeWidget `city: "-"` placeholder address · "Remember me" checkbox
is decorative.

---
*All measurements 2026-07-15, branch `fix/audit-2026-07-14`. Frontend suite 102/879 green; nothing pushed.*
