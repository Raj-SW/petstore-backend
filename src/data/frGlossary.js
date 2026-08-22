/**
 * Hand-written French for UI chrome, consulted before the machine provider.
 *
 * Two reasons this file exists, both observed live on the homepage:
 *
 * 1. LENGTH. A machine translator expands "Pet Care Tips" into "Conseils de
 *    soins pour animaux de compagnie" — 368px for a single nav item, which
 *    pushed the navbar 536px past the viewport and gave the whole site a
 *    horizontal scrollbar. Navigation labels have a width budget; prose does
 *    not. Short labels get a short human translation.
 *
 * 2. SENSE. Context-free translation picks the wrong word for UI verbs and
 *    domain nouns: "Care" became "Entretien" (servicing a machine), "Shop"
 *    became "Acheter" (the verb "to buy"), and "coat" became "manteau"
 *    (an overcoat) rather than "pelage" (an animal's coat).
 *
 * An entry mapping a string to ITSELF means "never translate this" — used for
 * the brand and for proper nouns the provider happily mangles ("VitalPaws"
 * came back as "Vital Pattes").
 *
 * Keys are matched on the exact trimmed source string, case-sensitively.
 * Anything absent falls through to the provider, which is the right default
 * for body copy where wrapping absorbs the extra length.
 */

// ── Never translate ────────────────────────────────────────────────────────
const PROTECTED = [
  'VitalPaws', 'Vital', 'Paws', 'WhatsApp', 'Google', 'Google Reviews',
  'Facebook', 'Instagram', 'TikTok', 'Mauritius', 'Piton', 'MUR', 'Rs',
  // The language switcher's own labels. Translating these flipped "Français"
  // into "English", so the menu offered the language you were already in.
  'English', 'Français', 'EN', 'FR',
];

const GLOSSARY = {
  // ── Primary navigation (hard width budget) ──
  'Home': 'Accueil',
  'Care': 'Soins',
  'Shop': 'Boutique',
  'Pet Travel': 'Voyage animalier',
  'Pet Care Tips': 'Conseils',
  'Our Clinic': 'La Clinique',
  'Contact': 'Contact',
  'Contact Us': 'Nous contacter',

  // ── Buttons and calls to action ──
  'Book Appointment': 'Prendre rendez-vous',
  'Book an Appointment': 'Prendre rendez-vous',
  'Mobile Vet': 'Vét. à domicile',
  'Learn More': 'En savoir plus',
  'View Details': 'Voir le détail',
  'View Profile': 'Voir le profil',
  'View All Articles': 'Tous les articles',
  'View all professionals': 'Tous nos praticiens',
  'Shop All': 'Tout voir',
  'Send Message': 'Envoyer',
  'Subscribe': "S'abonner",
  'Chat on WhatsApp': 'Discuter sur WhatsApp',
  'Ask us on WhatsApp': 'Écrivez-nous sur WhatsApp',
  'Call Us': 'Appelez-nous',
  'Ask a Question': 'Poser une question',
  'Leave a Review': 'Laisser un avis',
  'Explore the Pet Store': 'Découvrir la boutique',
  'Start Your Pet Relocation': "Organiser le voyage",
  'Previous slide': 'Diapositive précédente',
  'Next slide': 'Diapositive suivante',
  'Previous Vet': 'Praticien précédent',
  'Next Vet': 'Praticien suivant',

  // ── Product / shop chrome ──
  'From': 'Dès',
  'In Stock': 'En stock',
  'Out of Stock': 'Rupture de stock',
  'New Arrivals': 'Nouveautés',
  'All': 'Tous',
  'Dogs': 'Chiens',
  'Cats': 'Chats',
  'Dog': 'Chien',
  'Cat': 'Chat',
  'Other Pets': 'Autres animaux',
  'Puppy': 'Chiot',
  'Kitten': 'Chaton',
  'Bird': 'Oiseau',
  'Fish': 'Poisson',
  'Skin & Coat': 'Peau et pelage',
  'Skin and Coat': 'Peau et pelage',
  'Fleas & Ticks': 'Puces et tiques',
  'Shop by Need': 'Acheter par besoin',
  'Vet Essentials': 'Essentiels vétérinaires',
  'Vet Choice': 'Choix du vétérinaire',
  'Trusted Choice': 'Valeur sûre',
  'Most Recommended': 'Les plus recommandés',
  'Best Seller': 'Meilleure vente',
  'Quick sale': 'Vente rapide',
  'Popular': 'Populaires',
  'Promo': 'Promo',
  'Available': 'Disponible',
  'Available Today': 'Disponible aujourd’hui',
  'Approved': 'Approuvé',

  // ── Clinic / services ──
  'Veterinary Care': 'Soins vétérinaires',
  'Mobile Veterinary Care': 'Soins vétérinaires à domicile',
  'Mobile Vet / Home Visits': 'Vétérinaire à domicile',
  'Home Visit': 'Visite à domicile',
  'Find a Veterinarian': 'Trouver un vétérinaire',
  'Veterinarian Advice': 'Conseils du vétérinaire',
  'Veterinary Checks': 'Contrôles vétérinaires',
  'Licensed Veterinarians': 'Vétérinaires agréés',
  'Licensed Vet': 'Vétérinaire agréé',
  'Vet Network': 'Réseau vétérinaire',
  'Consultation': 'Consultation',
  'Documents': 'Documents',
  'Flight Preparation': 'Préparation du vol',
  'Safe Arrival': 'Arrivée en toute sécurité',
  'Your Journey': 'Votre parcours',
  'International': 'International',

  // ── Account / footer ──
  'My Orders': 'Mes commandes',
  'My Subscriptions': 'Mes abonnements',
  'Contact Support': 'Contacter le support',
  'Support': 'Assistance',
  'The Foundation': 'La Fondation',
  'About Us': 'À propos',
  'Get in Touch': 'Nous joindre',
  'Follow VitalPaws': 'Suivez VitalPaws',
  'Log Out': 'Déconnexion',
  'Login': 'Connexion',
  'Sign Up': "S'inscrire",
  'Your Name': 'Votre nom',
  'Your Email': 'Votre e-mail',
  'Message': 'Message',
  'Coming soon': 'Bientôt disponible',

  // ── Section headings ──
  'What Our Clients Say': 'Ce que disent nos clients',
  'Frequently Asked Questions': 'Questions fréquentes',
  'Trusted by Pet Parents': 'La confiance des propriétaires',
  'Multiple Countries Served': 'Plusieurs pays desservis',
  "Can't find it?": 'Vous ne trouvez pas ?',
};

// Protected terms translate to themselves.
for (const term of PROTECTED) GLOSSARY[term] = term;

module.exports = { GLOSSARY, PROTECTED };
