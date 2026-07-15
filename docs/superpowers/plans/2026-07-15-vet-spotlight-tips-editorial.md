# Vet Spotlight + Tips Editorial Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two card-grid homepage sections (Meet Our Veterinary Network, Pet Care Tips) with a crossfading professional spotlight and a magazine-style numbered index, per the approved spec.

**Architecture:** Two self-contained section rewrites in the frontend repo. Each keeps its existing data fetch and empty/skeleton handling, replacing only the presentation layer. No shared new components — the two layouts are intentionally different shapes. No backend changes.

**Tech Stack:** React 18, framer-motion (`AnimatePresence`, `useReducedMotion`), react-router `Link`/`useNavigate`, react-icons, plain CSS files, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-15-vet-spotlight-tips-editorial-design.md` (backend repo; mirror at repo root). Read it before starting.

## Global Constraints

- Frontend repo: `C:\Users\Raj\OneDrive\Documents\Pet Project\frontend`, branch `fix/audit-2026-07-14`.
- Design tokens only: `--color-primary-forest` #001C10, `--color-accent-gold` #D99A2B, `--color-bg-cream` #FAF5F1, `--font-display`, `--font-script`, `--font-body`. House ease `[0.25, 0.46, 0.45, 0.94]`.
- No new npm dependencies.
- Homepage only — do NOT touch `ProfessionalCard`, `TipCard`, `/appointments`, or `/pet-care-tips`.
- Professionals API responses may be **flattened or nested** (`pro.specialization` OR `pro.professionalInfo.specialization`) — always read via the `info()` normalizer defined in Task 1.
- Tip cover images resolve through the existing `coverUrl()` helper (`src/utils/coverImage.js`) — covers may be `{url}` objects or bare strings.
- All type sizes via `clamp()`; breakpoints at 1024 / 768 / 640 / 380 px per the spec's responsive matrices.
- Never `git push` — commit only.

---

### Task 1: VetNetworkSection → Spotlight

**Files:**
- Rewrite: `src/Pages/HomePage/HomePageSections/VetNetworkSection/VetNetworkSection.jsx`
- Rewrite: `src/Pages/HomePage/HomePageSections/VetNetworkSection/VetNetworkSection.css`
- Test (create): `src/Pages/HomePage/HomePageSections/VetNetworkSection/VetNetworkSection.test.jsx`

**Interfaces:**
- Consumes: `professionalsApi.getProfessionals(params)` → `{ data: [{ _id, name, role, specialization?, professionalInfo?: { specialization, rating, experience }, profileImage?: { url } }] }`; `useNavigate()`.
- Produces: default export `VetNetworkSection` (unchanged name — HomePage.jsx import untouched). Exports nothing else.

- [ ] **Step 1: Write the failing tests**

Create `src/Pages/HomePage/HomePageSections/VetNetworkSection/VetNetworkSection.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const real = await vi.importActual("react-router-dom");
  return { ...real, useNavigate: () => mockNavigate };
});

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const FRAMER_PROPS = new Set([
    "initial", "animate", "exit", "transition", "whileInView", "whileHover",
    "whileTap", "viewport", "layoutId", "layout", "variants",
  ]);
  const motion = new Proxy({}, {
    get: (_t, tag) =>
      React.forwardRef(({ children, ...props }, ref) => {
        const rest = {};
        for (const k of Object.keys(props)) if (!FRAMER_PROPS.has(k)) rest[k] = props[k];
        return React.createElement(tag, { ref, ...rest }, children);
      }),
  });
  return {
    motion,
    AnimatePresence: ({ children }) => children,
    useInView: () => true,
    useReducedMotion: () => true, // disables auto-advance in tests — deterministic
  };
});

vi.mock("../../../../Services/api/professionalsApi", () => ({
  default: { getProfessionals: vi.fn() },
}));

vi.mock("../../../../Components/HelperComponents/SkeletonCard/SkeletonCard", () => ({
  default: () => <div data-testid="skeleton" />,
}));

import professionalsApi from "../../../../Services/api/professionalsApi";
import VetNetworkSection from "./VetNetworkSection";

const PROS = [
  {
    _id: "p1",
    name: "Anisha Ramgoolam",
    role: "veterinarian",
    professionalInfo: { specialization: "Small-animal surgery", rating: 4.9, experience: 12 },
    profileImage: { url: "https://img/anisha.jpg" },
  },
  {
    _id: "p2",
    name: "Kevin Chan",
    role: "groomer",
    // flattened shape + no image + no rating: exercises normalizer and fallbacks
    specialization: "Show grooming",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  professionalsApi.getProfessionals.mockResolvedValue({ data: PROS });
});

describe("VetNetworkSection (spotlight)", () => {
  it("fetches top-rated professionals and shows the first in the spotlight", async () => {
    render(<VetNetworkSection />);
    expect(await screen.findByText("Anisha Ramgoolam")).toBeInTheDocument();
    expect(professionalsApi.getProfessionals).toHaveBeenCalledWith({
      limit: 4,
      sortBy: "professionalInfo.rating",
      sortOrder: "desc",
    });
    expect(screen.getByText(/Veterinarian/i)).toBeInTheDocument();
    expect(screen.getByText(/4\.9/)).toBeInTheDocument();
    expect(screen.getByText(/Small-animal surgery/)).toBeInTheDocument();
    expect(screen.getByText(/12 yrs experience/)).toBeInTheDocument();
  });

  it("renders one avatar button per professional and switches spotlight on click", async () => {
    render(<VetNetworkSection />);
    await screen.findByText("Anisha Ramgoolam");
    const avatars = screen.getAllByRole("button", { name: /Anisha|Kevin/ });
    expect(avatars).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Kevin Chan" }));
    expect(await screen.findByText("Kevin Chan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kevin Chan" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Show grooming/)).toBeInTheDocument();
  });

  it("shows initials monogram when the active professional has no photo", async () => {
    render(<VetNetworkSection />);
    await screen.findByText("Anisha Ramgoolam");
    fireEvent.click(screen.getByRole("button", { name: "Kevin Chan" }));
    await screen.findByText("Kevin Chan");
    // portrait monogram (KC) — avatar rail also shows initials for him
    expect(screen.getAllByText("KC").length).toBeGreaterThanOrEqual(1);
  });

  it("omits the star rating when rating is 0/missing", async () => {
    render(<VetNetworkSection />);
    await screen.findByText("Anisha Ramgoolam");
    fireEvent.click(screen.getByRole("button", { name: "Kevin Chan" }));
    await screen.findByText("Kevin Chan");
    const eyebrow = screen.getByTestId("vn-eyebrow");
    expect(eyebrow.textContent).toMatch(/Groomer/i);
    // the rating is rendered as "N.N" next to a star icon — absence of the
    // number is the real signal (the star is an svg with no text content)
    expect(eyebrow.textContent).not.toMatch(/\d\.\d/);
  });

  it("Book CTA navigates to the professional detail page", async () => {
    render(<VetNetworkSection />);
    await screen.findByText("Anisha Ramgoolam");
    fireEvent.click(screen.getByRole("button", { name: /Book with Anisha/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/appointments/professional/p1");
  });

  it("renders nothing when the API returns no professionals", async () => {
    professionalsApi.getProfessionals.mockResolvedValue({ data: [] });
    const { container } = render(<VetNetworkSection />);
    await waitFor(() => expect(container.firstChild).toBeNull());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "C:\Users\Raj\OneDrive\Documents\Pet Project\frontend"; npx vitest run src/Pages/HomePage/HomePageSections/VetNetworkSection`
Expected: FAIL — old component renders `ProfessionalCard`s; queries like "Book with Anisha", `vn-eyebrow`, monogram not found.

- [ ] **Step 3: Rewrite the component**

Replace `VetNetworkSection.jsx` entirely with:

```jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useInView, useReducedMotion } from "framer-motion";
import { FaPaw, FaStar, FaArrowRight } from "react-icons/fa";
import SkeletonCard from "../../../../Components/HelperComponents/SkeletonCard/SkeletonCard";
import professionalsApi from "../../../../Services/api/professionalsApi";
import "./VetNetworkSection.css";

const ease = [0.25, 0.46, 0.45, 0.94];

const ROLE_LABELS = {
  veterinarian: "Veterinarian",
  groomer: "Groomer",
  trainer: "Trainer",
  petTaxi: "Pet Taxi",
};

// API responses are sometimes flattened (pro.specialization) and sometimes
// nested (pro.professionalInfo.specialization) — normalize both shapes.
const info = (pro) => ({
  specialization: pro.specialization ?? pro.professionalInfo?.specialization ?? "",
  rating: pro.rating ?? pro.professionalInfo?.rating ?? 0,
  experience: pro.experience ?? pro.professionalInfo?.experience ?? null,
});

const initials = (name = "") =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

const AUTO_ADVANCE_MS = 6000;

const VetNetworkSection = () => {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);
  // Auto-advance stops permanently once the user picks an avatar, and pauses
  // while hovering — user intent always wins over the carousel timer.
  const [userTookControl, setUserTookControl] = useState(false);
  const [hovering, setHovering] = useState(false);

  const headerRef = useRef(null);
  const inView = useInView(headerRef, { once: true, amount: 0.3 });

  useEffect(() => {
    professionalsApi
      .getProfessionals({ limit: 4, sortBy: "professionalInfo.rating", sortOrder: "desc" })
      .then((res) => setProfessionals(res?.data ?? []))
      .catch((err) => console.error("Error fetching professionals:", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (reducedMotion || userTookControl || hovering || professionals.length < 2) return;
    const id = setInterval(
      () => setActive((i) => (i + 1) % professionals.length),
      AUTO_ADVANCE_MS,
    );
    return () => clearInterval(id);
  }, [reducedMotion, userTookControl, hovering, professionals.length]);

  if (!loading && professionals.length === 0) return null;

  const pro = professionals[active];
  const meta = pro ? info(pro) : null;
  const firstName = pro?.name?.split(" ")[0] ?? "";

  return (
    <section className="vn-section">
      <motion.div
        ref={headerRef}
        className="vn-header"
        initial={{ opacity: 0, y: -20 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
      >
        <div className="vn-deco" aria-hidden="true">
          <span className="vn-deco-line" />
          <FaPaw className="vn-deco-paw" />
          <span className="vn-deco-line" />
        </div>
        <h2 className="vn-title">Meet Our Veterinary Network</h2>
      </motion.div>

      {loading ? (
        <div className="vn-skeleton"><SkeletonCard variant="card" count={1} /></div>
      ) : (
        <motion.div
          className="vn-stage"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, ease }}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
        >
          <div className="vn-spotlight">
            <AnimatePresence mode="wait">
              <motion.div
                key={`portrait-${active}`}
                className="vn-portrait"
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                transition={{ duration: 0.35, ease }}
              >
                {pro.profileImage?.url ? (
                  <img src={pro.profileImage.url} alt={pro.name} loading={active === 0 ? undefined : "lazy"} />
                ) : (
                  <span className="vn-monogram" aria-hidden="true">{initials(pro.name)}</span>
                )}
              </motion.div>
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.div
                key={`bio-${active}`}
                className="vn-bio"
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                transition={{ duration: 0.35, delay: 0.05, ease }}
              >
                <p className="vn-eyebrow" data-testid="vn-eyebrow">
                  {ROLE_LABELS[pro.role] || "Professional"}
                  {meta.rating > 0 && (
                    <span className="vn-rating">
                      {" · "}<FaStar aria-hidden="true" /> {meta.rating.toFixed(1)}
                    </span>
                  )}
                </p>
                <h3 className="vn-name">{pro.name}</h3>
                <p className="vn-spec">
                  {meta.specialization}
                  {meta.experience != null && ` · ${meta.experience} yrs experience`}
                </p>
                <div className="vn-actions">
                  <motion.button
                    type="button"
                    className="vn-book-btn"
                    onClick={() => navigate(`/appointments/professional/${pro._id || pro.id}`)}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    Book with {firstName}
                  </motion.button>
                  <button
                    type="button"
                    className="vn-all-link"
                    onClick={() => navigate("/appointments")}
                  >
                    View all professionals <FaArrowRight size={11} aria-hidden="true" />
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {professionals.length > 1 && (
            <div className="vn-rail" role="group" aria-label="Choose a professional">
              {professionals.map((p, i) => (
                <button
                  key={p._id || p.id}
                  type="button"
                  className={`vn-avatar${i === active ? " vn-avatar--active" : ""}`}
                  aria-label={p.name}
                  aria-pressed={i === active}
                  onClick={() => { setActive(i); setUserTookControl(true); }}
                >
                  {p.profileImage?.url ? (
                    <img src={p.profileImage.url} alt="" loading="lazy" />
                  ) : (
                    <span aria-hidden="true">{initials(p.name)}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </section>
  );
};

export default VetNetworkSection;
```

- [ ] **Step 4: Rewrite the CSS**

Replace `VetNetworkSection.css` entirely with:

```css
.vn-section {
  background: var(--color-primary-forest, #001c10);
  padding: clamp(3rem, 6vw, 4.5rem) 1.5rem;
}

.vn-header { text-align: center; margin: 0 auto 2.5rem; }
.vn-deco {
  display: flex; align-items: center; justify-content: center;
  gap: 1rem; margin-bottom: 0.8rem;
}
.vn-deco-line {
  width: 64px; height: 1.5px; border-radius: 2px;
  background: var(--color-accent-gold, #d99a2b); opacity: 0.75;
}
.vn-deco-paw { color: var(--color-accent-gold, #d99a2b); font-size: 1rem; }
.vn-title {
  font-family: var(--font-display) !important;
  font-size: clamp(2rem, 4.5vw, 3rem);
  color: var(--color-accent-gold, #d99a2b);
  letter-spacing: 0.06em; margin: 0;
}

.vn-skeleton { max-width: 1100px; margin: 0 auto; }

.vn-stage { max-width: 1100px; margin: 0 auto; }

.vn-spotlight {
  display: grid;
  grid-template-columns: minmax(0, 320px) minmax(0, 1fr);
  gap: 3rem;
  align-items: center;
  min-height: 340px; /* reserve height — no layout shift when switching */
}

.vn-portrait {
  width: 300px; height: 340px;
  border-radius: 150px 150px 16px 16px;
  border: 2px solid var(--color-accent-gold, #d99a2b);
  outline: 1px solid rgba(217, 154, 43, 0.35);
  outline-offset: 6px;
  overflow: hidden;
  background: #123726;
  display: flex; align-items: center; justify-content: center;
  justify-self: center;
}
.vn-portrait img { width: 100%; height: 100%; object-fit: cover; display: block; }
.vn-monogram {
  font-family: var(--font-display) !important;
  font-size: 64px;
  color: var(--color-accent-gold, #d99a2b);
}

.vn-bio { min-width: 0; }
.vn-eyebrow {
  font-family: var(--font-body);
  font-size: 0.72rem; font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--color-accent-gold, #d99a2b);
  margin: 0 0 0.5rem;
  display: flex; align-items: center; gap: 0.25rem;
}
.vn-rating { display: inline-flex; align-items: center; gap: 0.25rem; }
.vn-name {
  font-family: var(--font-display) !important;
  font-size: clamp(2rem, 4vw, 3rem);
  color: var(--color-bg-cream, #faf5f1);
  line-height: 1.02; margin: 0 0 0.6rem;
}
.vn-spec {
  font-family: var(--font-body);
  font-size: clamp(0.9rem, 1.5vw, 1rem);
  color: rgba(250, 245, 241, 0.75);
  line-height: 1.6; margin: 0 0 1.6rem;
}

.vn-actions { display: flex; align-items: center; gap: 1.1rem; flex-wrap: wrap; }
.vn-book-btn {
  font-family: var(--font-body); font-size: 0.92rem; font-weight: 600;
  color: var(--color-primary-forest, #001c10);
  background: var(--color-accent-gold, #d99a2b);
  border: none; border-radius: 50px;
  padding: 0.8rem 2rem; cursor: pointer;
  transition: background 0.2s ease;
}
.vn-book-btn:hover { background: #c48a24; }
.vn-all-link {
  display: inline-flex; align-items: center; gap: 0.4rem;
  font-family: var(--font-body); font-size: 0.88rem; font-weight: 600;
  color: var(--color-bg-cream, #faf5f1);
  background: none; border: none; cursor: pointer; padding: 0.5rem 0;
  opacity: 0.85; transition: opacity 0.2s ease, gap 0.2s ease;
}
.vn-all-link:hover { opacity: 1; gap: 0.6rem; }

.vn-rail {
  display: flex; justify-content: center; align-items: center;
  gap: 0.9rem; margin-top: 2.2rem; flex-wrap: wrap;
}
.vn-avatar {
  width: 56px; height: 56px; border-radius: 50%;
  padding: 0; border: none; cursor: pointer;
  background: #123726; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  opacity: 0.55; transition: opacity 0.2s ease, transform 0.2s ease;
  font-family: var(--font-display) !important;
  font-size: 1.1rem; color: var(--color-accent-gold, #d99a2b);
}
.vn-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.vn-avatar:hover { opacity: 1; transform: scale(1.06); }
.vn-avatar--active {
  opacity: 1;
  outline: 2px solid var(--color-accent-gold, #d99a2b);
  outline-offset: 3px;
}
.vn-avatar:focus-visible {
  outline: 2px solid var(--color-accent-gold, #d99a2b);
  outline-offset: 3px;
}

/* Tablet 641–1023px: keep two columns, tighten */
@media (max-width: 1023px) {
  .vn-spotlight { grid-template-columns: minmax(0, 240px) minmax(0, 1fr); gap: 2rem; }
  .vn-portrait { width: 220px; height: 250px; border-radius: 110px 110px 12px 12px; }
  .vn-name { font-size: clamp(1.8rem, 3.5vw, 2.4rem); }
}

/* Phone ≤640px: single centered column */
@media (max-width: 640px) {
  .vn-spotlight { grid-template-columns: 1fr; gap: 1.5rem; min-height: 0; }
  .vn-portrait { width: 220px; height: 250px; }
  .vn-bio { text-align: center; }
  .vn-eyebrow, .vn-actions { justify-content: center; }
  .vn-actions { flex-direction: column; align-items: stretch; }
  .vn-book-btn { width: 100%; }
  .vn-all-link { justify-content: center; }
}

/* Small phone ≤380px */
@media (max-width: 380px) {
  .vn-portrait { width: 180px; height: 205px; border-radius: 90px 90px 12px 12px; }
  .vn-name { font-size: 1.7rem; }
  .vn-avatar { width: 48px; height: 48px; }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd "C:\Users\Raj\OneDrive\Documents\Pet Project\frontend"; npx vitest run src/Pages/HomePage/HomePageSections/VetNetworkSection`
Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
cd "C:\Users\Raj\OneDrive\Documents\Pet Project\frontend"
git add src/Pages/HomePage/HomePageSections/VetNetworkSection
git commit -m "feat(home): vet network spotlight — crossfading featured professional + avatar rail

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: PetCareTipsSection → Editorial Index

**Files:**
- Rewrite: `src/Pages/HomePage/HomePageSections/PetCareTipsSection/PetCareTipsSection.jsx`
- Rewrite: `src/Pages/HomePage/HomePageSections/PetCareTipsSection/PetCareTipsSection.css`
- Test (create): `src/Pages/HomePage/HomePageSections/PetCareTipsSection/PetCareTipsSection.test.jsx`

**Interfaces:**
- Consumes: `tipsApi.getTips({ limit: 3 })` → `{ data: [{ _id, slug, title, category, animalType, readTime?, coverImage? }] }`; `coverUrl(cover)` from `src/utils/coverImage.js` (handles `{url}` object or string, returns `""` when absent).
- Produces: default export `PetCareTipsSection` (unchanged name). The rewrite REMOVES the imports of `TipCard` and `../../../PetCareTips/PetCareTips.css` from this file (both remain used by the /pet-care-tips page — do not delete those files).

- [ ] **Step 1: Write the failing tests**

Create `src/Pages/HomePage/HomePageSections/PetCareTipsSection/PetCareTipsSection.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const FRAMER_PROPS = new Set([
    "initial", "animate", "exit", "transition", "whileInView", "whileHover",
    "whileTap", "viewport", "layoutId", "layout", "variants",
  ]);
  const motion = new Proxy({}, {
    get: (_t, tag) =>
      React.forwardRef(({ children, ...props }, ref) => {
        const rest = {};
        for (const k of Object.keys(props)) if (!FRAMER_PROPS.has(k)) rest[k] = props[k];
        return React.createElement(tag, { ref, ...rest }, children);
      }),
  });
  return {
    motion,
    AnimatePresence: ({ children }) => children,
    useInView: () => true,
    useReducedMotion: () => true,
  };
});

vi.mock("../../../../Services/api/tipsApi", () => ({
  default: { getTips: vi.fn() },
}));

import tipsApi from "../../../../Services/api/tipsApi";
import PetCareTipsSection from "./PetCareTipsSection";

const TIPS = [
  { _id: "t1", slug: "crate-training", title: "Crate training without tears",
    category: "Behaviour", animalType: "dog", readTime: 4,
    coverImage: { url: "https://img/crate.jpg" } },
  { _id: "t2", slug: "canary-cage", title: "Setting up the perfect canary cage",
    category: "Health", animalType: "bird", readTime: 3 }, // no cover image
  { _id: "t3", slug: "monsoon-skin", title: "Monsoon skincare for short coats",
    category: "Grooming", animalType: "dog" }, // no readTime
];

const renderSection = () =>
  render(<MemoryRouter><PetCareTipsSection /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  tipsApi.getTips.mockResolvedValue({ data: TIPS });
});

describe("PetCareTipsSection (editorial index)", () => {
  it("fetches 3 tips and renders numbered rows linking to detail pages", async () => {
    renderSection();
    await screen.findByText("Crate training without tears");
    expect(tipsApi.getTips).toHaveBeenCalledWith({ limit: 3 });
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
    expect(screen.getByText("03")).toBeInTheDocument();
    const row = screen.getByRole("link", { name: /Crate training/ });
    expect(row).toHaveAttribute("href", "/pet-care-tips/crate-training");
  });

  it("hovering a row makes it active — its title shows in the frame caption", async () => {
    renderSection();
    await screen.findByText("Setting up the perfect canary cage");
    fireEvent.mouseEnter(screen.getByRole("link", { name: /canary cage/ }));
    const caption = screen.getByTestId("pcts-frame-caption");
    expect(caption.textContent).toMatch(/canary cage/);
  });

  it("shows the paw fallback in the frame when the active tip has no cover", async () => {
    renderSection();
    await screen.findByText("Setting up the perfect canary cage");
    fireEvent.mouseEnter(screen.getByRole("link", { name: /canary cage/ }));
    expect(screen.getByTestId("pcts-frame-fallback")).toBeInTheDocument();
  });

  it("omits read time from meta when missing", async () => {
    renderSection();
    await screen.findByText("Monsoon skincare for short coats");
    const row = screen.getByRole("link", { name: /Monsoon skincare/ });
    expect(row.textContent).toMatch(/DOG · GROOMING/i);
    expect(row.textContent).not.toMatch(/min read/i);
  });

  it("renders nothing when the API returns no tips", async () => {
    tipsApi.getTips.mockResolvedValue({ data: [] });
    const { container } = renderSection();
    await waitFor(() => expect(container.firstChild).toBeNull());
  });

  it("View All Articles links to the tips page", async () => {
    renderSection();
    await screen.findByText("Crate training without tears");
    expect(screen.getByRole("link", { name: /View All Articles/i }))
      .toHaveAttribute("href", "/pet-care-tips");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "C:\Users\Raj\OneDrive\Documents\Pet Project\frontend"; npx vitest run src/Pages/HomePage/HomePageSections/PetCareTipsSection`
Expected: FAIL — old component renders TipCards; "01", frame caption, fallback testids not found.

- [ ] **Step 3: Rewrite the component**

Replace `PetCareTipsSection.jsx` entirely with:

```jsx
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useInView, useReducedMotion } from "framer-motion";
import { FaPaw, FaArrowRight } from "react-icons/fa";
import tipsApi from "../../../../Services/api/tipsApi";
import { coverUrl } from "../../../../utils/coverImage";
import "./PetCareTipsSection.css";

const ease = [0.25, 0.46, 0.45, 0.94];

const metaLine = (tip) =>
  [tip.animalType, tip.category, tip.readTime ? `${tip.readTime} min read` : null]
    .filter(Boolean)
    .join(" · ");

const PetCareTipsSection = () => {
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);
  const reducedMotion = useReducedMotion();

  const headerRef = useRef(null);
  const inView = useInView(headerRef, { once: true, amount: 0.3 });

  useEffect(() => {
    tipsApi
      .getTips({ limit: 3 })
      .then((res) => setTips(res?.data ?? []))
      .catch((err) => console.error("Error fetching pet care tips:", err))
      .finally(() => setLoading(false));
  }, []);

  if (!loading && tips.length === 0) return null;

  const activeTip = tips[active];
  const activeCover = activeTip ? coverUrl(activeTip.coverImage) : "";

  return (
    <section className="pcts-section">
      <motion.div
        ref={headerRef}
        className="pcts-header"
        initial={{ opacity: 0, y: -20 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
      >
        <div className="pcts-deco" aria-hidden="true">
          <span className="pcts-deco-line" />
          <FaPaw className="pcts-deco-paw" />
          <span className="pcts-deco-line" />
        </div>
        <h2 className="pcts-title">Pet Care Tips</h2>
        <p className="pcts-script">advice from our vets</p>
      </motion.div>

      {!loading && (
        <div className="pcts-editorial">
          <ol className="pcts-index">
            {tips.map((tip, i) => (
              <motion.li
                key={tip._id || tip.slug}
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.45, delay: i * 0.08, ease }}
              >
                <Link
                  to={`/pet-care-tips/${tip.slug || tip._id}`}
                  className={`pcts-row${i === active ? " pcts-row--active" : ""}`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                >
                  <span className="pcts-thumb" aria-hidden="true">
                    {coverUrl(tip.coverImage) ? (
                      <img src={coverUrl(tip.coverImage)} alt="" loading="lazy" />
                    ) : (
                      <FaPaw className="pcts-thumb-paw" />
                    )}
                  </span>
                  <span className="pcts-num" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="pcts-rowbody">
                    <span className="pcts-rowtitle">{tip.title}</span>
                    <span className="pcts-rowmeta">{metaLine(tip)}</span>
                  </span>
                  <FaArrowRight className="pcts-rowarrow" aria-hidden="true" />
                </Link>
              </motion.li>
            ))}
          </ol>

          <div className="pcts-frame" aria-hidden="true">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTip?._id || active}
                className="pcts-frame-media"
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                transition={{ duration: 0.4, ease }}
              >
                {activeCover ? (
                  <img src={activeCover} alt="" />
                ) : (
                  <span className="pcts-frame-fallback" data-testid="pcts-frame-fallback">
                    <FaPaw />
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
            <span className="pcts-frame-caption" data-testid="pcts-frame-caption">
              {activeTip?.title}
            </span>
          </div>
        </div>
      )}

      <div className="pcts-cta-row">
        <Link to="/pet-care-tips" className="pcts-cta-btn">View All Articles</Link>
      </div>
    </section>
  );
};

export default PetCareTipsSection;
```

- [ ] **Step 4: Rewrite the CSS**

Replace `PetCareTipsSection.css` entirely. NOTE: check the current file first
and keep the existing `.pcts-cta-row` / `.pcts-cta-btn` rules verbatim
(spec: reuse the existing CTA pill); everything else below.

```css
.pcts-section {
  background: var(--color-bg-cream, #faf5f1);
  padding: clamp(3rem, 6vw, 4.5rem) 1.5rem;
}

.pcts-header { text-align: center; margin: 0 auto 2.5rem; }
.pcts-deco {
  display: flex; align-items: center; justify-content: center;
  gap: 1rem; margin-bottom: 0.8rem;
}
.pcts-deco-line {
  width: 64px; height: 1.5px; border-radius: 2px;
  background: var(--color-accent-gold, #d99a2b); opacity: 0.6;
}
.pcts-deco-paw { color: var(--color-accent-gold, #d99a2b); font-size: 1rem; }
.pcts-title {
  font-family: var(--font-display) !important;
  font-size: clamp(2rem, 4.5vw, 3rem);
  color: var(--color-primary-forest, #001c10);
  letter-spacing: 0.06em; margin: 0;
}
.pcts-script {
  font-family: var(--font-script) !important;
  font-size: clamp(1.3rem, 2.5vw, 1.7rem);
  color: var(--color-accent-gold, #d99a2b);
  margin: 0.2rem 0 0;
}

.pcts-editorial {
  max-width: 1100px; margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 3rem;
  align-items: stretch;
}

.pcts-index { list-style: none; margin: 0; padding: 0; }
.pcts-index li + li .pcts-row { border-top: 1px solid #e8e0d2; }

.pcts-row {
  display: flex; align-items: center; gap: 1.1rem;
  padding: clamp(0.9rem, 2vw, 1.3rem) 0.5rem;
  text-decoration: none !important;
  min-height: 64px;
}
.pcts-thumb { display: none; } /* thumbnails are a phone-only affordance */

.pcts-num {
  font-family: var(--font-display) !important;
  font-size: 2rem; line-height: 1;
  color: #c9bfae;
  transition: color 0.25s ease;
  min-width: 2.4rem;
}
.pcts-row--active .pcts-num { color: var(--color-accent-gold, #d99a2b); }

.pcts-rowbody { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
.pcts-rowtitle {
  font-family: var(--font-body);
  font-size: clamp(1rem, 1.8vw, 1.15rem); font-weight: 600;
  color: var(--color-primary-forest, #001c10);
  position: relative; width: fit-content;
}
.pcts-rowtitle::after {
  content: ""; position: absolute; left: 0; bottom: -3px;
  width: 100%; height: 2px;
  background: var(--color-accent-gold, #d99a2b);
  transform: scaleX(0); transform-origin: left;
  transition: transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
.pcts-row--active .pcts-rowtitle::after { transform: scaleX(1); }
.pcts-rowmeta {
  font-family: var(--font-body);
  font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase;
  color: #8a8272;
}
.pcts-rowarrow {
  margin-left: auto; flex-shrink: 0;
  color: var(--color-accent-gold, #d99a2b);
  opacity: 0; transform: translateX(-6px);
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.pcts-row--active .pcts-rowarrow { opacity: 1; transform: translateX(0); }
.pcts-row:focus-visible {
  outline: 2px solid var(--color-accent-gold, #d99a2b);
  outline-offset: 2px; border-radius: 8px;
}

.pcts-frame {
  position: relative; border-radius: 16px; overflow: hidden;
  min-height: 300px; background: var(--color-primary-forest, #001c10);
}
.pcts-frame-media { position: absolute; inset: 0; }
.pcts-frame-media img {
  width: 100%; height: 100%; object-fit: cover; display: block;
}
.pcts-frame-fallback {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: var(--color-accent-gold, #d99a2b);
  font-size: 56px; opacity: 0.5;
}
.pcts-frame-caption {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 1;
  background: rgba(0, 28, 16, 0.75);
  color: var(--color-bg-cream, #faf5f1);
  font-family: var(--font-body); font-size: 0.85rem;
  padding: 0.7rem 1rem;
}

/* Tablet 768–1023px: keep frame, narrower */
@media (max-width: 1023px) {
  .pcts-editorial { grid-template-columns: minmax(0, 1fr) 280px; gap: 2rem; }
  .pcts-rowtitle { font-size: 1.05rem; }
}

/* Phone ≤767px: frame hidden, rows gain thumbnails, numbers dropped */
@media (max-width: 767px) {
  .pcts-editorial { grid-template-columns: 1fr; gap: 0; }
  .pcts-frame { display: none; }
  .pcts-num { display: none; }
  .pcts-thumb {
    display: flex; align-items: center; justify-content: center;
    width: 64px; height: 64px; border-radius: 12px; overflow: hidden;
    background: var(--color-primary-forest, #001c10); flex-shrink: 0;
  }
  .pcts-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .pcts-thumb-paw { color: var(--color-accent-gold, #d99a2b); font-size: 22px; opacity: 0.6; }
  .pcts-rowarrow { opacity: 1; transform: none; }
}

/* Small phone ≤380px */
@media (max-width: 380px) {
  .pcts-thumb { width: 52px; height: 52px; }
  .pcts-rowtitle { font-size: 0.95rem; }
}
```

Then append the existing `.pcts-cta-row` / `.pcts-cta-btn` rules copied verbatim from the current file.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd "C:\Users\Raj\OneDrive\Documents\Pet Project\frontend"; npx vitest run src/Pages/HomePage/HomePageSections/PetCareTipsSection`
Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
cd "C:\Users\Raj\OneDrive\Documents\Pet Project\frontend"
git add src/Pages/HomePage/HomePageSections/PetCareTipsSection
git commit -m "feat(home): pet care tips editorial index — numbered rows + crossfading image frame

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Live responsive verification + full suite + graph update

**Files:**
- No source changes expected (fix-ups only if verification finds issues).

**Interfaces:**
- Consumes: the two rewritten sections on the running dev server (user's frontend at http://localhost:5173).

- [ ] **Step 1: Full frontend suite**

Run: `cd "C:\Users\Raj\OneDrive\Documents\Pet Project\frontend"; npx vitest run --reporter=dot`
Expected: all test files pass (≥879 tests; one known DB-independent flake may need a single rerun — rerun once before investigating).

- [ ] **Step 2: Live check — desktop**

Open http://localhost:5173/ in the Browser pane at desktop width. Scroll to both sections and verify: spotlight shows top professional with gold arch portrait (or monogram), avatar click crossfades, auto-advance ticks after 6s and pauses on hover; tips index rows highlight on hover and drive the image frame crossfade; caption matches hovered row.

- [ ] **Step 3: Live check — responsive matrix**

Resize viewport to 1440, 1024, 768, 640, 375, 320 px. At each width check both sections for: no horizontal overflow (`document.documentElement.scrollWidth <= window.innerWidth`), touch targets ≥44px (avatars, rows), no text clipping in the arch frame or index rows, tablet keeps two columns, phone stacks/shows thumbnails.

- [ ] **Step 4: Screenshot proof**

Take screenshots of both sections at desktop and 375px and share them in the final summary.

- [ ] **Step 5: Update the knowledge graph**

Run: `cd "C:\Users\Raj\OneDrive\Documents\Pet Project\frontend"; graphify update .`
Expected: "Code graph updated" (graphify-out is gitignored in frontend — nothing to commit).

- [ ] **Step 6: Fix-up commit (only if steps 2–3 found issues)**

Any CSS/JSX fixes found during live verification:

```bash
cd "C:\Users\Raj\OneDrive\Documents\Pet Project\frontend"
git add src/Pages/HomePage/HomePageSections
git commit -m "fix(home): responsive fix-ups from live verification of spotlight + editorial sections

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
