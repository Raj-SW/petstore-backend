# Email Template Unification — Design Spec (Epic 10)

**Date:** 2026-06-21
**Repo:** backend (`petstore-backend`) — `src/templates/*`, `src/utils/email.js`, a preview script.
**Status:** ✅ Approved design, pending implementation plan.
**Coordinates with:** Epic 9a (`urls.js` link resolver), Epic 9b (`announcement.html` becomes a body-only fragment under this layout), Epic 6c (`formatMUR`), Security F5 (verification template).
**Backlog:** `docs/BACKLOG-2026-06-21.md` Epic 10. Builds the "email layout partial" in the DRY register.

## Problem

Each of the 20 templates is a **standalone HTML document with its own `<style>` block**; `renderTemplate` compiles a single file with no shared layout/partials. Result: duplicated CSS, inconsistent branding (e.g. `welcome.html` uses green `#2c7a4b`, not the app's premium forest `#001C10` + gold `#D99A2B`), inconsistent currency/date formatting, `resendVerificationEmail` reuses the `password-reset` template (security F5), and several orphaned `appointment-*` templates linger after booking was removed.

## Current state (from code)

- `src/utils/email.js`: `renderTemplate(name, data)` = `handlebars.compile(readFileSync(name.html))(data)` — single file, no partials/layout.
- 20 templates in `src/templates/` (incl. 6 `appointment*` ones).
- Brand tokens (app): forest `#001C10`, gold `#D99A2B`, cream `#FAF5F1` (from `GlobalCustomStyle.css`).

## Decisions (locked in brainstorm)

- **One wrapper layout**: content templates become body-only fragments injected into a single branded shell.
- **Hand-rolled** responsive HTML (email-safe tables + inline-ish CSS); **no MJML / no new build step**.
- **Audit + remove** unused templates.

## Design

### 1. Wrapper layout + `renderTemplate`
- Create **`src/templates/_layout.html`**: branded shell — header (VitalPaws logo/wordmark, forest-green band), a **`{{{body}}}`** content slot (triple-stache, unescaped), and a footer (`© {{year}} VitalPaws`, address, `support@vitalpaws.com`, and a **conditional unsubscribe** block shown only when `{{unsubscribeUrl}}` is provided). Email-safe: ≤600px, table-based, base CSS in a `<style>` in `<head>` plus critical inline styles on key elements (buttons, container) for clients that strip `<style>`. Colors hardcoded to the premium palette (forest `#001C10`, gold `#D99A2B`, cream `#FAF5F1`) — documented as the email mirror of the app tokens (email can't use CSS vars reliably).
- Modify **`renderTemplate(name, data)`**: render the content fragment to HTML, then render `_layout.html` with `{ ...data, body: <contentHtml>, year: <currentYear>, supportEmail }`. The layout is never itself a content name. Shared button/heading/paragraph classes live in the layout.

### 2. Migrate active templates to body-only fragments
- Strip `<!DOCTYPE>/<html>/<head>/<style>` from each active content template; keep only the inner content markup, using the layout's shared classes (`.btn`, headings, paragraphs) + minimal inline styles for unique bits.
- Consistent **greeting / CTA button / typography**; money via the shared **`formatMUR`** util (Epic 6c); a shared **date helper** for consistent date formatting.

### 3. Audit + remove dead templates
- Grep every `sendEmail({ template: '<name>' })` reference across `src/controllers` + `src/services`. Build the set of referenced template names.
- Any template file **not** referenced (expected: the 6 `appointment*` templates, orphaned since booking was removed — confirm `appointment.controller.js` no longer sends them) is **deleted**.
- A guard test asserts every referenced template name has a corresponding file (no broken references).

### 4. Dedicated verification template (Security F5)
- Add **`email-verification.html`** (body-only) with verify-your-email copy + CTA to `{{verificationUrl}}`.
- Point `resendVerificationEmail` (and any signup verification path) to it instead of `password-reset`.

### 5. Currency + date consistency
- All amounts via `formatMUR` (Epic 6c); all dates via one shared formatter. (The invoice **PDF** `$`→MUR fix is Epic 11, which reuses the same util.)

### 6. Preview harness
- `scripts/preview-emails.js`: for each template, render it (through the layout) with representative sample data and write to `tmp/email-previews/<name>.html` (gitignored) for visual QA. Reuses `renderTemplate`.

## Reuse / coordination
- The `_layout.html` is the shared email shell — **Epic 9b's `announcement.html`** is authored as a body-only fragment under it (its current standalone styling is dropped). Links across all templates use **`urls.js` (9a)**; amounts use **`formatMUR` (6c)**.

## Testing
Run suites individually.
- `renderTemplate` wraps a fragment in the layout (output contains the layout header/footer **and** the fragment content).
- A representative content template (e.g. `welcome`, `order-confirmation`) renders with the premium palette, `formatMUR` amounts, and correct links; the unsubscribe footer appears only when `unsubscribeUrl` is passed.
- `resendVerificationEmail` renders the `email-verification` template (not `password-reset`).
- Reference guard: every `sendEmail` template name resolves to a file; removed templates have no remaining references.
- `scripts/preview-emails.js` renders all templates without error.

## Acceptance criteria
- A single `_layout.html` provides a branded header/footer/base styles in the premium forest/gold palette; all active content templates are body-only fragments rendered through it via `renderTemplate`.
- Currency (MUR via `formatMUR`) and date formatting are consistent across emails.
- A dedicated verification template exists and `resendVerificationEmail` uses it (Security F5 resolved).
- The unsubscribe footer shows only for marketing emails (`unsubscribeUrl` present).
- Unused/orphaned templates are removed (audited by `sendEmail` references); no broken references remain.
- A preview harness renders every template for QA.
- Build + existing/new tests pass.

## Out of scope
- The invoice PDF currency/layout (Epic 11).
- Adding new email types (e.g. the new Announcement types' content is 9b; they render under this layout).
- Localization / dark-mode email variants.
