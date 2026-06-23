/**
 * Tests for src/config/urls.js — the shared frontend/API URL resolver (Epic 9a).
 * The module reads env at load time, so each case requires it fresh.
 */
const ENV_KEYS = ['FRONTEND_URL', 'CLIENT_URL', 'VERCEL_FRONTEND_URL', 'API_PUBLIC_URL'];

function loadUrls(overrides = {}) {
  jest.resetModules();
  ENV_KEYS.forEach((k) => delete process.env[k]);
  Object.assign(process.env, overrides);
  return require('../src/config/urls');
}

describe('config/urls', () => {
  const ORIGINAL = {};
  beforeAll(() => { ENV_KEYS.forEach((k) => { ORIGINAL[k] = process.env[k]; }); });
  afterAll(() => {
    jest.resetModules();
    ENV_KEYS.forEach((k) => {
      if (ORIGINAL[k] === undefined) delete process.env[k];
      else process.env[k] = ORIGINAL[k];
    });
  });

  it('builds frontend/product/shop URLs and strips slashes', () => {
    const u = loadUrls({ FRONTEND_URL: 'https://app.example.com/' });
    expect(u.frontendUrl('/petshop/')).toBe('https://app.example.com/petshop');
    expect(u.productUrl('abc123')).toBe('https://app.example.com/product/abc123');
    expect(u.shopUrl()).toBe('https://app.example.com/petshop');
  });

  it('builds API URLs from API_PUBLIC_URL', () => {
    const u = loadUrls({ API_PUBLIC_URL: 'https://api.example.com/api' });
    expect(u.apiUrl('announcements/unsubscribe')).toBe('https://api.example.com/api/announcements/unsubscribe');
  });

  it('resolves the frontend base with FRONTEND_URL > CLIENT_URL > VERCEL_FRONTEND_URL', () => {
    expect(loadUrls({ CLIENT_URL: 'https://c.example.com' }).FRONTEND_BASE).toBe('https://c.example.com');
    expect(loadUrls({ VERCEL_FRONTEND_URL: 'https://v.example.com' }).FRONTEND_BASE).toBe('https://v.example.com');
    expect(loadUrls({ FRONTEND_URL: 'https://f.example.com', CLIENT_URL: 'https://c.example.com' }).FRONTEND_BASE)
      .toBe('https://f.example.com');
  });

  it('defaults to localhost when nothing is set', () => {
    const u = loadUrls({});
    expect(u.FRONTEND_BASE).toBe('http://localhost:5173');
    expect(u.API_BASE).toBe('http://localhost:5000/api');
  });
});
