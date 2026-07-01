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

/**
 * Strip control characters (including CR/LF) from a user-supplied value before
 * it is interpolated into a log message, preventing log-forging / log-injection
 * (SonarQube jssecurity:S5145). Char-code filtering is used instead of a
 * control-character regex literal so the source stays free of control chars.
 *
 * @param {*} value
 * @returns {string}
 */
function sanitizeForLog(value) {
  if (value === null || value === undefined) return '';
  let out = '';
  const str = String(value);
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    if (code > 0x1f && code !== 0x7f) out += str[i];
  }
  return out;
}

module.exports = { toSafeString, escapeRegExp, sanitizeForLog };
