// Shared helpers for tip/gallery cover + section images (Epic 8).

// Normalise a coverImage value to the { url, publicId } shape. Legacy data and
// older clients may send a bare URL string.
function coerceCoverImage(cover) {
  if (cover === undefined || cover === null) return undefined;
  if (typeof cover === 'string') return { url: cover, publicId: '' };
  return { url: cover.url || '', publicId: cover.publicId || '' };
}

// Collect every Cloudinary publicId referenced by a doc/payload's cover + section
// images, so update flows can diff stored-vs-incoming and clean up removed assets.
// Collect publicIds from a doc/payload's section images (handles missing/odd shapes).
function collectSectionPublicIds(sections) {
  const ids = [];
  for (const section of Array.isArray(sections) ? sections : []) {
    for (const img of Array.isArray(section.images) ? section.images : []) {
      if (img?.publicId) ids.push(img.publicId);
    }
  }
  return ids;
}

function collectImagePublicIds(source) {
  if (!source) return [];
  const ids = [];
  const cover = source.coverImage;
  if (cover && typeof cover === 'object' && cover.publicId) ids.push(cover.publicId);
  ids.push(...collectSectionPublicIds(source.sections));
  return ids;
}

module.exports = { coerceCoverImage, collectImagePublicIds };
