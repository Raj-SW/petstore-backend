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
    // 15 MB — modern phone photos routinely exceed 8 MB. This intentionally
    // exceeds SonarQube S5693's 8 MB guidance; the risk is bounded because
    // uploads are auth-gated, image-only (fileFilter), and streamed straight
    // to Cloudinary without touching disk. NOSONAR
    fileSize: 15 * 1024 * 1024, // NOSONAR — see comment above
  },
});

module.exports = { upload };
