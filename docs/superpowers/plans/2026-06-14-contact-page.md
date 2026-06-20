# Contact Page + Map + Socials — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`. **Per user instruction: do NOT git commit/push — stage in working tree only.**

**Goal:** Build the `/contact` page (screenshot-matched), a reusable Google Map, updated footer socials, a contact-submissions admin inbox, and an admin-managed `promo` advert placement for the promo card.

**Architecture:** Backend adds contact admin endpoints + a `promo` Advert placement. Frontend adds a reusable `GoogleMap`, a `ContactPage`, a `contactApi`, footer social updates, and an `AdminContacts` inbox. Reuses the existing contact POST + Advert system + admin DataTable/modal patterns.

**Tech Stack:** Express/Mongoose/Joi (Jest); React/Vite/Framer Motion (Vitest).

**Spec:** `docs/superpowers/specs/2026-06-14-contact-page-design.md`

---

## BACKEND

### Task 1: Contact model status
**Files:** Modify `src/models/contact.model.js`
- [ ] Add a `status` field: `status: { type: String, enum: ['new', 'resolved'], default: 'new', index: true }`. (Read the file first to place it among existing fields.) Stage only.

### Task 2: Advert `promo` placement
**Files:** Modify `src/models/advert.model.js`, `src/validators/advert.validator.js`
- [ ] Model: `PLACEMENTS = ['banner', 'sponsored', 'hero', 'promo']`. Change link `required` fn to `function () { return ['banner', 'sponsored'].includes(this.placement); }` (link optional for hero AND promo).
- [ ] Validator: placement valid set add `'promo'`. Update create link `.when('placement', { is: Joi.valid('hero','promo'), then: optional/allow(''), otherwise: required min(1) })` — use `Joi.when` with `is: Joi.valid('hero','promo')`. Stage only.

### Task 3: Contact controller admin methods
**Files:** Modify `src/controllers/contact.controller.js`
- [ ] Keep `submitContact`. Add:
```js
const mongoose = require('mongoose'); // ensure imported
exports.getContacts = async (req, res, next) => {
  try {
    const contacts = await Contact.find().sort('-createdAt');
    return res.status(200).json({ success: true, count: contacts.length, data: contacts });
  } catch (e) { return next(e); }
};
exports.updateContact = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return next(new AppError('Invalid contact id', 400));
    const contact = await Contact.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
    if (!contact) return next(new AppError('Contact not found', 404));
    return res.status(200).json({ success: true, data: contact });
  } catch (e) { return next(e); }
};
exports.deleteContact = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return next(new AppError('Invalid contact id', 400));
    const contact = await Contact.findByIdAndDelete(req.params.id);
    if (!contact) return next(new AppError('Contact not found', 404));
    return res.status(200).json({ success: true, message: 'Contact deleted' });
  } catch (e) { return next(e); }
};
```
(Read the file to match its existing require names — `Contact`, `AppError`.) Stage only.

### Task 4: Contact routes (admin)
**Files:** Modify `src/routes/contact.routes.js`
- [ ] Add admin imports + routes:
```js
const { isAuthenticated, isAdmin } = require('../middlewares/auth.middleware');
const { submitContact, getContacts, updateContact, deleteContact } = require('../controllers/contact.controller');
// ...
router.post('/', submitContact);
router.get('/admin/all', isAuthenticated, isAdmin, getContacts);
router.patch('/:id', isAuthenticated, isAdmin, updateContact);
router.delete('/:id', isAuthenticated, isAdmin, deleteContact);
```
Stage only.

### Task 5: Backend tests
**Files:** Create `tests/contact.controller.test.js`; Modify `tests/adverts.controller.test.js`
- [ ] `contact.controller.test.js` (mirror adverts test harness): `POST /api/contact` public 201; `GET /api/contact/admin/all` 401 without token, 403 non-admin, 200 admin; `PATCH /:id` sets status resolved; `DELETE /:id` removes. (Contact submit may require name/email/message — check the model/validator.)
- [ ] In `adverts.controller.test.js`: add "creates a promo advert without a link → 201".
- [ ] Run `cd backend && npx cross-env NODE_ENV=test jest --runInBand --forceExit tests/contact.controller.test.js tests/adverts.controller.test.js tests/advert.model.test.js` → PASS. Stage only.

---

## FRONTEND

### Task 6: GoogleMap component + test
**Files:** Create `src/Components/Common/GoogleMap.jsx`, `src/Components/Common/GoogleMap.test.jsx`
- [ ] **Failing test:**
```jsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import GoogleMap, { CLINIC_LOCATION } from "./GoogleMap";
describe("GoogleMap", () => {
  it("renders an iframe embedding the query", () => {
    const { container } = render(<GoogleMap query={CLINIC_LOCATION} title="Find us" />);
    const iframe = container.querySelector("iframe");
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute("src")).toContain("output=embed");
    expect(iframe.getAttribute("src")).toContain(encodeURIComponent(CLINIC_LOCATION));
  });
});
```
- [ ] Run → fail. Implement:
```jsx
export const CLINIC_LOCATION = "-20.0948521,57.6355452";
const GoogleMap = ({ query = CLINIC_LOCATION, zoom = 15, height = "320px", title = "Map", className = "" }) => (
  <iframe
    title={title}
    className={className}
    src={`https://www.google.com/maps?q=${encodeURIComponent(query)}&z=${zoom}&output=embed`}
    width="100%"
    height={height}
    style={{ border: 0, borderRadius: "14px" }}
    loading="lazy"
    referrerPolicy="no-referrer-when-downgrade"
    allowFullScreen
  />
);
export default GoogleMap;
```
- [ ] Run → pass. Stage only.

### Task 7: contactApi
**Files:** Create `src/Services/api/contactApi.js`
- [ ] Mirror `advertsApi.js`: `submitContact(data)` POST `/contact`; `getContactsAdmin()` GET `/contact/admin/all`; `updateContact(id, data)` PATCH `/contact/:id`; `deleteContact(id)` DELETE `/contact/:id`. Stage only.

### Task 8: ContactPage
**Files:** Create `src/Pages/Contact/ContactPage.jsx`, `Contact.css`
- [ ] Build per spec: hero (pill, serif title, subtitle, `Link` buttons → `/appointments` and `/petshop`, FaPaw + squiggle SVG, 3 blob-shape showcase images), contact section (form left → `contactApi.submitContact` with name/email/message + success/error toast; promo card right → `advertsApi.getAdverts('promo')`, rotate w/ dots, fallback static card), and a `<GoogleMap query={CLINIC_LOCATION} />` + address block. Brand palette + Framer Motion. Stage only.

### Task 9: Footer socials
**Files:** Modify `src/Components/Footer/Footer.jsx`
- [ ] Replace the `.ft-socials` block with a `SOCIALS` array: WhatsApp `https://wa.me/23057580480` (`IoLogoWhatsapp`), TikTok `#` (`FaTiktok` from `react-icons/fa6`), Facebook `#` (`FaFacebook`), Instagram `#` (`FaInstagram`). Map to `<a target="_blank" rel="noopener noreferrer">`. Remove YouTube import if now unused. Stage only.

### Task 10: Routing + nav
**Files:** Modify `src/main.jsx`, `src/Components/NavigationBar/NavigationBar.jsx`
- [ ] `main.jsx`: import `ContactPage`; add public route `{ path: "contact", element: <ContactPage /> }`.
- [ ] `NavigationBar.jsx`: `NAV_LINKS` Contact `href: "/contact"`; replace the disabled mobile "Contact" span with an active `<a href="/contact" ...>`. Stage only.

### Task 11: AdminContacts inbox
**Files:** Create `src/Pages/Admin/Contacts/AdminContacts.jsx` (+ CSS); Modify `src/main.jsx`, `src/Components/Admin/AdminLayout.jsx`
- [ ] `AdminContacts.jsx` (mirror AdminGallery): DataTable (name, email, message snippet, status badge toggle New/Resolved via `updateContact`, date), detail modal, delete via shared `AnimatePresence` modal. Uses `contactApi.getContactsAdmin/updateContact/deleteContact`.
- [ ] `main.jsx`: admin route `{ path: "contacts", element: <AdminContacts /> }`.
- [ ] `AdminLayout.jsx`: import `FiMail`; sidebar item "Contacts" → `/admin/contacts`. Stage only.

### Task 12: Verification
- [ ] `cd frontend && npx vitest run src/Components/Common/GoogleMap.test.jsx` → pass.
- [ ] `npm run build` → clean.
- [ ] `npm test` → all green.
- [ ] Backend already running (nodemon). `curl "http://localhost:5000/api/contact/admin/all"` → 401 (auth required, proves route mounted). Stage only — do NOT commit.

---

## Self-Review
- **Spec coverage:** contact page (T8), GoogleMap reusable (T6), footer socials (T9), contact admin inbox (T1,T3,T4,T11), promo placement for the card (T2,T8), routing/nav (T10), tests (T5,T6,T12). Covered.
- **Placeholders:** code shown for non-obvious pieces; ContactPage/AdminContacts described as "mirror X" with explicit behaviours/props (read the analogue files at impl time for exact JSX).
- **Consistency:** `promo` placement in model+validator (T2) consumed by ContactPage `getAdverts('promo')` (T8) and admin Adverts; `CLINIC_LOCATION` defined T6 used T8; contactApi method names (T7) used in T8/T11; contact `status` field (T1) used by updateContact (T3) + admin toggle (T11).
- **Commit policy:** every task "Stage only — do NOT commit."
