const Feedback = require('../src/models/feedback.model');

describe('Feedback model', () => {
  it('requires name, rating, message', () => {
    const e = new Feedback({}).validateSync();
    expect(e.errors.name).toBeDefined();
    expect(e.errors.rating).toBeDefined();
    expect(e.errors.message).toBeDefined();
  });

  it('rejects a rating out of range', () => {
    const e = new Feedback({ name: 'Amy', rating: 9, message: 'Lovely place' }).validateSync();
    expect(e.errors.rating).toBeDefined();
  });

  it('rejects more than 3 photos', () => {
    const photos = [{ url: 'a' }, { url: 'b' }, { url: 'c' }, { url: 'd' }];
    const e = new Feedback({ name: 'Amy', rating: 5, message: 'Lovely place', photos }).validateSync();
    expect(e.errors.photos).toBeDefined();
  });

  it('defaults approved to false and accepts a valid doc', () => {
    const fb = new Feedback({ name: 'Amy', rating: 5, message: 'Lovely place', photos: [{ url: 'a', publicId: 'p' }] });
    expect(fb.approved).toBe(false);
    expect(fb.validateSync()).toBeUndefined();
  });
});
