/**
 * Seed Pet Care Tips + Adverts
 *
 * Usage (from backend/):
 *   node scripts/seed-pet-care-tips.js           # adds seed data (skips if tips exist)
 *   node scripts/seed-pet-care-tips.js --fresh   # deletes existing tips/adverts first
 *
 * Requires MONGODB_URI in .env. Needs at least one admin user (creates a
 * fallback seed admin if none exists).
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/user.model');
const PetCareTip = require('../src/models/petCareTip.model');
const Advert = require('../src/models/advert.model');

const p = (text) => `<p>${text}</p>`;
const h3 = (text) => `<h3>${text}</h3>`;
const ul = (...items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;

const TIPS = [
  {
    title: 'How to build a balanced diet for your dog at every life stage',
    animalType: 'dog', category: 'nutrition', breed: 'Golden Retriever',
    difficulty: 'beginner', featured: true, published: true,
    coverImage: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=1200',
    body:
      p('A well-balanced diet is the foundation of your dog\'s health. Whether you have a puppy, an adult dog, or a senior companion, their nutritional needs change significantly across life stages.') +
      h3('Puppies (0–12 months)') +
      p('Puppies need calorie-dense food rich in protein and DHA to support rapid muscle and brain development.') +
      ul('Protein: at least 22% dry matter', 'Fat: at least 8% dry matter', 'Feed 3–4 small meals per day') +
      h3('Adult dogs (1–7 years)') +
      p('Focus on maintaining lean muscle mass and a healthy weight. Portion control matters more at this stage — energy needs drop by roughly 20% after the first year.') +
      h3('Senior dogs (7+ years)') +
      p('Senior formulas reduce calories while boosting joint-support nutrients like glucosamine and omega-3 fatty acids.'),
  },
  {
    title: 'Grooming your Persian cat: a step-by-step guide',
    animalType: 'cat', category: 'grooming', breed: 'Persian',
    difficulty: 'beginner', featured: true, published: true,
    coverImage: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=1200',
    body:
      p('Persian cats have long, dense coats that mat easily without daily care. Ten minutes a day keeps their coat healthy and your furniture fur-free.') +
      h3('Daily routine') +
      ul('Use a wide-tooth metal comb first to find tangles', 'Follow with a slicker brush for the undercoat', 'Wipe tear stains gently with a damp cotton pad') +
      h3('Monthly tasks') +
      p('Bathe with a cat-specific shampoo and trim nails. Introduce both early so your cat accepts them calmly.'),
  },
  {
    title: 'Signs of respiratory illness in parrots and what to do',
    animalType: 'bird', category: 'health', breed: 'African Grey',
    difficulty: 'advanced', featured: true, published: true,
    coverImage: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=1200',
    body:
      p('Birds hide illness instinctively, so respiratory symptoms are often advanced by the time they are visible. Knowing the early signs can save your parrot\'s life.') +
      h3('Watch for') +
      ul('Tail bobbing while breathing', 'Open-mouth breathing at rest', 'Discharge around nares', 'Voice changes or reduced vocalisation') +
      h3('What to do') +
      p('Move the bird to a warm, quiet room, remove airborne irritants (candles, non-stick pans, sprays), and contact an avian vet immediately. Respiratory illness in birds deteriorates fast.'),
  },
  {
    title: 'Teaching recall to puppies under 6 months',
    animalType: 'dog', category: 'training', breed: '',
    difficulty: 'beginner', featured: false, published: true,
    body:
      p('Recall is the single most important command for your puppy\'s safety. Start indoors with zero distractions.') +
      ul('Say the cue once, crouch, open arms', 'Reward every single return with high-value treats', 'Never call your puppy to something unpleasant') +
      p('Once reliable indoors, practice in a fenced garden, then on a long training lead in the park.'),
  },
  {
    title: 'Why dental hygiene matters for indoor cats',
    animalType: 'cat', category: 'dental', breed: '',
    difficulty: 'beginner', featured: false, published: true,
    body:
      p('By age three, most cats show signs of dental disease. Indoor cats are no exception — diet and genetics matter more than environment.') +
      ul('Brush with cat-safe toothpaste 3× a week', 'Dental treats reduce plaque but don\'t replace brushing', 'Annual vet dental checks catch resorption early') +
      p('Watch for drooling, dropping food, or pawing at the mouth — all signs of dental pain worth a vet visit.'),
  },
  {
    title: 'Maintaining water pH for tropical freshwater fish',
    animalType: 'fish', category: 'health', breed: '',
    difficulty: 'intermediate', featured: false, published: true,
    body:
      p('Stable pH matters more than a perfect number. Most community tropical fish thrive between 6.8 and 7.5, but sudden swings are what kill.') +
      ul('Test weekly with a liquid kit (strips are inaccurate)', 'Change 20–25% of water weekly with dechlorinated water', 'Avoid chasing pH with chemicals — fix the cause instead') +
      p('Driftwood lowers pH naturally; crushed coral raises it. Make changes gradually over days, not hours.'),
  },
  {
    title: 'What vegetables are safe for rabbits daily?',
    animalType: 'rabbit', category: 'nutrition', breed: '',
    difficulty: 'beginner', featured: false, published: true,
    body:
      p('A rabbit\'s diet should be 85% hay, but daily leafy greens add nutrients and enrichment.') +
      h3('Safe daily greens') +
      ul('Romaine lettuce (never iceberg)', 'Cilantro, basil, parsley', 'Carrot tops (the greens, not the root)') +
      h3('Occasional treats only') +
      p('Carrots, apple, and berries are sugary — keep to a tablespoon a few times a week.'),
  },
  {
    title: 'Enrichment activities for bearded dragons',
    animalType: 'reptile', category: 'exercise', breed: 'Bearded Dragon',
    difficulty: 'intermediate', featured: false, published: true,
    body:
      p('Bearded dragons are smarter than they look. Enrichment prevents lethargy and stereotypic glass-surfing.') +
      ul('Supervised free-roam time in a secure room', 'Climbing branches and basking platform rotation', 'Live insect hunts in a feeding bin', 'Shallow warm-water swims') +
      p('Rotate the enclosure layout monthly — novelty itself is enrichment for reptiles.'),
  },
  {
    title: 'Crate training without tears: a weekend plan',
    animalType: 'dog', category: 'behavior', breed: '',
    difficulty: 'intermediate', featured: false, published: true,
    body:
      p('A crate should be your dog\'s favourite room, not a punishment. This weekend plan builds positive association fast.') +
      h3('Day 1') +
      p('Feed all meals beside, then inside, the open crate. Toss treats in randomly throughout the day.') +
      h3('Day 2') +
      p('Close the door for 10 seconds during meals, building to 5 minutes. Stay in sight, ignore whining, reward silence.'),
  },
  {
    title: 'Setting up the perfect canary cage',
    animalType: 'bird', category: 'health', breed: 'Canary',
    difficulty: 'beginner', featured: false, published: true,
    body:
      p('Canaries live 10+ years with the right setup. Width matters more than height — they fly horizontally.') +
      ul('Minimum 60cm wide flight cage', 'Perches of varying natural diameters', 'Place away from drafts, kitchens, and direct sun') +
      p('Cover the cage at night for 10–12 hours of dark, quiet sleep.'),
  },
  {
    title: 'Hairball season: helping your long-haired cat cope',
    animalType: 'cat', category: 'health', breed: 'Maine Coon',
    difficulty: 'beginner', featured: false, published: true,
    body:
      p('Spring shedding means hairball season for long-haired breeds. More than one hairball a week warrants attention.') +
      ul('Daily brushing removes hair before your cat swallows it', 'Hairball-control food adds fibre to move hair through', 'A teaspoon of plain canned pumpkin helps digestion') +
      p('Repeated unproductive retching is an emergency — hairballs can cause blockages.'),
  },
  {
    title: 'Senior dog mobility checklist',
    animalType: 'dog', category: 'health', breed: '',
    difficulty: 'intermediate', featured: false, published: false,
    body:
      p('Draft article for review: monthly mobility checks for senior dogs.') +
      ul('Hesitation on stairs', 'Difficulty rising after rest', 'Muscle loss along the spine and hips'),
  },
];

const ADVERTS = [
  {
    title: 'Royal Canin — breed-specific nutrition, now 20% off at VitalPaws shop',
    image: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=800',
    link: '/petshop',
    placement: 'banner',
    active: true,
  },
  {
    title: 'Book a grooming appointment with our certified professionals',
    image: '',
    link: '/appointments',
    placement: 'banner',
    active: true,
  },
  {
    title: 'VitaPet supplements — complete daily nutrition for dogs',
    image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800',
    link: '/petshop',
    placement: 'sponsored',
    active: true,
  },
  {
    title: 'Inactive test advert (should never appear publicly)',
    image: '',
    link: '/petshop',
    placement: 'sponsored',
    active: false,
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
    const { deletedCount: t } = await PetCareTip.deleteMany({});
    const { deletedCount: a } = await Advert.deleteMany({});
    console.log(`--fresh: removed ${t} tips, ${a} adverts`);
  } else if (await PetCareTip.countDocuments()) {
    console.log('Tips already exist. Re-run with --fresh to reseed. Aborting.');
    await mongoose.disconnect();
    return;
  }

  // create() (not insertMany) so pre-save slug/readTime hooks run
  for (const tip of TIPS) {
    await PetCareTip.create({ ...tip, createdBy: admin._id });
  }
  for (const ad of ADVERTS) {
    await Advert.create({ ...ad, createdBy: admin._id });
  }

  console.log(`Seeded ${TIPS.length} tips (${TIPS.filter((t) => t.published).length} published, ${TIPS.filter((t) => t.featured).length} featured)`);
  console.log(`Seeded ${ADVERTS.length} adverts (${ADVERTS.filter((a) => a.active).length} active)`);

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
