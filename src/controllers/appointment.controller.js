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
      professionalName,
      professionalId,
      dateTime,
      petName,
      petId,
      description,
      address,
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

    // Check if time slot is available for professional
    const existingAppointment = await Appointment.findOne({
      professionalId,
      dateTime: new Date(dateTime),
      status: { $in: ['PENDING', 'CONFIRMED'] },
    });
    if (existingAppointment) {
      return next(new AppError('This time slot is already booked', 400));
    }

    // Check if time slot is available for pet (double-booking prevention)
    const petDoubleBooking = await Appointment.findOne({
      petId,
      dateTime: new Date(dateTime),
      status: { $in: ['PENDING', 'CONFIRMED'] },
    });
    if (petDoubleBooking) {
      return next(new AppError('This pet already has an appointment at this time', 400));
    }

    // Create appointment
    const appointment = new Appointment({
      appointmentType,
      professionalName,
      professionalId,
      dateTime: new Date(dateTime),
      petName,
      petId,
      description,
      address,
      status: 'PENDING',
      userId: req.user._id,
    });

    await appointment.save();

    // Populate the appointment with related data
    await appointment.populate([
      { path: 'professionalId', select: 'name email phoneNumber role professionalInfo' },
      { path: 'petId', select: 'name species breed age' },
      { path: 'userId', select: 'name email' },
    ]);

    // Send emails asynchronously after saving
    (async () => {
      try {
        // Email to professional
        await sendEmail({
          to: professional.email,
          subject: 'New Appointment Request Received',
          template: 'appointment-request',
          data: {
            professionalName: professional.name,
            petName,
            date: new Date(dateTime).toLocaleDateString(),
            time: new Date(dateTime).toLocaleTimeString(),
            description,
            userName: req.user.name,
            userEmail: req.user.email,
            userPhone: req.user.phoneNumber,
          },
        });
      } catch (emailError) {
        console.error('Failed to send appointment request email to professional:', emailError);
      }
      try {
        // Email to user
        await sendEmail({
          to: req.user.email,
          subject: 'Appointment Request Sent',
          template: 'appointment-confirmation',
          data: {
            userName: req.user.name,
            petName,
            date: new Date(dateTime).toLocaleDateString(),
            time: new Date(dateTime).toLocaleTimeString(),
            description,
            professionalName: professional.name,
          },
        });
      } catch (emailError) {
        console.error('Failed to send appointment confirmation email to user:', emailError);
      }
    })();

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
        { path: 'professionalId', select: 'name email phoneNumber role ' },
        { path: 'petId', select: 'name species breed age' },
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

    const query = { professionalId: req.user._id };
    if (status) {
      query.status = status.toUpperCase();
    }

    const appointments = await Appointment.find(query)
      .populate([
        { path: 'userId', select: 'name email phoneNumber address' },
        { path: 'petId', select: 'name species breed age weight medicalHistory' },
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
      { path: 'professionalId', select: 'name email phoneNumber' },
      { path: 'userId', select: 'name email phoneNumber' },
      { path: 'petId', select: 'name' },
    ]);

    if (!appointment) {
      return next(new AppError('Appointment not found', 404));
    }

    // Check if user has permission to update this appointment;
    const isProfessionalAssigned =
      req.user._id.toString() === appointment.professionalId.toString();
    const isProfessional = req.user.role === appointment.appointmentType;
    const isAdmin = req.user.role === 'admin';
    if (!isProfessionalAssigned && !isProfessional) {
      return next(new AppError('Access denied', 403));
    }

    // Business rules for status updates
    if (status === 'CONFIRMED' && !isProfessional && !isAdmin) {
      return next(new AppError('Only service providers can confirm appointments', 403));
    }

    if (status === 'COMPLETED' && !isProfessional && !isAdmin) {
      return next(new AppError('Only service providers can mark appointments as completed', 403));
    }

    appointment.status = status;
    await appointment.save();

    // Send notification email to both user and professional
    try {
      // Email to customer
      await sendEmail({
        to: appointment.userId.email,
        subject: `Your appointment with ${appointment.professionalId.name} is confirmed`,
        template: 'appointmentStatusUpdateCustomer',
        data: {
          recipientName: appointment.userId.name,
          vetName: appointment.professionalId.name,
          petName: appointment.petId.name,
          description: appointment.description,
          address: appointment.address,
          dateTime: appointment.dateTime,
        },
      });
      // Email to professional
      await sendEmail({
        to: appointment.professionalId.email,
        subject: `You have confirmed an appointment with ${appointment.userId.name}`,
        template: 'appointmentStatusUpdateProfessional',
        data: {
          recipientName: appointment.professionalId.name,
          customerName: appointment.userId.name,
          petName: appointment.petId.name,
          description: appointment.description,
          address: appointment.address,
          dateTime: appointment.dateTime,
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
      { path: 'professionalId', select: 'name email phoneNumber role professionalInfo' },
      { path: 'user', select: 'name email phoneNumber address' },
      { path: 'petId', select: 'name species breed age weight medicalHistory' },
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

    // Notify both user and professional
    (async () => {
      try {
        // Email to user
        await sendEmail({
          to: appointment.user.email,
          subject: 'Appointment Cancelled',
          template: 'appointmentStatusUpdate',
          data: {
            recipientName: appointment.user.name,
            appointmentType: appointment.appointmentType,
            status: 'cancelled',
            dateTime: appointment.dateTime,
            petName: appointment.petId.name || (appointment.petId && appointment.petId.name),
          },
        });
      } catch (emailError) {
        console.error('Failed to send cancellation email to user:', emailError);
      }
      try {
        // Email to professional
        await sendEmail({
          to: appointment.professional.email,
          subject: 'Appointment Cancelled',
          template: 'appointmentStatusUpdate',
          data: {
            recipientName: appointment.professional.name,
            appointmentType: appointment.appointmentType,
            status: 'cancelled',
            dateTime: appointment.dateTime,
            petName: appointment.petId.name || (appointment.petId && appointment.petId.name),
          },
        });
      } catch (emailError) {
        console.error('Failed to send cancellation email to professional:', emailError);
      }
    })();

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
