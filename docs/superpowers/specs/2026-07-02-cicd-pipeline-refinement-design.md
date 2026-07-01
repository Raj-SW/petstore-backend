# CI/CD Pipeline Refinement — Design

**Date:** 2026-07-02
**Status:** Design approved, not yet implemented
**Repo:** `backend/`
**Branch:** `fix/sonarqube-issues-2026-06-29` (or a dedicated follow-up branch)

Builds on [2026-06-28-backend-testing-architecture-cicd-design.md](2026-06-28-backend-testing-architecture-cicd-design.md), which shipped the current `ci.yml` (unit → integration → report jobs) and the `db-lifecycle.js` cross-file test isolation fix. This spec refines that pipeline now that the integration suite is reliably green (was previously ~104/282 passing due to a test-isolation bug, now ~278/282).

---

## 1. Problem & Goals

### Current state

- `ci.yml`: `unit` job → `integration` job (`needs: unit`, `--runInBand`, ~11 min) → `report` job (merges coverage + JUnit, posts PR comment).
- `sonarcloud.yml`: a **separate** workflow, triggered on every push/PR to every branch (`branches: ["**"]`). It re-runs `npm run test:coverage` (the **full** unit+integration suite, ~11+ min) from scratch, purely to regenerate `coverage/lcov.info` for the Sonar scan — completely duplicating work `ci.yml` already did seconds/minutes earlier.
- `codeql.yml`: security-and-quality queries on push/PR to `main`/`develop` + weekly cron. **Already correctly scans PRs** — an earlier investigation this session initially suspected it didn't, but that was a fetch-tooling gotcha (GitHub's `code-scanning/alerts` API defaults to the repo's default branch unless `ref` is explicitly passed), not a real pipeline gap. No change needed here.
- `reviewdog` job (inside `ci.yml`): inline ESLint suggestions on PR diffs, `fail_level: none` — always advisory, never blocks.
- No lint gate: 1268 pre-existing ESLint errors are accepted debt (per the prior spec); nothing currently fails a build on lint.
- `test:integration` runs with `--runInBand`, forcing all 35 integration files to execute serially in one process.

### Goals

1. **Speed:** cut the integration job's wall-clock time via in-job parallelism, without spinning up multiple CI runners/jobs.
2. **Eliminate the SonarCloud duplicate test run** — without merging `sonarcloud.yml` into `ci.yml`. **Workflows must stay in separate files.** (User preference, non-negotiable — do not propose consolidating scan/quality workflows into the main CI workflow in this or future designs.)
3. **Add a real lint gate** that blocks only on issues in *new/changed* code, leaving the 1268-error legacy backlog untouched.
4. Confirm the SonarCloud coverage gate (80% on new code) is now meaningful given the integration suite is green — no workflow change needed, just verification.

### Non-goals

- CD / deployment automation — explicitly out of scope, deployment stays however it's currently handled (e.g. platform auto-deploy outside GitHub Actions).
- Ratcheting the legacy 1268 ESLint errors down — that's separate future work, not blocked on this.
- Changing CodeQL's trigger/query configuration — already working correctly.

---

## 2. Design

### 2.1 Integration suite: in-job worker parallelism

**Change `test:integration`** (`package.json`) to drop `--runInBand`:

```diff
- "test:integration": "cross-env NODE_ENV=test jest --selectProjects integration --runInBand --forceExit",
+ "test:integration": "cross-env NODE_ENV=test jest --selectProjects integration --forceExit",
```

Jest will then run its default worker-pool parallelism (auto-detected from available CPUs — GitHub's standard Linux runner has 4 vCPUs) within the **same single `integration` job** — no matrix, no extra runners.

**This is unsafe without a supporting change.** `tests/helpers/db-lifecycle.js` currently uses **one shared MongoDB connection** and clears **every collection before every test** (`beforeEach`). If multiple Jest worker processes run concurrently against that same database, Worker A's clear-all would wipe data Worker B just inserted mid-test — reintroducing the exact cross-file contamination class of bug that `db-lifecycle.js` was built to fix in the first place, just via a different mechanism.

**Fix:** give each Jest worker its own logical database within the same in-memory `mongod` instance, keyed by Jest's own `process.env.JEST_WORKER_ID` (automatically set per worker, e.g. `"1"`, `"2"`, `"3"`, `"4"`):

```js
// tests/helpers/db-lifecycle.js
const workerId = process.env.JEST_WORKER_ID || '1';
const uri = `${process.env.MONGODB_URI}_worker_${workerId}`; // separate DB name, same mongod

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
});
```

(Exact URI construction needs to respect whatever `mongod.getUri()` already returns from `tests/helpers/setup.js` — likely appending/replacing the trailing DB-name path segment rather than blind string concatenation. Implementation detail for the plan, not the design.)

Each worker's `deleteMany({})` sweep then only ever touches its own isolated database — no cross-worker interference, no shared-state races.

**Expected payoff:** ~11 min → roughly ~3-4 min (accounting for per-worker overhead and the fact that one file, `admin.user-management.test.js`, alone takes ~60-70s and becomes a floor on how fast any shard containing it can finish).

**Not changing:** `test:unit` already runs without `--runInBand` (Jest's default worker parallelism already applies) and completes in ~4-12 seconds — already fast, nothing to gain there.

### 2.2 SonarCloud: stop duplicating the test run, stay a separate workflow

`sonarcloud.yml` remains its own file. Instead of running `npm run test:coverage` itself, it triggers via `workflow_run` after `ci.yml` completes and **downloads** the coverage artifact `ci.yml`'s `report` job already produces, rather than regenerating it.

```yaml
# sonarcloud.yml (restructured)
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]

jobs:
  sonarcloud:
    if: github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.workflow_run.head_sha }}
          fetch-depth: 0

      - name: Download merged coverage
        uses: actions/download-artifact@v4
        with:
          name: coverage-merged        # ci.yml's report job needs to upload this
          path: coverage
          run-id: ${{ github.event.workflow_run.id }}
          github-token: ${{ secrets.GITHUB_TOKEN }}

      - uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_CUBE_TOKEN }}
```

**Required companion change in `ci.yml`'s `report` job:** add an `actions/upload-artifact` step for the merged `coverage/lcov.info` (it currently merges coverage but doesn't publish it as a named artifact for cross-workflow reuse — only the per-job `cov-unit`/`cov-integration` raw JSON artifacts exist today).

**Known trade-off to flag explicitly:** `workflow_run` triggers run in the context of the **default branch**, not the PR branch, by default — the `ref: ${{ github.event.workflow_run.head_sha }}` checkout works around this for getting the right *code*, but SonarCloud's automatic PR decoration (inline PR comments, PR-scoped new-code analysis) typically relies on the `pull_request` event context. This may need explicit `sonar.pullrequest.key` / `sonar.pullrequest.branch` / `sonar.pullrequest.base` properties passed manually when the trigger isn't a native `pull_request` event. **This is a real implementation risk** the plan needs to validate against a real PR before considering this shipped — if PR decoration breaks, the fallback is accepting the duplicate test run rather than losing PR-level Sonar feedback.

### 2.3 Diff-scoped lint gate

**Revised during implementation** (original draft below is kept for context, but was not shipped as-is — see "Why the original approach failed" at the end of this section).

Rather than adding a new custom job that shells out to `git diff --name-only` + `eslint <files>`, reuse the existing `reviewdog` job's proven diff-scoping (`filter_mode: diff_context`) and simply make it a real gate by changing `fail_level` from `none` to `error`:

```yaml
      - uses: reviewdog/action-eslint@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          reporter: github-pr-review
          eslint_flags: ". --ext .js"
          filter_mode: diff_context
          fail_level: error   # was: none
          level: warning
```

`fail_level: error` blocks the build only on ESLint *error*-severity findings that reviewdog's own diff-context filtering surfaces (i.e. only issues on/near lines actually changed in the PR) — warning-severity findings still get inline comments but don't fail the build. No second job, no duplicate ESLint run.

**Why the original approach failed:** `git diff --name-only` returns whole **file paths** that changed, not line ranges. A naive `npx eslint $CHANGED_FILES` therefore re-lints each *entire* file, including all of its pre-existing debt — not just the lines the PR touched. Tested against this branch's actual diff (46 files changed vs. `main`, each touched by only a handful of lines): **400 problems (389 errors)** were reported, almost all from untouched code in files that happened to have one or two changed lines. This defeated the design's stated goal ("the 1268-error legacy backlog... never trips it"). `reviewdog`'s `filter_mode: diff_context` already does real line-range diff-matching internally (verified working earlier in this project — it was the source of the ~67 correctly diff-scoped PR comments triaged in the CodeQL/reviewdog fix pass), so reusing it instead of reimplementing the same logic in bash is both simpler and actually correct.

**Second correction, found only after a real CI run:** even with `reviewdog` + `fail_level: error`, the first push (using `filter_mode: diff_context`) still failed the build — with **115 findings**, only 17 of which (`no-multiple-empty-lines`, caused by this same plan's Task 1-3 work removing per-file `mongoose.connect()` calls and leaving double-blank-lines behind) were things this work actually introduced. The other ~98 were pre-existing debt in files touched *somewhere* by this long-lived branch's cumulative diff — `diff_context` matches on the whole diff hunk (changed lines *plus* surrounding unchanged context lines), so on a branch with many commits and large diffs, "context" can include plenty of old, untouched code. Switched `filter_mode` from `diff_context` to `added` — which matches only lines the diff literally introduces, not their surrounding context — eliminating the false positives while still catching genuine new-line errors (like the double-blank-lines, which were fixed directly rather than relying on the gate to catch a self-inflicted formatting slip).

This **fails the build** (unlike `reviewdog`, which stays purely advisory/inline) only when ESLint finds errors on files actually touched by the PR — the 1268-error legacy backlog in untouched files never trips it. `reviewdog`'s existing job is unchanged; the two are complementary (reviewdog = inline suggestions, this new job = a real pass/fail gate).

### 2.4 Coverage gate — verify only, no change

SonarCloud's "80% on new code" quality gate is already configured (it's what failed with "67.3% on New Code" earlier this session, before the integration-suite fix). Now that integration tests reliably exercise the controllers, no workflow change is needed — just confirm on the next real PR that new-code coverage clears 80%.

---

## 3. Testing / Rollout

1. Implement the `db-lifecycle.js` per-worker DB change first, in isolation — verify locally (`npm run test:integration`, no `--runInBand`) that all ~278 integration tests still pass with no cross-test contamination, before touching any workflow YAML.
2. Update `package.json`'s `test:integration` script.
3. Add the `coverage-merged` artifact upload to `ci.yml`'s `report` job.
4. Restructure `sonarcloud.yml` to the `workflow_run` + download pattern.
5. Open a throwaway/real PR to validate: (a) the `workflow_run`-triggered SonarCloud job actually fires and finds the artifact, (b) PR decoration still works (the explicit risk flagged in 2.2) — if it doesn't, fall back to the old self-contained `sonarcloud.yml` rather than losing PR feedback.
6. Add the new `lint` job to `ci.yml`, verify it correctly scopes to changed files only and doesn't choke on the legacy backlog.

## 4. Risks & Trade-offs

- **`workflow_run` PR decoration risk** (2.2) — the single biggest uncertainty in this design. Must be validated against a real PR before considering it done; has an explicit fallback (accept the duplicate run) if it breaks.
- **Per-worker DB isolation correctness** (2.1) — needs careful validation that the URI construction actually produces a distinct database per worker rather than accidentally colliding (e.g. if `MONGODB_URI` already has a path segment, string concatenation could produce an invalid or unintended URI). Verify by asserting collection counts are worker-scoped during a parallel test run, not just "tests pass."
- **Uneven shard timing** — one slow integration file (`admin.user-management.test.js`, ~60-70s) sets a floor on how much the parallelism can help; not something this design fixes, just a known ceiling on the speedup.
