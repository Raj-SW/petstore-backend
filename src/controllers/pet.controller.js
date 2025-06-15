const Pet = require('../models/pet.model');
const { AppError } = require('../middlewares/errorHandler');

// Create a new pet
exports.createPet = async (req, res, next) => {
  try {
    const {
      name, breed, age, type, color, gender, description,
    } = req.body;

    // Validate required fields
    if (!name || !breed || !age || !type || !color || !gender) {
      return next(new AppError('Please provide all required fields', 400));
    }

    // Validate age
    if (age < 0 || age > 30) {
      return next(new AppError('Age must be between 0 and 30', 400));
    }

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
    const pets = await Pet.find({ owner: req.user._id }).sort('-createdAt');

    res.status(200).json({
      success: true,
      count: pets.length,
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
    const {
      name, breed, age, type, color, gender, description,
    } = req.body;

    // Validate age if provided
    if (age !== undefined && (age < 0 || age > 30)) {
      return next(new AppError('Age must be between 0 and 30', 400));
    }

    const pet = await Pet.findById(req.params.id);

    if (!pet) {
      return next(new AppError('Pet not found', 404));
    }

    if (pet.owner.toString() !== req.user._id.toString()) {
      return next(new AppError('You do not have permission to update this pet', 403));
    }

    const updatedPet = await Pet.findByIdAndUpdate(
      req.params.id,
      {
        name, breed, age, type, color, gender, description,
      },
      { new: true, runValidators: true },
    );

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

    await Pet.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Pet deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
