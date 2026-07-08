const professionalService = require('../services/professionalService');
const { AppError } = require('../middlewares/errorHandler');
const { sendEmail } = require('../utils/email');
const { frontendUrl } = require('../config/urls');
const { uploadToCloudinary, validateImageFile } = require('../utils/cloudinary');
const logger = require('../utils/logger');

exports.listProfessionals = async (req, res, next) => {
  try {
    const { search, role, status, page, limit, sortBy, sortOrder } = req.query;
    const result = await professionalService.adminListProfessionals(
      { search, role, status },
      { page, limit },
      { sortBy, sortOrder }
    );
    res.status(200).json({ success: true, data: result.professionals, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
};

exports.createProfessional = async (req, res, next) => {
  try {
    const { user, rawToken } = await professionalService.createProfessionalAccount(req.body);

    const inviteUrl = frontendUrl(`reset-password?token=${rawToken}`);
    let warning;
    try {
      await sendEmail({
        to: user.email,
        subject: 'You have been added as a VitalPaws professional',
        template: 'professional-invite',
        data: { name: user.name, role: user.role, inviteUrl },
      });
    } catch (emailErr) {
      logger.warn('Professional invite email failed', { error: emailErr.message });
      warning =
        'Account created but the invite email could not be sent. The professional can use "Forgot password" to set their password.';
    }

    res.status(201).json({ success: true, data: user, ...(warning ? { warning } : {}) });
  } catch (error) {
    next(error);
  }
};

exports.promoteProfessional = async (req, res, next) => {
  try {
    const { userId, role, professionalInfo } = req.body;
    const user = await professionalService.promoteUserToProfessional(userId, { role, professionalInfo });
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

exports.updateProfessional = async (req, res, next) => {
  try {
    const user = await professionalService.adminUpdateProfessional(req.params.id, req.body);
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

exports.toggleStatus = async (req, res, next) => {
  try {
    const isActive = req.body.isActive === true || req.body.isActive === 'true';
    const user = await professionalService.adminUpdateProfessional(req.params.id, {
      professionalInfo: { isActive },
    });
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

exports.offboardProfessional = async (req, res, next) => {
  try {
    const user = await professionalService.offboardProfessional(req.params.id);
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

exports.uploadImage = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('No image file provided', 400));
    validateImageFile(req.file);
    const result = await uploadToCloudinary(req.file, 'professionals');
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
