const mongoose = require('mongoose');
const AppointmentRequest = require('../models/appointmentRequest.model');
const MobileVetRequest = require('../models/mobileVetRequest.model');
const { REQUEST_STATUSES } = require('../models/serviceRequestCommon');
const { uploadToCloudinary } = require('../utils/cloudinary');
const { AppError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');
const { toSafeString } = require('../utils/sanitize');

// The two request types differ in payload but share an identical admin
// lifecycle, so list/update/note are generated once per model.
const adminHandlers = (Model, label) => ({
  // GET /admin — paginated, status-filtered, with per-status counts for the tabs
  list: async (req, res, next) => {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Number.parseInt(req.query.limit, 10) || 20);
      const status = toSafeString(req.query.status);
      const filter = REQUEST_STATUSES.includes(status) ? { status } : {};

      const [items, total, statusCounts] = await Promise.all([
        Model.find(filter)
          .sort({ isEmergency: -1, createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('notes.by', 'name email'),
        Model.countDocuments(filter),
        Model.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      ]);

      const stats = Object.fromEntries(REQUEST_STATUSES.map((s) => [s, 0]));
      statusCounts.forEach(({ _id, count }) => { stats[_id] = count; });

      return res.status(200).json({
        success: true,
        data: items,
        stats,
        pagination: { total, page, pages: Math.ceil(total / limit) },
      });
    } catch (error) {
      return next(error);
    }
  },

  // PATCH /:id — status change and/or corrections after speaking to the client
  update: async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return next(new AppError('Invalid request id', 400));
      }
      const item = await Model.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true, runValidators: true },
      ).populate('notes.by', 'name email');
      if (!item) return next(new AppError(`${label} not found`, 404));

      return res.status(200).json({ success: true, data: item });
    } catch (error) {
      return next(error);
    }
  },

  // POST /:id/notes — append an intervention note
  addNote: async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return next(new AppError('Invalid request id', 400));
      }
      const item = await Model.findByIdAndUpdate(
        req.params.id,
        { $push: { notes: { text: req.body.text, by: req.user._id, at: new Date() } } },
        { new: true, runValidators: true },
      ).populate('notes.by', 'name email');
      if (!item) return next(new AppError(`${label} not found`, 404));

      return res.status(201).json({ success: true, data: item });
    } catch (error) {
      return next(error);
    }
  },

  // DELETE /:id
  remove: async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return next(new AppError('Invalid request id', 400));
      }
      const item = await Model.findByIdAndDelete(req.params.id);
      if (!item) return next(new AppError(`${label} not found`, 404));
      return res.status(200).json({ success: true, message: `${label} deleted` });
    } catch (error) {
      return next(error);
    }
  },
});

const appointmentAdmin = adminHandlers(AppointmentRequest, 'Appointment request');
const mobileVetAdmin = adminHandlers(MobileVetRequest, 'Mobile vet request');

// POST /api/requests/appointments — public
exports.createAppointmentRequest = async (req, res, next) => {
  try {
    const item = await AppointmentRequest.create(req.body);
    logger.info('Appointment request received', { id: item._id });
    return res.status(201).json({ success: true, data: item });
  } catch (error) {
    return next(error);
  }
};

// POST /api/requests/mobile-vet — public, optional single pet photo
exports.createMobileVetRequest = async (req, res, next) => {
  try {
    const { lat, lng, ...rest } = req.body;
    const payload = { ...rest };
    if (lat !== undefined && lng !== undefined) payload.coords = { lat, lng };
    if (req.file) payload.photo = await uploadToCloudinary(req.file, 'mobile-vet-requests');

    const item = await MobileVetRequest.create(payload);
    logger.info('Mobile vet request received', { id: item._id, emergency: item.isEmergency });
    return res.status(201).json({ success: true, data: item });
  } catch (error) {
    return next(error);
  }
};

exports.getAppointmentRequests = appointmentAdmin.list;
exports.updateAppointmentRequest = appointmentAdmin.update;
exports.addAppointmentRequestNote = appointmentAdmin.addNote;
exports.deleteAppointmentRequest = appointmentAdmin.remove;

exports.getMobileVetRequests = mobileVetAdmin.list;
exports.updateMobileVetRequest = mobileVetAdmin.update;
exports.addMobileVetRequestNote = mobileVetAdmin.addNote;
exports.deleteMobileVetRequest = mobileVetAdmin.remove;
