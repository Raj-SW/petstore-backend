const Pet = require('../models/pet.model');
const { AppError } = require('../middlewares/errorHandler');
const {
  uploadMultipleToCloudinary,
  deleteMultipleFromCloudinary,
  validateImageFile,
} = require('../utils/cloudinary');

const MAX_PET_IMAGES = 6;

// Shared ownership guard — returns the pet, or sends the right error via next().
async function loadOwnedPet(req, next) {
  const pet = await Pet.findById(req.params.id);
  if (!pet) {
    next(new AppError('Pet not found', 404));
    return null;
  }
  if (pet.owner.toString() !== req.user._id.toString()) {
    next(new AppError('You do not have permission to modify this pet', 403));
    return null;
  }
  return pet;
}

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

    if (pet.images?.length) {
      await deleteMultipleFromCloudinary(pet.images.map((img) => img.publicId));
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

// Add photos to a pet (max MAX_PET_IMAGES total)
exports.addPetImages = async (req, res, next) => {
  try {
    const pet = await loadOwnedPet(req, next);
    if (!pet) return;

    if (!req.files || req.files.length === 0) {
      return next(new AppError('No images uploaded. Use field name "petImages".', 400));
    }
    if (pet.images.length + req.files.length > MAX_PET_IMAGES) {
      return next(new AppError(`A pet can have at most ${MAX_PET_IMAGES} photos`, 400));
    }

    req.files.forEach((file) => validateImageFile(file));
    const uploaded = await uploadMultipleToCloudinary(req.files, 'pets');
    pet.images.push(...uploaded);
    await pet.save();

    return res.status(201).json({ success: true, data: pet });
  } catch (error) {
    return next(error);
  }
};

// Delete a single photo from a pet
exports.deletePetImage = async (req, res, next) => {
  try {
    const pet = await loadOwnedPet(req, next);
    if (!pet) return;

    const { publicId } = req.params;
    const exists = pet.images.some((img) => img.publicId === publicId);
    if (!exists) return next(new AppError('Image not found', 404));

    await deleteMultipleFromCloudinary([publicId]);
    pet.images = pet.images.filter((img) => img.publicId !== publicId);
    await pet.save();

    return res.status(200).json({ success: true, data: pet });
  } catch (error) {
    return next(error);
  }
};

// Set a photo as the cover (move to index 0)
exports.setPrimaryPetImage = async (req, res, next) => {
  try {
    const pet = await loadOwnedPet(req, next);
    if (!pet) return;

    const { publicId } = req.params;
    const target = pet.images.find((img) => img.publicId === publicId);
    if (!target) return next(new AppError('Image not found', 404));

    pet.images = [target, ...pet.images.filter((img) => img.publicId !== publicId)];
    await pet.save();

    return res.status(200).json({ success: true, data: pet });
  } catch (error) {
    return next(error);
  }
};
