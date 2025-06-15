const mongoose = require('mongoose');
const professionalService = require('../services/professionalService');
const { AppError } = require('../middlewares/errorHandler');

// Helper function to validate ObjectId
const validateObjectId = (id, fieldName = 'ID') => {
  if (!id) {
    throw new AppError(`${fieldName} is required`, 400);
  }
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${fieldName} format`, 400);
  }
};

// Get all professionals with filtering and pagination
exports.getAllProfessionals = async (req, res, next) => {
  try {
    const filters = {
      specialization: req.query.specialization,
      role: req.query.role,
      rating: req.query.rating,
      isActive: req.query.isActive,
      city: req.query.city,
      state: req.query.state,
    };

    const pagination = {
      page: req.query.page,
      limit: req.query.limit,
    };

    const sorting = {
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
    };

    const result = await professionalService.getAllProfessionals(filters, pagination, sorting);
    console.log('result', result);
    res.status(200).json({
      success: true,
      data: result.professionals,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

// Get a single professional by ID
exports.getProfessional = async (req, res, next) => {
  try {
    validateObjectId(req.params.id, 'Professional ID');

    const professional = await professionalService.getProfessionalById(req.params.id);

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

// Update a professional (for admin use or professional self-update)
exports.updateProfessional = async (req, res, next) => {
  try {
    validateObjectId(req.params.id, 'Professional ID');

    const professional = await professionalService.updateProfessional(req.params.id, req.body);

    res.status(200).json({
      success: true,
      data: professional,
      message: 'Professional updated successfully',
    });
  } catch (error) {
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

// Get professionals by role/specialization
exports.getProfessionalsByRole = async (req, res, next) => {
  try {
    const { role } = req.params;
    const professionals = await professionalService.getProfessionalsByRole(role);

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
    const timeSlot = {
      day: req.query.day,
      time: req.query.time,
      role: req.query.role,
      specialization: req.query.specialization,
    };

    const professionals = await professionalService.getAvailableProfessionals(timeSlot);

    res.status(200).json({
      success: true,
      data: professionals,
    });
  } catch (error) {
    next(error);
  }
};

// Update professional rating (called when a review is submitted)
exports.updateProfessionalRating = async (req, res, next) => {
  try {
    validateObjectId(req.params.id, 'Professional ID');

    const { rating } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return next(new AppError('Rating must be between 1 and 5', 400));
    }

    const professional = await professionalService.updateProfessionalRating(req.params.id, rating);

    res.status(200).json({
      success: true,
      data: professional,
      message: 'Professional rating updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Set professional availability
exports.setProfessionalAvailability = async (req, res, next) => {
  try {
    validateObjectId(req.params.id, 'Professional ID');

    const professional = await professionalService.setProfessionalAvailability(
      req.params.id,
      req.body.availability
    );

    res.status(200).json({
      success: true,
      data: professional,
      message: 'Availability updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Toggle professional active status
exports.toggleProfessionalStatus = async (req, res, next) => {
  try {
    validateObjectId(req.params.id, 'Professional ID');

    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return next(new AppError('isActive must be a boolean value', 400));
    }

    const professional = await professionalService.toggleProfessionalStatus(
      req.params.id,
      isActive
    );

    res.status(200).json({
      success: true,
      data: professional,
      message: `Professional ${isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    next(error);
  }
};
