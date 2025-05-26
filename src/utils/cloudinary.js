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
exports.uploadToCloudinary = async (file, folder) => {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder,
      resource_type: 'auto',
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

// Delete file from Cloudinary
exports.deleteFromCloudinary = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    logger.error('Cloudinary delete error:', error);
    throw new AppError('Error deleting file from Cloudinary', 500);
  }
};
