/**
 * Seed homepage promo banner slides (Advert docs with placement "hero")
 *
 * Usage (from backend/):
 *   node scripts/seed-promo-banners.js           # adds hero banners (skips if some exist)
 *   node scripts/seed-promo-banners.js --fresh   # deletes existing hero banners first
 *
 * Requires MONGODB_URI in .env. Ensures an admin user (createdBy). Only touches
 * placement:"hero" adverts — banner/sponsored adverts are left untouched.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/user.model');
const Advert = require('../src/models/advert.model');

// Wide banner images (~1920px) — replace via Admin → Adverts upload anytime.
const BANNERS = [
  {
    title: 'Royal Canin — breed-specific nutrition',
    image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=1920&h=680&fit=crop',
    link: '/petshop',
    order: 1,
  },
  {
    title: 'Grooming & spa days — book now',
    image: 'https://images.unsplash.com/photo-1591768575198-88dac53fbd0a?w=1920&h=680&fit=crop',
    link: '/appointments',
    order: 2,
  },
  {
    title: 'Everything for your cat, under one roof',
    image: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=1920&h=680&fit=crop',
    link: '/petshop',
    order: 3,
  },
  {
    title: 'New arrivals every week',
    image: 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=1920&h=680&fit=crop',
    link: '',
    order: 4,
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

  let admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    console.log('No admin user found — creating seed admin (seed-admin@vitalpaws.test)');
    admin = await User.create({
      name: 'Seed Admin',
      email: 'seed-admin@vitalpaws.test',
      phoneNumber: '00000000',
      address: 'Seed Street',
      password: 'SeedAdmin123*',
      role: 'admin',
    });
  }

  if (fresh) {
    const { deletedCount } = await Advert.deleteMany({ placement: 'hero' });
    console.log(`--fresh: removed ${deletedCount} hero banners`);
  } else if (await Advert.countDocuments({ placement: 'hero' })) {
    console.log('Hero banners already exist. Re-run with --fresh to reseed. Aborting.');
    await mongoose.disconnect();
    return;
  }

  for (const b of BANNERS) {
    await Advert.create({ ...b, placement: 'hero', active: true, createdBy: admin._id });
  }

  console.log(`Seeded ${BANNERS.length} hero banners (all active)`);
  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
