/**
 * Add profile photos to professionals + insert a few new professionals
 *
 * Usage (from backend/):
 *   node scripts/seed-professional-images.js
 *
 * Requires MONGODB_URI in .env.
 *
 * Images come from https://i.pravatar.cc — a free, key-less public API
 * that serves stable placeholder headshots by number (no signup, no rate
 * limit for this volume). Each professional gets { url, publicId } on
 * professionalInfo.profileImage (publicId is a local label only — these
 * images were never uploaded to Cloudinary, so there's nothing to delete
 * there).
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/user.model');

const pravatar = (n) => ({ url: `https://i.pravatar.cc/300?img=${n}`, publicId: `pravatar-${n}` });

// Existing seeded professionals (scripts/seed-professionals.js) — matched by email.
const EXISTING_PHOTOS = {
  'amara.devi@vitalpaws.test': pravatar(47),
  'kevin.appadoo@vitalpaws.test': pravatar(12),
  'sarah.li@vitalpaws.test': pravatar(45),
  'marc.antoine@vitalpaws.test': pravatar(33),
  'priya.ramsamy@vitalpaws.test': pravatar(48),
  'jordan.fok@vitalpaws.test': pravatar(15),
  'ravi.nagen@vitalpaws.test': pravatar(52),
  'nadia.bhugun@vitalpaws.test': pravatar(29),
};

const availability = (days) => {
  const all = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const map = {};
  all.forEach((d) => {
    map[d] = days.includes(d)
      ? { startTime: '09:00', endTime: '17:00', isAvailable: true }
      : { startTime: '09:00', endTime: '17:00', isAvailable: false };
  });
  return map;
};
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const p = (text) => `<p>${text}</p>`;

// Brand-new professionals — one per role, each with a photo.
const NEW_PROFESSIONALS = [
  {
    name: 'Dr. Ines Vallet',
    email: 'ines.vallet@vitalpaws.test',
    phoneNumber: '52005001',
    address: '9 La Croisette, Grand Baie',
    role: 'veterinarian',
    professionalInfo: {
      specialization: 'Dermatology & allergies',
      experience: 8,
      qualifications: ['DVM', 'Dip. Veterinary Dermatology'],
      rating: 4.7,
      reviewCount: 27,
      bio: p('Focuses on chronic skin conditions and food allergies — the cases other clinics have given up on.'),
      services: [{ name: 'Dermatology consult', price: 1100, duration: 40, description: 'Skin/allergy workup' }],
      availability: availability(WEEKDAYS),
      isActive: true,
      profileImage: pravatar(5),
    },
  },
  {
    name: 'Yohann Pierre',
    email: 'yohann.pierre@vitalpaws.test',
    phoneNumber: '52005002',
    address: '11 Church Street, Mahebourg',
    role: 'groomer',
    professionalInfo: {
      specialization: 'Cat grooming specialist',
      experience: 4,
      qualifications: [],
      rating: 4.6,
      reviewCount: 19,
      bio: p('One of the only groomers on the island specializing exclusively in cats — low-stress handling techniques.'),
      services: [{ name: 'Cat groom & de-shed', price: 700, duration: 50, description: 'Bath, brush, nail trim' }],
      availability: availability([...WEEKDAYS, 'saturday']),
      isActive: true,
      profileImage: pravatar(23),
    },
  },
  {
    name: 'Devi Ramlall',
    email: 'devi.ramlall@vitalpaws.test',
    phoneNumber: '52005003',
    address: '3 Royal Road, Goodlands',
    role: 'trainer',
    professionalInfo: {
      specialization: 'Agility & sport training',
      experience: 6,
      qualifications: ['AKC Agility Certified'],
      rating: 4.8,
      reviewCount: 22,
      bio: p('Competitive agility background — trains dogs (and owners) for both fun and serious competition.'),
      services: [{ name: 'Agility foundations', price: 1400, duration: 60, description: 'Group class, max 5 dogs' }],
      availability: availability(['saturday', 'sunday']),
      isActive: true,
      profileImage: pravatar(8),
    },
  },
  {
    name: 'Ashwin Beeharry',
    email: 'ashwin.beeharry@vitalpaws.test',
    phoneNumber: '52005004',
    address: '6 Sivananda Avenue, Rose Belle',
    role: 'petTaxi',
    professionalInfo: {
      specialization: 'Rural & long-distance transport',
      experience: 3,
      qualifications: [],
      rating: 4.5,
      reviewCount: 11,
      bio: p('Covers routes the city-based drivers skip — south and east coast pickups, no extra surcharge.'),
      services: [{ name: 'Long-distance transport', price: 1200, duration: 90, description: 'Cross-island, door-to-door' }],
      availability: availability([...WEEKDAYS, 'saturday']),
      isActive: true,
      profileImage: pravatar(60),
    },
  },
];

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Aborting.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // 1. Backfill photos onto existing professionals (non-destructive update).
  let updated = 0;
  for (const [email, photo] of Object.entries(EXISTING_PHOTOS)) {
    const res = await User.updateOne(
      { email },
      { $set: { 'professionalInfo.profileImage': photo } }
    );
    if (res.matchedCount) updated += 1;
  }
  console.log(`Backfilled photos onto ${updated}/${Object.keys(EXISTING_PHOTOS).length} existing professionals`);

  // 2. Insert brand-new professionals (skip any that already exist by email).
  let created = 0;
  for (const pro of NEW_PROFESSIONALS) {
    const exists = await User.findOne({ email: pro.email });
    if (exists) {
      console.log(`Skipping ${pro.email} — already exists`);
      continue;
    }
    await User.create({ ...pro, password: 'SeedPro123*', isActive: true });
    created += 1;
  }
  console.log(`Created ${created} new professionals`);

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
