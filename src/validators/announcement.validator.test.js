const { validateAnnouncement } = require('./announcement.validator');
const { AppError } = require('../middlewares/errorHandler');

const run = (body) => {
  const req = { body: { ...body } };
  let err = null;
  validateAnnouncement(req, {}, (e) => { err = e || null; });
  return { err, body: req.body };
};

const OID = '507f1f77bcf86cd799439011';

describe('validateAnnouncement — type required', () => {
  it('rejects a missing type', () => {
    expect(run({ subject: 'Hello there' }).err).toBeInstanceOf(AppError);
  });

  it('back-fills type=sale when productIds present without a type', () => {
    const { err, body } = run({ subject: 'Big Sale', productIds: [OID] });
    expect(err).toBeNull();
    expect(body.type).toBe('sale');
  });

  it('strips a client-supplied bucket', () => {
    const { body } = run({ type: 'sale', subject: 'Sale', productIds: [OID], bucket: 'hacked' });
    expect(body.bucket).toBeUndefined();
  });
});

describe('validateAnnouncement — product types', () => {
  it('requires at least one product for a sale', () => {
    const err = run({ type: 'sale', subject: 'Sale time' }).err;
    expect(err.message).toMatch(/at least one product/);
  });

  it('passes a restock with productIds', () => {
    expect(run({ type: 'restock', subject: 'Back in stock', productIds: [OID] }).err).toBeNull();
  });
});

describe('validateAnnouncement — content types', () => {
  it('requires a contentRef for new_tip', () => {
    expect(run({ type: 'new_tip', subject: 'New tip!' }).err.message)
      .toMatch(/tip or post must be selected/);
  });

  it('passes new_post with a full contentRef', () => {
    expect(run({
      type: 'new_post', subject: 'New post', contentRef: { kind: 'post', id: OID },
    }).err).toBeNull();
  });
});

describe('validateAnnouncement — event', () => {
  it('requires title and startsAt', () => {
    expect(run({ type: 'event', subject: 'Event' }).err.message)
      .toMatch(/title and start date/);
  });

  it('rejects an end date before the start date', () => {
    expect(run({
      type: 'event', subject: 'Event',
      event: { title: 'Adopt Day', startsAt: '2026-07-10', endsAt: '2026-07-01' },
    }).err.message).toMatch(/on or after the start date/);
  });

  it('passes a valid event', () => {
    expect(run({
      type: 'event', subject: 'Event',
      event: { title: 'Adopt Day', startsAt: '2026-07-01', endsAt: '2026-07-02' },
    }).err).toBeNull();
  });
});

describe('validateAnnouncement — general', () => {
  it('requires a message or a cta url', () => {
    expect(run({ type: 'general', subject: 'Notice' }).err.message)
      .toMatch(/message or a call-to-action/);
  });

  it('passes with a message', () => {
    expect(run({ type: 'general', subject: 'Notice', message: 'We are open' }).err).toBeNull();
  });

  it('rejects a non-http cta url', () => {
    expect(run({
      type: 'general', subject: 'Notice', cta: { label: 'Go', url: 'javascript:alert(1)' },
    }).err).toBeInstanceOf(AppError);
  });
});
