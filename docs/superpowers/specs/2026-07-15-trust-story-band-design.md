# Trust Story Band ("What Our Clients Say" rebuild) — Design Spec

**Date:** 2026-07-15
**Scope:** Homepage `StatsSection` (frontend repo) — full rebuild of all three
parts: mission row, stat counters, testimonials. Approach: A+C blend approved
by the user — featured "note from a pet parent" + drifting marquee wall — on a
**light palette** (the section sits between the cream Tips band and the ivory
Featured Products band, and the homepage already has two adjacent forest-dark
bands at Pet Travel + Vet Network; no more dark slabs).

**Goal:** Replace the flat two-card testimonial layout with a band that reads
as one story — *who we are → proof in numbers → proof in words* — with
rich-but-tasteful motion, zero dark-green background area, and full
responsiveness.

**Palette (binding):**
- Band background: `#FFFFFF`.
- Paper elements (chips, featured note): `--color-bg-cream` #FAF5F1 and
  `--color-bg-warm-ivory` #F6ECE3, 1px border `#EFE6D8`.
- Accent: `--color-accent-gold` #D99A2B — numerals, stars, rules, monograms.
- Text: `--color-primary-forest` #001C10 (headings), `#5c6b60` muted body.
- Forest is TYPE-ONLY in this section — never a background fill.
- Fonts: `--font-display` headings, `--font-script` short accents only,
  `--font-body` copy. Quotes use `--font-body` italic at 1.05rem — script at
  paragraph length is unreadable.
- House ease `[0.25, 0.46, 0.45, 0.94]`.

## Files
- Rewrite: `src/Pages/HomePage/HomePageSections/StatsSection.jsx`
- Rewrite: `src/Pages/HomePage/HomePageSections/StatsSection.css`
- Rewrite: `src/Pages/HomePage/HomePageSections/StatsSection.test.jsx`
- Keep: `assets/StatsSection/vet-with-dog.jpg` (mission photo). The 9
  slide-*.webp imports and `SLIDE_IMAGES` logic are DELETED (the per-slide
  photo-grid card goes away; slide-2-a.webp stays in the repo — the Gallery
  hero uses it).

## Data
- Same fetch: `feedbackApi.getFeedback({ limit: 12 })` → items
  `{ _id, name, role?, rating?, message, photos?: [(string | {url})] }`.
- Keep the existing hardcoded `TESTIMONIALS` fallback (used when the API
  errors or returns empty) — extend each fallback entry with `rating: 5`.
- Normalize photos with the existing `toPhotoUrl` helper (string or `{url}`).
- **Live average rating:** `avg = mean(rating of items with rating > 0)`
  rounded to 1 decimal; when no rated items (or fallback data), use the
  constant default below.

## Part 1 — Mission row
Two-column grid (`minmax(0, 300px) minmax(0, 1fr)`, gap 3rem, max-width
1100px, centered):
- Left: `vet-with-dog.jpg` in the arch frame motif (280×320, radius
  `140px 140px 16px 16px`, 2px gold border + offset outline — same treatment
  as the Vet Spotlight portrait, tying the motif together).
- Right: eyebrow "OUR PROMISE" (gold, 0.72rem, letterspaced uppercase),
  headline (display font, clamp(1.9rem, 3.5vw, 2.6rem), forest):
  "Your pets, at the heart of everything we do", body (existing about copy,
  trimmed to the current first sentence + second sentence, muted).
- Entrance: image x -40→0 fade, content x 40→0 fade, `useInView` once (keep
  current pattern).

## Part 2 — Trust strip
Full-width row between 1px gold rules (`rgba(217,154,43,0.35)`), padding
1.4rem 0, three stats centered with 3rem gaps:

```js
// Placeholder truth — user swaps real figures here later.
const TRUST_STATS = [
  { value: 100, suffix: "+", label: "Successful Relocations" },
  { value: 11,  suffix: "",  label: "Certified Professionals" },
  { value: null, suffix: "★", label: "Average Rating", fallback: 4.8 }, // live from feedback
];
```

- Numerals: display font, clamp(2rem, 4vw, 2.8rem), gold. Labels: body font
  0.8rem uppercase letterspaced, forest.
- **Count-up:** when the strip first enters view, animate 0 → value over
  1.2s with the house ease (framer-motion `animate()` in a `useEffect`,
  rendering via state; 1 decimal for the rating, integers otherwise).
  Under `useReducedMotion()`, render final values immediately.

## Part 3 — Wall of love (testimonials)
Header: deco line+paw+line (gold) + "What Our Clients Say" (display font,
forest — fixes the current "What Our Client Say" typo) + script subtitle
"real words from real pet parents" (gold).

### Featured note (A)
Max-width 640px, centered. Cream paper card (radius 16px, border #EFE6D8,
slight rotate(0.5deg), soft shadow `0 14px 34px rgba(0,28,16,0.08)`),
padding 1.6rem 1.8rem, min-height 210px (no layout shift):
- Left inset: polaroid — 84×96px, white 5px frame, rotate(-5deg), photo =
  testimonial's first photo; **no photo → gold monogram disc** (first letter,
  display font, on `#F6ECE3`).
- Right: star row (gold `FaStar` × rating, gray hollow remainder — only when
  `rating > 0`), quote (body italic 1.05rem, forest, clamp to 4 lines via
  `-webkit-line-clamp`), author line "— {name}{, role}" (0.85rem muted).
- Transition on change: `AnimatePresence mode="wait"`; enter y 18→0 +
  rotate -1.5→0.5deg + opacity, spring (stiffness 260, damping 22); exit
  y -14 + opacity 0, 0.18s. Reduced motion: opacity-only.
- **Auto-advance** every 7s while idle; pauses on hover over the note or
  marquee; stops permanently after ANY user selection (chip click, dot).
  Never runs under reduced motion or with < 2 testimonials.
- Dots below the note (same pattern as vr-dots: 8px, gold active pill 20px),
  clickable, `aria-label="Go to testimonial N"`.

### Marquee wall (C)
Below the featured note. Two rows (one row when < 6 testimonials), each a
horizontally drifting track of compact quote chips:
- Chip: button. Ivory/cream paper (alternate per index), radius 12px, border
  #EFE6D8, padding 0.6rem 1rem, subtle rotate alternating ±1deg, content:
  gold mini-stars (0.6rem, when rated) + first ~60 chars of the quote +
  "— {firstName}" (0.75rem). Chip height ≥44px (touch target).
- Drift: pure CSS `@keyframes` `translateX(0 → -50%)`, track content
  duplicated once for a seamless loop (duplicate set `aria-hidden="true"`,
  chips in it `tabIndex={-1}`). Row 1 drifts left (~40s linear), row 2
  drifts right (~52s). `:hover` on the wall pauses both
  (`animation-play-state: paused`); chip focus also pauses (row-level
  `:focus-within`).
- **Click/tap/Enter a chip → that testimonial becomes the featured note**
  (spring lift on the note as it swaps) and auto-advance stops. Active
  testimonial's chip gets a gold border + full opacity; others 0.85.
- Reduced motion: no drift — chips render as a static centered flex-wrap
  grid (no duplicate set rendered).

## Responsive matrix
| Range | Layout |
|---|---|
| ≥1440px | Content capped at 1100px (mission/strip) and full-bleed marquee rows; no stretch |
| 1024–1439px | As designed |
| 768–1023px (tablet) | Mission stays two-column, photo column 240px (arch 220×250); trust strip gaps 2rem; featured note max-width 560px |
| ≤767px (phone) | Mission stacks (photo 220px centered → text centered); trust strip becomes a horizontal 3-across row, wraps at very narrow; ONE marquee row; featured note full-width, polaroid 64×74 |
| ≤380px | Counters stack 3-across shrinks to numerals clamp floor 1.6rem; chip quote truncates ~40 chars; note padding 1.1rem |

All type via `clamp()`; breakpoints change structure only. Live verification
at 1440/1024/768/640/375/320 for overflow, ≥44px targets, clipping —
mandatory implementation step. NOTE: marquee tracks must live inside an
`overflow-x: hidden` wrapper so the duplicated track never widens the page.

## Accessibility
- Chips: real `<button>`s, `aria-pressed` on the active one, visible
  focus ring (2px gold). Duplicate marquee set `aria-hidden` + untabbable.
- Featured note region: `aria-live="polite"` so chip selection announces the
  new quote.
- Stars: `aria-label="Rated N out of 5"` on the star row container; icons
  `aria-hidden`.
- Mission image `alt="Veterinarian examining a dog"`; polaroid `alt=""`
  (decorative — the note text identifies the author).

## Performance
- Marquee is CSS-only (compositor-friendly `transform`); no JS rAF loops.
- Photos `loading="lazy"`. No new dependencies. Slide-image imports removed
  (drops ~0.5MB of webp from the homepage chunk's asset graph).

## Testing (vitest + RTL, framer + API mocked per house pattern; reduced-motion mocked true)
1. Fetches `{ limit: 12 }`; renders featured note with first testimonial's
   quote, author, and star rating.
2. Falls back to hardcoded testimonials when the API rejects (renders
   "John Corner, Melbourne").
3. Average-rating stat: with mocked items rated 5 and 4 → "4.5★" rendered;
   with no rated items → fallback "4.8".
4. Clicking a marquee chip swaps the featured note to that testimonial and
   sets `aria-pressed`.
5. Testimonial without photos → monogram disc (author initial) in the note.
6. Reduced motion: marquee renders chips WITHOUT the aria-hidden duplicate
   set (static grid).
7. Section renders mission headline and all three trust labels.
8. Dots: clicking dot N selects testimonial N (featured quote text changes).

## Out of scope
- The neighboring sections and their backgrounds (the adjacent
  PetTravelBand+VetNetwork double-forest observation is noted for a future
  pass, not this one).
- Feedback submission flow, admin moderation, backend.
- Real trust-stat figures — constants are placeholders the user will swap.
