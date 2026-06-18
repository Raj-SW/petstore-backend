/**
 * Seed homepage Engagement "promo" adverts.
 *
 * Usage (from backend/):
 *   node scripts/seed-promo-adverts.js           # adds promo adverts (skips if any exist)
 *   node scripts/seed-promo-adverts.js --fresh   # deletes existing promo adverts first
 *
 * Requires MONGODB_URI in .env and at least one admin user.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/user.model');
const Advert = require('../src/models/advert.model');

const PROMOS = [
  {
    title: 'Celebrate the Joy of Christmas with Your Pets — 50% off festive treats!',
    image: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=720&h=900&fit=crop',
    link: '/petshop',
    placement: 'promo',
    order: 0,
    active: true,
  },
  {
    title: 'Premium, vet-approved pet food — now in stock',
    image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=720&h=900&fit=crop',
    link: '/petshop',
    placement: 'promo',
    order: 1,
    active: true,
  },
  {
    title: 'Book any service this month and get grooming free',
    image: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=720&h=900&fit=crop',
    link: '/appointments',
    placement: 'promo',
    order: 2,
    active: true,
  },
];

async function run() {
  const fresh = process.argv.includes('--fresh');

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Aborting.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    console.error('No admin user found. Create an admin first. Aborting.');
    await mongoose.disconnect();
    process.exit(1);
  }

  if (fresh) {
    const { deletedCount } = await Advert.deleteMany({ placement: 'promo' });
    console.log(`--fresh: removed ${deletedCount} existing promo adverts`);
  } else if (await Advert.countDocuments({ placement: 'promo' })) {
    console.log('Promo adverts already exist. Re-run with --fresh to reseed. Aborting.');
    await mongoose.disconnect();
    return;
  }

  for (const promo of PROMOS) {
    await Advert.create({ ...promo, createdBy: admin._id });
  }

  console.log(`Seeded ${PROMOS.length} promo adverts (active).`);
  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
