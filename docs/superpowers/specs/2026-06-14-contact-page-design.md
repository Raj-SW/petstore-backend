# Contact Page + Map + Socials — Design Spec

**Date:** 2026-06-14
**Status:** Approved, proceeding to implementation
**Scope:** Sub-project 1 of the larger batch (contact page, reusable map, social icons, contact admin inbox, promo placement). Full-stack.

## Goal

A dedicated `/contact` page matching the provided screenshot, plus: a reusable Google Map component, updated footer social icons, an admin inbox for contact/question submissions, and an admin-managed promo card (reusing the Advert system).

## Approved decisions
- **Promo card** (right of the contact form): driven by the **Advert** system via a new `promo` placement (rotating, dots), admin-managed.
- **Contact admin**: list + view + status (`new`/`resolved`) + delete. (Also serves the homepage question form, which already posts to `/api/contact`.)
- **Socials**: update the **Footer** icons — WhatsApp, TikTok, Facebook, Instagram (drop YouTube). Map = no-API-key `<iframe>`.
- **Hero buttons**: Book Appointment → `/appointments`, Get Started → `/petshop`.
- **Location**: Vitalpaws Veterinary Clinic, coords `-20.0948521, 57.6355452` (resolved from the hero Find-Us link `https://maps.app.goo.gl/YQRTJz6vFe3K9Z6UA`).
- **WhatsApp**: `https://wa.me/23057580480`. Facebook/Instagram/TikTok URLs are pending from the user — wired as editable constants (placeholder `#` until provided).

---

## Backend (`backend/`)

### `src/models/contact.model.js`
- Confirm existing fields (name, email, message, timestamps). Add:
  - `status: { type: String, enum: ['new', 'resolved'], default: 'new', index: true }`.

### `src/controllers/contact.controller.js`
- Keep `submitContact`.
- Add `getContacts` (admin) — all submissions, sort `-createdAt`, `{ success, count, data }`.
- Add `updateContact` (admin) — `findByIdAndUpdate` status (validate ObjectId; 404 if missing).
- Add `deleteContact` (admin) — delete by id (404 if missing).

### `src/routes/contact.routes.js`
- Keep `POST /`.
- Add (guarded `isAuthenticated, isAdmin`): `GET /admin/all` → getContacts; `PATCH /:id` → updateContact; `DELETE /:id` → deleteContact.

### Advert `promo` placement
- `advert.model.js`: `PLACEMENTS` → add `'promo'` (now `['banner','sponsored','hero','promo']`). `link` already optional for non-required? No — keep link required for banner/sponsored; **promo link optional** too (extend the conditional: required only when placement is `banner` or `sponsored`). Update the model `required` fn to `return ['banner','sponsored'].includes(this.placement);`.
- `advert.validator.js`: add `'promo'` to the placement valid set; the create link rule already makes link optional for hero — change it to be optional for `hero` **and** `promo` (i.e. required only for banner/sponsored).
- (getAdverts already filters by placement + sorts by order — no change.)

---

## Frontend (`frontend/`)

### `src/Components/Common/GoogleMap.jsx` (new, reusable)
- Props: `query` (string, e.g. `"-20.0948521,57.6355452"` or a place name), `zoom = 15`, `height = "320px"`, `title = "Map"`, `className`.
- Renders `<iframe src={`https://www.google.com/maps?q=${encodeURIComponent(query)}&z=${zoom}&output=embed`} ... loading="lazy" referrerPolicy="no-referrer-when-downgrade" />`. No API key.
- Export a `CLINIC_LOCATION = "-20.0948521,57.6355452"` constant for default use.

### `src/Services/api/contactApi.js` (new)
- `submitContact(data)` → `POST /contact`.
- `getContactsAdmin()` → `GET /contact/admin/all`.
- `updateContact(id, data)` → `PATCH /contact/:id`.
- `deleteContact(id)` → `DELETE /contact/:id`.

### `src/Pages/Contact/ContactPage.jsx` (+ `Contact.css`)
- **Hero:** pill tag ("#1 Pet care in Mauritius"), serif title ("Compassionate Care, Dedicated to Your Pet's Wellness"), subtitle, two buttons (`Link` to `/appointments` and `/petshop`), decorative paw (FaPaw) + squiggle SVG, and a 3-image organic-shape showcase row (rounded-blob shapes; tasteful placeholder images via existing assets/Unsplash).
- **Contact section:** heading "Connecting You with Care for Your Beloved Pets" + subtext; two columns:
  - Left: form (Your Name, Your Email Address, Message) → `contactApi.submitContact`; success + error toasts; matches the existing ContactSection field pattern.
  - Right: **promo card** — fetch `advertsApi.getAdverts('promo')`; rotate through them (auto every ~5s) with dots + a "Get 50% Discount"-style pill from the advert title; clickable via advert link; if none, show a static fallback card.
- **Map:** a `<GoogleMap query={CLINIC_LOCATION} />` block near the bottom (and address text).
- Framer Motion reveals; brand palette (forest/amber/ivory) + script font for the title.

### `src/Components/Footer/Footer.jsx`
- Replace the socials block: WhatsApp (`https://wa.me/23057580480`), TikTok, Facebook, Instagram. Icons: `IoLogoWhatsapp`, `FaTiktok` (react-icons/fa6), `FaFacebook`, `FaInstagram`. Define an editable `SOCIALS` array of `{ label, href, icon }`; FB/IG/TikTok hrefs default to `#` (pending real URLs), WhatsApp concrete. `target="_blank" rel="noopener noreferrer"`.

### Routing + nav
- `main.jsx`: add `/contact` → `ContactPage`.
- `NavigationBar.jsx`: enable the existing "Contact" link (`href: null` → `/contact`) in `NAV_LINKS` and the mobile menu (currently a disabled span).

### Admin
- `src/Pages/Admin/Contacts/AdminContacts.jsx` (+ CSS) — inbox via `getContactsAdmin`: DataTable (name, email, message snippet, status badge, date), row → detail modal (full message, mark New/Resolved via `updateContact`), delete via the shared `AnimatePresence` modal (`admin-modal*`/`at-btn-danger`). "Mark resolved" toggle in the table too.
- `main.jsx`: routes `/admin/contacts`. `AdminLayout.jsx`: sidebar item "Contacts" (icon `FiMail`/`FiInbox`).

---

## Data flow
1. Visitor submits the contact form (contact page or homepage) → `POST /api/contact` → stored `status:'new'`.
2. Admin → Contacts inbox lists submissions; can view, mark resolved, delete.
3. Contact page promo card pulls active `promo` adverts (admin-managed via Admin → Adverts, placement "Contact promo").
4. Map renders the clinic location via iframe (no key).

## Error handling
- Backend: `AppError` + central handler; 400 invalid id, 404 missing, auth guards.
- Frontend: toasts on submit/admin failures; promo card + map render nothing/fallback on error (never break the page).

## Testing
- **Backend (Jest+supertest):** `GET /api/contact/admin/all` (admin only — 401/403 guards), `PATCH` status, `DELETE`; `submitContact` still public. Advert: `promo` placement accepted, link optional for promo.
- **Frontend (Vitest+RTL):** `GoogleMap` renders an iframe whose `src` contains the query + `output=embed`; `ContactPage` renders the form and calls `submitContact`; `AdminContacts` renders submission rows; Footer renders the 4 socials with correct hrefs (WhatsApp concrete).
- Manual: submit → appears in admin inbox → mark resolved/delete; map shows clinic; footer icons link out; promo card rotates.

## Out of scope (YAGNI)
- Email reply-from-admin (chosen "status + delete" only).
- The Discounts feature itself (the promo card just shows adverts).
- Maps JS/Embed API + API key (using plain iframe).
- Real FB/IG/TikTok URLs until provided (editable constants).

## New dependencies
- Possibly `react-icons/fa6` for `FaTiktok` (react-icons already installed; fa6 ships with it). No new packages.
