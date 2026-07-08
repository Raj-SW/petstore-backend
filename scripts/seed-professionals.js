/**
 * Seed Professionals (veterinarian / groomer / trainer / petTaxi)
 *
 * Usage (from backend/):
 *   node scripts/seed-professionals.js           # adds seed data (skips if professionals exist)
 *   node scripts/seed-professionals.js --fresh   # deletes existing professionals first
 *
 * Requires MONGODB_URI in .env. Professionals are User documents with
 * role in {veterinarian, groomer, trainer, petTaxi} + professionalInfo.
 * Password is hashed by the User model's pre('save') hook.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/user.model');

const PROFESSIONAL_ROLES = ['veterinarian', 'groomer', 'trainer', 'petTaxi'];

const p = (text) => `<p>${text}</p>`;
const bold = (text) => `<strong>${text}</strong>`;

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
const WEEKDAYS_SAT = [...WEEKDAYS, 'saturday'];

const PROFESSIONALS = [
  {
    name: 'Dr. Amara Devi',
    email: 'amara.devi@vitalpaws.test',
    phoneNumber: '52001001',
    address: '12 Royal Road, Curepipe',
    role: 'veterinarian',
    professionalInfo: {
      specialization: 'Small animal surgery',
      experience: 9,
      qualifications: ['BVSc', 'MSc Veterinary Surgery'],
      rating: 4.8,
      reviewCount: 34,
      bio: p(`${bold('Board-certified surgeon')} with a decade of experience in soft-tissue and orthopedic procedures.`) +
           p('Believes a calm room makes for a calm patient — every visit starts with five minutes of just saying hello.'),
      services: [
        { name: 'Wellness exam', price: 800, duration: 30, description: 'Full physical checkup' },
        { name: 'Vaccination', price: 500, duration: 20, description: 'Core + lifestyle vaccines' },
        { name: 'Soft-tissue surgery consult', price: 1500, duration: 45, description: 'Pre-surgical assessment' },
      ],
      availability: availability(WEEKDAYS),
      isActive: true,
    },
  },
  {
    name: 'Dr. Kevin Appadoo',
    email: 'kevin.appadoo@vitalpaws.test',
    phoneNumber: '52001002',
    address: '4 Sivananda Avenue, Quatre Bornes',
    role: 'veterinarian',
    professionalInfo: {
      specialization: 'Exotic & avian medicine',
      experience: 6,
      qualifications: ['DVM'],
      rating: 4.6,
      reviewCount: 21,
      bio: p('One of the few vets on the island seeing rabbits, birds and reptiles alongside cats and dogs.'),
      services: [
        { name: 'Exotic pet checkup', price: 900, duration: 30, description: 'Species-specific exam' },
      ],
      availability: availability(WEEKDAYS_SAT),
      isActive: true,
    },
  },
  {
    name: 'Sarah Li',
    email: 'sarah.li@vitalpaws.test',
    phoneNumber: '52002001',
    address: '8 Grand Baie Bypass, Grand Baie',
    role: 'groomer',
    professionalInfo: {
      specialization: 'Breed-specific styling',
      experience: 5,
      qualifications: ['Certified Master Groomer'],
      rating: 4.9,
      reviewCount: 58,
      bio: p(`Spa-day grooming with a ${bold('gentle, fear-free')} approach — especially loves working with nervous first-timers.`),
      services: [
        { name: 'Full groom & style', price: 1200, duration: 90, description: 'Bath, cut, blow-dry, nail trim' },
        { name: 'Bath & brush', price: 500, duration: 40, description: 'Quick refresh' },
      ],
      availability: availability(WEEKDAYS_SAT),
      isActive: true,
    },
  },
  {
    name: 'Marc Antoine',
    email: 'marc.antoine@vitalpaws.test',
    phoneNumber: '52002002',
    address: '21 Royal Road, Rose Hill',
    role: 'groomer',
    professionalInfo: {
      specialization: 'Large-breed & double-coat care',
      experience: 3,
      qualifications: [],
      rating: 4.4,
      reviewCount: 12,
      bio: p('Handles the big, fluffy ones — huskies, retrievers, shepherds — with patience and the right tools for the coat.'),
      services: [
        { name: 'De-shedding treatment', price: 900, duration: 60, description: 'Undercoat blowout' },
      ],
      availability: availability(['tuesday', 'wednesday', 'thursday', 'friday', 'saturday']),
      isActive: true,
    },
  },
  {
    name: 'Priya Ramsamy',
    email: 'priya.ramsamy@vitalpaws.test',
    phoneNumber: '52003001',
    address: '5 Coastal Road, Flic en Flac',
    role: 'trainer',
    professionalInfo: {
      specialization: 'Puppy foundations & obedience',
      experience: 7,
      qualifications: ['CPDT-KA'],
      rating: 4.9,
      reviewCount: 45,
      bio: p(`${bold('Positive-reinforcement only.')} Group puppy classes on weekends, private obedience sessions on weekdays.`),
      services: [
        { name: 'Puppy foundations (4-week course)', price: 3200, duration: 60, description: 'Group class, max 6 pups' },
        { name: 'Private obedience session', price: 1000, duration: 60, description: '1-on-1 at your home' },
      ],
      availability: availability(WEEKDAYS_SAT),
      isActive: true,
    },
  },
  {
    name: 'Jordan Fok',
    email: 'jordan.fok@vitalpaws.test',
    phoneNumber: '52003002',
    address: '17 Vandermeersch Street, Vacoas',
    role: 'trainer',
    professionalInfo: {
      specialization: 'Behaviour correction & reactivity',
      experience: 4,
      qualifications: [],
      rating: 4.5,
      reviewCount: 9,
      bio: p('Works with dogs who struggle on leash or around other animals — slow, structured, no shortcuts.'),
      services: [
        { name: 'Behaviour assessment', price: 1500, duration: 75, description: 'Initial consult + plan' },
      ],
      availability: availability(WEEKDAYS),
      isActive: true,
    },
  },
  {
    name: 'Ravi Nagen',
    email: 'ravi.nagen@vitalpaws.test',
    phoneNumber: '52004001',
    address: '30 Motorway M1, Phoenix',
    role: 'petTaxi',
    professionalInfo: {
      specialization: 'Door-to-door pet transport',
      experience: 2,
      qualifications: [],
      rating: 4.7,
      reviewCount: 15,
      bio: p('GPS-tracked, climate-controlled vehicle. Vet visits, grooming appointments, airport runs.'),
      services: [
        { name: 'Local transport (island-wide)', price: 600, duration: 45, description: 'One-way, door-to-door' },
      ],
      availability: availability([...WEEKDAYS_SAT, 'sunday']),
      isActive: true,
    },
  },
  {
    name: 'Nadia Bhugun',
    email: 'nadia.bhugun@vitalpaws.test',
    phoneNumber: '52004002',
    address: '2 Coromandel Road, Petite Rivière',
    role: 'petTaxi',
    professionalInfo: {
      specialization: 'Multi-pet & airport transfers',
      experience: 1,
      qualifications: [],
      rating: 4.2,
      reviewCount: 4,
      bio: p('New to the platform but ten years of experience running a home boarding service — pets travel calm and safe.'),
      services: [
        { name: 'Airport transfer', price: 900, duration: 60, description: 'SSR Airport pickup/drop-off' },
      ],
      availability: availability(WEEKDAYS),
      isActive: false, // seeded as inactive to exercise the admin toggle/filter
    },
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

  const existingCount = await User.countDocuments({ role: { $in: PROFESSIONAL_ROLES } });

  if (fresh) {
    const { deletedCount } = await User.deleteMany({ role: { $in: PROFESSIONAL_ROLES } });
    console.log(`--fresh: removed ${deletedCount} existing professional accounts`);
  } else if (existingCount) {
    console.log(`${existingCount} professionals already exist. Re-run with --fresh to reseed. Aborting.`);
    await mongoose.disconnect();
    return;
  }

  // create() (not insertMany) so the password pre('save') hash hook runs
  for (const pro of PROFESSIONALS) {
    await User.create({ ...pro, password: 'SeedPro123*', isActive: true });
  }

  console.log(
    `Seeded ${PROFESSIONALS.length} professionals ` +
    `(${PROFESSIONALS.filter((x) => x.role === 'veterinarian').length} vets, ` +
    `${PROFESSIONALS.filter((x) => x.role === 'groomer').length} groomers, ` +
    `${PROFESSIONALS.filter((x) => x.role === 'trainer').length} trainers, ` +
    `${PROFESSIONALS.filter((x) => x.role === 'petTaxi').length} petTaxi)`
  );

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
