# E2E tests (black-box API)

Reserved for Phase 3: black-box end-to-end tests that start the real server
process and exercise it over real HTTP as an external client, backed by a real
MongoDB (service container in CI, `mongodb-memory-server` locally).

Once populated, a third Jest project (`e2e`) is added in `jest.config.js`
matching `tests/e2e/**/*.test.js`, plus a `test:e2e` script and a CI job.

Scope (planned): auth lifecycle, order lifecycle → invoice, payment with mocked
gateways, subscription create → enriched detail.
