/**
 * Jest configuration — the test pyramid expressed as Jest "projects".
 *
 *   unit        co-located test files under src (see testMatch below).
 *               No database, fully isolated, fast.
 *   integration test files under tests/. Supertest against the real Express
 *               app, backed by an in-memory MongoDB replica set (tests/setup.js).
 *
 * A future `e2e` project (black-box API over real HTTP + a real Mongo service)
 * will be added as a third entry here.
 *
 * Coverage is collected across all selected projects in a single `--coverage`
 * run; the options below live at the root so they apply to the whole run.
 */
module.exports = {
  testTimeout: 30000,
  // Ignore the git worktree copy so Haste doesn't see duplicate package.json/modules.
  modulePathIgnorePatterns: ['<rootDir>/.worktrees/'],

  collectCoverageFrom: [
    'src/controllers/**/*.js',
    'src/services/**/*.js',
    'src/models/**/*.js',
    'src/middlewares/**/*.js',
    'src/validators/**/*.js',
    'src/utils/**/*.js',
    '!src/**/*.test.js',
  ],
  coverageReporters: ['text', 'lcov', 'text-summary'],
  coverageDirectory: 'coverage',

  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      setupFiles: ['<rootDir>/tests/env-setup.js'],
      testMatch: ['<rootDir>/src/**/*.test.js'],
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      globalSetup: '<rootDir>/tests/setup.js',
      globalTeardown: '<rootDir>/tests/teardown.js',
      setupFiles: ['<rootDir>/tests/env-setup.js'],
      testMatch: ['<rootDir>/tests/**/*.test.js'],
    },
  ],
};
