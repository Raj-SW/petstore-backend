/**
 * migrate-prices-to-mur.js
 * One-time: fetch live USD→MUR rate and multiply all product prices.
 * Run: node scripts/migrate-prices-to-mur.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const https = require('https');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) { console.error('❌ MONGODB_URI not set'); process.exit(1); }

function fetchRate() {
  return new Promise((resolve, reject) => {
    https.get('https://open.er-api.com/v6/latest/USD', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.result !== 'success') return reject(new Error('Rate fetch failed: ' + json['error-type']));
          resolve(json.rates.MUR);
        } catch (e) {
          reject(new Error('Failed to parse rate response: ' + e.message));
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('🔌 Connecting to MongoDB…');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected.');

  const rate = await fetchRate();
  console.log(`💱 1 USD = ${rate} MUR`);

  const col = mongoose.connection.collection('products');
  const products = await col.find({}).toArray();

  let updated = 0;
  for (const p of products) {
    const murPrice = parseFloat((p.price * rate).toFixed(2));
    await col.updateOne({ _id: p._id }, { $set: { price: murPrice } });
    updated++;
  }

  console.log(`✅ Done. ${updated} products updated.`);
  console.log(`📋 Rate used: 1 USD = ${rate} MUR. Store this value for rollback.`);
  await mongoose.disconnect();
}

run().catch(err => { console.error('❌', err.message); process.exit(1); });
