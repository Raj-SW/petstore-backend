<!-- Mirror copy. Canonical: docs/superpowers/specs/2026-07-15-punchlist-batch2-design.md -->

# Punch-List Batch 2 — Design Spec

**Date:** 2026-07-15
**Scope:** Frontend repo (branch `fix/audit-2026-07-14`) + one small backend
field. 11 workstreams from the user's final punch list, investigated against
the current code. Decisions confirmed by the user: Back button on drill-in
pages only; `bestSeller` backend field added; uniform hero = 55vh (60svh
phones).

**Shared tokens:** `--color-primary-forest` #001C10, `--color-accent-gold`
#D99A2B, `--color-bg-cream` #FAF5F1, `--color-bg-warm-ivory` #F6ECE3,
`--font-display`/`--font-script`/`--font-body`, house ease
`[0.25, 0.46, 0.45, 0.94]`. WhatsApp brand green `#25D366` (hover `#1EBE5D`).
WhatsApp number constant already exists: `WHATSAPP_NUMBER = "23057580480"`
in `Components/AppointmentModal/AppointmentModal.jsx:6` — export it from
there; do not duplicate the literal.

---

## 1. Testimonial strip fix + manual navigation
File: `HomePageSections/StatsSection.jsx` / `.css`.
- Marquee drift renders ONLY when a row has ≥ 8 chips (`testimonials.length
  >= 8` for one row; two rows require ≥ 12 so each row has ≥ 6). Below that,
  render the existing static wrapped grid (`.ts-marquee--static` styles) for
  everyone, not just reduced-motion — the drift loop cannot look continuous
  on a short track.
- Chip rotation reduced to ±0.5deg and the marquee wrapper gets
  `padding: 4px 0` so rotated chips never clip against `overflow hidden`.
- Add prev/next arrow buttons flanking the featured note (`.ts-arrow`,
  46px round, forest bg, gold hover — same treatment as `.vr-arrow`).
  Clicking sets `active` ±1 (wrapping) and sets `userTookControl` (kills
  auto-advance), same as chip clicks. `aria-label="Previous testimonial"` /
  `"Next testimonial"`. On phones the arrows sit below the note beside the
  dots.

## 2. Services page rename
File: `Pages/ServicePage/ServicePage.jsx`.
- Line ~296 hero CTA text `Import &amp; Export` → `Pet Travel`.
- Line ~48 SERVICES entry `label: "Import & Export"` → `label: "Pet Travel"`.

## 3. Breadcrumbs → BackButton
- New `Components/HelperComponents/BackButton/BackButton.jsx` + `.css`:
  `<button>` with `FaArrowLeft` + "Back". Behavior: if
  `window.history.state?.idx > 0` → `navigate(-1)`; else →
  `navigate(fallbackTo)`. Props: `fallbackTo` (required), `label = "Back"`.
  Style: inline-flex pill, transparent bg, forest text, gold hover underline,
  min-height 40px (matches `.co-back` look, extracted to the shared file).
- REMOVE `<Breadcrumb>` from all 11 usages (list in the investigation:
  UserProfile:194, PetTravelPage:20, IndividualProductItemPage:479,
  ProfessionalDetailPage:77, AppointmentPage:60, PetShopPage:215,
  ImportPage:59, MyOrdersPage:297, GalleryPage:122, GalleryDetailPage:61,
  TipDetailPage:75) and delete the crumb wrapper divs (e.g. `.pt-crumb`,
  `.ps-crumb-strip`).
- ADD `<BackButton>` only on drill-in pages: IndividualProductItemPage
  (fallback `/petshop`), TipDetailPage (`/pet-care-tips`), GalleryDetailPage
  (`/gallery`), ProfessionalDetailPage (`/appointments`), UserProfile (`/`),
  MyOrdersPage (`/`). Placed where the crumb strip was.
- DELETE `Components/HelperComponents/Breadcrumb/` (component + css + any
  test) — nothing references it afterwards. Also replace the checkout's
  ad-hoc `.co-back` link with BackButton (fallback `/petshop`) for
  consistency.

## 4. Pet Travel "WhatsApp Us" button → brand green
File: `Pages/PetTravel/PetTravel.css` (+ PtHero.jsx class swap if needed).
- The hero's WhatsApp CTA becomes filled `#25D366`, white text/icon, hover
  `#1EBE5D`, same pill radius/padding as `pt-btn-primary`. Class
  `pt-btn-whatsapp` replaces `pt-btn-outline--onimage` on that button (the
  outline-on-image style stays for any other use).

## 5. Homepage hero reinvention (text left, photo right)
Files: `HomePageSections/HeroSection.jsx` / `.css`.
- Remove the `.hero-logo-col` (24% column) and its logo `<img>` — the navbar
  already brands the page. The `.hero-content` block becomes left-aligned
  (`text-align: left`, `align-items: flex-start`), anchored to the left with
  `padding-left: clamp(1.5rem, 6vw, 5rem)`, `max-width: 580px`.
- `.hero-right-col` spacer grows so the right pet photo (`hero-image-right.webp`,
  52% width) is fully unobstructed; `.hero-right-fade` gradient narrows
  (fade only the seam, not the animals).
- Buttons row wraps left-aligned. Parallax and all four CTAs unchanged.
- Mobile (≤767px): unchanged stacking behavior (text over photo with
  stronger overlay), text remains left-aligned.

## 6. Checkout: summary left, friendlier flow
Files: `Pages/CartCheckoutPage/CartCheckOutPage.jsx` / `.css`
(payment/order logic untouched — this is layout/UX only).
- Grid becomes `grid-template-columns: 400px minmax(0, 1fr)`:
  LEFT `.co-sidebar` = **"1 · Your Order"** (items, totals, subscription
  chooser). RIGHT = **"2 · Delivery Details"** (address + notes) then
  **"3 · Payment"** (card element + Place Order button + perks). Sticky
  behavior moves to the LEFT column.
- Numbered section titles: gold numeral circle (28px) + title, shared
  `.co-step-title` style.
- Inputs: min-height 48px, font-size 1rem, existing autocomplete attrs kept,
  error text unchanged. Place Order button min-height 52px.
- Mobile (≤900px): single column, order summary FIRST (already the case),
  then delivery, then payment — numbering reads 1-2-3 top to bottom.
- All existing tests must keep passing (same field names/ids, same submit
  flow, same empty-cart screen).

## 7. Uniform hero size — 55vh standard
- `PageHero.css`: `.ph-hero` min-height 65vh → **55vh**; DELETE the
  `--compact` variant (and the `compact` prop from PageHero.jsx and its 4
  call sites — Contact, PetShop, Gallery, PetCareTips). Add
  `@media (max-width: 640px) { .ph-hero { min-height: 60svh; } }`.
- `ServicePage.css`: `.sp-hero` 65vh → 55vh (keep its 55vh mobile rule,
  now redundant → align to 60svh).
- `PetTravel.css`: `.pt-hero` 65vh → 55vh; mobile 72svh → 60svh.
- About page (PageHero full) inherits 55vh automatically.

## 8. Standard search bar — `HeroSearch`
- New `Components/HelperComponents/HeroSearch/HeroSearch.jsx` + `.css`:
  the light pill (extracted from `.pct-search`): FiSearch icon + input,
  white bg, 12px radius, gold `:focus-within` border, width
  `min(100%, 560px)`. Props: `value`, `onChange`, `placeholder`,
  `onSubmit?` (Enter key), `ariaLabel`.
- PetCareTipsPage and GalleryPage swap their ad-hoc `.pct-search` /
  `.gal-search` divs for `<HeroSearch>` (controlled, same state wiring);
  the old CSS blocks are deleted.
- PetShopPage's hero uses `<HeroSearch>` with local state and
  `onSubmit={(q) => navigate(`/petshop?search=${encodeURIComponent(q)}`)}`
  — replacing the gooey `SearchBar` there. `SearchBar` component is deleted
  if nothing else renders it (investigation says petshop/product only —
  verify IndividualProductItemPage during implementation; if it renders
  SearchBar, swap it the same way).

## 9. WhatsApp booking — form-first modals
File: `Components/AppointmentModal/AppointmentModal.jsx` / `.css` rebuilt;
consumers: HeroSection (2 instances), PtHero (1 instance).

Shared modal shell (premium): centered, max-width 460px, cream bg, 20px
radius, gold top rule, display-font title, `AnimatePresence` scale/fade
(0.96→1, 0.25s house ease), Escape + backdrop close, focus trapped on open,
body scroll locked (reuse the app's existing scroll-lock approach from the
mobile menu if present, else `overflow: hidden` on body while open).

New props:
`{ open, onClose, variant, title, description, hours?, note?, fields, buildMessage, primaryLabel, secondaryAction? ("clinic" | "call"), footnote }`
— but implement via three PRESETS exported from the same file so consumers
stay one-liners: `BOOKING_PRESET`, `MOBILE_VET_PRESET`, `TRAVEL_PRESET`.

**Booking preset** (Book Appointment):
- Title "Book Your Appointment", line "We're excited to care for your pet."
- Consultation hours list: Monday, Wednesday, Thursday, Saturday —
  4:30 PM – 6:00 PM (calendar icon per row).
- Note: "Need another time? Home visits and special appointments may be
  available upon request."
- Form fields (all optional, labeled, 44px inputs):
  Pet's Name (text) · Pet Type (select: Dog / Cat / Other) · Reason for
  Visit (text) · Preferred Day (select: Monday / Wednesday / Thursday /
  Saturday) · Preferred Time (text, placeholder "e.g. 5:00 PM") ·
  Owner's Name (text).
- Buttons: 🟢 **Continue with WhatsApp** (green #25D366 pill) — opens
  `https://wa.me/23057580480?text=` with:
  ```
  Hello VitalPaws 🐾
  I would like to book an appointment.
  • Pet's Name: {petName}
  • Dog / Cat / Other: {petType}
  • Reason for Visit: {reason}
  • Preferred Consultation Day: {day}
  • Preferred Time: {time}
  • Owner's Name: {owner}
  Thank you.
  ```
  (blank fields stay blank after the colon — the template survives.)
  📍 **Find Our Clinic** (outline, existing CLINIC_MAP_URL) · **Close**.
- Footnote (small grey): "We usually reply within a few minutes during
  business hours."

**Mobile Vet preset**:
- Title "Need a veterinarian at your location?", body "Our mobile veterinary
  service brings professional care directly to your home when appropriate."
- "Suitable for" checklist (✔ green check icons): Sick pets · Elderly pets ·
  Pets unable to travel · Vaccinations · Follow-up consultations ·
  Emergency assistance (subject to availability).
- Form fields: Pet Name · Location · Reason · Preferred Time (all text).
- Buttons: **Book Mobile Visit** (green) → wa.me prefilled:
  ```
  Hello VitalPaws,
  I would like to request a mobile veterinary visit.
  Pet Name: {petName}
  Location: {location}
  Reason: {reason}
  Preferred Time: {time}
  ```
  **Call Now** (outline, `tel:+23057580480`) · **Close**.

**Travel preset** (PtHero "Book a Consultation"): title/description as
today; fields: Pet Name · Pet Type (Dog/Cat/Other) · Destination Country ·
Travel Month; Continue with WhatsApp message:
  ```
  Hello VitalPaws 🐾
  I would like to plan pet travel.
  Pet Name: {petName}
  Pet Type: {petType}
  Destination: {destination}
  Travel Month: {month}
  Thank you.
  ```

## 10. Product labels (Vet Recommended / Best Seller / Sale)
- **Backend:** `product.model.js` gains `bestSeller: { type: Boolean,
  default: false }` (next to `vetRecommended`); admin create/update
  controller allowlist + Joi schema accept it (mirror exactly how
  `vetRecommended` was wired); AdminProductForm gains a "Best Seller"
  checkbox beside the existing Vet Recommended one. One integration test:
  admin sets bestSeller=true → public product list returns it.
- **Frontend card** (`ProductCardV2.jsx`): new `badges` corner stack
  (top-left, vertical gap 4px, max TWO badges rendered in priority order
  Sale > Vet Recommended > Best Seller): existing SaleBadge stays; new
  `.pc-badge--vet` gold pill "Vet Recommended" (paw icon); new
  `.pc-badge--best` plum (#7A3B69) pill "Best Seller" (star icon). New
  props `vetRecommended`, `bestSeller` passed from PetShopPage,
  VetRecommendedSection, FeaturedProductSection.
- **Detail page** (`IndividualProductItemPage.jsx`): same two pills added
  to the existing `.ip-badges` row.

## 11. "Premium Care. Every Step of the Way." (replaces ServicesSection)
Files: rewrite `HomePageSections/ServicesSection.jsx` / `.css` (+test).
Per the user's screenshot:
- Cream band. Header centered: title "Premium Care." (display, forest) +
  "Every Step of the Way." (display, gold) on one line, subtitle "Explore
  our key services designed to keep your pets healthy, happy, and by your
  side for years to come." (muted body).
- 4 pillar cards in a row (grid 4 → 2×2 at ≤1023px → 1-col at ≤640px):
  each card = soft tinted panel (16px radius, 1px border, white inner),
  circular icon chip (44px, colored, centered, overlapping the photo top),
  photo (4:3, 12px radius), colored title, 2-line blurb, "Learn More"
  pill with arrow (colored, matching the card hue).
- Card data:
  1. Veterinary Care — forest #1D4432 hue — photo `veterinary-service.webp`
     — "Expert consultations, diagnostics, vaccinations and treatments with
     compassion and precision." — `/appointments?tab=veterinarians`.
  2. Pet Store — plum #7A3B69 — photo `NavigationBarAssets/PetStore/img2.webp`
     — "Premium foods, supplements, toys and essentials carefully selected
     for your pet's well-being." — `/petshop`.
  3. Pet Travel — teal #2A6F6A — photo `ExportImport/catflying.webp` —
     "Safe, stress-free travel solutions including documentation, crates
     and expert guidance." — `/import-export-service`.
  4. Pet Care Tips — gold #BA7517 — photo `StatsSection/vet-with-dog.jpg`
     — "Helpful tips, guides and advice to help you give your pet the best
     life possible." — `/pet-care-tips`.
- Motion: staggered rise-in on scroll (0.07s), card hover lift −6px,
  arrow nudges on hover. Reduced motion: fades only.

## Cross-cutting
- Reduced motion honored in all new/changed motion.
- Full frontend suite + backend suite green; live verification at
  1440/1024/768/640/375/320 (Browser pane) for every touched surface.
- No new npm dependencies. Never push without instruction.

## Out of scope
- ImportPage form redesign (only loses its breadcrumb).
- Real best-seller analytics (manual admin flag only).
- Backend consultation-hours config (hours are frontend constants for now).
