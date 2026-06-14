/**
 * Seed Gallery posts
 *
 * Usage (from backend/):
 *   node scripts/seed-gallery.js           # adds seed data (skips if posts exist)
 *   node scripts/seed-gallery.js --fresh   # deletes existing gallery posts first
 *
 * Requires MONGODB_URI in .env. Needs at least one admin user (creates a
 * fallback seed admin if none exists). Reuses the existing Advert collection.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/user.model');
const GalleryPost = require('../src/models/galleryPost.model');

const p = (text) => `<p>${text}</p>`;
const h3 = (text) => `<h3>${text}</h3>`;
const ul = (...items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
const img = (src) => `<img src="${src}" class="rte-img" alt="" />`;

const POSTS = [
  {
    title: 'Mauritius Pet Expo 2026',
    category: 'event',
    eventDate: '2026-03-12',
    location: 'Swami Vivekananda Centre, Pailles',
    tags: ['expo', 'community', 'adoption'],
    featured: true,
    published: true,
    coverImage: 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=1200',
    body:
      p('We brought the whole VitalPaws crew to the island\'s biggest pet event of the year. From the moment doors opened, the hall was buzzing with wagging tails, curious cats and proud pet parents.') +
      img('https://images.unsplash.com/photo-1558788353-f76d92427f16?w=1000') +
      h3('The adoption corner') +
      p('Our partner shelters set up a cozy adoption corner, and by midday fourteen pets had found new families. There were more than a few happy tears.') +
      h3('Live demos') +
      p('Our groomers and vets ran back-to-back demos on nail trimming, dental care and first aid. The first-aid session was standing-room only.'),
  },
  {
    title: 'Beach Cleanup with our Rescue Dogs',
    category: 'community',
    eventDate: '2026-02-02',
    location: 'Flic en Flac Public Beach',
    tags: ['charity', 'environment', 'rescue'],
    featured: false,
    published: true,
    coverImage: 'https://images.unsplash.com/photo-1507146426996-ef05306b995a?w=1200',
    body:
      p('Forty volunteers and a dozen very enthusiastic rescue dogs spent Saturday morning clearing the shoreline at Flic en Flac. Together we collected over 60 bags of litter.') +
      ul('60+ bags of litter removed', '40 volunteers + 12 rescue dogs', 'Free health checks for every volunteer\'s pet') +
      p('Sandy paws, a cleaner beach, and a reminder that a healthy environment keeps our animals healthy too.'),
  },
  {
    title: 'Voted Best Pet Store 2025',
    category: 'award',
    eventDate: '2025-12-18',
    location: 'Bagatelle Mall of Mauritius',
    tags: ['award', 'milestone'],
    featured: false,
    published: true,
    coverImage: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?w=1200',
    body:
      p('We are humbled and thrilled — VitalPaws was voted Best Pet Store 2025 at the annual Retail Excellence Awards. This one belongs to our customers and their wonderful companions.') +
      p('Thank you for trusting us with the animals you love. We promise to keep raising the bar.'),
  },
  {
    title: 'March Adoption Drive — 14 Forever Homes',
    category: 'event',
    eventDate: '2026-03-22',
    location: 'Caudan Waterfront, Port Louis',
    tags: ['adoption', 'community'],
    featured: false,
    published: true,
    coverImage: 'https://images.unsplash.com/photo-1601758174114-e711c0cbaa69?w=1200',
    body:
      p('Our March adoption drive at the Caudan Waterfront was a roaring success. Fourteen dogs and cats met their new families, and every adopter went home with a starter kit.') +
      img('https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=1000') +
      p('Couldn\'t adopt but want to help? Fostering and sponsorship spots are open year-round.'),
  },
  {
    title: 'Behind the Scenes: Grooming Day',
    category: 'behind_the_scenes',
    eventDate: '2026-01-15',
    location: 'VitalPaws Grooming Studio',
    tags: ['grooming', 'team'],
    featured: false,
    published: true,
    coverImage: 'https://images.unsplash.com/photo-1591768575198-88dac53fbd0a?w=1200',
    body:
      p('Ever wondered what a day in our grooming studio looks like? We followed our senior groomer through a full shift — from nervous first-timers to seasoned show dogs.') +
      h3('The calm-first approach') +
      p('Every groom starts with a few minutes of just saying hello. A calm dog is a safe dog, and it shows in the results.'),
  },
  {
    title: 'New Vet Clinic Opening — Coming Soon',
    category: 'announcement',
    eventDate: '2026-05-01',
    location: 'VitalPaws, Quatre Bornes',
    tags: ['announcement', 'health'],
    featured: false,
    published: true,
    coverImage: 'https://images.unsplash.com/photo-1576201836106-db1758fd1c97?w=1200',
    body:
      p('Big news: a full in-house veterinary clinic is opening at our Quatre Bornes branch this May. Vaccinations, dental care, and minor surgery — all under one roof.') +
      p('Founding-member checkup packages will be announced closer to the date. Watch this space.'),
  },
  {
    title: 'Draft: Summer Pet Carnival (planning)',
    category: 'event',
    eventDate: '2026-07-20',
    location: 'TBC',
    tags: ['planning'],
    featured: false,
    published: false,
    body:
      p('Internal draft for review — outline for the Summer Pet Carnival. Stalls, agility course, mascot, food trucks. Not yet published.'),
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
    const { deletedCount } = await GalleryPost.deleteMany({});
    console.log(`--fresh: removed ${deletedCount} gallery posts`);
  } else if (await GalleryPost.countDocuments()) {
    console.log('Gallery posts already exist. Re-run with --fresh to reseed. Aborting.');
    await mongoose.disconnect();
    return;
  }

  // create() (not insertMany) so pre-save slug/excerpt/tag hooks run
  for (const post of POSTS) {
    await GalleryPost.create({ ...post, createdBy: admin._id });
  }

  console.log(
    `Seeded ${POSTS.length} gallery posts ` +
    `(${POSTS.filter((x) => x.published).length} published, ${POSTS.filter((x) => x.featured).length} featured)`
  );

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
