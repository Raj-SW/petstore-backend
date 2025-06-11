const Pet = require('../models/pet.model');
const { AppError } = require('../middlewares/errorHandler');

// Create a new pet
exports.createPet = async (req, res, next) => {
  try {
    const { name, breed, age, type, color, gender, description } = req.body;
    const pet = await Pet.create({
      name,
      breed,
      age,
      type,
      color,
      gender,
      description,
      owner: req.user._id,
    });
    res.status(201).json({
      success: true,
      data: pet,
    });
  } catch (error) {
    next(error);
  }
};

// Get all pets of the logged-in user
exports.getMyPets = async (req, res, next) => {
  try {
    const pets = await Pet.find({ owner: req.user._id });
    res.status(200).json({
      success: true,
      data: pets,
    });
  } catch (error) {
    next(error);
  }
};

// Get a single pet by ID
exports.getPet = async (req, res, next) => {
  try {
    const pet = await Pet.findById(req.params.id);
    if (!pet) {
      return next(new AppError('Pet not found', 404));
    }
    if (pet.owner.toString() !== req.user._id.toString()) {
      return next(new AppError('You do not have permission to view this pet', 403));
    }
    res.status(200).json({
      success: true,
      data: pet,
    });
  } catch (error) {
    next(error);
  }
};

// Update a pet
exports.updatePet = async (req, res, next) => {
  try {
    const pet = await Pet.findById(req.params.id);
    if (!pet) {
      return next(new AppError('Pet not found', 404));
    }
    if (pet.owner.toString() !== req.user._id.toString()) {
      return next(new AppError('You do not have permission to update this pet', 403));
    }
    const updatedPet = await Pet.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    res.status(200).json({
      success: true,
      data: updatedPet,
    });
  } catch (error) {
    next(error);
  }
};

// Delete a pet
exports.deletePet = async (req, res, next) => {
  try {
    const pet = await Pet.findById(req.params.id);
    if (!pet) {
      return next(new AppError('Pet not found', 404));
    }
    if (pet.owner.toString() !== req.user._id.toString()) {
      return next(new AppError('You do not have permission to delete this pet', 403));
    }
    await pet.remove();
    res.status(204).json({
      success: true,
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
