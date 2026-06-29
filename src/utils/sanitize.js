/**
 * Input-sanitization helpers for defending Mongo queries against
 * NoSQL operator-injection (SonarQube jssecurity:S5147) and regex
 * injection / ReDoS (jssecurity:S2631).
 *
 * The app already applies `express-mongo-sanitize` globally (see src/app.js),
 * but these helpers sanitize at the query site so the intent is explicit,
 * type-safe, and statically verifiable.
 */

/**
 * Coerce a user-supplied value into a primitive string safe to use in a
 * Mongo equality filter. Objects and arrays — the operator-injection vector,
 * e.g. `{ $ne: null }` — are rejected (returns undefined) rather than allowed
 * to reach the query. Callers should guard: `const v = toSafeString(x); if (v) ...`.
 *
 * @param {*} value
 * @returns {string|undefined}
 */
function toSafeString(value) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'object') return undefined;
  return String(value);
}

/**
 * Escape regular-expression metacharacters in a user-supplied value so it can
 * be used as a literal inside a RegExp without injecting a pattern or causing
 * catastrophic backtracking (ReDoS).
 *
 * @param {*} value
 * @returns {string}
 */
function escapeRegExp(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { toSafeString, escapeRegExp };
