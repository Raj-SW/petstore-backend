<!-- Mirror copy. Canonical: docs/superpowers/plans/2026-07-15-trust-story-band.md -->

# Trust Story Band Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the homepage `StatsSection` as a light "trust story" band — mission row, count-up trust strip, and a featured testimonial note fed by a drifting marquee wall of quote chips.

**Architecture:** One section component rewrite (StatsSection.jsx/css/test). The marquee is pure CSS animation over a duplicated chip track; the featured note is framer-motion `AnimatePresence`; counters use framer's `animate()` on scroll-into-view. All data comes from the existing `feedbackApi` with the existing hardcoded fallback.

**Tech Stack:** React 18, framer-motion (`AnimatePresence`, `useInView`, `useReducedMotion`, `animate`), react-icons, plain CSS, Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-07-15-trust-story-band-design.md` (backend repo). Read it before starting.

## Global Constraints

- Frontend repo: `C:\Users\Raj\OneDrive\Documents\Pet Project\frontend`, branch `fix/audit-2026-07-14`.
- Band background `#FFFFFF`; paper `--color-bg-cream` #FAF5F1 / `--color-bg-warm-ivory` #F6ECE3, borders `#EFE6D8`; gold `--color-accent-gold` #D99A2B; forest `--color-primary-forest` #001C10 **as text only — never a background fill** (exception: none). House ease `[0.25, 0.46, 0.45, 0.94]`.
- Quotes render in `--font-body` italic (never script at paragraph length).
- No new npm dependencies. Homepage only — no other files.
- Marquee tracks must sit inside an `overflow-x: hidden` wrapper (the duplicated track must never widen the page).
- Auto-advance 7s: pauses on hover, stops permanently on any user selection, disabled under reduced motion or with < 2 testimonials.
- Fix the heading typo: "What Our Clients Say" (was "Client").
- All type via `clamp()`; breakpoints 1024 / 767 / 380 px.
- Never `git push`.

---

### Task 1: StatsSection → Trust Story Band

**Files:**
- Rewrite: `src/Pages/HomePage/HomePageSections/StatsSection.jsx`
- Rewrite: `src/Pages/HomePage/HomePageSections/StatsSection.css`
- Rewrite: `src/Pages/HomePage/HomePageSections/StatsSection.test.jsx`

**Interfaces:**
- Consumes: `feedbackApi.getFeedback({ limit: 12 })` → `{ data: [{ _id, name, role?, rating?, message, photos?: [(string|{url})] }] }`. Asset `../../../assets/StatsSection/vet-with-dog.jpg`.
- Produces: default export `StatsSection` (unchanged name — HomePage.jsx import untouched). The 9 `slide-*.webp` imports and `SLIDE_IMAGES` are deleted (files stay in the repo; Gallery uses slide-2-a.webp).

- [ ] **Step 1: Write the failing tests**

Replace `src/Pages/HomePage/HomePageSections/StatsSection.test.jsx` entirely with:

```jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

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
    useReducedMotion: () => true, // counters render final values; marquee static
    // count-up helper: jump straight to the target so tests are deterministic
    animate: (_from, to, opts) => { opts?.onUpdate?.(to); return { stop: () => {} }; },
  };
});

vi.mock("../../../Services/api/feedbackApi", () => ({
  default: { getFeedback: vi.fn() },
}));

vi.mock("../../../assets/StatsSection/vet-with-dog.jpg", () => ({ default: "vet.jpg" }));

import feedbackApi from "../../../Services/api/feedbackApi";
import StatsSection from "./StatsSection";

const FEEDBACK = [
  { _id: "f1", name: "Amina Joomun", role: "Dog mum", rating: 5,
    message: "The veterinary team diagnosed my dog quickly and the follow-up care was outstanding.",
    photos: [{ url: "https://img/amina.jpg" }] },
  { _id: "f2", name: "Kevin Chan", rating: 4,
    message: "Grooming is exceptional and my cat actually enjoys going there now." },
  { _id: "f3", name: "Priya Nair", rating: 0,
    message: "Lovely welcoming team, my rabbit felt at home." },
];

beforeEach(() => {
  vi.clearAllMocks();
  feedbackApi.getFeedback.mockResolvedValue({ data: FEEDBACK });
});

describe("StatsSection (trust story band)", () => {
  it("fetches feedback and features the first testimonial with author and stars", async () => {
    render(<StatsSection />);
    expect(await screen.findByText(/follow-up care was outstanding/)).toBeInTheDocument();
    expect(feedbackApi.getFeedback).toHaveBeenCalledWith({ limit: 12 });
    expect(screen.getByText(/Amina Joomun/)).toBeInTheDocument();
    // both the featured note and Amina's chip carry the label — assert at least one
    expect(screen.getAllByLabelText("Rated 5 out of 5").length).toBeGreaterThanOrEqual(1);
  });

  it("falls back to hardcoded testimonials when the API rejects", async () => {
    feedbackApi.getFeedback.mockRejectedValue(new Error("boom"));
    render(<StatsSection />);
    expect(await screen.findByText(/John Corner, Melbourne/)).toBeInTheDocument();
  });

  it("computes the live average rating from rated items only", async () => {
    render(<StatsSection />);
    await screen.findByText(/follow-up care was outstanding/);
    // (5 + 4) / 2 = 4.5 — the rating-0 item is excluded
    expect(screen.getByText("4.5★")).toBeInTheDocument();
  });

  it("uses the fallback average when no items carry ratings", async () => {
    feedbackApi.getFeedback.mockResolvedValue({
      data: [{ _id: "x", name: "NoStars", rating: 0, message: "nice" }],
    });
    render(<StatsSection />);
    await screen.findByText(/nice/);
    expect(screen.getByText("4.8★")).toBeInTheDocument();
  });

  it("clicking a marquee chip features that testimonial and marks it pressed", async () => {
    render(<StatsSection />);
    await screen.findByText(/follow-up care was outstanding/);
    const chip = screen.getByRole("button", { name: /Kevin/ });
    fireEvent.click(chip);
    expect(await screen.findByText(/enjoys going there now/)).toBeInTheDocument();
    expect(chip).toHaveAttribute("aria-pressed", "true");
  });

  it("shows a monogram disc when the featured testimonial has no photo", async () => {
    render(<StatsSection />);
    await screen.findByText(/follow-up care was outstanding/);
    fireEvent.click(screen.getByRole("button", { name: /Kevin/ }));
    await screen.findByText(/enjoys going there now/);
    expect(screen.getByTestId("ts-monogram").textContent).toBe("K");
  });

  it("reduced motion renders the marquee as a static grid without duplicate chips", async () => {
    render(<StatsSection />);
    await screen.findByText(/follow-up care was outstanding/);
    // one chip per testimonial — no aria-hidden duplicate track
    const chips = screen.getAllByRole("button", { name: /Amina|Kevin|Priya/ });
    expect(chips).toHaveLength(3);
    expect(document.querySelector(".ts-track[aria-hidden]")).toBeNull();
  });

  it("renders the mission headline and all three trust labels", async () => {
    render(<StatsSection />);
    await screen.findByText(/follow-up care was outstanding/);
    expect(screen.getByText(/at the heart of everything we do/i)).toBeInTheDocument();
    expect(screen.getByText("Successful Relocations")).toBeInTheDocument();
    expect(screen.getByText("Certified Professionals")).toBeInTheDocument();
    expect(screen.getByText("Average Rating")).toBeInTheDocument();
  });

  it("dot N selects testimonial N", async () => {
    render(<StatsSection />);
    await screen.findByText(/follow-up care was outstanding/);
    fireEvent.click(screen.getByRole("button", { name: "Go to testimonial 3" }));
    expect(await screen.findByText(/rabbit felt at home/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "C:\Users\Raj\OneDrive\Documents\Pet Project\frontend"; npx vitest run src/Pages/HomePage/HomePageSections/StatsSection.test.jsx`
Expected: FAIL — old component lacks `4.5★`, chips, `ts-monogram`, trust labels.

- [ ] **Step 3: Rewrite the component**

Replace `StatsSection.jsx` entirely with:

```jsx
import { useState, useEffect, useRef } from "react";
import {
  motion, AnimatePresence, useInView, useReducedMotion, animate,
} from "framer-motion";
import { FaPaw, FaStar, FaRegStar } from "react-icons/fa";
import feedbackApi from "../../../Services/api/feedbackApi";
import vetWithDogImg from "../../../assets/StatsSection/vet-with-dog.jpg";
import "./StatsSection.css";

const ease = [0.25, 0.46, 0.45, 0.94];
const toPhotoUrl = (p) => (typeof p === "string" ? p : p?.url);

// Fallback when the API errors or returns nothing (kept from the old section).
const TESTIMONIALS = [
  { id: 1, author: "John Corner, Melbourne", rating: 5,
    text: "So far, this pet shop has proven to be the best in the area when it comes to providing expert and reliable services for pet owners. Their team operates with genuine care and passion." },
  { id: 2, author: "Sarah Mitchell, Sydney", rating: 5,
    text: "I've been bringing my golden retriever here for over two years. The staff is knowledgeable, kind, and truly passionate about what they do. Couldn't recommend them more." },
  { id: 3, author: "David Lim, Auckland", rating: 5,
    text: "The grooming service is exceptional and my cat actually enjoys going there now. The products are top-notch and the team always gives the best advice." },
  { id: 4, author: "Priya Nair, Wellington", rating: 5,
    text: "Absolutely love this place. From the moment we walked in, the team made both me and my rabbit feel welcome. The care they provide is second to none." },
  { id: 5, author: "James Okafor, Brisbane", rating: 5,
    text: "Five stars without hesitation. The veterinary team diagnosed my dog quickly and the follow-up care was outstanding. This is the only pet store I'll ever trust." },
];

// Placeholder truth — swap real figures here. value: null = live average rating.
const TRUST_STATS = [
  { value: 100, suffix: "+", decimals: 0, label: "Successful Relocations" },
  { value: 11, suffix: "", decimals: 0, label: "Certified Professionals" },
  { value: null, suffix: "★", decimals: 1, label: "Average Rating", fallback: 4.8 },
];

const AUTO_ADVANCE_MS = 7000;
const initialOf = (author = "") => (author.trim()[0] || "?").toUpperCase();
const firstNameOf = (author = "") => author.split(/[\s,]+/).filter(Boolean)[0] || "";

// Gold count-up numeral; renders the final value immediately under reduced motion.
const CountUp = ({ to, decimals, suffix }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduced = useReducedMotion();
  const [val, setVal] = useState(reduced ? to : 0);
  useEffect(() => {
    if (!inView) return undefined;
    if (reduced) { setVal(to); return undefined; }
    const controls = animate(0, to, {
      duration: 1.2, ease, onUpdate: (v) => setVal(v),
    });
    return () => controls.stop();
  }, [inView, reduced, to]);
  return (
    <span ref={ref} className="ts-stat-value">
      {val.toFixed(decimals)}{suffix}
    </span>
  );
};

const Stars = ({ rating, size = 14 }) => {
  if (!rating || rating <= 0) return null;
  const full = Math.round(rating);
  return (
    <span className="ts-stars" aria-label={`Rated ${rating} out of 5`}>
      {Array.from({ length: 5 }, (_, i) =>
        i < full
          ? <FaStar key={i} size={size} aria-hidden="true" />
          : <FaRegStar key={i} size={size} className="ts-star-empty" aria-hidden="true" />
      )}
    </span>
  );
};

const StatsSection = () => {
  const reduced = useReducedMotion();
  const [testimonials, setTestimonials] = useState(TESTIMONIALS);
  const [avgRating, setAvgRating] = useState(null);
  const [active, setActive] = useState(0);
  const [userTookControl, setUserTookControl] = useState(false);
  const [hovering, setHovering] = useState(false);

  const missionRef = useRef(null);
  const missionInView = useInView(missionRef, { once: true, amount: 0.3 });

  useEffect(() => {
    feedbackApi
      .getFeedback({ limit: 12 })
      .then((res) => {
        const items = res?.data;
        if (Array.isArray(items) && items.length > 0) {
          setTestimonials(
            items.map((fb, i) => ({
              id: fb._id || i,
              author: fb.role ? `${fb.name}, ${fb.role}` : fb.name,
              text: fb.message,
              rating: fb.rating,
              photos: (fb.photos || []).map(toPhotoUrl).filter(Boolean),
            }))
          );
          const rated = items.filter((fb) => Number(fb.rating) > 0);
          if (rated.length > 0) {
            setAvgRating(rated.reduce((s, fb) => s + Number(fb.rating), 0) / rated.length);
          }
        }
      })
      .catch(() => { /* keep hardcoded fallback */ });
  }, []);

  useEffect(() => {
    if (reduced || userTookControl || hovering || testimonials.length < 2) return undefined;
    const id = setInterval(
      () => setActive((i) => (i + 1) % testimonials.length),
      AUTO_ADVANCE_MS,
    );
    return () => clearInterval(id);
  }, [reduced, userTookControl, hovering, testimonials.length]);

  const pick = (i) => { setActive(i); setUserTookControl(true); };

  const featured = testimonials[active];
  const photo = featured?.photos?.[0];

  // Two drifting rows when there's enough material, otherwise one.
  const twoRows = testimonials.length >= 6;
  const rows = twoRows
    ? [testimonials.filter((_, i) => i % 2 === 0), testimonials.filter((_, i) => i % 2 === 1)]
    : [testimonials];

  const chip = (t) => {
    const i = testimonials.indexOf(t);
    return (
      <button
        key={t.id}
        type="button"
        className={`ts-chip${i === active ? " ts-chip--active" : ""}`}
        aria-pressed={i === active}
        onClick={() => pick(i)}
      >
        <Stars rating={t.rating} size={9} />
        <span className="ts-chip-quote">{t.text.slice(0, 60)}…</span>
        <span className="ts-chip-name">— {firstNameOf(t.author)}</span>
      </button>
    );
  };

  return (
    <section className="ts-band">
      {/* ── 1. Mission ── */}
      <div className="ts-mission" ref={missionRef}>
        <motion.div
          className="ts-mission-media"
          initial={reduced ? { opacity: 0 } : { opacity: 0, x: -40 }}
          animate={missionInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.6, ease }}
        >
          <img src={vetWithDogImg} alt="Veterinarian examining a dog" loading="lazy" />
        </motion.div>
        <motion.div
          className="ts-mission-copy"
          initial={reduced ? { opacity: 0 } : { opacity: 0, x: 40 }}
          animate={missionInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1, ease }}
        >
          <p className="ts-eyebrow">Our Promise</p>
          <h2 className="ts-mission-heading">
            Your pets, at the heart of everything we do
          </h2>
          <p className="ts-mission-body">
            From grooming to wellness, we cover every aspect of your pet's
            needs. Our team stays updated on the latest in pet care to provide
            the best solutions for you and your furry friends.
          </p>
        </motion.div>
      </div>

      {/* ── 2. Trust strip ── */}
      <div className="ts-strip">
        {TRUST_STATS.map((s) => (
          <div key={s.label} className="ts-stat">
            <CountUp
              to={s.value ?? avgRating ?? s.fallback}
              decimals={s.decimals}
              suffix={s.suffix}
            />
            <span className="ts-stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── 3. Wall of love ── */}
      <div
        className="ts-wall"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div className="ts-header">
          <div className="ts-deco" aria-hidden="true">
            <span className="ts-deco-line" />
            <FaPaw className="ts-deco-paw" />
            <span className="ts-deco-line" />
          </div>
          <h3 className="ts-title">What Our Clients Say</h3>
          <p className="ts-script">real words from real pet parents</p>
        </div>

        <div className="ts-note-stage" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.figure
              key={featured?.id ?? active}
              className="ts-note"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 18, rotate: -1.5 }}
              animate={{ opacity: 1, y: 0, rotate: 0.5 }}
              exit={{ opacity: 0, y: -14, transition: { duration: 0.18 } }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
            >
              <div className="ts-polaroid" aria-hidden="true">
                {photo ? (
                  <img src={photo} alt="" loading="lazy" />
                ) : (
                  <span className="ts-monogram" data-testid="ts-monogram">
                    {initialOf(featured?.author)}
                  </span>
                )}
              </div>
              <div className="ts-note-body">
                <Stars rating={featured?.rating} />
                <blockquote className="ts-quote">{featured?.text}</blockquote>
                <figcaption className="ts-author">— {featured?.author}</figcaption>
              </div>
            </motion.figure>
          </AnimatePresence>
        </div>

        <div className="ts-dots">
          {testimonials.map((t, i) => (
            <button
              key={t.id}
              type="button"
              className={`ts-dot${i === active ? " ts-dot--active" : ""}`}
              aria-label={`Go to testimonial ${i + 1}`}
              onClick={() => pick(i)}
            />
          ))}
        </div>

        <div className={`ts-marquee${reduced ? " ts-marquee--static" : ""}`}>
          {rows.map((row, r) => (
            <div key={r} className={`ts-row ts-row--${r === 1 ? "reverse" : "forward"}`}>
              <div className="ts-track">{row.map(chip)}</div>
              {!reduced && (
                <div className="ts-track" aria-hidden="true">
                  {row.map((t) => {
                    const i = testimonials.indexOf(t);
                    return (
                      <button
                        key={`dup-${t.id}`}
                        type="button"
                        tabIndex={-1}
                        className={`ts-chip${i === active ? " ts-chip--active" : ""}`}
                        onClick={() => pick(i)}
                      >
                        <Stars rating={t.rating} size={9} />
                        <span className="ts-chip-quote">{t.text.slice(0, 60)}…</span>
                        <span className="ts-chip-name">— {firstNameOf(t.author)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
```

- [ ] **Step 4: Rewrite the CSS**

Replace `StatsSection.css` entirely with:

```css
.ts-band {
  background: #ffffff;
  padding: clamp(3rem, 6vw, 4.5rem) 1.5rem;
}

/* ── 1. Mission ── */
.ts-mission {
  max-width: 1100px;
  margin: 0 auto 2.8rem;
  display: grid;
  grid-template-columns: minmax(0, 300px) minmax(0, 1fr);
  gap: 3rem;
  align-items: center;
}
.ts-mission-media {
  width: 280px; height: 320px;
  border-radius: 140px 140px 16px 16px;
  border: 2px solid var(--color-accent-gold, #d99a2b);
  outline: 1px solid rgba(217, 154, 43, 0.35);
  outline-offset: 6px;
  overflow: hidden;
  justify-self: center;
}
.ts-mission-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ts-eyebrow {
  font-family: var(--font-body);
  font-size: 0.72rem; font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--color-accent-gold, #d99a2b);
  margin: 0 0 0.5rem;
}
.ts-mission-heading {
  font-family: var(--font-display) !important;
  font-size: clamp(1.9rem, 3.5vw, 2.6rem);
  letter-spacing: 0.04em; line-height: 1.05;
  color: var(--color-primary-forest, #001c10);
  margin: 0 0 0.8rem;
}
.ts-mission-body {
  font-family: var(--font-body);
  font-size: clamp(0.9rem, 1.5vw, 1rem);
  color: #5c6b60; line-height: 1.7; margin: 0; max-width: 56ch;
}

/* ── 2. Trust strip ── */
.ts-strip {
  max-width: 1100px;
  margin: 0 auto 3rem;
  display: flex; justify-content: center; gap: 3rem; flex-wrap: wrap;
  border-top: 1px solid rgba(217, 154, 43, 0.35);
  border-bottom: 1px solid rgba(217, 154, 43, 0.35);
  padding: 1.4rem 0;
}
.ts-stat { display: flex; flex-direction: column; align-items: center; gap: 0.15rem; }
.ts-stat-value {
  font-family: var(--font-display) !important;
  font-size: clamp(2rem, 4vw, 2.8rem);
  color: var(--color-accent-gold, #d99a2b);
  line-height: 1;
}
.ts-stat-label {
  font-family: var(--font-body);
  font-size: 0.8rem; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--color-primary-forest, #001c10);
}

/* ── 3. Wall of love ── */
.ts-header { text-align: center; margin-bottom: 2rem; }
.ts-deco {
  display: flex; align-items: center; justify-content: center;
  gap: 1rem; margin-bottom: 0.8rem;
}
.ts-deco-line {
  width: 64px; height: 1.5px; border-radius: 2px;
  background: var(--color-accent-gold, #d99a2b); opacity: 0.6;
}
.ts-deco-paw { color: var(--color-accent-gold, #d99a2b); font-size: 1rem; }
.ts-title {
  font-family: var(--font-display) !important;
  font-size: clamp(2rem, 4.5vw, 3rem);
  letter-spacing: 0.06em;
  color: var(--color-primary-forest, #001c10);
  margin: 0;
}
.ts-script {
  font-family: var(--font-script) !important;
  font-size: clamp(1.3rem, 2.5vw, 1.7rem);
  color: var(--color-accent-gold, #d99a2b);
  margin: 0.2rem 0 0;
}

.ts-note-stage { max-width: 640px; margin: 0 auto; min-height: 210px; }
.ts-note {
  display: flex; gap: 1.4rem; align-items: flex-start;
  background: var(--color-bg-cream, #faf5f1);
  border: 1px solid #efe6d8; border-radius: 16px;
  box-shadow: 0 14px 34px rgba(0, 28, 16, 0.08);
  padding: 1.6rem 1.8rem; margin: 0;
}
.ts-polaroid {
  flex-shrink: 0; width: 84px; height: 96px;
  background: #fff; border: 5px solid #fff; border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 28, 16, 0.15);
  transform: rotate(-5deg); overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.ts-polaroid img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ts-monogram {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  background: var(--color-bg-warm-ivory, #f6ece3);
  font-family: var(--font-display) !important;
  font-size: 2.2rem; color: var(--color-accent-gold, #d99a2b);
}
.ts-note-body { min-width: 0; }
.ts-stars { display: inline-flex; gap: 2px; color: var(--color-accent-gold, #d99a2b); }
.ts-star-empty { opacity: 0.35; }
.ts-quote {
  font-family: var(--font-body); font-style: italic;
  font-size: 1.05rem; line-height: 1.65;
  color: var(--color-primary-forest, #001c10);
  margin: 0.5rem 0 0.7rem;
  display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical;
  overflow: hidden;
}
.ts-author { font-family: var(--font-body); font-size: 0.85rem; color: #8a8272; }

.ts-dots { display: flex; justify-content: center; gap: 0.4rem; margin: 1.2rem 0 2rem; }
.ts-dot {
  width: 8px; height: 8px; padding: 0; border: none; border-radius: 9999px;
  background: #e3d9c8; cursor: pointer;
  transition: width 0.25s ease, background 0.25s ease;
}
.ts-dot--active { width: 20px; background: var(--color-accent-gold, #d99a2b); }
.ts-dot:focus-visible {
  outline: 2px solid var(--color-accent-gold, #d99a2b); outline-offset: 2px;
}

/* Marquee — pure CSS drift over a duplicated track */
.ts-marquee { overflow-x: hidden; display: grid; gap: 0.9rem; }
.ts-row { display: flex; width: max-content; }
.ts-row--forward .ts-track { animation: ts-drift 40s linear infinite; }
.ts-row--reverse .ts-track { animation: ts-drift 52s linear infinite reverse; }
.ts-row:hover .ts-track,
.ts-row:focus-within .ts-track { animation-play-state: paused; }
.ts-track { display: flex; gap: 0.9rem; padding-right: 0.9rem; }
@keyframes ts-drift {
  from { transform: translateX(0); }
  to { transform: translateX(-100%); }
}

.ts-chip {
  display: inline-flex; align-items: center; gap: 0.55rem;
  min-height: 44px;
  background: var(--color-bg-warm-ivory, #f6ece3);
  border: 1px solid #efe6d8; border-radius: 12px;
  padding: 0.6rem 1rem; cursor: pointer;
  font-family: var(--font-body);
  opacity: 0.85; transform: rotate(1deg);
  transition: opacity 0.2s ease, border-color 0.2s ease;
  white-space: nowrap;
}
.ts-chip:nth-child(even) {
  background: var(--color-bg-cream, #faf5f1);
  transform: rotate(-1deg);
}
.ts-chip:hover { opacity: 1; }
.ts-chip--active {
  opacity: 1; border-color: var(--color-accent-gold, #d99a2b);
}
.ts-chip:focus-visible {
  outline: 2px solid var(--color-accent-gold, #d99a2b); outline-offset: 2px;
}
.ts-chip-quote { font-size: 0.8rem; color: var(--color-primary-forest, #001c10); }
.ts-chip-name { font-size: 0.75rem; color: #8a8272; }

/* Reduced motion: static wrapped grid, no drift */
.ts-marquee--static .ts-row { width: auto; }
.ts-marquee--static .ts-track {
  flex-wrap: wrap; justify-content: center; animation: none; padding-right: 0;
}
.ts-marquee--static .ts-chip { white-space: normal; transform: none; }

/* ── Responsive ── */
@media (max-width: 1023px) {
  .ts-mission { grid-template-columns: minmax(0, 240px) minmax(0, 1fr); gap: 2rem; }
  .ts-mission-media { width: 220px; height: 250px; border-radius: 110px 110px 12px 12px; }
  .ts-strip { gap: 2rem; }
  .ts-note-stage { max-width: 560px; }
}

@media (max-width: 767px) {
  .ts-mission { grid-template-columns: 1fr; gap: 1.5rem; }
  .ts-mission-copy { text-align: center; }
  .ts-mission-body { margin: 0 auto; }
  .ts-strip { gap: 1.5rem; }
  .ts-note { padding: 1.2rem 1.3rem; gap: 1rem; }
  .ts-polaroid { width: 64px; height: 74px; }
}

@media (max-width: 380px) {
  .ts-stat-value { font-size: 1.6rem; }
  .ts-note { padding: 1.1rem; }
  .ts-chip-quote { max-width: 40ch; overflow: hidden; text-overflow: ellipsis; }
}
```

Layout note for the implementer: at ≤767px render remains ONE marquee row
only when `testimonials.length < 6` naturally; additionally hide the second
row on phones by adding this rule to the 767px block:

```css
  .ts-row:nth-child(2) { display: none; }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd "C:\Users\Raj\OneDrive\Documents\Pet Project\frontend"; npx vitest run src/Pages/HomePage/HomePageSections/StatsSection.test.jsx`
Expected: 9 passed. (If the chip-name query matches both original and duplicate chips under non-reduced motion — it won't here, the mock forces reduced motion — do not weaken assertions; investigate.)

- [ ] **Step 6: Full suite sanity + commit**

Run: `cd "C:\Users\Raj\OneDrive\Documents\Pet Project\frontend"; npx vitest run --reporter=dot` — expect all files green (~102 files).

```bash
cd "C:\Users\Raj\OneDrive\Documents\Pet Project\frontend"
git add src/Pages/HomePage/HomePageSections/StatsSection.jsx src/Pages/HomePage/HomePageSections/StatsSection.css src/Pages/HomePage/HomePageSections/StatsSection.test.jsx
git commit -m "feat(home): trust story band — mission, count-up stats, featured note + marquee wall

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Live verification + graph update

**Files:**
- No source changes expected (fix-ups only if verification finds issues).

**Interfaces:**
- Consumes: the rebuilt section on the user's dev server at http://localhost:5173.

- [ ] **Step 1: Desktop checks**

Open http://localhost:5173/ in the Browser pane, scroll to the band. Verify: white background (no dark fill anywhere in the section); count-up plays when the strip scrolls into view; featured note shows quote/stars/author with polaroid or monogram; marquee rows drift in opposite directions and pause on hover; clicking a chip lifts it into the featured note and stops auto-advance; dots work.

- [ ] **Step 2: Responsive matrix**

Check at 1440, 1024, 768, 640, 375, 320 px: no horizontal overflow contributed by this section (`document.documentElement.scrollWidth <= window.innerWidth` — note the app has a known pre-existing off-canvas mobile-nav overflow, exclude it by checking the section's own bounding width), chips ≥44px tall, mission stacks at ≤767px, second marquee row hidden on phones, counters wrap without clipping at 320px.

- [ ] **Step 3: Update the knowledge graph**

Run: `cd "C:\Users\Raj\OneDrive\Documents\Pet Project\frontend"; graphify update .`

- [ ] **Step 4: Fix-up commit (only if issues found)**

```bash
cd "C:\Users\Raj\OneDrive\Documents\Pet Project\frontend"
git add src/Pages/HomePage/HomePageSections
git commit -m "fix(home): responsive fix-ups from live verification of trust story band

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
