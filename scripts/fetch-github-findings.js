#!/usr/bin/env node
/**
 * Fetches CodeQL code-scanning alerts and reviewdog PR review comments from
 * GitHub, and writes them to reports/codeql-alerts.md and
 * reports/reviewdog-comments.md (both gitignored).
 *
 * Usage:
 *   node scripts/fetch-github-findings.js
 *
 * Required env vars (in .env):
 *   GITHUB_TOKEN — personal access token with `repo` (classic) or
 *                  Code scanning alerts (read) + Pull requests (read)
 *                  (fine-grained) scopes.
 *
 * Optional env vars:
 *   GITHUB_REPO   — "owner/repo", inferred from `git remote get-url origin` if unset.
 *   GITHUB_BRANCH — branch to find the open PR for, defaults to the current branch.
 */

require('dotenv').config();
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
  console.error('Missing required env var: GITHUB_TOKEN');
  process.exit(1);
}

function inferRepo() {
  if (process.env.GITHUB_REPO) return process.env.GITHUB_REPO;
  const url = execSync('git remote get-url origin').toString().trim();
  const match = url.match(/github\.com[:/]([^/]+)\/([^/.]+)(\.git)?$/);
  if (!match) throw new Error(`Could not parse owner/repo from remote URL: ${url}`);
  return `${match[1]}/${match[2]}`;
}

function inferBranch() {
  if (process.env.GITHUB_BRANCH) return process.env.GITHUB_BRANCH;
  return execSync('git branch --show-current').toString().trim();
}

const REPO = inferRepo();
const BRANCH = inferBranch();
const [OWNER] = REPO.split('/');

function ghRequest(apiPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: apiPath,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'petstore-backend-findings-fetcher',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode} for ${apiPath}: ${data}`));
          return;
        }
        resolve(JSON.parse(data));
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function fetchAllPages(apiPathBuilder) {
  let page = 1;
  let all = [];
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const batch = await ghRequest(apiPathBuilder(page));
    all = all.concat(batch);
    if (batch.length < 100) break;
    page += 1;
  }
  return all;
}

async function fetchCodeQLAlerts() {
  console.log(`Fetching CodeQL alerts for ${REPO}…`);
  try {
    const alerts = await fetchAllPages(
      (page) => `/repos/${REPO}/code-scanning/alerts?state=open&per_page=100&page=${page}`,
    );
    console.log(`Found ${alerts.length} open CodeQL alert(s).`);
    return alerts;
  } catch (err) {
    console.warn(`Could not fetch CodeQL alerts: ${err.message}`);
    return [];
  }
}

async function findOpenPR() {
  console.log(`Looking for an open PR for ${OWNER}:${BRANCH}…`);
  const prs = await ghRequest(`/repos/${REPO}/pulls?state=open&head=${OWNER}:${BRANCH}`);
  if (prs.length === 0) {
    console.log('No open PR found for this branch.');
    return null;
  }
  console.log(`Found PR #${prs[0].number}: ${prs[0].title}`);
  return prs[0];
}

async function fetchReviewComments(prNumber) {
  console.log(`Fetching review comments for PR #${prNumber}…`);
  const comments = await fetchAllPages(
    (page) => `/repos/${REPO}/pulls/${prNumber}/comments?per_page=100&page=${page}`,
  );
  // reviewdog posts as a specific bot/user; keep everything, tag the source below.
  console.log(`Found ${comments.length} review comment(s).`);
  return comments;
}

function buildCodeQLReport(alerts) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const lines = [
    '# CodeQL Alerts Report',
    `**Repo:** \`${REPO}\`  `,
    `**Generated:** ${now}  `,
    `**Total open alerts:** ${alerts.length}`,
    '',
  ];

  if (alerts.length === 0) {
    lines.push('No open CodeQL alerts. 🎉');
    return lines.join('\n');
  }

  const bySeverity = {};
  for (const a of alerts) {
    const sev = a.rule?.security_severity_level || a.rule?.severity || 'unknown';
    if (!bySeverity[sev]) bySeverity[sev] = [];
    bySeverity[sev].push(a);
  }

  lines.push('## Summary by Severity', '', '| Severity | Count |', '|---|---|');
  for (const [sev, list] of Object.entries(bySeverity)) {
    lines.push(`| ${sev} | ${list.length} |`);
  }
  lines.push('', '---', '', '## Alerts', '');

  for (const a of alerts) {
    const loc = a.most_recent_instance?.location;
    const file = loc ? `${loc.path}:${loc.start_line}` : 'unknown location';
    lines.push(`### #${a.number} — ${a.rule.description}`);
    lines.push(`- **File:** \`${file}\``);
    lines.push(`- **Rule:** \`${a.rule.id}\` | **Severity:** ${a.rule.security_severity_level || a.rule.severity}`);
    lines.push(`- **URL:** ${a.html_url}`);
    lines.push('');
  }

  return lines.join('\n');
}

function buildReviewdogReport(pr, comments) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const lines = [
    '# Reviewdog / PR Review Comments Report',
    `**Repo:** \`${REPO}\`  `,
    `**Generated:** ${now}  `,
    pr ? `**PR:** #${pr.number} — ${pr.title}  ` : '**PR:** none found',
    `**Total comments:** ${comments.length}`,
    '',
  ];

  if (comments.length === 0) {
    lines.push('No review comments found.');
    return lines.join('\n');
  }

  lines.push('## Comments', '');
  for (const c of comments) {
    lines.push(`### \`${c.path}:${c.line || c.original_line || '?'}\``);
    lines.push(`- **Author:** ${c.user?.login || 'unknown'}`);
    lines.push(`- **Body:**\n\n${c.body}\n`);
    lines.push(`- **URL:** ${c.html_url}`);
    lines.push('');
  }

  return lines.join('\n');
}

async function main() {
  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const alerts = await fetchCodeQLAlerts();
  const codeqlReport = buildCodeQLReport(alerts);
  const codeqlPath = path.join(reportsDir, 'codeql-alerts.md');
  fs.writeFileSync(codeqlPath, codeqlReport, 'utf8');
  console.log(`CodeQL report saved to: ${codeqlPath}`);
  fs.writeFileSync(path.join(reportsDir, 'codeql-alerts.json'), JSON.stringify(alerts, null, 2), 'utf8');

  const pr = await findOpenPR();
  const comments = pr ? await fetchReviewComments(pr.number) : [];
  const reviewdogReport = buildReviewdogReport(pr, comments);
  const reviewdogPath = path.join(reportsDir, 'reviewdog-comments.md');
  fs.writeFileSync(reviewdogPath, reviewdogReport, 'utf8');
  console.log(`Reviewdog report saved to: ${reviewdogPath}`);
  fs.writeFileSync(path.join(reportsDir, 'reviewdog-comments.json'), JSON.stringify(comments, null, 2), 'utf8');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
