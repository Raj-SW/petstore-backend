/**
 * Shared integration-test factories & auth helpers.
 *
 * Replaces the `makeUser` / `signupAndLogin` snippets that were copy-pasted
 * across integration test files. Import from a test under tests/integration/:
 *
 *   const { makeUser, signupAndLogin } = require('../helpers/factories');
 */
const request = require('supertest');
const app = require('../../src/app');

let seq = 0;

/** Build a unique, valid user payload. Override any field as needed. */
function makeUser(overrides = {}) {
  seq += 1;
  return {
    name: 'Test User',
    email: `user-${Date.now()}-${seq}@example.com`,
    phoneNumber: '12345678',
    address: '123 Test St',
    password: 'Password123*',
    ...overrides,
  };
}

/**
 * Sign up then log in, returning the access token and the user payload used.
 * Pass a user from makeUser() (with e.g. { role: 'admin' }) to control it.
 */
async function signupAndLogin(userData = makeUser()) {
  await request(app).post('/api/auth/signup').send(userData);
  const res = await request(app).post('/api/auth/login').send({
    email: userData.email,
    password: userData.password,
  });
  return { token: res.body.data?.accessToken, user: userData };
}

module.exports = { makeUser, signupAndLogin };
