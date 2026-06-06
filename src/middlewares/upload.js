const multer = require('multer');
const { AppError } = require('./errorHandler');

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

// Memory storage — no disk dependency, buffer goes straight to Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
});

module.exports = { upload };
