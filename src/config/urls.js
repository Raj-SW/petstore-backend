// Single source of truth for building frontend + public-API URLs used in emails
// and redirects. Resolves the base from whichever env var the deploy actually
// sets, normalises slashes, and warns loudly at startup when production is
// missing the email-critical URLs (which otherwise silently fall back to
// localhost — the root cause of the announcement "wrong URL" bug).

const logger = require('../utils/logger');

// Linear slash-trimming (no regex) to avoid super-linear backtracking (S8786).
const SLASH = '/'.charCodeAt(0);
const stripTrailing = (s) => {
  const str = String(s || '');
  let end = str.length;
  while (end > 0 && str.charCodeAt(end - 1) === SLASH) end -= 1;
  return str.slice(0, end);
};
const stripBoth = (s) => {
  const str = String(s || '');
  let start = 0;
  let end = str.length;
  while (start < end && str.charCodeAt(start) === SLASH) start += 1;
  while (end > start && str.charCodeAt(end - 1) === SLASH) end -= 1;
  return str.slice(start, end);
};

const FRONTEND_BASE = stripTrailing(
  process.env.FRONTEND_URL
  || process.env.CLIENT_URL
  || process.env.VERCEL_FRONTEND_URL
  || 'http://localhost:5173'
);

const API_BASE = stripTrailing(process.env.API_PUBLIC_URL || 'http://localhost:5000/api');

const frontendUrl = (path = '') => {
  const p = stripBoth(path);
  return p ? `${FRONTEND_BASE}/${p}` : FRONTEND_BASE;
};

const apiUrl = (path = '') => {
  const p = stripBoth(path);
  return p ? `${API_BASE}/${p}` : API_BASE;
};

const productUrl = (id) => frontendUrl(`product/${id}`);
const shopUrl = () => frontendUrl('petshop');

// Warn (don't throw) when production is missing email-critical URL config.
function validateUrlConfig() {
  if (process.env.NODE_ENV !== 'production') return;
  if (!process.env.FRONTEND_URL && !process.env.CLIENT_URL && !process.env.VERCEL_FRONTEND_URL) {
    logger.warn('[urls] No frontend base URL set (FRONTEND_URL/CLIENT_URL/VERCEL_FRONTEND_URL) — email links will point to localhost');
  }
  if (!process.env.API_PUBLIC_URL) {
    logger.warn('[urls] API_PUBLIC_URL not set — unsubscribe / public-API links will point to localhost');
  }
}

module.exports = {
  FRONTEND_BASE,
  API_BASE,
  frontendUrl,
  apiUrl,
  productUrl,
  shopUrl,
  validateUrlConfig,
};
