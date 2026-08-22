/**
 * Purge translation-cache rows that predate the entity-decoding fix and the
 * French glossary.
 *
 * Two classes of bad row:
 *   1. Entity garbage — MyMemory's HTML-escaped output was stored verbatim,
 *      so the footer rendered a literal "S&#39;abonner&#10;".
 *   2. Strings the glossary now owns — cached machine output like
 *      "Page d'accueil" for "Home" is bypassed at read time, but leaving it
 *      behind is confusing and it would resurface if a key were ever removed.
 *
 * Rows marked `reviewed: true` are never touched — a human corrected those.
 *
 * Cache rows are regenerable, so deleting is safe: anything still needed is
 * re-fetched on the next request.
 *
 *   node scripts/purgeBadTranslations.js          # dry run, reports only
 *   node scripts/purgeBadTranslations.js --apply  # actually delete
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Translation = require('../src/models/translation.model');
const { GLOSSARY } = require('../src/data/frGlossary');
const { hashText } = require('../src/utils/translate');

const APPLY = process.argv.includes('--apply');

// Any HTML entity that survived into stored text.
const ENTITY = /&(#\d+|#x[0-9a-f]+|amp|quot|apos|lt|gt);/i;

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set — check backend/.env');
  await mongoose.connect(uri);

  const all = await Translation.find({ reviewed: { $ne: true } }).lean();
  const glossaryHashes = new Set(Object.keys(GLOSSARY).map(hashText));

  const entityRows = all.filter((r) => ENTITY.test(r.text || ''));
  const supersededRows = all.filter(
    (r) => !ENTITY.test(r.text || '') && glossaryHashes.has(r.hash),
  );

  const doomed = [...entityRows, ...supersededRows];

  console.log(`scanned            : ${all.length} unreviewed rows`);
  console.log(`entity garbage     : ${entityRows.length}`);
  console.log(`superseded by gloss: ${supersededRows.length}`);
  console.log(`to delete          : ${doomed.length}`);
  console.log('');
  doomed.slice(0, 15).forEach((r) => {
    console.log(`  ${JSON.stringify(r.source)} -> ${JSON.stringify(r.text)}`);
  });
  if (doomed.length > 15) console.log(`  … and ${doomed.length - 15} more`);

  if (!APPLY) {
    console.log('\nDRY RUN — nothing deleted. Re-run with --apply to delete.');
  } else if (doomed.length > 0) {
    const res = await Translation.deleteMany({ _id: { $in: doomed.map((r) => r._id) } });
    console.log(`\nDeleted ${res.deletedCount} rows.`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
