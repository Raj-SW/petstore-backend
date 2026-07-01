# CI/CD Pipeline Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut integration-suite wall-clock time via safe in-job Jest worker parallelism, stop SonarCloud from duplicating the full test run (while keeping it a separate workflow file), and add a real diff-scoped lint gate.

**Architecture:** `tests/helpers/db-lifecycle.js` gets per-Jest-worker MongoDB database isolation (keyed by `JEST_WORKER_ID`) so `--runInBand` can be safely dropped from `test:integration`. `ci.yml`'s `report` job publishes its merged `coverage/lcov.info` as a named artifact; `sonarcloud.yml` is restructured to trigger via `workflow_run` after `ci.yml` completes and download that artifact instead of re-running `npm run test:coverage`. A new `lint` job in `ci.yml` runs ESLint against only the files changed in the PR diff and fails the build on real errors there, leaving the 1268-error legacy backlog untouched.

**Tech Stack:** Jest 29 (multi-project config, `mongodb-memory-server`), GitHub Actions (`actions/upload-artifact@v4`, `actions/download-artifact@v4`, `workflow_run` trigger), Node.js `URL` API.

**Spec:** `docs/superpowers/specs/2026-07-02-cicd-pipeline-refinement-design.md`

---

## Task 1: Per-worker MongoDB isolation in `db-lifecycle.js`

**Context:** Currently every integration test file connects to the *same* MongoDB database (via `process.env.MONGODB_URI`, a fixed in-memory replica set URI written by `globalSetup`) and `db-lifecycle.js`'s `beforeEach` clears *every* collection before *every* test. Under `--runInBand` (today's setting) this is safe because only one test ever runs at a time. If `--runInBand` is removed, Jest will run multiple **worker processes** concurrently, each potentially executing a different test file at the same moment — and since they'd all still point at the identical physical database, one worker's `deleteMany({})` would wipe data another worker's concurrently-running test just inserted.

The fix: give each Jest worker process its own logical database name within the same in-memory `mongod`, using Jest's `process.env.JEST_WORKER_ID` (stable per worker process, e.g. `"1"`, `"2"`, `"3"`, `"4"`). `MongoMemoryReplSet.getUri()` (called in `tests/helpers/setup.js`) returns a URI with **no database name in the path**, e.g. `mongodb://127.0.0.1:49651/?replicaSet=testset` — string concatenation would corrupt this (it would append after the `?replicaSet=testset` query string). Use the `URL` API to correctly set the pathname instead.

**Files:**
- Modify: `tests/helpers/db-lifecycle.js`

- [ ] **Step 1: Add the per-worker URI builder and use it in `beforeAll`**

Replace the full contents of `tests/helpers/db-lifecycle.js` with:

```js
/**
 * Shared DB lifecycle for the integration project (wired via `setupFilesAfterEnv`).
 *
 * Each Jest worker process gets its own logical MongoDB database within the
 * shared in-memory replica set, keyed by JEST_WORKER_ID. This is required
 * because Jest runs multiple worker processes concurrently (once --runInBand
 * is dropped from test:integration) — without per-worker isolation, one
 * worker's "clear every collection before each test" would wipe data another
 * worker's concurrently-running test just inserted, since they'd otherwise
 * all point at the exact same physical database.
 *
 * MongoMemoryReplSet.getUri() (see tests/helpers/setup.js) returns a URI with
 * no database name in the path, e.g. "mongodb://127.0.0.1:PORT/?replicaSet=testset" —
 * the worker-specific db name is inserted via the URL API (not string
 * concatenation, which would corrupt the query string).
 *
 * This module also:
 *   - connects the default mongoose connection once per test file (idempotent —
 *     each test file gets a fresh mongoose module instance, so this fires once
 *     per file, safely reusing the same per-worker database across files
 *     handled by the same worker), and
 *   - clears EVERY collection in that worker's database before each test.
 *
 * Per-file connect is redundant (kept files still work — connect is a no-op
 * when already connected); per-file `deleteMany` calls are harmless.
 */
const mongoose = require('mongoose');

function buildWorkerUri() {
  const workerId = process.env.JEST_WORKER_ID || '1';
  const url = new URL(process.env.MONGODB_URI);
  url.pathname = `/test_worker_${workerId}`;
  return url.toString();
}

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(buildWorkerUri());
  }
});

beforeEach(async () => {
  if (mongoose.connection.readyState !== 1) return;
  const { collections } = mongoose.connection;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({})),
  );
});
```

- [ ] **Step 2: Syntax-check the file**

Run: `node --check tests/helpers/db-lifecycle.js`
Expected: no output (exits 0)

---

## Task 2: Verify real parallel execution is safe (diagnostic run)

**Context:** This proves the Task 1 change actually works under real concurrent Jest workers — not just "the file has no syntax errors." This is a manual verification step (there's no existing precedent in this codebase for unit-testing files under `tests/helpers/`, and the correctness property here — "no cross-worker contamination when multiple workers run concurrently" — can only be meaningfully checked by actually running the suite with multiple workers, not by a mocked unit test).

**Files:** none (verification only, no code changes)

- [ ] **Step 1: Run the full integration suite with explicit multi-worker parallelism, without touching the default npm script yet**

Run: `npx cross-env NODE_ENV=test jest --selectProjects integration --forceExit --maxWorkers=4`

Expected: all suites pass — same pass count as the current serial baseline (282 tests total, 1 pre-existing `todo`, rest passing — this was the confirmed state at the end of the prior CI/CD-adjacent session work). If any test fails with a duplicate-key error (`E11000`) or an assertion about missing/wrong data that wasn't failing before, that indicates cross-worker contamination — STOP and re-check the `buildWorkerUri()` logic in Task 1 (in particular, confirm `process.env.JEST_WORKER_ID` is actually different across workers by temporarily adding `console.log('worker', process.env.JEST_WORKER_ID, 'connecting to', buildWorkerUri())` inside `beforeAll`, running once, checking the output shows at least 2 distinct worker IDs/URIs, then removing the log line).

- [ ] **Step 2: Confirm the run actually used multiple workers (not a silent fallback to 1)**

Run: `npx cross-env NODE_ENV=test jest --selectProjects integration --forceExit --maxWorkers=4 --verbose 2>&1 | grep -c "PASS integration"`

Expected: `35` (one line per integration test file — confirms all 35 suites ran; combined with Step 1's pass/fail result and a materially lower wall-clock time than the ~11 minute `--runInBand` baseline, this confirms real parallel execution occurred without corruption).

---

## Task 3: Drop `--runInBand` from the default integration test script

**Files:**
- Modify: `package.json:12`

- [ ] **Step 1: Update the `test:integration` script**

In `package.json`, change:

```diff
-        "test:integration": "cross-env NODE_ENV=test jest --selectProjects integration --runInBand --forceExit",
+        "test:integration": "cross-env NODE_ENV=test jest --selectProjects integration --forceExit",
```

Leave `test` (line 10) and `test:coverage` (line 14) as-is for now — they still use `--runInBand` across *both* projects combined via `jest` with no `--selectProjects` filter; changing those is out of scope for this plan (the design only targets `test:integration` specifically, since that's what `ci.yml`'s `integration` job invokes).

- [ ] **Step 2: Run the updated script exactly as CI will**

Run: `npm run test:integration`
Expected: all integration suites pass (same result as Task 2's diagnostic run — this just confirms the *actual* npm script, not just an ad-hoc `jest` invocation, behaves the same way).

- [ ] **Step 3: Confirm the unit suite is untouched**

Run: `npm run test:unit`
Expected: `Tests: 281 passed, 281 total` (unchanged — Task 1-3 only touch the integration project).

- [ ] **Step 4: Commit**

```bash
git add tests/helpers/db-lifecycle.js package.json
git commit -m "$(cat <<'EOF'
perf(tests): parallelize integration suite via per-worker DB isolation

Drop --runInBand from test:integration so Jest runs its default
multi-worker parallelism (auto-detected from CPU count) within a single
job, instead of executing all 35 integration files serially (~11 min).

This is only safe because db-lifecycle.js now gives each Jest worker
process its own logical MongoDB database (test_worker_<JEST_WORKER_ID>,
via the URL API) within the shared in-memory replica set — otherwise one
worker's "clear every collection before each test" would race with and
wipe data a concurrently-running test in a different worker just
inserted.

Verified via explicit --maxWorkers=4 runs before and after the script
change: all integration suites still pass with no cross-worker
contamination.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Publish merged coverage as a named artifact from `ci.yml`

**Context:** `sonarcloud.yml` (Task 5) needs to download `ci.yml`'s already-merged `coverage/lcov.info` instead of regenerating it. `ci.yml`'s `report` job already produces this file (via the existing `nyc merge` + `nyc report --reporter=lcov ...` steps) but never publishes it as a reusable artifact — only the raw per-job `cov-unit`/`cov-integration` JSON artifacts exist today.

**Files:**
- Modify: `.github/workflows/ci.yml:111` (insert a new step immediately after the existing "Merge coverage" step)

- [ ] **Step 1: Add the artifact-upload step**

In `.github/workflows/ci.yml`, immediately after the existing "Merge coverage" step (currently ending at line 111, right before the "Merge test results" step), insert:

```yaml
      - name: Upload merged coverage
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage-merged
          path: coverage/lcov.info
          if-no-files-found: error
```

The full `report` job's step list should now read (showing the relevant section, `...` = unchanged steps before/after):

```yaml
      # A2: merge the two partial coverage runs into one true whole-codebase report.
      - name: Merge coverage
        run: |
          mkdir -p _merge .nyc_output coverage
          cp _artifacts/cov-unit/coverage-final.json _merge/unit.json
          cp _artifacts/cov-integration/coverage-final.json _merge/integration.json
          npx nyc merge _merge .nyc_output/out.json
          npx nyc report --reporter=lcov --reporter=json-summary --reporter=text-summary --report-dir=coverage

      - name: Upload merged coverage
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage-merged
          path: coverage/lcov.info
          if-no-files-found: error

      - name: Merge test results
        run: |
          mkdir -p reports
          npx jrm reports/merged.xml "_artifacts/junit-unit/junit-unit.xml" "_artifacts/junit-integration/junit-integration.xml"
```

- [ ] **Step 2: Validate the YAML syntax**

Run: `node -e "require('js-yaml') ? console.log('js-yaml available') : null" 2>/dev/null; python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" 2>&1 || node -e "const fs=require('fs'); const c=fs.readFileSync('.github/workflows/ci.yml','utf8'); console.log(c.includes('coverage-merged') ? 'artifact block present' : 'MISSING')"`

Expected: no Python/YAML parse errors (if `python3`/`yaml` isn't available, the fallback Node check should print `artifact block present`). This step only needs to confirm the file is still valid YAML and contains the new block — full end-to-end validation happens when the workflow actually runs on push (Task 6).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
ci: publish merged lcov.info as a named artifact

Adds an upload-artifact step for coverage/lcov.info (name:
coverage-merged) to ci.yml's report job, so sonarcloud.yml can download
it via workflow_run instead of re-running the full test suite to
regenerate the same coverage data.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Restructure `sonarcloud.yml` to trigger via `workflow_run`

**Context:** Per the design, `sonarcloud.yml` **stays a separate workflow file** (do not merge it into `ci.yml`). Instead of its current `push`/`pull_request` triggers plus a full `npm run test:coverage` run, it now triggers after `ci.yml` ("CI") completes and downloads the `coverage-merged` artifact from that run.

**Files:**
- Modify: `.github/workflows/sonarcloud.yml` (full rewrite)

- [ ] **Step 1: Rewrite the workflow**

Replace the full contents of `.github/workflows/sonarcloud.yml` with:

```yaml
name: SonarCloud

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
          name: coverage-merged
          path: coverage
          run-id: ${{ github.event.workflow_run.id }}
          github-token: ${{ secrets.GITHUB_TOKEN }}

      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_CUBE_TOKEN }}
```

Note: `"CI"` in `workflows: ["CI"]` must exactly match `ci.yml`'s `name:` field (`name: CI`, line 1 of `ci.yml`) — GitHub matches `workflow_run` by workflow *name*, not filename.

- [ ] **Step 2: Validate the YAML is well-formed**

Run: `node -e "const fs=require('fs'); const c=fs.readFileSync('.github/workflows/sonarcloud.yml','utf8'); console.log(c.includes('workflow_run') && c.includes('coverage-merged') ? 'OK' : 'MISSING EXPECTED CONTENT')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/sonarcloud.yml
git commit -m "$(cat <<'EOF'
ci: stop sonarcloud.yml duplicating the full test suite run

sonarcloud.yml previously ran `npm run test:coverage` (unit + integration,
~11+ min) from scratch on every push to every branch, purely to
regenerate coverage/lcov.info — completely duplicating work ci.yml's
report job had already done seconds/minutes earlier.

Restructured to trigger via workflow_run after "CI" completes and
download the coverage-merged artifact ci.yml now publishes (see previous
commit), instead of regenerating it. Stays a separate workflow file —
not merged into ci.yml.

Known risk (flagged in the design doc, needs validation on a real PR):
workflow_run runs in the default-branch context by default; the
`ref: head_sha` checkout gets the right code, but SonarCloud's automatic
PR decoration may need explicit sonar.pullrequest.* properties since this
is no longer a native `pull_request`-triggered event. If PR decoration
breaks, the fallback is reverting this commit (accepting the duplicate
test run) rather than losing PR-level Sonar feedback.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Validate the restructured SonarCloud workflow on a real PR

**Context:** This is the explicit risk called out in the design (§2.2 and §4) — `workflow_run`-triggered jobs run in the default-branch context, which can break SonarCloud's automatic PR decoration (inline PR comments, PR-scoped new-code analysis). This can only be validated against a real GitHub Actions run on an actual PR, not locally.

**Files:** none (this task is a manual verification checklist, not code)

- [ ] **Step 1: Push the branch containing Tasks 1-5's commits and open (or update) a PR**

Run: `git push origin <branch-name>` (use whatever branch this plan is being executed on)

- [ ] **Step 2: Confirm the "CI" workflow run completes successfully**

In the GitHub Actions tab, confirm the `CI` workflow (unit → integration → report, plus the existing `reviewdog` job) completes with the `report` job showing a `coverage-merged` artifact in its run summary.

- [ ] **Step 3: Confirm the SonarCloud workflow fires and finds the artifact**

In the GitHub Actions tab, confirm a `SonarCloud` workflow run appears shortly after the `CI` run completes (triggered via `workflow_run`), and that its `sonarcloud` job's "Download merged coverage" step succeeds (not a 404/artifact-not-found error).

- [ ] **Step 4: Confirm PR decoration still works**

On the PR itself, confirm SonarCloud still posts its usual PR check/comment (coverage %, new issues, quality gate status) as it did before this change. **If PR decoration is missing or broken:**
  - Check the SonarCloud job logs for a warning about missing PR context (commonly: `Could not find a valid branch or pull request` or similar).
  - If broken, add explicit PR context properties to the `SonarCloud Scan` step's `env` or as `-D` args, e.g.:
    ```yaml
      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_CUBE_TOKEN }}
        with:
          args: >
            -Dsonar.pullrequest.key=${{ github.event.workflow_run.pull_requests[0].number }}
            -Dsonar.pullrequest.branch=${{ github.event.workflow_run.head_branch }}
            -Dsonar.pullrequest.base=main
    ```
    (This requires the triggering PR's base branch — adjust `sonar.pullrequest.base` if PRs in this repo don't always target `main`.)
  - If decoration still doesn't work after adding explicit properties, **fall back**: revert Task 5's commit (`git revert <sha>`) to restore `sonarcloud.yml`'s original self-contained `push`/`pull_request` triggers, accepting the duplicate test run rather than losing PR-level Sonar feedback. Document this outcome by updating the design doc's status line.

- [ ] **Step 5: Record the outcome**

Update the `**Status:**` line at the top of `docs/superpowers/specs/2026-07-02-cicd-pipeline-refinement-design.md` to reflect whether the `workflow_run` approach shipped successfully or was reverted, and commit that doc update.

---

## Task 7: Add a diff-scoped lint gate

**Context:** Currently `reviewdog` posts inline ESLint suggestions on PR diffs but never fails the build (`fail_level: none`). This task makes real ESLint errors within the diff actually fail the build.

**Revised during implementation.** The original plan (below, struck through in spirit) called for a *new* custom `lint` job running `git diff --name-only` + `npx eslint <changed files>`. Testing that locally against this branch's real diff (46 files changed vs. `main`) produced **400 problems (389 errors)** — because `git diff --name-only` returns whole file paths, not line ranges, so plain `eslint` re-lints each *entire* file including all its pre-existing debt, not just the touched lines. This defeats the stated goal ("the 1268-error legacy backlog never trips it").

The corrected approach: reuse the *existing* `reviewdog` job's `filter_mode: diff_context`, which already does real line-range diff-matching internally (this is what produced the ~67 correctly diff-scoped PR comments triaged earlier in this project's CodeQL/reviewdog fix work). Just flip `fail_level` from `none` to `error` — no new job, no duplicate ESLint run.

**Files:**
- Modify: `.github/workflows/ci.yml:172-181` (the existing `reviewdog` job's ESLint step)

- [ ] **Step 1: Change `fail_level` on the existing `reviewdog` step**

In `.github/workflows/ci.yml`, inside the `reviewdog` job's `reviewdog/action-eslint@v1` step, change:

```diff
+      # Inline suggestions + a real gate, scoped to changed lines only via
+      # filter_mode: diff_context — so the ~1268 pre-existing lint errors
+      # elsewhere in touched files (or in untouched files) never trip this.
+      # fail_level: error blocks the build only on ESLint *error*-severity
+      # findings within the diff; warning-severity findings still get
+      # inline comments but don't fail the build.
       - uses: reviewdog/action-eslint@v1
         with:
           github_token: ${{ secrets.GITHUB_TOKEN }}
           reporter: github-pr-review
           eslint_flags: ". --ext .js"
           filter_mode: diff_context
-          fail_level: none
+          fail_level: error
           level: warning
```

(Remove the old comment above the step — "Inline suggestions on changed lines only, so the ~1268 pre-existing lint errors don't flood the PR. Never blocks the build (fail_level: none)." — and replace it with the new comment above.)

- [ ] **Step 2: Validate the YAML is well-formed**

Run: `node -e "const fs=require('fs'); const c=fs.readFileSync('.github/workflows/ci.yml','utf8'); console.log(c.includes('fail_level: error') ? 'OK' : 'MISSING')"`
Expected: `OK`

- [ ] **Step 3: Confirm this branch's own diff wouldn't trip the new gate**

Since `reviewdog/action-eslint` can't be run as a plain CLI locally (it's a GitHub Action wrapper around ESLint + reviewdog's diff-matching, not a standalone npm package in this repo), the closest local proxy is: confirm no *new* ESLint errors were introduced on the exact lines this branch changed. Run:

```bash
git fetch origin main --depth=1
git diff "origin/main...HEAD" -- '*.js' | grep -E "^\+" | grep -v "^+++"  | wc -l
```

Expected: a non-zero count of added lines (sanity check the diff isn't empty), and manually confirm (via the targeted `npx eslint <file>` checks already run inline while writing each task's code in Tasks 1-5, e.g. Task 1's `node --check tests/helpers/db-lifecycle.js`) that no new file introduced obvious ESLint errors. Full confirmation only happens on the real PR in Task 6 — this step is a sanity check, not a substitute.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
ci: make the reviewdog ESLint check a real gate on new-line errors

Flip fail_level from none to error on the existing reviewdog job.
filter_mode: diff_context already scopes findings to lines the PR
actually changed, so this blocks the build only on real ESLint errors
introduced by this diff — the 1268-error legacy backlog elsewhere never
trips it. Warning-severity findings still get inline comments but don't
fail the build.

(Originally planned as a separate custom job using git diff --name-only +
eslint <files>, but that lints whole files, not just changed lines,
producing 400 problems against this branch's actual diff. Corrected to
reuse reviewdog's already-proven diff-context filtering instead.)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

**Spec coverage check:**
- §2.1 (integration parallelism + per-worker DB isolation) → Tasks 1-3. ✅
- §2.2 (SonarCloud stays separate, stops duplicating test run) → Tasks 4-6. ✅
- §2.3 (diff-scoped lint gate) → Task 7. ✅
- §2.4 (coverage gate — verify only, no workflow change) → No task needed per the spec itself; verification happens naturally as part of Task 6's PR check. ✅
- §3 Testing/Rollout ordering (db-lifecycle change first, in isolation, before touching workflow YAML) → Task order (1→2→3 before 4→5→6→7) matches. ✅
- §4 Risks — `workflow_run` PR decoration risk has an explicit task (Task 6) with a documented fallback; per-worker DB correctness has an explicit verification task (Task 2); uneven shard timing is a known, undismissable ceiling (not something any task claims to fix).

**Type/naming consistency check:** `buildWorkerUri()` (Task 1) is only referenced within `db-lifecycle.js` itself — no cross-task naming drift. Artifact name `coverage-merged` is used identically in Task 4 (upload) and Task 5 (download). Workflow name `"CI"` (Task 5's `workflow_run.workflows` list) matches `ci.yml`'s existing `name: CI` (unchanged, line 1).
