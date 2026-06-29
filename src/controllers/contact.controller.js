const mongoose = require('mongoose');
const Contact = require('../models/contact.model');
const { sendEmail } = require('../utils/email');
const { AppError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');
const { toSafeString } = require('../utils/sanitize');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.SMTP_FROM;

// POST /api/contact  — public
exports.submitContact = async (req, res, next) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return next(new AppError('Name, email and message are required', 400));
    }

    const contact = await Contact.create({ name, email, message });

    // Confirmation email to user — non-fatal
    try {
      await sendEmail({
        to: email,
        subject: 'We received your message — VitalPaws',
        template: 'contact-confirmation',
        data: { name },
      });
    } catch (err) {
      logger.warn('Contact confirmation email failed (non-fatal)', { error: err.message });
    }

    // Notification email to admin — non-fatal
    try {
      await sendEmail({
        to: ADMIN_EMAIL,
        subject: `New contact message from ${name}`,
        template: 'contact-admin',
        data: { name, email, message, contactId: contact._id },
      });
    } catch (err) {
      logger.warn('Admin contact notification email failed (non-fatal)', { error: err.message });
    }

    logger.info('Contact message submitted', { contactId: contact._id, email });

    res.status(201).json({
      success: true,
      message: 'Message received! We\'ll get back to you shortly.',
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/contacts  — admin only
exports.getContacts = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
    const skip  = (page - 1) * limit;

    const filter = {};
    const status = toSafeString(req.query.status);
    if (status) filter.status = status;

    const [contacts, total] = await Promise.all([
      Contact.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Contact.countDocuments(filter),
    ]);

    const stats = await Contact.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const statMap = { new: 0, read: 0, replied: 0 };
    stats.forEach(({ _id, count }) => { statMap[_id] = count; });

    res.status(200).json({
      success: true,
      data: contacts,
      stats: statMap,
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/contacts/:id  — admin only
exports.updateContactStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['new', 'read', 'replied'].includes(status)) {
      return next(new AppError('Invalid status', 400));
    }

    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!contact) return next(new AppError('Contact not found', 404));

    res.status(200).json({ success: true, data: contact });
  } catch (error) {
    next(error);
  }
};

// POST /api/contact/:id/reply  — admin only
exports.replyToContact = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new AppError('Invalid contact id', 400));
    }
    const message = (req.body.message || '').trim();
    if (!message) {
      return next(new AppError('Reply message is required', 400));
    }
    const contact = await Contact.findById(req.params.id);
    if (!contact) return next(new AppError('Contact not found', 404));

    // Send the reply — if this throws, status is left unchanged so the admin knows it failed.
    await sendEmail({
      to: contact.email,
      subject: 'Re: your message to VitalPaws',
      template: 'contact-reply',
      data: { name: contact.name, message, original: contact.message },
    });

    contact.status = 'replied';
    contact.lastReply = message;
    contact.repliedAt = new Date();
    await contact.save();

    logger.info('Contact reply sent', { contactId: contact._id });
    return res.status(200).json({ success: true, message: 'Reply sent', data: contact });
  } catch (error) {
    return next(error);
  }
};

// DELETE /api/contact/:id  — admin only
exports.deleteContact = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new AppError('Invalid contact id', 400));
    }
    const contact = await Contact.findByIdAndDelete(req.params.id);
    if (!contact) return next(new AppError('Contact not found', 404));
    res.status(200).json({ success: true, message: 'Contact deleted' });
  } catch (error) {
    next(error);
  }
};
