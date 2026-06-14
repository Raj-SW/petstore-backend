const mongoose = require('mongoose');
const GalleryPost = require('../src/models/galleryPost.model');

describe('GalleryPost model', () => {
  it('requires title, body, category, eventDate, createdBy', () => {
    const err = new GalleryPost({}).validateSync();
    expect(err.errors.title).toBeDefined();
    expect(err.errors.body).toBeDefined();
    expect(err.errors.category).toBeDefined();
    expect(err.errors.eventDate).toBeDefined();
    expect(err.errors.createdBy).toBeDefined();
  });

  it('rejects an invalid category', () => {
    const err = new GalleryPost({
      title: 'X',
      body: '<p>x</p>',
      category: 'nope',
      eventDate: new Date(),
      createdBy: new mongoose.Types.ObjectId(),
    }).validateSync();
    expect(err.errors.category).toBeDefined();
  });

  it('accepts a valid document', () => {
    const err = new GalleryPost({
      title: 'Mauritius Pet Expo 2026',
      body: '<p>A great day.</p>',
      category: 'event',
      eventDate: new Date(),
      createdBy: new mongoose.Types.ObjectId(),
    }).validateSync();
    expect(err).toBeUndefined();
  });

  it('exposes the category list as a static', () => {
    expect(GalleryPost.CATEGORIES).toContain('event');
    expect(GalleryPost.CATEGORIES).toContain('behind_the_scenes');
  });
});
