/**
 * Migration: legacy product schema → new schema
 *
 * Legacy fields:        New fields:
 *   title       →        name
 *   category    →        categories[]
 *   imageUrl    →        images[{ url, publicId }]
 *   stock       →        quantity
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI not set in .env');
  process.exit(1);
}

function extractPublicId(cloudinaryUrl) {
  try {
    // https://res.cloudinary.com/<cloud>/image/upload/v123456/filename.webp
    // publicId = "filename" (no extension)
    const parts = cloudinaryUrl.split('/');
    const filename = parts[parts.length - 1];
    return filename.replace(/\.[^.]+$/, '');
  } catch {
    return '';
  }
}

async function migrate() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB\n');

  const col = mongoose.connection.db.collection('products');

  // Target: documents missing the new `name` field (i.e. legacy docs)
  const legacy = await col.find({
    $or: [
      { name: { $exists: false } },
      { name: null },
      { name: '' },
    ],
  }).toArray();

  console.log(`Found ${legacy.length} legacy products to migrate\n`);

  let migrated = 0;
  let skipped = 0;
  let failed  = 0;

  for (const p of legacy) {
    const $set = {};

    // title → name
    if (p.title) {
      $set.name = p.title;
    } else {
      console.warn(`  SKIP ${p._id}: no title to migrate`);
      skipped++;
      continue;
    }

    // category (string) → categories (array)
    if (!p.categories || p.categories.length === 0) {
      $set.categories = p.category ? [p.category] : [];
    }

    // imageUrl → images[{ url, publicId }]
    if (!p.images || p.images.length === 0) {
      if (p.imageUrl) {
        $set.images = [{ url: p.imageUrl, publicId: extractPublicId(p.imageUrl) }];
      }
    }

    // stock → quantity (use stock as the authoritative value for legacy docs)
    if (p.stock !== undefined && p.stock !== null) {
      $set.quantity = p.stock;
    }

    try {
      await col.updateOne({ _id: p._id }, { $set });
      migrated++;
      console.log(`  ✓  ${p.title}`);
      console.log(`       name="${$set.name}" categories=${JSON.stringify($set.categories)} quantity=${$set.quantity ?? '(unchanged)'}`);
    } catch (err) {
      failed++;
      console.error(`  ✗  ${p._id}: ${err.message}`);
    }
  }

  console.log('\n─────────────────────────────');
  console.log(`Migrated : ${migrated}`);
  console.log(`Skipped  : ${skipped}`);
  console.log(`Failed   : ${failed}`);
  console.log('─────────────────────────────\n');

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
