const mongoose = require('mongoose');
const Advert = require('../src/models/advert.model');

describe('Advert model — hero', () => {
  it('accepts placement "hero" without a link', () => {
    const err = new Advert({
      title: 'Hero One',
      placement: 'hero',
      createdBy: new mongoose.Types.ObjectId(),
    }).validateSync();
    expect(err).toBeUndefined();
  });

  it('still requires a link for banner placement', () => {
    const err = new Advert({
      title: 'Banner',
      placement: 'banner',
      createdBy: new mongoose.Types.ObjectId(),
    }).validateSync();
    expect(err.errors.link).toBeDefined();
  });

  it('defaults order to 0', () => {
    const a = new Advert({
      title: 'X',
      placement: 'hero',
      createdBy: new mongoose.Types.ObjectId(),
    });
    expect(a.order).toBe(0);
  });
});
