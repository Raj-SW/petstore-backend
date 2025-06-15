const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide your name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide your email'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: [true, 'Please provide your phone number'],
      trim: true,
    },
    address: {
      type: String,
      required: [true, 'Please provide your address'],
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: 8,
      select: false,
    },
    role: {
      type: String,
      enum: ['customer', 'veterinarian', 'groomer', 'trainer', 'admin'],
      default: 'customer',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    passwordResetToken: String,
    passwordResetExpires: Date,
    emailVerificationToken: String,
    emailVerificationExpires: Date,

    // Professional-specific fields (only populated for professional roles)
    professionalInfo: {
      specialization: {
        type: String,
        trim: true,
        required() {
          return this.role !== 'customer' && this.role !== 'admin';
        },
      },
      qualifications: {
        type: [String],
        default: [],
      },
      experience: {
        type: Number,
        min: 0,
        required() {
          return this.role !== 'customer' && this.role !== 'admin';
        },
      },
      rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
      reviewCount: {
        type: Number,
        default: 0,
      },
      profileImage: {
        type: String,
        trim: true,
      },
      availability: {
        type: Map,
        of: {
          startTime: String,
          endTime: String,
          isAvailable: { type: Boolean, default: true },
        },
        default: new Map(),
      },
      isActive: {
        type: Boolean,
        default: true,
      },
      bio: {
        type: String,
        trim: true,
        maxlength: 500,
      },
      services: [
        {
          name: String,
          price: Number,
          duration: Number, // in minutes
          description: String,
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ 'professionalInfo.specialization': 1 });
userSchema.index({ 'professionalInfo.rating': -1 });
userSchema.index({ 'professionalInfo.isActive': 1 });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate JWT token
userSchema.methods.generateAuthToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// Generate refresh token
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  });
};

// Virtual to check if user is a professional
userSchema.virtual('isProfessional').get(function () {
  return ['veterinarian', 'groomer', 'trainer'].includes(this.role);
});

// Method to get professional data only
userSchema.methods.getProfessionalData = function () {
  if (!this.isProfessional) {
    return null;
  }

  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    phoneNumber: this.phoneNumber,
    address: this.address,
    role: this.role,
    ...this.professionalInfo.toObject(),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

// Method to get customer data only
userSchema.methods.getCustomerData = function () {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    phoneNumber: this.phoneNumber,
    address: this.address,
    role: this.role,
    isEmailVerified: this.isEmailVerified,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

// Static method to find professionals
userSchema.statics.findProfessionals = function (query = {}) {
  return this.find({
    role: { $in: ['veterinarian', 'groomer', 'trainer'] },
    ...query,
  });
};

// Static method to find available professionals
userSchema.statics.findAvailableProfessionals = function (filters = {}) {
  const query = {
    role: { $in: ['veterinarian', 'groomer', 'trainer'] },
    'professionalInfo.isActive': true,
    ...filters,
  };

  return this.find(query);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
