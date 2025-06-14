const mongoose = require('mongoose');

const Appointment = require('../models/appointment.model');
const Pet = require('../models/pet.model');
const User = require('../models/user.model');
const { AppError } = require('../middlewares/errorHandler');
const { sendEmail } = require('../utils/email');
const { validateAppointment } = require('../validators/appointment.validator');

// Helper function to validate ObjectId
const validateObjectId = (id, fieldName = 'ID') => {
  if (!id) {
    throw new AppError(`${fieldName} is required`, 400);
  }
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${fieldName} format`, 400);
  }
};

// Create new appointment
exports.createAppointment = async (req, res, next) => {
  try {
    const { error } = validateAppointment(req.body);
    if (error) {
      return next(new AppError(error.details[0].message, 400));
    }

    const {
      appointmentType,
      professionalId,
      datetimeISO,
      duration,
      status,
      location,
      petId,
      description,
      notes,
    } = req.body;

    // Validate ObjectIds
    validateObjectId(professionalId, 'Professional ID');
    validateObjectId(petId, 'Pet ID');

    // Validate that the professional exists and has the correct role
    const professional = await User.findOne({
      _id: professionalId,
      role: { $in: ['veterinarian', 'groomer', 'trainer'] },
      'professionalInfo.isActive': true,
    });

    if (!professional) {
      return next(new AppError('Professional not found or inactive', 400));
    }

    // Validate that the professional's role matches the appointment type
    if (professional.role !== appointmentType) {
      return next(new AppError(`Professional is not a ${appointmentType}`, 400));
    }

    const pet = await Pet.findById(petId);
    if (!pet) {
      return next(new AppError('Pet not found', 400));
    }

    // Check if time slot is available
    const existingAppointment = await Appointment.findOne({
      professional: professionalId,
      dateTime: new Date(datetimeISO),
      status: { $in: ['PENDING', 'CONFIRMED'] },
    });

    if (existingAppointment) {
      return next(new AppError('This time slot is already booked', 400));
    }

    // Create appointment
    const appointment = new Appointment({
      appointmentType,
      professional: professionalId,
      professionalLocation: professional.professionalInfo.location?.address || location,
      dateTime: new Date(datetimeISO),
      duration,
      description,
      location,
      additionalNotes: notes,
      pet: petId,
      user: req.user._id,
      status: status || 'PENDING',
    });

    await appointment.save();

    // Populate the appointment with related data
    await appointment.populate([
      { path: 'professional', select: 'name email phoneNumber role professionalInfo' },
      { path: 'user', select: 'name email phoneNumber' },
      { path: 'pet', select: 'name species breed age' },
    ]);

    // Send confirmation email to customer
    try {
      await sendEmail({
        to: req.user.email,
        subject: 'Appointment Confirmation',
        template: 'appointmentConfirmation',
        data: {
          customerName: req.user.name,
          professionalName: professional.name,
          appointmentType,
          dateTime: appointment.dateTime,
          petName: pet.name,
        },
      });
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the appointment creation if email fails
    }

    res.status(201).json({
      success: true,
      data: appointment,
      message: 'Appointment created successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Get all appointments for a user
exports.getUserAppointments = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const query = { user: req.user._id };
    if (status) {
      query.status = status.toUpperCase();
    }

    const appointments = await Appointment.find(query)
      .populate([
        { path: 'professional', select: 'name email phoneNumber role professionalInfo' },
        { path: 'pet', select: 'name species breed age' },
      ])
      .sort({ dateTime: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await Appointment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: appointments,
      pagination: {
        total,
        page: parseInt(page, 10),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get all appointments for a professional
exports.getProfessionalAppointments = async (req, res, next) => {
  try {
    // Verify that the user is a professional
    if (!['veterinarian', 'groomer', 'trainer'].includes(req.user.role)) {
      return next(new AppError('Access denied. Professional role required.', 403));
    }

    const { status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const query = { professional: req.user._id };
    if (status) {
      query.status = status.toUpperCase();
    }

    const appointments = await Appointment.find(query)
      .populate([
        { path: 'user', select: 'name email phoneNumber address' },
        { path: 'pet', select: 'name species breed age weight medicalHistory' },
      ])
      .sort({ dateTime: 1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await Appointment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: appointments,
      pagination: {
        total,
        page: parseInt(page, 10),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update appointment status
exports.updateAppointmentStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const { appointmentId } = req.params;

    // Validate ObjectId
    validateObjectId(appointmentId, 'Appointment ID');

    if (!['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'].includes(status)) {
      return next(new AppError('Invalid status', 400));
    }

    const appointment = await Appointment.findById(appointmentId).populate([
      { path: 'professional', select: 'name email phoneNumber' },
      { path: 'user', select: 'name email phoneNumber' },
      { path: 'pet', select: 'name' },
    ]);

    if (!appointment) {
      return next(new AppError('Appointment not found', 404));
    }

    // Check if user has permission to update this appointment
    const isProfessional = appointment.professional._id.toString() === req.user._id.toString();
    const isCustomer = appointment.user._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isProfessional && !isCustomer && !isAdmin) {
      return next(new AppError('Access denied', 403));
    }

    // Business rules for status updates
    if (status === 'CONFIRMED' && !isProfessional && !isAdmin) {
      return next(new AppError('Only professionals can confirm appointments', 403));
    }

    if (status === 'COMPLETED' && !isProfessional && !isAdmin) {
      return next(new AppError('Only professionals can mark appointments as completed', 403));
    }

    appointment.status = status;
    await appointment.save();

    // Send notification email
    try {
      const emailRecipient = isProfessional
        ? appointment.user.email
        : appointment.professional.email;
      const recipientName = isProfessional ? appointment.user.name : appointment.professional.name;

      await sendEmail({
        to: emailRecipient,
        subject: `Appointment ${status.toLowerCase()}`,
        template: 'appointmentStatusUpdate',
        data: {
          recipientName,
          appointmentType: appointment.appointmentType,
          status: status.toLowerCase(),
          dateTime: appointment.dateTime,
          petName: appointment.pet.name,
        },
      });
    } catch (emailError) {
      console.error('Failed to send status update email:', emailError);
    }

    res.status(200).json({
      success: true,
      data: appointment,
      message: `Appointment ${status.toLowerCase()} successfully`,
    });
  } catch (error) {
    next(error);
  }
};

// Get appointment by ID
exports.getAppointmentById = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;

    // Validate ObjectId
    validateObjectId(appointmentId, 'Appointment ID');

    const appointment = await Appointment.findById(appointmentId).populate([
      { path: 'professional', select: 'name email phoneNumber role professionalInfo' },
      { path: 'user', select: 'name email phoneNumber address' },
      { path: 'pet', select: 'name species breed age weight medicalHistory' },
    ]);

    if (!appointment) {
      return next(new AppError('Appointment not found', 404));
    }

    // Check if user has permission to view this appointment
    const isProfessional = appointment.professional._id.toString() === req.user._id.toString();
    const isCustomer = appointment.user._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isProfessional && !isCustomer && !isAdmin) {
      return next(new AppError('Access denied', 403));
    }

    res.status(200).json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

// Delete/Cancel appointment
exports.deleteAppointment = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;

    // Validate ObjectId
    validateObjectId(appointmentId, 'Appointment ID');

    const appointment = await Appointment.findById(appointmentId).populate([
      { path: 'professional', select: 'name email' },
      { path: 'user', select: 'name email' },
    ]);

    if (!appointment) {
      return next(new AppError('Appointment not found', 404));
    }

    // Check if user has permission to delete this appointment
    const isCustomer = appointment.user._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isCustomer && !isAdmin) {
      return next(new AppError('Access denied', 403));
    }

    // Don't allow deletion of completed appointments
    if (appointment.status === 'COMPLETED') {
      return next(new AppError('Cannot delete completed appointments', 400));
    }

    // Update status to cancelled instead of deleting
    appointment.status = 'CANCELLED';
    await appointment.save();

    // Notify professional
    try {
      await sendEmail({
        to: appointment.professional.email,
        subject: 'Appointment Cancelled',
        template: 'appointmentCancellation',
        data: {
          professionalName: appointment.professional.name,
          customerName: appointment.user.name,
          appointmentType: appointment.appointmentType,
          dateTime: appointment.dateTime,
        },
      });
    } catch (emailError) {
      console.error('Failed to send cancellation email:', emailError);
    }

    res.status(200).json({
      success: true,
      message: 'Appointment cancelled successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Get public professional appointments
exports.getPublicProfessionalAppointments = async (req, res, next) => {
  try {
    const { professionalId } = req.params;

    // Validate ObjectId
    validateObjectId(professionalId, 'Professional ID');

    // Verify that the professional exists and is active
    const professional = await User.findOne({
      _id: professionalId,
      role: { $in: ['veterinarian', 'groomer', 'trainer'] },
    });

    if (!professional) {
      return next(new AppError('Professional not found or inactive', 404));
    }

    const query = {
      professionalId: professional._id,
      status: { $in: ['CONFIRMED'] }, // Only show confirmed appointments
    };

    const appointments = await Appointment.find(query);

    const total = await Appointment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: appointments,
      pagination: {
        total,
      },
    });
  } catch (error) {
    next(error);
  }
};
