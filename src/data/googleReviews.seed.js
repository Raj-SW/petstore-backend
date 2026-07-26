// Real Google reviews for VitalPaws, copied verbatim from
// https://share.google/hthxT0N5smL9uGAba (truncated "…More" ones trimmed to
// their last complete sentence). Do not invent or embellish.
const GOOGLE_REVIEWS_SEED = [
  { name: "Nal Raj Sharma Seetohul", rating: 5, message: "Great place. They've just opened. The staff are very helpful." },
  { name: "Altaaf Auleear", rating: 5, message: "Excellent service from the team at VitalPaws Veterinary Clinic. The vet was friendly, professional, and took great care of my dog. The consultation was thorough, and everything was explained clearly." },
  { name: "Parwez Ahmad", rating: 5, message: "I had an excellent experience at VitalPaws Veterinary Clinic. The veterinarian was professional, knowledgeable, and genuinely cared about my dog's health. The consultation was thorough, and everything was explained clearly." },
  { name: "Mohammad Juneid Abdur-Rahman", rating: 5, message: "Amazing service. Took both of my cats there. Very professional and friendly. They make you feel at ease and explain you clearly. Would highly recommend." },
  { name: "Jeson Bégué", rating: 5, message: "Excellent veterinary clinic! The staff is incredibly professional, caring, and welcoming. The facility is very clean. Highly recommended for anyone looking for top-notch care for their pets!" },
  { name: "Yushnamudhoo 19", rating: 5, message: "Amazing care from the team at VitalPaws Veterinary Clinic. My pet was vomiting foam and bile, had a hard stomach, a fever, and black stools. They treated him quickly and with so much compassion." },
  { name: "Aftab Alam", rating: 5, message: "Amazing care for my dog! I took my dog to this clinic and had a really positive experience. The vets and staff were friendly, patient, and explained everything clearly." },
  { name: "Zuhair Moedine", rating: 5, message: "I brought my cat to VitalPaws Veterinary Clinic, and I couldn't be happier with the care we received. The vet was gentle, patient, and handled my cat with so much kindness, which made the whole visit stress-free." },
  { name: "Zakee Khameery", rating: 5, message: "I contacted VitalPaws Veterinary Clinic for help with exporting my two cats." },
  { name: "Rajnat Mansi", rating: 5, message: "Great veterinary clinic with friendly staff and excellent care for pets." },
  { name: "Viren Tharnvithian", rating: 5, message: "Had a very good experience. Staffs are friendly and they explain things clearly." },
  { name: "Ayush R", rating: 5, message: "Reasonable price. Excellent service." },
  { name: "Utashna Seegoolam", rating: 5, message: "Highly recommended. Friendly and generous services. They came to my place on a Sunday to treat my dog. Am so grateful to them. Thank you a lot. My mom really appreciate your services. Thank you." },
  { name: "Cathryn Gush", rating: 5, message: "Dr Karina is a wonderful combination of professionalism and empathy. We felt confident that our dogs were getting the best care." },
  { name: "Hassan Hossen", rating: 5, message: "Extremely reliable. Punctual also. Hasnat has been very helpful and also compared to any other veterinary clinic, VitalPaws's services are a lot better and cheaper as well as efficient!" },
  { name: "Goshima Rajnat", rating: 5, message: "Very good service.. Highly recommended 👍" },
  { name: "Poniah Pankaj Kumar", rating: 5, message: "Very good job they take a good care of my puppy 🐶 thank you very much." },
  { name: "Mookshma Goburdhun", rating: 5, message: "A heartfelt thank you to Dr Rajnat for exceptional care given of my cat during his critical time." },
  { name: "Arfa Soydan", rating: 5, message: "Great service. My cats were well taken care of. Dr Rajnat is very gentle and professional. Highly recommended." },
  { name: "Suf Yaan", rating: 5, message: "Cosy place. Helpful staffs." },
];

// Known seeded/test junk to remove from the collection.
const TEST_ENTRY_NAMES = ["TestUser", "Moisa"];

module.exports = { GOOGLE_REVIEWS_SEED, TEST_ENTRY_NAMES };
