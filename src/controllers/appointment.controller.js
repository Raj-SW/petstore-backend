const Appointment = require('../models/appointment.model');
const User = require('../models/user.model');
const { AppError } = require('../middlewares/errorHandler');
const { sendEmail } = require('../utils/email');
const logger = require('../utils/logger');

// Create new appointment
exports.createAppointment = async (req, res, next) => {
  try {
    const { serviceProviderId, serviceType, pet, date, timeSlot, reason } = req.body;

    // Validate service provider exists and has correct role
    const serviceProvider = await User.findOne({
      _id: serviceProviderId,
      role: serviceType,
    });

    if (!serviceProvider) {
      return next(new AppError('Invalid service provider', 400));
    }

    // Check if time slot is available
    const existingAppointment = await Appointment.findOne({
      serviceProvider: serviceProviderId,
      date,
      'timeSlot.start': timeSlot.start,
      'timeSlot.end': timeSlot.end,
      status: { $in: ['pending', 'accepted'] },
    });

    if (existingAppointment) {
      return next(new AppError('This time slot is already booked', 400));
    }

    // Create appointment
    const appointment = await Appointment.create({
      user: req.user.id,
      serviceProvider: serviceProviderId,
      serviceType,
      pet,
      date,
      timeSlot,
      reason,
    });

    // Send notification to service provider
    await sendEmail({
      email: serviceProvider.email,
      subject: 'New Appointment Request',
      template: 'appointment-request',
      data: {
        name: serviceProvider.name,
        appointmentId: appointment._id,
        customerName: req.user.name,
        petName: pet.name,
        date,
        timeSlot,
        reason,
      },
    });

    // Send confirmation to customer
    await sendEmail({
      email: req.user.email,
      subject: 'Appointment Request Confirmation',
      template: 'appointment-confirmation',
      data: {
        name: req.user.name,
        appointmentId: appointment._id,
        serviceProviderName: serviceProvider.name,
        serviceType,
        petName: pet.name,
        date,
        timeSlot,
        reason,
      },
    });

    res.status(201).json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

// Get user's appointments
exports.getMyAppointments = async (req, res, next) => {
  try {
    const appointments = await Appointment.find({ user: req.user.id })
      .populate('serviceProvider', 'name email')
      .sort('-date');

    res.status(200).json({
      success: true,
      data: appointments,
    });
  } catch (error) {
    next(error);
  }
};

// Get service provider's appointments
exports.getServiceProviderAppointments = async (req, res, next) => {
  try {
    const appointments = await Appointment.find({ serviceProvider: req.user.id })
      .populate('user', 'name email')
      .sort('-date');

    res.status(200).json({
      success: true,
      data: appointments,
    });
  } catch (error) {
    next(error);
  }
};

// Get single appointment
exports.getAppointment = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('user', 'name email')
      .populate('serviceProvider', 'name email');

    if (!appointment) {
      return next(new AppError('Appointment not found', 404));
    }

    // Check if user is authorized to view this appointment
    if (
      appointment.user._id.toString() !== req.user.id &&
      appointment.serviceProvider._id.toString() !== req.user.id
    ) {
      return next(new AppError('Not authorized to view this appointment', 403));
    }

    res.status(200).json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

// Update appointment status (accept/reject)
exports.updateAppointmentStatus = async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return next(new AppError('Appointment not found', 404));
    }

    // Check if service provider is authorized
    if (appointment.serviceProvider.toString() !== req.user.id) {
      return next(new AppError('Not authorized to update this appointment', 403));
    }

    // Validate status transition
    const validTransitions = {
      pending: ['accepted', 'rejected'],
      accepted: ['completed', 'cancelled'],
      rejected: [],
      completed: [],
      cancelled: [],
    };

    if (!validTransitions[appointment.status].includes(status)) {
      return next(new AppError('Invalid status transition', 400));
    }

    appointment.status = status;
    if (notes) appointment.notes = notes;
    await appointment.save();

    // Send notification to customer
    await sendEmail({
      email: appointment.user.email,
      subject: 'Appointment Status Update',
      template: 'appointment-status-update',
      data: {
        name: appointment.user.name,
        appointmentId: appointment._id,
        status,
        notes,
      },
    });

    res.status(200).json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

// Cancel appointment
exports.cancelAppointment = async (req, res, next) => {
  try {
    const { cancellationReason } = req.body;
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return next(new AppError('Appointment not found', 404));
    }

    // Check if user is authorized to cancel
    if (
      appointment.user.toString() !== req.user.id &&
      appointment.serviceProvider.toString() !== req.user.id
    ) {
      return next(new AppError('Not authorized to cancel this appointment', 403));
    }

    // Check if appointment can be cancelled
    if (!['pending', 'accepted'].includes(appointment.status)) {
      return next(new AppError('Appointment cannot be cancelled', 400));
    }

    appointment.status = 'cancelled';
    appointment.cancellationReason = cancellationReason;
    await appointment.save();

    // Send cancellation notification
    const recipient =
      appointment.user.toString() === req.user.id ? appointment.serviceProvider : appointment.user;

    await sendEmail({
      email: recipient.email,
      subject: 'Appointment Cancelled',
      template: 'appointment-cancelled',
      data: {
        name: recipient.name,
        appointmentId: appointment._id,
        cancellationReason,
      },
    });

    res.status(200).json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

// Get appointments by professionalId (number)
exports.getAppointmentsByProfessional = async (req, res, next) => {
  try {
    const { professionalId } = req.params;
    const appointments = await Appointment.find({ professionalId: Number(professionalId) });
    res.status(200).json({
      success: true,
      data: appointments,
    });
  } catch (error) {
    next(error);
  }
};

// Get appointments by ownerId (number)
exports.getAppointmentsByOwner = async (req, res, next) => {
  try {
    const { ownerId } = req.params;
    const appointments = await Appointment.find({ ownerId: Number(ownerId) });
    res.status(200).json({
      success: true,
      data: appointments,
    });
  } catch (error) {
    next(error);
  }
};

// Get all appointments
exports.getAllAppointments = async (req, res, next) => {
  try {
    const appointments = await Appointment.find();
    res.status(200).json({
      success: true,
      data: appointments,
    });
  } catch (error) {
    next(error);
  }
};
