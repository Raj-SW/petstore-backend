# Backend Testing Architecture & CI/CD — Design

**Date:** 2026-06-28
**Status:** Phase 1 implemented (runner split + CI). Phases 2–3 (unit backfill to 90%, e2e) pending.
**Repo:** `backend/`
**Branch:** `docs/testing-architecture-cicd`

---

## Update 2026-06-28 — Final decisions & Phase 1 shipped

Two decisions changed from the first draft after review:

- **Runner: stay on Jest** (not Vitest). Lowest risk; the chosen folder/projects conventions are Jest-native. No migration of the existing suite.
- **Unit-test location: co-located** next to source (`src/**/*.test.js`), per the established convention — *not* a separate `tests/unit/` folder. `tests/` holds integration (and later e2e) only.

**Measured baseline (honest scope — controllers, services, models, middlewares, validators, utils):**

| Metric | Coverage |
|--------|----------|
| Statements | 57.85% (2157/3728) |
| Branches | 46.52% (898/1930) |
| Functions | 56.78% (247/435) |
| Lines | **58.34%** (2044/3503) |

Suite: **42 test suites / 311 tests green** (7 unit co-located + 35 integration). The old narrow `collectCoverageFrom` hid this — services/models/utils were never in the denominator.

**Phase 1 delivered:** Jest `projects` split (`unit` / `integration`), co-located the 7 existing unit tests, `test:unit` / `test:integration` / `test:all` scripts, corrected coverage scope, and a GitHub Actions `ci.yml` with **two separate jobs** — `unit` and `integration` (the latter `needs: unit` for fail-fast) — each producing its own coverage artifact, on push/PR to `main`/`develop`. The 90% ratchet gate and e2e layer are deferred to Phases 2–3.

The sections below are the original design; where they say "Vitest," read "Jest," and where they say `tests/unit/`, read co-located `src/**/*.test.js`.

---

## 1. Problem & Goals

### Current state (audit)

- **Runner:** Jest 29 + Supertest + `mongodb-memory-server` (1-node replica set so Mongo transactions work).
- **42 test files** in `tests/`, all flat in one directory.
- **No true unit tests.** Every file is an integration/API test: it boots the real Express `app` and exercises the full HTTP → controller → service → model → DB path. Services, utils, and model methods are only covered *transitively*.
- **Coverage measurement is misleading.** `collectCoverageFrom` counts only `controllers/`, `middlewares/`, `validators/`. It **excludes** `services/` (8 files), `models/` (23), `utils/` (10), `routes/` (22), `config/` (6) — so the reported % omits most business logic.
- Committed `coverage/` report is stale (2026-06-07).
- **CI:** `.github/workflows/sonarcloud.yml` exists; coverage is wired to SonarCloud.
- Fixtures (`makeUser`, `signupAndLogin`) are copy-pasted across files; no shared factory module.

### Goals

1. A proper **test pyramid**: unit, integration, e2e — each isolated, independently runnable.
2. **Honest, broad coverage measurement** across all business logic.
3. **Maximum practical coverage**, enforced by a ratcheting gate (target 90% lines).
4. A **staged CI/CD pipeline** running all three layers with a coverage gate.
5. Migrate the runner from **Jest → Vitest** (user decision).

### Non-goals

- Full-stack (browser) E2E with Playwright/Cypress — belongs in the frontend repo. E2E here is black-box API only.
- Rewriting application/source code for testability beyond what's needed to unit-test a given module.
- 100% coverage. 90% lines / 85% branches is the defined ceiling for "maximum practical."

---

## 2. Target Architecture — The Test Pyramid

Three layers, each in its own directory and Vitest project config:

| Layer | Dir | Tests | DB | Concurrency |
|-------|-----|-------|-----|-------------|
| **Unit** | `tests/unit/` | services, utils, validators, model statics/methods — **in isolation**, all I/O mocked via `vi.mock` | none (mocked) | fully parallel |
| **Integration** | `tests/integration/` | Supertest → real `app` → controller→service→model→DB | `mongodb-memory-server` replica set (as today) | serial (`--runInBand` equivalent) |
| **E2E** | `tests/e2e/` | real server **process** over real HTTP, black-box external client | real MongoDB (service container in CI; `mongodb-memory-server` locally) | serial, long timeout |

### Migration of existing tests

The 42 current tests are **integration tests** → move to `tests/integration/` largely unchanged (only Jest→Vitest API conversions). The net-new work is the **unit** layer (source of most new coverage) and a small, high-value **e2e** suite.

### E2E suite scope (critical flows only)

- Auth lifecycle: signup → verify → login → refresh → logout.
- Order lifecycle: add to cart → create order → invoice generation.
- Payment: order with **mocked** Stripe/PayPal/MCB gateway (no real network).
- Subscription create → enriched detail read.

E2E is deliberately thin — it proves the wired system works end-to-end, not exhaustive branch coverage (that's the unit layer's job).

---

## 3. Framework & Tooling

- **Vitest** runner with `globals: true` so `describe / it / expect / beforeAll / afterEach` need **no** rewriting. Only `jest.* → vi.*` calls change (`jest.mock` → `vi.mock`, `jest.fn` → `vi.fn`, `jest.spyOn` → `vi.spyOn`). This is mechanical across the 42 files.
- **Supertest** retained for the integration layer.
- **@vitest/coverage-v8** for coverage (fast, no instrumentation step).
- **`vitest.workspace.js`** defining three projects (unit / integration / e2e) so each gets its own setup, timeout, and concurrency. A single `vitest` invocation can run one project or all.
- **Shared fixtures** in `tests/factories/` (e.g. `userFactory`, `productFactory`, `authHelper`) — replaces copy-pasted `makeUser`/`signupAndLogin`.
- CommonJS source is consumed by Vitest/Vite without changes (no source migration to ESM).

### Config layout

```
vitest.workspace.js          # lists the three projects
tests/
  factories/                 # shared builders + auth helpers
  unit/
    setup.unit.js            # no DB; resets mocks
    *.test.js
  integration/
    setup.integration.js     # in-memory replica set (adapted from current tests/setup.js)
    *.test.js                # 42 migrated files land here
  e2e/
    setup.e2e.js             # starts server process + connects real Mongo
    *.test.js
```

The existing `tests/setup.js` / `teardown.js` / `env-setup.js` logic (in-memory replica set, URI hand-off) is adapted into `setup.integration.js` using Vitest's `globalSetup` + `provide`/`inject` (replacing the temp-file URI hand-off).

---

## 4. Coverage Policy

- **Scope (included):** `src/controllers`, `src/services`, `src/models`, `src/middlewares`, `src/validators`, `src/utils`.
- **Excluded:** `src/config`, `src/routes` (declarative), `src/server.js`, `src/app.js` bootstrap wiring, seed scripts, `**/*.test.js`.
- **Provider:** v8.
- **Thresholds (CI fails below):** start at the *current real* number (measured on first Vitest run), then **ratchet** upward toward the target — never allowed to regress.
- **Target ceiling:** 90% lines, 90% statements, 90% functions, 85% branches.
- Merged coverage (unit + integration) is uploaded to **SonarCloud** via the existing workflow.

E2E coverage is **not** counted toward the gate (process-boundary coverage is noisy); e2e is a pass/fail correctness signal.

---

## 5. CI/CD Pipeline (GitHub Actions)

Staged jobs — cheapest feedback first; expensive layers gated behind cheap ones:

```
lint ─→ unit ─→ integration ─→ e2e ─→ coverage-gate + sonar upload
```

- **lint** — ESLint (existing config).
- **unit** — `vitest run --project unit --coverage`. Fast, fully parallel.
- **integration** — `vitest run --project integration --coverage`. In-memory Mongo.
- **e2e** — `vitest run --project e2e`. MongoDB **service container** (`services: mongo:`) in the workflow; app built/started against it.
- **coverage-gate** — merge unit+integration coverage, enforce thresholds (build fails below), upload to SonarCloud.
- The coverage gate + lint + unit + integration are **required checks** on PRs to `main`. E2E required too once stable.

### Local DB strategy

- Unit: none.
- Integration: `mongodb-memory-server` (no Docker needed).
- E2E: `mongodb-memory-server` locally (no Docker needed); real `mongo` service container in CI for realism.

---

## 6. Rollout — Incremental (Approach A, approved)

Always-green, low risk:

1. **Migrate runner.** Install Vitest + coverage-v8, add workspace config, convert `jest.* → vi.*` in the 42 files, move them into `tests/integration/`. Suite stays green. Remove Jest.
2. **Fix coverage scope.** Apply the real `include`/`exclude`. Run once to capture the *honest* baseline number; set thresholds to that baseline.
3. **Extract shared factories.** Replace per-file `makeUser`/`signupAndLogin` with `tests/factories/`.
4. **Build the unit layer, module by module**, raising (ratcheting) the threshold after each batch until the 90% ceiling. Order by risk/value: services → utils → model methods → validators.
5. **Add the e2e layer** (critical flows) + the MongoDB service-container CI job.
6. **Wire the staged GitHub Actions pipeline** with the coverage gate as a required check.

A realistic expectation: steps 1–3 are mechanical and quick. Step 4 (reaching 90% across services/models/utils) is the **bulk of the effort** — dozens of new unit-test files — and proceeds as an ongoing ratchet, not a single push.

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Vitest mock semantics differ subtly from Jest (`vi.mock` hoisting, module factory) | Convert + run per-file; fix as they surface. `globals:true` minimizes surface area. |
| In-memory replica-set setup behaves differently under Vitest `globalSetup` | Port the existing working logic; verify the heaviest transaction test (orders) first. |
| Coverage gate blocks unrelated PRs while backfilling | Ratchet from the real baseline, not from 90% — gate never demands more than current + the batch being added. |
| E2E flakiness from real server/DB timing | Serial execution, generous timeouts, explicit readiness wait before first request. |

---

## 8. Open Questions

None blocking. Gateway-mock strategy for e2e payments will be pinned down during the implementation plan (reuse existing integration-test mocks where possible).
