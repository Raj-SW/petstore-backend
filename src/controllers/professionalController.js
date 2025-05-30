const Professional = require('../models/professional.model');
const { createError } = require('../middlewares/errorHandler');

// Get all professionals with filtering and pagination
exports.getAllProfessionals = async (req, res, next) => {
  try {
    const {
      profession,
      role,
      rating,
      isActive,
      page = 1,
      limit = 10,
      sortBy = 'rating',
      sortOrder = 'desc',
    } = req.query;

    // Build query
    const query = {};
    if (profession) query.profession = profession;
    if (role) query.role = role;
    if (rating) query.rating = { $gte: rating };
    if (isActive !== undefined) query.isActive = isActive;

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Execute query with pagination and sorting
    const professionals = await Professional.find(query)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');

    // Get total count for pagination
    const total = await Professional.countDocuments(query);

    res.status(200).json({
      success: true,
      data: professionals,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get a single professional by ID
exports.getProfessional = async (req, res, next) => {
  try {
    const professional = await Professional.findById(req.params.id).select('-__v');

    if (!professional) {
      return next(createError(404, 'Professional not found'));
    }

    res.status(200).json({
      success: true,
      data: professional,
    });
  } catch (error) {
    next(error);
  }
};

// Create a new professional
exports.createProfessional = async (req, res, next) => {
  try {
    const professional = await Professional.create(req.body);

    res.status(201).json({
      success: true,
      data: professional,
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(createError(400, 'Email already exists'));
    }
    next(error);
  }
};

// Update a professional
exports.updateProfessional = async (req, res, next) => {
  try {
    const professional = await Professional.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).select('-__v');

    if (!professional) {
      return next(createError(404, 'Professional not found'));
    }

    res.status(200).json({
      success: true,
      data: professional,
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(createError(400, 'Email already exists'));
    }
    next(error);
  }
};

// Delete a professional
exports.deleteProfessional = async (req, res, next) => {
  try {
    const professional = await Professional.findByIdAndDelete(req.params.id);

    if (!professional) {
      return next(createError(404, 'Professional not found'));
    }

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

// Get professionals by specialization
exports.getProfessionalsByRole = async (req, res, next) => {
  try {
    const { role } = req.params;
    const professionals = await Professional.find({ role }).select('-__v');

    res.status(200).json({
      success: true,
      data: professionals,
    });
  } catch (error) {
    next(error);
  }
};

// Get available professionals for a specific time slot
exports.getAvailableProfessionals = async (req, res, next) => {
  try {
    const { day, time, profession } = req.query;

    const professionals = await Professional.find({
      profession,
      'availability.day': day,
      'availability.startTime': { $lte: time },
      'availability.endTime': { $gte: time },
      isActive: true,
    }).select('-__v');

    res.status(200).json({
      success: true,
      data: professionals,
    });
  } catch (error) {
    next(error);
  }
};
