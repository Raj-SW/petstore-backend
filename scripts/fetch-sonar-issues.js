#!/usr/bin/env node
/**
 * Fetches all SonarQube/SonarCloud issues for the project and generates a
 * Markdown report saved to reports/sonar-issues.md
 *
 * Usage:
 *   node scripts/fetch-sonar-issues.js
 *
 * Required env vars (in .env):
 *   SONAR_HOST_URL   — e.g. https://sonarcloud.io or http://localhost:9000
 *   SONAR_TOKEN      — personal access token
 *   SONAR_PROJECT_KEY — your project key, e.g. raj-sw
 */

require('dotenv').config();
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = (process.env.SONAR_HOST_URL || '').replace(/\/$/, '');
const TOKEN = process.env.SONAR_TOKEN;
const PROJECT_KEY = process.env.SONAR_PROJECT_KEY;

if (!HOST || !TOKEN || !PROJECT_KEY) {
  console.error('Missing required env vars: SONAR_HOST_URL, SONAR_TOKEN, SONAR_PROJECT_KEY');
  process.exit(1);
}

function fetchPage(page) {
  return new Promise((resolve, reject) => {
    const url = `${HOST}/api/issues/search?componentKeys=${encodeURIComponent(PROJECT_KEY)}&resolved=false&ps=100&p=${page}`;
    const parsed = new URL(url);
    const token = Buffer.from(`${TOKEN}:`).toString('base64');

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
    };

    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          return;
        }
        resolve(JSON.parse(data));
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function fetchAllIssues() {
  console.log(`Fetching issues from ${HOST} for project "${PROJECT_KEY}"…`);
  const first = await fetchPage(1);
  const { total } = first;
  const pages = Math.ceil(total / 100);
  console.log(`Total issues: ${total} across ${pages} page(s)`);

  let issues = [...first.issues];
  for (let p = 2; p <= pages; p += 1) {
    // eslint-disable-next-line no-await-in-loop -- sequential pagination, avoids hammering the API
    const data = await fetchPage(p);
    issues = issues.concat(data.issues);
    process.stdout.write(`  Fetched page ${p}/${pages}\r`);
  }
  console.log(`\nDone. Collected ${issues.length} issues.`);
  return issues;
}

const SEVERITY_ORDER = ['BLOCKER', 'CRITICAL', 'MAJOR', 'MINOR', 'INFO'];
const SEVERITY_EMOJI = {
  BLOCKER: '🔴',
  CRITICAL: '🟠',
  MAJOR: '🟡',
  MINOR: '🔵',
  INFO: '⚪',
};

function buildReport(issues) {
  const now = `${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`;

  // Group by severity
  const bySeverity = {};
  for (const sev of SEVERITY_ORDER) bySeverity[sev] = [];
  for (const issue of issues) {
    const sev = issue.severity || 'INFO';
    if (!bySeverity[sev]) bySeverity[sev] = [];
    bySeverity[sev].push(issue);
  }

  // Group by type
  const byType = {};
  for (const issue of issues) {
    const t = issue.type || 'UNKNOWN';
    if (!byType[t]) byType[t] = 0;
    byType[t] += 1;
  }

  // Group by file
  const byFile = {};
  for (const issue of issues) {
    const comp = issue.component || '';
    const file = comp.includes(':') ? comp.split(':').slice(1).join(':') : comp;
    if (!byFile[file]) byFile[file] = [];
    byFile[file].push(issue);
  }

  const lines = [];

  lines.push('# SonarQube Issues Report');
  lines.push(`**Project:** \`${PROJECT_KEY}\`  `);
  lines.push(`**Generated:** ${now}  `);
  lines.push(`**Total issues:** ${issues.length}`);
  lines.push('');

  // Summary table
  lines.push('## Summary by Severity');
  lines.push('');
  lines.push('| Severity | Count |');
  lines.push('|----------|-------|');
  for (const sev of SEVERITY_ORDER) {
    const count = bySeverity[sev].length;
    if (count > 0) lines.push(`| ${SEVERITY_EMOJI[sev]} ${sev} | ${count} |`);
  }
  lines.push('');

  lines.push('## Summary by Type');
  lines.push('');
  lines.push('| Type | Count |');
  lines.push('|------|-------|');
  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${type} | ${count} |`);
  }
  lines.push('');

  lines.push('## Summary by File');
  lines.push('');
  lines.push('| File | Issues |');
  lines.push('|------|--------|');
  const sortedFiles = Object.entries(byFile).sort((a, b) => b[1].length - a[1].length);
  for (const [file, fileIssues] of sortedFiles) {
    lines.push(`| \`${file}\` | ${fileIssues.length} |`);
  }
  lines.push('');

  // Detail by severity
  lines.push('---');
  lines.push('');
  lines.push('## Issues by Severity');
  lines.push('');

  const nonEmptySeverities = SEVERITY_ORDER.filter((sev) => bySeverity[sev].length > 0);
  for (const sev of nonEmptySeverities) {
    const sevIssues = bySeverity[sev];
    lines.push(`### ${SEVERITY_EMOJI[sev]} ${sev} (${sevIssues.length})`);
    lines.push('');

    for (const issue of sevIssues) {
      const comp = issue.component || '';
      const file = comp.includes(':') ? comp.split(':').slice(1).join(':') : comp;
      const line = issue.textRange ? issue.textRange.startLine : '?';
      const rule = issue.rule || '';
      const message = issue.message || '';
      const type = issue.type || '';

      lines.push(`- **\`${file}:${line}\`** — ${message}`);
      lines.push(`  - Rule: \`${rule}\` | Type: ${type}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

async function main() {
  const issues = await fetchAllIssues();
  const report = buildReport(issues);

  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const outPath = path.join(reportsDir, 'sonar-issues.md');
  fs.writeFileSync(outPath, report, 'utf8');
  console.log(`Report saved to: ${outPath}`);

  // Also save raw JSON for programmatic use
  const jsonPath = path.join(reportsDir, 'sonar-issues.json');
  fs.writeFileSync(jsonPath, JSON.stringify(issues, null, 2), 'utf8');
  console.log(`Raw JSON saved to: ${jsonPath}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
