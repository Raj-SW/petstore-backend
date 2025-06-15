const mongoose = require('mongoose');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Validation utilities for MongoDB operations
 */
class ValidationUtils {
  /**
   * Validate MongoDB ObjectId
   * @param {string} id - The ID to validate
   * @param {string} fieldName - Name of the field for error messages
   * @throws {AppError} - If ID is invalid
   */
  static validateObjectId(id, fieldName = 'ID') {
    if (!id) {
      throw new AppError(`${fieldName} is required`, 400);
    }

    if (typeof id !== 'string') {
      throw new AppError(`${fieldName} must be a string`, 400);
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(`Invalid ${fieldName} format. Must be a valid MongoDB ObjectId`, 400);
    }
  }

  /**
   * Validate multiple ObjectIds
   * @param {Object} ids - Object containing id fields to validate
   * @param {Object} fieldNames - Object mapping id keys to field names
   * @throws {AppError} - If any ID is invalid
   */
  static validateObjectIds(ids, fieldNames = {}) {
    Object.keys(ids).forEach((key) => {
      const fieldName = fieldNames[key] || key;
      this.validateObjectId(ids[key], fieldName);
    });
  }

  /**
   * Convert string to ObjectId if valid
   * @param {string} id - The ID to convert
   * @param {string} fieldName - Name of the field for error messages
   * @returns {mongoose.Types.ObjectId} - Valid ObjectId
   * @throws {AppError} - If ID is invalid
   */
  static toObjectId(id, fieldName = 'ID') {
    this.validateObjectId(id, fieldName);
    return new mongoose.Types.ObjectId(id);
  }

  /**
   * Check if a value is a valid ObjectId without throwing
   * @param {any} id - The value to check
   * @returns {boolean} - True if valid ObjectId
   */
  static isValidObjectId(id) {
    return id && typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);
  }

  /**
   * Validate pagination parameters
   * @param {Object} params - Pagination parameters
   * @param {number} params.page - Page number
   * @param {number} params.limit - Items per page
   * @param {number} maxLimit - Maximum allowed limit
   * @returns {Object} - Validated pagination parameters
   */
  static validatePagination(params = {}, maxLimit = 100) {
    const { page = 1, limit = 10 } = params;

    const validatedPage = Math.max(1, parseInt(page, 10) || 1);
    const validatedLimit = Math.min(maxLimit, Math.max(1, parseInt(limit, 10) || 10));

    return {
      page: validatedPage,
      limit: validatedLimit,
      skip: (validatedPage - 1) * validatedLimit,
    };
  }

  /**
   * Validate sort parameters
   * @param {Object} params - Sort parameters
   * @param {string} params.sortBy - Field to sort by
   * @param {string} params.sortOrder - Sort order (asc/desc)
   * @param {Array} allowedFields - Allowed fields for sorting
   * @returns {Object} - Validated sort parameters
   */
  static validateSort(params = {}, allowedFields = []) {
    const { sortBy, sortOrder = 'desc' } = params;

    let validatedSortBy = sortBy;
    if (sortBy && allowedFields.length > 0 && !allowedFields.includes(sortBy)) {
      validatedSortBy = allowedFields[0]; // Default to first allowed field
    }

    const validatedSortOrder = ['asc', 'desc'].includes(sortOrder) ? sortOrder : 'desc';

    return {
      sortBy: validatedSortBy,
      sortOrder: validatedSortOrder,
      sortDirection: validatedSortOrder === 'desc' ? -1 : 1,
    };
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @param {string} fieldName - Name of the field for error messages
   * @throws {AppError} - If email is invalid
   */
  static validateEmail(email, fieldName = 'Email') {
    if (!email) {
      throw new AppError(`${fieldName} is required`, 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError(`Invalid ${fieldName} format`, 400);
    }
  }

  /**
   * Validate phone number format
   * @param {string} phone - Phone number to validate
   * @param {string} fieldName - Name of the field for error messages
   * @throws {AppError} - If phone number is invalid
   */
  static validatePhoneNumber(phone, fieldName = 'Phone number') {
    if (!phone) {
      throw new AppError(`${fieldName} is required`, 400);
    }

    // Allow various phone number formats
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    if (!phoneRegex.test(phone)) {
      throw new AppError(`Invalid ${fieldName} format`, 400);
    }
  }

  /**
   * Validate required fields
   * @param {Object} data - Data object to validate
   * @param {Array} requiredFields - Array of required field names
   * @throws {AppError} - If any required field is missing
   */
  static validateRequiredFields(data, requiredFields) {
    const missingFields = requiredFields.filter((field) => {
      const value = data[field];
      return value === undefined || value === null || value === '';
    });

    if (missingFields.length > 0) {
      throw new AppError(`Missing required fields: ${missingFields.join(', ')}`, 400);
    }
  }

  /**
   * Validate enum values
   * @param {any} value - Value to validate
   * @param {Array} allowedValues - Array of allowed values
   * @param {string} fieldName - Name of the field for error messages
   * @throws {AppError} - If value is not in allowed values
   */
  static validateEnum(value, allowedValues, fieldName = 'Value') {
    if (value && !allowedValues.includes(value)) {
      throw new AppError(`Invalid ${fieldName}. Allowed values: ${allowedValues.join(', ')}`, 400);
    }
  }

  /**
   * Validate date format and range
   * @param {string|Date} date - Date to validate
   * @param {string} fieldName - Name of the field for error messages
   * @param {Object} options - Validation options
   * @param {Date} options.minDate - Minimum allowed date
   * @param {Date} options.maxDate - Maximum allowed date
   * @returns {Date} - Validated date object
   * @throws {AppError} - If date is invalid
   */
  static validateDate(date, fieldName = 'Date', options = {}) {
    if (!date) {
      throw new AppError(`${fieldName} is required`, 400);
    }

    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      throw new AppError(`Invalid ${fieldName} format`, 400);
    }

    if (options.minDate && dateObj < options.minDate) {
      throw new AppError(`${fieldName} cannot be before ${options.minDate.toISOString()}`, 400);
    }

    if (options.maxDate && dateObj > options.maxDate) {
      throw new AppError(`${fieldName} cannot be after ${options.maxDate.toISOString()}`, 400);
    }

    return dateObj;
  }

  /**
   * Validate numeric range
   * @param {number} value - Value to validate
   * @param {string} fieldName - Name of the field for error messages
   * @param {Object} options - Validation options
   * @param {number} options.min - Minimum allowed value
   * @param {number} options.max - Maximum allowed value
   * @throws {AppError} - If value is out of range
   */
  static validateNumericRange(value, fieldName = 'Value', options = {}) {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new AppError(`${fieldName} must be a valid number`, 400);
    }

    if (options.min !== undefined && value < options.min) {
      throw new AppError(`${fieldName} must be at least ${options.min}`, 400);
    }

    if (options.max !== undefined && value > options.max) {
      throw new AppError(`${fieldName} must be at most ${options.max}`, 400);
    }
  }

  /**
   * Sanitize and validate string input
   * @param {string} value - String to validate
   * @param {string} fieldName - Name of the field for error messages
   * @param {Object} options - Validation options
   * @param {number} options.minLength - Minimum string length
   * @param {number} options.maxLength - Maximum string length
   * @param {boolean} options.trim - Whether to trim whitespace
   * @returns {string} - Sanitized string
   * @throws {AppError} - If string is invalid
   */
  static validateString(value, fieldName = 'Value', options = {}) {
    if (typeof value !== 'string') {
      throw new AppError(`${fieldName} must be a string`, 400);
    }

    const sanitized = options.trim !== false ? value.trim() : value;

    if (options.minLength && sanitized.length < options.minLength) {
      throw new AppError(`${fieldName} must be at least ${options.minLength} characters long`, 400);
    }

    if (options.maxLength && sanitized.length > options.maxLength) {
      throw new AppError(`${fieldName} must be at most ${options.maxLength} characters long`, 400);
    }

    return sanitized;
  }
}

module.exports = ValidationUtils;
