/**
 * Unit tests for the upload middleware.
 * Uses a minimal standalone Express app so the real multer limits are exercised
 * without the avatar test's mock overriding them.
 */
const request = require('supertest');
const express = require('express');

function buildTestApp() {
  const { upload } = require('./upload');
  const app = express();
  app.post('/upload', upload.single('file'), (req, res) => {
    res.json({ ok: true });
  });
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.statusCode || 400;
    res.status(status).json({ error: err.message, code: err.code });
  });
  return app;
}

describe('upload middleware', () => {
  let app;

  beforeAll(() => {
    app = buildTestApp();
  });

  it('accepts a file under 15 MB', async () => {
    const small = Buffer.alloc(1024, 0);
    const res = await request(app)
      .post('/upload')
      .attach('file', small, { filename: 'small.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
  });

  it('rejects a file over 15 MB with a 4xx error', async () => {
    const oversized = Buffer.alloc(15 * 1024 * 1024 + 1, 0);
    const res = await request(app)
      .post('/upload')
      .attach('file', oversized, { filename: 'big.png', contentType: 'image/png' });

    expect([400, 413]).toContain(res.status);
    expect(res.body.code).toBe('LIMIT_FILE_SIZE');
  });

  it('rejects non-image mime types', async () => {
    const buf = Buffer.from('not an image');
    const res = await request(app)
      .post('/upload')
      .attach('file', buf, { filename: 'doc.pdf', contentType: 'application/pdf' });

    expect([400, 415]).toContain(res.status);
  });
});
