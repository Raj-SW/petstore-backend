const express = require('express');
const { isAuthenticated } = require('../middlewares/auth.middleware');
const {
  createPet,
  getMyPets,
  getPet,
  updatePet,
  deletePet,
} = require('../controllers/pet.controller');

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

module.exports = router;
