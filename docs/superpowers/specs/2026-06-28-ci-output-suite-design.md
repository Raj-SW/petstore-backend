# CI/CD Output Suite — Design

**Date:** 2026-06-28
**Status:** Approved; implementing
**Repo:** `backend/`
**Branch:** `docs/testing-architecture-cicd`
**Depends on:** `2026-06-28-backend-testing-architecture-cicd-design.md` (Jest projects + CI)

---

## Goal

Make the CI pipeline surface rich, separate, visible outputs on every PR: real
whole-codebase coverage, a coverage+test PR comment, a test-results report,
a job summary, README badges, and inline code suggestions. Each appears as its
**own check / comment** — nothing collapsed into one opaque status.

## Decisions (locked)

- **Coverage combination: A2 (artifact merge).** `unit` and `integration` stay
  separate jobs (fast fail + separate logs); each uploads its partial coverage
  (`coverage-final.json`) + JUnit as artifacts. A `report` job downloads both,
  **merges** them with `nyc` into one true whole-codebase report.
- **SonarCloud stays its own separate workflow** (`sonarcloud.yml`), unchanged in
  identity. It gets a `npm run test:coverage` step + a `sonar-project.properties`
  so it reports real coverage instead of 0.0%. (A single Jest run over both
  projects auto-merges coverage, so Sonar needs no artifact plumbing.)
- **Code suggestions:** `reviewdog/action-eslint` in CI (diff-scoped inline
  suggestions) + CodeRabbit GitHub App (installed by the user, AI review).

## Architecture

```
ci.yml
  unit         → jest unit  --coverage (coverage/unit) + junit  → upload artifacts
  integration  → (needs unit) jest integration --coverage + junit → upload artifacts
  report       → (needs unit, integration)
                   download both artifacts
                   nyc merge coverage-final.json × 2 → merged → nyc report
                       → lcov.info + coverage-summary.json
                   junit-report-merger → merged junit
                   MishaKav/jest-coverage-comment  → sticky PR comment (coverage + tests)
                   dorny/test-reporter             → "Tests" check + annotations
                   write tables to $GITHUB_STEP_SUMMARY
  reviewdog    → action-eslint, reporter=github-pr-review, filter=diff, fail_level=none

sonarcloud.yml (separate, kept)
  npm ci → npm run test:coverage → SonarCloud Scan (reads coverage/lcov.info)
```

## Repo changes

- **devDeps:** `jest-junit`, `nyc`, `junit-report-merger`.
- **jest.config.js:** `coverageReporters: ['text','lcov','json','json-summary']`;
  add `reporters: ['default', 'jest-junit']`. JUnit output name set per job via
  `JEST_JUNIT_OUTPUT_*` env in the workflow.
- **sonar-project.properties:** `sonar.sources=src`, `sonar.tests=tests` +
  co-located, `sonar.javascript.lcov.reportPaths=coverage/lcov.info`,
  exclusions for tests/config/migrations.
- **.github/workflows/ci.yml:** add `report` + `reviewdog` jobs; `unit` &
  `integration` emit coverage+junit artifacts.
- **.github/workflows/sonarcloud.yml:** add coverage step.
- **README.md:** badges — CI status, SonarCloud quality gate, SonarCloud
  coverage, tests.

## Coverage merge detail (A2)

Each job runs jest with `--coverage --coverageReporters=json` →
`coverage/coverage-final.json` (raw Istanbul data, mergeable). The `report` job:

1. Places `unit/coverage-final.json` and `integration/coverage-final.json` into a
   dir, `npx nyc merge <dir> .nyc_output/out.json`.
2. `npx nyc report --reporter=lcov --reporter=json-summary --reporter=text
   --report-dir=coverage` → true combined `lcov.info` + `coverage-summary.json`.

This is the honest whole-codebase number (currently ~58% lines), fed to the PR
comment and job summary.

## What shows in PR Checks / comments

Checks: `CI / unit`, `CI / integration`, `CI / report`, `CI / reviewdog`,
`SonarCloud`, Quality Gate, `Tests` (test-reporter), Vercel.
Comments: Sonar quality gate, coverage+tests bot comment, CodeRabbit review,
Vercel deploy, reviewdog inline suggestions.

## Risks

| Risk | Mitigation |
|------|------------|
| `nyc merge` schema mismatch between jest versions | jest 29 emits standard Istanbul json; verified locally before pushing. |
| reviewdog floods PR with 1268 existing errors | `filter_mode: diff_context` (only changed lines) + `fail_level: none` (never blocks). |
| Coverage comment double with Sonar's | Acceptable — Sonar comment = quality gate; bot comment = per-file coverage + test counts. Different value. |
| Sonar re-runs full suite (~5–6 min) | It's a separate pipeline; runs in parallel with ci. Acceptable. |

## Out of scope
- 90% ratchet gate (separate; needs coverage to climb first).
- E2E job (Phase 3).
