/**
 * Export all products from MongoDB to a JSON file for review.
 *
 * Usage (from backend/):
 *   node scripts/export-products.js
 *   node scripts/export-products.js --out tmp/my-products.json
 *
 * Output: tmp/products-export-<timestamp>.json  (or --out path)
 * Requires MONGODB_URI in .env
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Product = require('../src/models/product.model');

const outArg = process.argv.indexOf('--out');
const outFile = outArg !== -1
  ? path.resolve(process.argv[outArg + 1])
  : path.join(__dirname, `../tmp/products-export-${Date.now()}.json`);

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const products = await Product.find({}).lean();
  console.log(`Found ${products.length} product(s)`);

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(products, null, 2));

  console.log(`Exported → ${outFile}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
