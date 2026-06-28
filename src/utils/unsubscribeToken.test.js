const jwt = require('jsonwebtoken');
const {
  makeUnsubscribeToken,
  verifyUnsubscribeToken,
  BUCKET_FIELD,
} = require('./unsubscribeToken');

// JWT_SECRET is provided by tests/helpers/env-setup.js (.env.test).
const USER_ID = '507f1f77bcf86cd799439011';

describe('makeUnsubscribeToken / verifyUnsubscribeToken round-trip', () => {
  it('defaults to the promotions bucket (sales field)', () => {
    const token = makeUnsubscribeToken(USER_ID);
    expect(verifyUnsubscribeToken(token)).toEqual({
      userId: USER_ID, bucket: 'promotions', field: 'sales',
    });
  });

  it('honours the news bucket', () => {
    const token = makeUnsubscribeToken(USER_ID, 'news');
    expect(verifyUnsubscribeToken(token)).toEqual({
      userId: USER_ID, bucket: 'news', field: 'news',
    });
  });

  it('accepts a non-string userId by stringifying it', () => {
    const token = makeUnsubscribeToken({ toString: () => USER_ID });
    expect(verifyUnsubscribeToken(token).userId).toBe(USER_ID);
  });
});

describe('verifyUnsubscribeToken edge cases', () => {
  it('returns null for a garbage token', () => {
    expect(verifyUnsubscribeToken('not.a.jwt')).toBeNull();
  });

  it('returns null for a token signed with the wrong secret', () => {
    const bad = jwt.sign({ id: USER_ID, purpose: 'unsubscribe' }, 'wrong-secret');
    expect(verifyUnsubscribeToken(bad)).toBeNull();
  });

  it('returns null for a wrong-purpose token', () => {
    const bad = jwt.sign({ id: USER_ID, purpose: 'login' }, process.env.JWT_SECRET);
    expect(verifyUnsubscribeToken(bad)).toBeNull();
  });

  it('accepts legacy "unsubscribe-sales" tokens as the promotions bucket', () => {
    const legacy = jwt.sign(
      { id: USER_ID, purpose: 'unsubscribe-sales' },
      process.env.JWT_SECRET,
    );
    expect(verifyUnsubscribeToken(legacy)).toEqual({
      userId: USER_ID, bucket: 'promotions', field: 'sales',
    });
  });

  it('falls back to promotions for an unknown bucket value', () => {
    const token = jwt.sign(
      { id: USER_ID, purpose: 'unsubscribe', bucket: 'bogus' },
      process.env.JWT_SECRET,
    );
    expect(verifyUnsubscribeToken(token).bucket).toBe('promotions');
  });
});

describe('BUCKET_FIELD map', () => {
  it('maps promotions→sales and news→news', () => {
    expect(BUCKET_FIELD).toEqual({ promotions: 'sales', news: 'news' });
  });
});
