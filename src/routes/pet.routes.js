const express = require('express');
const { isAuthenticated } = require('../middlewares/auth.middleware');
const {
  createPet,
  getMyPets,
  getPet,
  updatePet,
  deletePet,
  addPetImages,
  deletePetImage,
  setPrimaryPetImage,
} = require('../controllers/pet.controller');
const { upload } = require('../middlewares/upload');

const router = express.Router();

// All pet routes require authentication
router.use(isAuthenticated);

// Create a new pet
router.post('/', createPet);

// Get all pets of the logged-in user
router.get('/', getMyPets);

// Get a single pet by ID
router.get('/:id', getPet);

// Update a pet
router.patch('/:id', updatePet);

// Delete a pet
router.delete('/:id', deletePet);

// Pet photo management (gallery). All owner-guarded in the controller.
router.post('/:id/images', upload.array('petImages', 6), addPetImages);
router.delete('/:id/images/:publicId', deletePetImage);
router.patch('/:id/images/:publicId/primary', setPrimaryPetImage);

module.exports = router;
