const cloudinary = require('cloudinary').v2;
const { AppError } = require('../middlewares/errorHandler');
const logger = require('./logger');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload file to Cloudinary
exports.uploadToCloudinary = async (file, folder = 'products') => {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder,
      resource_type: 'auto',
      transformation: [
        { width: 800, height: 800, crop: 'fill', quality: 'auto' },
        { fetch_format: 'auto' },
      ],
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    logger.error('Cloudinary upload error:', error);
    throw new AppError('Error uploading file to Cloudinary', 500);
  }
};

// Upload multiple files to Cloudinary
exports.uploadMultipleToCloudinary = async (files, folder = 'products') => {
  try {
    const uploadPromises = files.map((file) => exports.uploadToCloudinary(file, folder));
    const results = await Promise.all(uploadPromises);
    return results;
  } catch (error) {
    logger.error('Cloudinary multiple upload error:', error);
    throw new AppError('Error uploading files to Cloudinary', 500);
  }
};

// Delete file from Cloudinary
exports.deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    if (result.result !== 'ok') {
      logger.warn(`Failed to delete image with publicId: ${publicId}`);
    }
    return result;
  } catch (error) {
    logger.error('Cloudinary delete error:', error);
    throw new AppError('Error deleting file from Cloudinary', 500);
  }
};

// Delete multiple files from Cloudinary
exports.deleteMultipleFromCloudinary = async (publicIds) => {
  try {
    if (!publicIds || publicIds.length === 0) {
      return;
    }

    const deletePromises = publicIds.map((publicId) => exports.deleteFromCloudinary(publicId));
    await Promise.allSettled(deletePromises); // Use allSettled to handle partial failures
  } catch (error) {
    logger.error('Cloudinary multiple delete error:', error);
    throw new AppError('Error deleting files from Cloudinary', 500);
  }
};

// Validate image file
exports.validateImageFile = (file) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new AppError('Invalid file type. Only JPEG, PNG, and WebP images are allowed.', 400);
  }

  if (file.size > maxSize) {
    throw new AppError('File size too large. Maximum size is 5MB.', 400);
  }

  return true;
};
