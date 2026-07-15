<!-- Mirror copy. Canonical: docs/superpowers/plans/2026-07-15-punchlist-batch2.md -->

# Punch-List Batch 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 11 approved punch-list workstreams: testimonial nav fix, Services rename, breadcrumbs→BackButton, WhatsApp-green CTA, homepage hero text-left, checkout rebuild (summary left, numbered flow), 55vh hero standard, shared HeroSearch, form-first WhatsApp booking modals, product badges (+backend bestSeller), and the Premium Care section replacing ServicesSection.

**Architecture:** Independent task-sized changes in the frontend repo plus one small backend field. Two new shared components (BackButton, HeroSearch), one rebuilt shared modal (AppointmentModal with presets), two section rewrites (ServicesSection, hero), and surgical edits elsewhere. Every task carries its own tests.

**Tech Stack:** React 18, framer-motion, react-router, react-icons, plain CSS, Vitest + RTL; backend Node/Express/Mongoose/Jest for Task 8.

**Spec:** `docs/superpowers/specs/2026-07-15-punchlist-batch2-design.md` — the binding source for all copy, colors, and templates. Read it first; where this plan says "per spec §N", the spec text governs.

## Global Constraints

- Frontend `C:\Users\Raj\OneDrive\Documents\Pet Project\frontend`, backend `C:\Users\Raj\OneDrive\Documents\Pet Project\backend`, both on branch `fix/audit-2026-07-14`.
- Tokens: forest #001C10 (`--color-primary-forest`), gold #D99A2B (`--color-accent-gold`), cream #FAF5F1, ivory #F6ECE3; WhatsApp green `#25D366` / hover `#1EBE5D`; plum `#7A3B69`; house ease `[0.25, 0.46, 0.45, 0.94]`.
- WhatsApp number: import/export `WHATSAPP_NUMBER` from `Components/AppointmentModal/AppointmentModal.jsx` — never re-hardcode `23057580480` elsewhere.
- No new npm dependencies. Reduced motion honored on all new motion.
- After each task: run that task's test file(s); full suites run once in the final task.
- Never `git push`.

---

### Task 1: Quick wins — Services rename + WhatsApp-green CTA

**Files:**
- Modify: `frontend/src/Pages/ServicePage/ServicePage.jsx` (lines ~48, ~296)
- Modify: `frontend/src/Pages/PetTravel/sections/PtHero.jsx` (WhatsApp button class)
- Modify: `frontend/src/Pages/PetTravel/PetTravel.css` (new class)

**Interfaces:** none consumed/produced.

- [ ] **Step 1:** In `ServicePage.jsx` change the SERVICES entry `label: "Import & Export"` → `label: "Pet Travel"`, and the hero outline button text `Import &amp; Export` → `Pet Travel`.
- [ ] **Step 2:** In `PtHero.jsx`, on the WhatsApp `<motion.a>`, replace class `pt-btn pt-btn-outline pt-btn-outline--onimage` with `pt-btn pt-btn-whatsapp`.
- [ ] **Step 3:** In `PetTravel.css`, after the `.pt-btn-outline--onimage:hover` block add:

```css
.pt-btn-whatsapp {
  background: #25d366;
  border: 2px solid #25d366;
  color: #ffffff !important;
}
.pt-btn-whatsapp:hover {
  background: #1ebe5d;
  border-color: #1ebe5d;
  color: #ffffff !important;
}
```

- [ ] **Step 4:** Update assertions: `frontend/src/Pages/PetTravel/PetTravelPage.test.jsx` — if any test queries the WhatsApp link by class or the ServicePage tests assert "Import & Export", update to the new label/class. Run: `npx vitest run src/Pages/PetTravel src/Pages/ServicePage` → PASS.
- [ ] **Step 5:** Commit: `fix(ux): rename Import & Export to Pet Travel; WhatsApp CTA in brand green`

---

### Task 2: BackButton component + remove breadcrumbs everywhere

**Files:**
- Create: `frontend/src/Components/HelperComponents/BackButton/BackButton.jsx`, `BackButton.css`, `BackButton.test.jsx`
- Modify (remove `<Breadcrumb>` + wrapper divs; add BackButton where noted): `Pages/UserProfile.jsx` (+BackButton `/`), `Pages/PetTravel/PetTravelPage.jsx` (remove only, incl. `.pt-crumb` markup+CSS), `Pages/IndividualProductItemPage/IndividualProductItemPage.jsx` (+`/petshop`), `Pages/AppointmentPage/ProfessionalDetailPage.jsx` (+`/appointments`), `Pages/AppointmentPage/AppointmentPage.jsx` (remove only), `Pages/PetShopPage/PetShopPage.jsx` (remove only, incl. `.ps-crumb-strip` markup+CSS), `Pages/ImportExport/Import/ImportPage.jsx` (remove only), `Pages/MyOrders/MyOrdersPage.jsx` (+`/`), `Pages/Gallery/GalleryPage.jsx` (remove only), `Pages/Gallery/GalleryDetailPage.jsx` (+`/gallery`), `Pages/PetCareTips/TipDetailPage.jsx` (+`/pet-care-tips`)
- Modify: `Pages/CartCheckoutPage/CartCheckOutPage.jsx` — replace the `.co-back` `<Link>` with `<BackButton fallbackTo="/petshop" label="Continue Shopping" />`
- Delete: `frontend/src/Components/HelperComponents/Breadcrumb/` (whole folder)

**Interfaces:**
- Produces: `BackButton({ fallbackTo, label = "Back" })` default export.

- [ ] **Step 1:** Write failing test `BackButton.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const real = await vi.importActual("react-router-dom");
  return { ...real, useNavigate: () => mockNavigate };
});

import BackButton from "./BackButton";

beforeEach(() => vi.clearAllMocks());

describe("BackButton", () => {
  it("goes back when there is history", () => {
    window.history.pushState({ idx: 2 }, "");
    render(<BackButton fallbackTo="/petshop" />);
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it("uses the fallback route when there is no history", () => {
    window.history.pushState({ idx: 0 }, "");
    render(<BackButton fallbackTo="/petshop" />);
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/petshop");
  });

  it("renders a custom label", () => {
    window.history.pushState({ idx: 0 }, "");
    render(<BackButton fallbackTo="/" label="Continue Shopping" />);
    expect(screen.getByRole("button", { name: /continue shopping/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2:** Run it → FAIL (module not found).
- [ ] **Step 3:** Implement `BackButton.jsx`:

```jsx
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import "./BackButton.css";

/** Replaces breadcrumbs on drill-in pages: history back with a safe fallback. */
const BackButton = ({ fallbackTo, label = "Back" }) => {
  const navigate = useNavigate();
  const goBack = () => {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate(fallbackTo);
  };
  return (
    <button type="button" className="back-btn" onClick={goBack}>
      <FaArrowLeft size={12} aria-hidden="true" /> {label}
    </button>
  );
};

export default BackButton;
```

`BackButton.css`:

```css
.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 40px;
  padding: 0.35rem 0.9rem 0.35rem 0;
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-primary-forest, #001c10);
  transition: color 0.2s ease, gap 0.2s ease;
}
.back-btn:hover { color: var(--color-accent-gold, #ba7517); gap: 0.6rem; }
.back-btn:focus-visible {
  outline: 2px solid var(--color-accent-gold, #d99a2b);
  outline-offset: 2px;
  border-radius: 6px;
}
```

- [ ] **Step 4:** Run BackButton tests → PASS.
- [ ] **Step 5:** Remove every `<Breadcrumb …/>` render + its import + crumb wrapper markup from the 11 pages listed above; add `<BackButton fallbackTo="…" />` in that spot on the six drill-in pages only (fallbacks per the file list). Replace checkout's `.co-back` link. Delete the Breadcrumb folder. Delete now-dead crumb CSS blocks (`.pt-crumb*`, `.ps-crumb-strip*`, `.gal-breadcrumb` inline wrapper, etc.).
- [ ] **Step 6:** Grep `Breadcrumb` across `frontend/src` → zero hits. Run the touched pages' test files (`npx vitest run src/Pages/PetShopPage src/Pages/Gallery src/Pages/PetCareTips src/Pages/PetTravel src/Pages/MyOrders src/Pages/CartCheckoutPage`) → PASS (update any test that asserted breadcrumb presence to assert the BackButton or its absence).
- [ ] **Step 7:** Commit: `feat(nav): replace breadcrumbs with BackButton on drill-in pages`

---

### Task 3: Shared HeroSearch + retire the gooey SearchBar

**Files:**
- Create: `frontend/src/Components/HelperComponents/HeroSearch/HeroSearch.jsx`, `.css`, `.test.jsx`
- Modify: `Pages/PetCareTips/PetCareTipsPage.jsx`, `Pages/Gallery/GalleryPage.jsx`, `Pages/PetShopPage/PetShopPage.jsx`
- Delete: `Components/HelperComponents/SearchBar/` (verify IndividualProductItemPage first; if it renders SearchBar, swap it for HeroSearch with the same navigate-on-submit)
- Delete dead CSS: `.pct-search*` block in `PetCareTips.css`, `.gal-search*` block in `Gallery.css`

**Interfaces:**
- Produces: `HeroSearch({ value, onChange, placeholder, onSubmit?, ariaLabel })` default export. `onChange(string)`, `onSubmit(string)` on Enter.

- [ ] **Step 1:** Failing tests `HeroSearch.test.jsx`:

```jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import HeroSearch from "./HeroSearch";

describe("HeroSearch", () => {
  it("renders with placeholder and calls onChange with the raw string", () => {
    const onChange = vi.fn();
    render(<HeroSearch value="" onChange={onChange} placeholder="Search moments…" ariaLabel="Search gallery" />);
    const input = screen.getByLabelText("Search gallery");
    fireEvent.change(input, { target: { value: "expo" } });
    expect(onChange).toHaveBeenCalledWith("expo");
  });

  it("calls onSubmit with the current value on Enter", () => {
    const onSubmit = vi.fn();
    render(<HeroSearch value="dog food" onChange={() => {}} onSubmit={onSubmit} ariaLabel="Search products" />);
    fireEvent.keyDown(screen.getByLabelText("Search products"), { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("dog food");
  });
});
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement:

```jsx
import { FiSearch } from "react-icons/fi";
import "./HeroSearch.css";

/** The standard site search pill — used in every page hero that searches. */
const HeroSearch = ({ value, onChange, placeholder = "Search…", onSubmit, ariaLabel = "Search" }) => (
  <div className="hero-search">
    <FiSearch size={17} aria-hidden="true" />
    <input
      type="search"
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter" && onSubmit) onSubmit(value); }}
    />
  </div>
);

export default HeroSearch;
```

```css
.hero-search {
  display: flex;
  align-items: center;
  gap: 12px;
  width: min(100%, 560px);
  background: #ffffff;
  border: 1px solid #e8e0d2;
  border-radius: 12px;
  padding: 12px 18px;
  color: #8a8272;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.hero-search:focus-within {
  border-color: var(--color-accent-gold, #d99a2b);
  box-shadow: 0 0 0 3px rgba(217, 154, 43, 0.18);
}
.hero-search input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-family: var(--font-body);
  font-size: 14px;
  color: var(--color-primary-forest, #001c10);
}
```

- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Swap-in: Tips and Gallery replace their `.pct-search`/`.gal-search` divs with `<HeroSearch value={search} onChange={setSearch} placeholder=… ariaLabel=… />` (drop the inline width style — the component owns it). PetShop hero replaces `<SearchBar showInPages…/>` with local `const [q, setQ] = useState("")` + `<HeroSearch value={q} onChange={setQ} placeholder="Search for products…" ariaLabel="Search products" onSubmit={(v) => navigate(`/petshop?search=${encodeURIComponent(v)}`)} />`. Check IndividualProductItemPage for SearchBar; swap identically if present. Delete the SearchBar folder + dead search CSS blocks.
- [ ] **Step 6:** Grep `SearchBar` → zero hits. Run: `npx vitest run src/Pages/PetShopPage src/Pages/Gallery src/Pages/PetCareTips src/Components/HelperComponents/HeroSearch` → PASS (update any tests referencing the old inputs — they query by aria-label, which is preserved).
- [ ] **Step 7:** Commit: `feat(search): one standard HeroSearch pill across shop, tips and gallery`

---

### Task 4: Uniform 55vh heroes

**Files:**
- Modify: `Components/HelperComponents/PageHero/PageHero.jsx` (remove `compact` prop), `PageHero.css`
- Modify: `Pages/ServicePage/ServicePage.css`, `Pages/PetTravel/PetTravel.css`
- Modify call sites: `ContactPage.jsx`, `PetShopPage.jsx`, `GalleryPage.jsx`, `PetCareTipsPage.jsx` (drop `compact`)

**Interfaces:** PageHero loses the `compact` prop (About already passes nothing).

- [ ] **Step 1:** PageHero.css: `.ph-hero { min-height: 55vh; }` (was 65vh); delete the `.ph-hero--compact` blocks (all three: hero, content, title); add at the end:

```css
@media (max-width: 640px) {
  .ph-hero { min-height: 60svh; }
}
```

- [ ] **Step 2:** PageHero.jsx: remove `compact` from the signature and the className ternary (`className="ph-hero"`). Remove `compact` from the four call sites.
- [ ] **Step 3:** ServicePage.css `.sp-hero` 65vh → 55vh; its mobile 55vh rule → 60svh. PetTravel.css `.pt-hero` 65vh → 55vh; mobile 72svh → 60svh.
- [ ] **Step 4:** Run: `npx vitest run src/Pages` scoped to touched pages → PASS. Commit: `style(hero): one 55vh hero standard across all pages`

---

### Task 5: Homepage hero — text left, photo unobstructed

**Files:**
- Modify: `HomePageSections/HeroSection.jsx`, `HeroSection.css` (+ its test if it asserts the logo)

**Interfaces:** CTAs and both AppointmentModal instances stay wired exactly as today (Task 7 upgrades the modal itself).

- [ ] **Step 1:** JSX: delete the `.hero-logo-col` column and its logo `<img>` import/usage. Keep `.hero-bg-left`, `.hero-bg-right`, parallax transforms, all four buttons, both modals.
- [ ] **Step 2:** CSS: `.hero-overlay` becomes a two-part flex (`justify-content: flex-start`); `.hero-content { text-align: left; align-items: flex-start; max-width: 580px; padding-left: clamp(1.5rem, 6vw, 5rem); }`; `.hero-buttons { justify-content: flex-start; }`; `.hero-right-fade` gradient narrowed to fade only the seam between text zone and photo (reduce its width/stop so the animals are fully visible); delete `.hero-logo-col` rules. Keep the ≤767px stacking as-is except text stays left-aligned.
- [ ] **Step 3:** Update `HeroSection` tests if they assert the logo img; run `npx vitest run src/Pages/HomePage/HomePageSections/HeroSection*` (or the homepage suite) → PASS.
- [ ] **Step 4:** Commit: `feat(home): hero copy left, pet photo unobstructed right`

---

### Task 6: Testimonial strip — static below 8 chips + prev/next arrows

**Files:**
- Modify: `HomePageSections/StatsSection.jsx`, `StatsSection.css`, `StatsSection.test.jsx`

**Interfaces:** none new; behavior per spec §1.

- [ ] **Step 1:** Add failing tests to `StatsSection.test.jsx`:

```jsx
  it("renders prev/next arrows that navigate testimonials and stop auto-advance", async () => {
    render(<StatsSection />);
    await screen.findByText(/follow-up care was outstanding/);
    fireEvent.click(screen.getByRole("button", { name: "Next testimonial" }));
    expect(await screen.findByText(/enjoys going there now/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous testimonial" }));
    expect(await screen.findByText(/follow-up care was outstanding/)).toBeInTheDocument();
  });

  it("renders the chip wall statically (no duplicate track) when fewer than 8 testimonials", async () => {
    render(<StatsSection />);
    await screen.findByText(/follow-up care was outstanding/);
    expect(document.querySelector('.ts-track[aria-hidden="true"]')).toBeNull();
  });
```

(The second currently passes only under the reduced-motion mock — the implementation must make it hold for ANY motion preference when count < 8; keep the reduced-motion mock as-is, the assertion documents the contract.)

- [ ] **Step 2:** Implementation in `StatsSection.jsx`:
  - `const drift = !reduced && testimonials.length >= 8;` — render the duplicate `aria-hidden` track and drift classes only when `drift`; otherwise add `ts-marquee--static`. Two rows only when `testimonials.length >= 12`.
  - Wrap the featured note stage with arrows:

```jsx
<div className="ts-note-row">
  <button type="button" className="ts-arrow" aria-label="Previous testimonial"
    onClick={() => pick((active - 1 + testimonials.length) % testimonials.length)}>
    <FaArrowLeft size={16} aria-hidden="true" />
  </button>
  {/* existing .ts-note-stage here */}
  <button type="button" className="ts-arrow" aria-label="Next testimonial"
    onClick={() => pick((active + 1) % testimonials.length)}>
    <FaArrowRight size={16} aria-hidden="true" />
  </button>
</div>
```

  (import `FaArrowLeft, FaArrowRight`; `pick` already stops auto-advance.)
- [ ] **Step 3:** CSS: `.ts-note-row { display:flex; align-items:center; gap:1rem; justify-content:center; }`; `.ts-arrow { width:46px; height:46px; border-radius:50%; border:none; cursor:pointer; background:var(--color-primary-forest,#001c10); color:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:background .2s ease, transform .15s ease; } .ts-arrow:hover { background:var(--color-accent-gold,#ba7517); transform:scale(1.08);} .ts-arrow:focus-visible { outline:2px solid var(--color-accent-gold,#d99a2b); outline-offset:2px; }`; chip rotation ±1deg → ±0.5deg; `.ts-marquee { padding: 4px 0; }`. Mobile ≤640px: `.ts-note-row { flex-wrap: wrap; } .ts-note-row .ts-arrow { order: 2; margin-top: .6rem; }` so arrows drop under the note.
- [ ] **Step 4:** Run `npx vitest run src/Pages/HomePage/HomePageSections/StatsSection.test.jsx` → all pass (existing 9 + 2 new).
- [ ] **Step 5:** Commit: `fix(home): testimonial wall static below 8 chips + manual prev/next arrows`

---

### Task 7: AppointmentModal — premium form-first WhatsApp booking

**Files:**
- Rewrite: `Components/AppointmentModal/AppointmentModal.jsx`, `.css`; create `AppointmentModal.test.jsx`
- Modify consumers: `HomePageSections/HeroSection.jsx` (2 instances), `Pages/PetTravel/sections/PtHero.jsx` (1 instance)

**Interfaces:**
- Produces: default export `AppointmentModal({ open, onClose, preset })` plus named exports `WHATSAPP_NUMBER`, `BOOKING_PRESET`, `MOBILE_VET_PRESET`, `TRAVEL_PRESET`. A preset is `{ title, intro, hours?, note?, checklist?, fields: [{ key, label, type: "text"|"select", options?, placeholder? }], buildMessage(values) → string, primaryLabel, secondary: { type: "clinic"|"call" }|null, footnote? }`.
- Consumers render `<AppointmentModal open={…} onClose={…} preset={BOOKING_PRESET} />` etc. All current prop spellings (`title`, `description`, `waMessage`, `hours`, `primaryLabel`) are REPLACED by the preset API — update all three consumers in this task.

Copy is binding per spec §9 (hours Mon/Wed/Thu/Sat 4:30 PM – 6:00 PM; message templates verbatim; footnote "We usually reply within a few minutes during business hours."; mobile-vet checklist; Call Now `tel:+23057580480`).

- [ ] **Step 1:** Failing tests `AppointmentModal.test.jsx` (framer mocked per house pattern; jsdom `window.open` spied):

```jsx
// mocks: framer-motion proxy (house pattern), no API mocks needed
import AppointmentModal, { BOOKING_PRESET, MOBILE_VET_PRESET } from "./AppointmentModal";

describe("AppointmentModal (booking preset)", () => {
  it("shows hours, note and footnote", () => {
    render(<AppointmentModal open onClose={() => {}} preset={BOOKING_PRESET} />);
    expect(screen.getByText("Book Your Appointment")).toBeInTheDocument();
    expect(screen.getAllByText(/4:30 PM – 6:00 PM/).length).toBe(4);
    expect(screen.getByText(/Home visits and special appointments/)).toBeInTheDocument();
    expect(screen.getByText(/reply within a few minutes/)).toBeInTheDocument();
  });

  it("builds the WhatsApp URL from the form values", () => {
    render(<AppointmentModal open onClose={() => {}} preset={BOOKING_PRESET} />);
    fireEvent.change(screen.getByLabelText("Pet's Name"), { target: { value: "Rex" } });
    fireEvent.change(screen.getByLabelText("Owner's Name"), { target: { value: "Raj" } });
    const link = screen.getByRole("link", { name: /Continue with WhatsApp/i });
    const href = decodeURIComponent(link.getAttribute("href"));
    expect(href).toContain("wa.me/23057580480");
    expect(href).toContain("Pet's Name: Rex");
    expect(href).toContain("Owner's Name: Raj");
    expect(href).toContain("Reason for Visit:"); // blank field keeps its bullet
  });

  it("mobile vet preset shows the checklist and Call Now", () => {
    render(<AppointmentModal open onClose={() => {}} preset={MOBILE_VET_PRESET} />);
    expect(screen.getByText(/Pets unable to travel/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Call Now/i }))
      .toHaveAttribute("href", "tel:+23057580480");
  });

  it("renders nothing when closed and closes on Escape", () => {
    const onClose = vi.fn();
    const { rerender } = render(<AppointmentModal open={false} onClose={onClose} preset={BOOKING_PRESET} />);
    expect(screen.queryByText("Book Your Appointment")).toBeNull();
    rerender(<AppointmentModal open onClose={onClose} preset={BOOKING_PRESET} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. Core mechanics (full copy per spec §9):

```jsx
export const WHATSAPP_NUMBER = "23057580480";
const CLINIC_MAP_URL = /* keep the existing constant value from the old file */;

const waUrl = (msg) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;

export const BOOKING_PRESET = {
  title: "Book Your Appointment",
  intro: "We're excited to care for your pet.",
  hours: ["Monday", "Wednesday", "Thursday", "Saturday"].map(
    (d) => `${d} – 4:30 PM – 6:00 PM`
  ),
  note: "Need another time? Home visits and special appointments may be available upon request.",
  fields: [
    { key: "petName", label: "Pet's Name", type: "text" },
    { key: "petType", label: "Pet Type", type: "select", options: ["Dog", "Cat", "Other"] },
    { key: "reason", label: "Reason for Visit", type: "text" },
    { key: "day", label: "Preferred Day", type: "select", options: ["Monday", "Wednesday", "Thursday", "Saturday"] },
    { key: "time", label: "Preferred Time", type: "text", placeholder: "e.g. 5:00 PM" },
    { key: "owner", label: "Owner's Name", type: "text" },
  ],
  buildMessage: (v) =>
    `Hello VitalPaws 🐾\nI would like to book an appointment.\n• Pet's Name: ${v.petName || ""}\n• Dog / Cat / Other: ${v.petType || ""}\n• Reason for Visit: ${v.reason || ""}\n• Preferred Consultation Day: ${v.day || ""}\n• Preferred Time: ${v.time || ""}\n• Owner's Name: ${v.owner || ""}\nThank you.`,
  primaryLabel: "Continue with WhatsApp",
  secondary: { type: "clinic" },
  footnote: "We usually reply within a few minutes during business hours.",
};
// MOBILE_VET_PRESET and TRAVEL_PRESET analogous, copy + fields + templates per spec §9.
```

Component: framer `AnimatePresence` shell (backdrop fade + panel scale 0.96→1, house ease, reduced-motion opacity-only), Escape listener while open, body `overflow: hidden` while open (cleanup on close/unmount), labeled inputs (`htmlFor`/`id` pairs — the tests query by label), primary CTA an `<a target="_blank" rel="noopener noreferrer" href={waUrl(preset.buildMessage(values))}>` in WhatsApp green, secondary link (clinic map or `tel:+${WHATSAPP_NUMBER}`), Close button. CSS: cream panel, max-width 460px, 20px radius, gold top border rule, 44px inputs, `max-height: 88svh; overflow-y: auto` so it never clips on phones.

- [ ] **Step 4:** Update the three consumers to the preset API (HeroSection booking → `BOOKING_PRESET`, mobile vet → `MOBILE_VET_PRESET`; PtHero → `TRAVEL_PRESET`). Update PtHero's direct `waHref` link ONLY if it referenced the removed props (its plain "WhatsApp Us" link stays a direct link — only the "Book a Consultation" modal changes).
- [ ] **Step 5:** Run: `npx vitest run src/Components/AppointmentModal src/Pages/HomePage/HomePageSections/HeroSection* src/Pages/PetTravel` → PASS (update consumer tests to the new API).
- [ ] **Step 6:** Commit: `feat(booking): premium form-first WhatsApp modals (booking, mobile vet, travel)`

---

### Task 8: Backend `bestSeller` field

**Files (backend repo):**
- Modify: `src/models/product.model.js` (add `bestSeller: { type: Boolean, default: false }` next to `vetRecommended`)
- Modify: the product controller/validation exactly where `vetRecommended` is accepted (create + update allowlist/Joi) — mirror it for `bestSeller`
- Test: `tests/integration/products/product.bestSeller.test.js`

**Interfaces:** Public product list/detail responses include `bestSeller`.

- [ ] **Step 1:** Failing integration test (mirror the existing vetRecommended test file's setup — admin auth helper, product factory):

```js
it("admin can set bestSeller and it appears in the public product list", async () => {
  const { token } = await createAdmin();
  const create = await request(app)
    .post("/api/products")
    .set("Authorization", `Bearer ${token}`)
    .field("name", "Chew Bone").field("price", 100).field("category", "Dogs")
    .field("bestSeller", "true");
  expect(create.status).toBe(201);
  const list = await request(app).get("/api/products");
  const p = list.body.data.find((x) => x.name === "Chew Bone");
  expect(p.bestSeller).toBe(true);
});
```

(Adapt field/factory mechanics to how the existing vetRecommended test creates products — copy that file's approach verbatim.)
- [ ] **Step 2:** Run → FAIL. **Step 3:** Add the model field + controller/Joi wiring (identical pattern to `vetRecommended`). **Step 4:** Run the test file + the products suite → PASS.
- [ ] **Step 5 (frontend admin):** `Pages/Admin/Products/AdminProductForm.jsx` — add a "Best Seller" checkbox beside the existing "Vet Recommended" one (same state/submit wiring pattern). Run its test file if one exists.
- [ ] **Step 6:** Commit backend (`feat(products): bestSeller flag`) and frontend (`feat(admin): best-seller checkbox on product form`) separately in their repos.

---

### Task 9: Product badges on card + detail page

**Files:**
- Modify: `Components/HelperComponents/ProductCard/ProductCardV2.jsx` (+ its CSS file; find it next to the component) and its test
- Modify: `Pages/IndividualProductItemPage/IndividualProductItemPage.jsx` (badges row)
- Modify pass-throughs: `PetShopPage.jsx`, `HomePageSections/VetRecommendedSection/VetRecommendedSection.jsx`, `HomePageSections/FeaturedProductSection.jsx` — add `vetRecommended={product.vetRecommended}` `bestSeller={product.bestSeller}`

**Interfaces:** ProductCardV2 gains optional `vetRecommended = false`, `bestSeller = false` props.

- [ ] **Step 1:** Failing card tests (in the existing ProductCardV2 test file, house render helpers):

```jsx
it("shows the Vet Recommended badge", () => {
  renderCard({ vetRecommended: true });
  expect(screen.getByText(/vet recommended/i)).toBeInTheDocument();
});
it("shows at most two badges, sale first", () => {
  renderCard({ isOnSaleNow: true, discountPercentLabel: 20, vetRecommended: true, bestSeller: true });
  expect(screen.getByText(/-20%/)).toBeInTheDocument();
  expect(screen.getByText(/vet recommended/i)).toBeInTheDocument();
  expect(screen.queryByText(/best seller/i)).toBeNull();
});
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement: a `.pc-badges` absolute stack top-left of the image wrap; build an ordered array `[sale?, vet?, best?]`, slice(0, 2), render. Vet pill: gold bg, forest text, `FaPaw` 10px. Best pill: `#7A3B69` bg, white text, `FaStar` 10px. Pills: 0.66rem, 700, uppercase, 0.25rem 0.6rem padding, 999px radius. (Keep SaleBadge exactly as-is — it is the first element of the stack when on sale.)
- [ ] **Step 4:** Detail page: in the `.ip-badges` row add the same two pills conditioned on `product.vetRecommended` / `product.bestSeller` (reuse classes via the card CSS or duplicate two small rules in the page CSS — match the page's existing badge styling scale).
- [ ] **Step 5:** Wire pass-through props at the three list call sites. Run: `npx vitest run src/Components/HelperComponents/ProductCard src/Pages/IndividualProductItemPage src/Pages/PetShopPage` → PASS.
- [ ] **Step 6:** Commit: `feat(products): vet-recommended and best-seller badges on cards and product page`

---

### Task 10: "Premium Care. Every Step of the Way." (replaces ServicesSection)

**Files:**
- Rewrite: `HomePageSections/ServicesSection.jsx`, `ServicesSection.css`, + test

**Interfaces:** default export name `ServicesSection` unchanged (HomePage import untouched). Card data per spec §11 (4 pillars, hues, photos, blurbs, routes — copy verbatim from the spec).

- [ ] **Step 1:** Failing tests:

```jsx
it("renders the Premium Care heading and all four pillars", () => {
  renderSection();
  expect(screen.getByText(/premium care\./i)).toBeInTheDocument();
  expect(screen.getByText(/every step of the way\./i)).toBeInTheDocument();
  ["Veterinary Care", "Pet Store", "Pet Travel", "Pet Care Tips"].forEach((t) =>
    expect(screen.getByText(t)).toBeInTheDocument());
  expect(screen.getAllByRole("button", { name: /learn more/i })).toHaveLength(4);
});
it("Learn More navigates to the pillar route", () => {
  renderSection();
  fireEvent.click(screen.getAllByRole("button", { name: /learn more/i })[2]);
  expect(mockNavigate).toHaveBeenCalledWith("/import-export-service");
});
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement per spec §11: PILLARS array (title, hue, photo import, blurb, route, icon: FaStethoscope / FaShoppingBag / FaPlane / FaLightbulb), header (display forest "Premium Care." + gold "Every Step of the Way." + muted subtitle), 4-card grid: card = white panel on tinted wrapper (`background: {hue}0D` via rgba), icon disc (44px, hue bg, white icon, positioned overlapping the photo top edge), photo 4:3 12px radius, hue-colored title, blurb, Learn More pill (hue border/text, arrow slides on hover). Staggered `whileInView` rise (0.07s), hover lift −6px, reduced-motion fades. Grid: 4 → 2×2 (≤1023px) → 1 col (≤640px). Type via clamp.
- [ ] **Step 4:** Run tests → PASS. **Step 5:** Commit: `feat(home): Premium Care pillar section replaces old services grid`

---

### Task 11: Checkout — summary left, numbered friendly flow

**Files:**
- Modify: `Pages/CartCheckoutPage/CartCheckOutPage.jsx` (layout/JSX order + step titles only — ZERO changes to state, validation, or the submit handler), `CartCheckOutPage.css`
- Modify: `CartCheckOutPage.test.jsx` only if selectors break (field ids/names/labels must not change)

**Interfaces:** all existing ids (`street`, `city`, `state`, `country`, `zipCode`), the `#co-form` id, and button roles stay identical — the existing 6 tests must pass unmodified if possible.

- [ ] **Step 1:** JSX: reorder the grid children — `<aside className="co-sidebar">` (order summary + subscription) becomes the FIRST child titled `1 · Your Order`; the form column follows with `2 · Delivery Details` (address + notes) and `3 · Payment` (card element + retry hint + Place Order + perks moved INTO this column). Step titles use:

```jsx
const StepTitle = ({ n, children }) => (
  <h2 className="co-step-title">
    <span className="co-step-num" aria-hidden="true">{n}</span> {children}
  </h2>
);
```

- [ ] **Step 2:** CSS: `.co-layout { grid-template-columns: 400px minmax(0, 1fr); }`; sticky moves to the left column (`.co-sidebar { position: sticky; top: 88px; }` already exists — verify it still applies); `.co-step-num { display:inline-flex; width:28px; height:28px; border-radius:50%; background:var(--color-accent-gold,#d99a2b); color:var(--color-primary-forest,#001c10); font-weight:700; font-size:0.9rem; align-items:center; justify-content:center; margin-right:0.5rem; }`; inputs `min-height: 48px; font-size: 1rem;`; `.co-place-btn { min-height: 52px; }`. Mobile ≤900px: single column with `.co-sidebar { order: -1; position: static; }` (already present — confirm) so reading order stays 1→2→3.
- [ ] **Step 3:** Run: `npx vitest run src/Pages/CartCheckoutPage` → all existing tests PASS (they don't assert layout order; if any does, update it to the new order).
- [ ] **Step 4:** Commit: `feat(checkout): order summary first + numbered steps + friendlier inputs`

---

### Task 12: Full suites + live responsive verification

- [ ] **Step 1:** Frontend `npx vitest run --reporter=dot` → all files green (one known flake: rerun once before investigating). Backend `npm test` in the backend repo → green.
- [ ] **Step 2:** Live (Browser pane, user's dev server :5173 — if the pane reports `document.hidden`, do DOM-level checks and note animation playback as visually unverified): homepage (hero text left + photo visible; Premium Care section; testimonial arrows work; badges on product cards), services page ("Pet Travel" label), pet travel (green WhatsApp button, 55vh hero, no crumbs), shop/tips/gallery (HeroSearch, 55vh, no crumbs), product detail (BackButton + badges), checkout (summary left, numbered steps), booking modals (open Book Appointment + Mobile Vet from the hero; verify form → wa.me href content).
- [ ] **Step 3:** Widths 1440/1024/768/640/375/320: no new horizontal overflow (ignore the known off-canvas mobile-nav offender), 44px+ targets, modals fit within 88svh.
- [ ] **Step 4:** `graphify update .` in the frontend repo (and backend if backend files changed).
- [ ] **Step 5:** Fix-up commit(s) only if verification found issues: `fix: batch-2 live verification fix-ups`
