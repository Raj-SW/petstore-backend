/**
 * Epic 8 migration — wrap legacy string `coverImage` values on PetCareTip and
 * GalleryPost into the new `{ url, publicId }` shape. Best-effort publicId parse
 * from the Cloudinary URL. Idempotent: docs already in object shape are skipped.
 *
 *   node scripts/migrate-cover-images.js
 *
 * Exposes migrateCollection() for tests.
 */
const mongoose = require('mongoose');

// Cloudinary URLs look like .../upload/v123/<folder>/<name>.<ext>; the publicId
// is "<folder>/<name>" (no version, no extension). Best-effort only.
function parsePublicId(url) {
  if (typeof url !== 'string' || !url) return '';
  const m = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
  return m ? m[1] : '';
}

// Migrate one collection's string coverImage fields in place. Returns the count
// of documents updated. Operates via the raw driver so legacy strings (which no
// longer match the schema) can be read.
async function migrateCollection(collection) {
  const cursor = collection.find({ coverImage: { $type: 'string' } });
  let updated = 0;
  // eslint-disable-next-line no-await-in-loop
  for (let doc = await cursor.next(); doc; doc = await cursor.next()) {
    const url = doc.coverImage || '';
    // eslint-disable-next-line no-await-in-loop
    await collection.updateOne(
      { _id: doc._id },
      { $set: { coverImage: { url, publicId: parsePublicId(url) } } },
    );
    updated += 1;
  }
  return updated;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/petstore');
  const db = mongoose.connection.db;
  const tips = await migrateCollection(db.collection('petcaretips'));
  const posts = await migrateCollection(db.collection('galleryposts'));
  // eslint-disable-next-line no-console
  console.log(`Migrated coverImage: ${tips} tips, ${posts} gallery posts.`);
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { migrateCollection, parsePublicId };
