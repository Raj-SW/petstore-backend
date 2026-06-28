const mongoose = require('mongoose');
const ValidationUtils = require('./validation');
const { AppError } = require('../middlewares/errorHandler');

const OID = new mongoose.Types.ObjectId().toString();

describe('ValidationUtils.validateObjectId', () => {
  it('accepts a valid ObjectId string', () => {
    expect(() => ValidationUtils.validateObjectId(OID)).not.toThrow();
  });

  it('throws when missing', () => {
    expect(() => ValidationUtils.validateObjectId('')).toThrow(AppError);
    expect(() => ValidationUtils.validateObjectId(undefined, 'User ID')).toThrow('User ID is required');
  });

  it('throws when not a string', () => {
    expect(() => ValidationUtils.validateObjectId(123)).toThrow('must be a string');
  });

  it('throws when malformed', () => {
    expect(() => ValidationUtils.validateObjectId('not-an-id')).toThrow('Invalid ID format');
  });
});

describe('ValidationUtils.validateObjectIds', () => {
  it('validates every id and uses the mapped field name on failure', () => {
    expect(() => ValidationUtils.validateObjectIds(
      { productId: 'bad' },
      { productId: 'Product ID' },
    )).toThrow('Invalid Product ID format');
  });

  it('passes when all ids are valid', () => {
    expect(() => ValidationUtils.validateObjectIds({ a: OID, b: OID })).not.toThrow();
  });
});

describe('ValidationUtils.toObjectId', () => {
  it('returns a real ObjectId for valid input', () => {
    const result = ValidationUtils.toObjectId(OID);
    expect(result).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(result.toString()).toBe(OID);
  });

  it('throws for invalid input', () => {
    expect(() => ValidationUtils.toObjectId('nope')).toThrow(AppError);
  });
});

describe('ValidationUtils.isValidObjectId', () => {
  it('returns true/false without throwing', () => {
    expect(ValidationUtils.isValidObjectId(OID)).toBe(true);
    expect(ValidationUtils.isValidObjectId('nope')).toBe(false);
    expect(ValidationUtils.isValidObjectId(123)).toBe(false);
    expect(ValidationUtils.isValidObjectId(undefined)).toBeFalsy();
  });
});

describe('ValidationUtils.validatePagination', () => {
  it('applies defaults when no params given', () => {
    expect(ValidationUtils.validatePagination()).toEqual({ page: 1, limit: 10, skip: 0 });
  });

  it('computes skip from page and limit', () => {
    expect(ValidationUtils.validatePagination({ page: 3, limit: 20 }))
      .toEqual({ page: 3, limit: 20, skip: 40 });
  });

  it('clamps page to >= 1 and limit to the max', () => {
    expect(ValidationUtils.validatePagination({ page: -5, limit: 9999 }, 100))
      .toEqual({ page: 1, limit: 100, skip: 0 });
  });

  it('falls back to defaults for non-numeric input', () => {
    expect(ValidationUtils.validatePagination({ page: 'x', limit: 'y' }))
      .toEqual({ page: 1, limit: 10, skip: 0 });
  });
});

describe('ValidationUtils.validateSort', () => {
  it('defaults to desc / -1 direction', () => {
    expect(ValidationUtils.validateSort()).toEqual({
      sortBy: undefined, sortOrder: 'desc', sortDirection: -1,
    });
  });

  it('keeps an allowed sortBy and maps asc to 1', () => {
    expect(ValidationUtils.validateSort({ sortBy: 'price', sortOrder: 'asc' }, ['price', 'name']))
      .toEqual({ sortBy: 'price', sortOrder: 'asc', sortDirection: 1 });
  });

  it('falls back to the first allowed field for a disallowed sortBy', () => {
    expect(ValidationUtils.validateSort({ sortBy: 'evil' }, ['name', 'price']).sortBy).toBe('name');
  });

  it('coerces an invalid sortOrder to desc', () => {
    expect(ValidationUtils.validateSort({ sortBy: 'name', sortOrder: 'sideways' }, ['name']).sortOrder)
      .toBe('desc');
  });
});

describe('ValidationUtils.validateEmail', () => {
  it('accepts a well-formed email', () => {
    expect(() => ValidationUtils.validateEmail('a@b.com')).not.toThrow();
  });
  it('throws on missing and malformed emails', () => {
    expect(() => ValidationUtils.validateEmail('')).toThrow('required');
    expect(() => ValidationUtils.validateEmail('nope')).toThrow('Invalid Email format');
  });
});

describe('ValidationUtils.validatePhoneNumber', () => {
  it('accepts common formats', () => {
    expect(() => ValidationUtils.validatePhoneNumber('+1 (555) 123-4567')).not.toThrow();
  });
  it('rejects too-short / missing', () => {
    expect(() => ValidationUtils.validatePhoneNumber('')).toThrow('required');
    expect(() => ValidationUtils.validatePhoneNumber('123')).toThrow('Invalid');
  });
});

describe('ValidationUtils.validateRequiredFields', () => {
  it('passes when all present', () => {
    expect(() => ValidationUtils.validateRequiredFields({ a: 1, b: 'x' }, ['a', 'b'])).not.toThrow();
  });
  it('lists every missing field (undefined/null/empty)', () => {
    expect(() => ValidationUtils.validateRequiredFields({ a: '', b: null, c: 1 }, ['a', 'b', 'd']))
      .toThrow('Missing required fields: a, b, d');
  });
});

describe('ValidationUtils.validateEnum', () => {
  it('passes for allowed or empty values', () => {
    expect(() => ValidationUtils.validateEnum('x', ['x', 'y'])).not.toThrow();
    expect(() => ValidationUtils.validateEnum(undefined, ['x'])).not.toThrow();
  });
  it('throws for a disallowed value', () => {
    expect(() => ValidationUtils.validateEnum('z', ['x', 'y'], 'Status'))
      .toThrow('Invalid Status. Allowed values: x, y');
  });
});

describe('ValidationUtils.validateDate', () => {
  it('returns a Date for valid input', () => {
    expect(ValidationUtils.validateDate('2026-01-01')).toBeInstanceOf(Date);
  });
  it('throws on missing/invalid', () => {
    expect(() => ValidationUtils.validateDate('')).toThrow('required');
    expect(() => ValidationUtils.validateDate('not-a-date')).toThrow('Invalid');
  });
  it('enforces min/max bounds', () => {
    expect(() => ValidationUtils.validateDate('2020-01-01', 'Date', { minDate: new Date('2025-01-01') }))
      .toThrow('cannot be before');
    expect(() => ValidationUtils.validateDate('2030-01-01', 'Date', { maxDate: new Date('2025-01-01') }))
      .toThrow('cannot be after');
  });
});

describe('ValidationUtils.validateNumericRange', () => {
  it('passes within range', () => {
    expect(() => ValidationUtils.validateNumericRange(5, 'Qty', { min: 1, max: 10 })).not.toThrow();
  });
  it('rejects non-numbers and out-of-range values', () => {
    expect(() => ValidationUtils.validateNumericRange(NaN)).toThrow('valid number');
    expect(() => ValidationUtils.validateNumericRange(0, 'Qty', { min: 1 })).toThrow('at least 1');
    expect(() => ValidationUtils.validateNumericRange(99, 'Qty', { max: 10 })).toThrow('at most 10');
  });
});

describe('ValidationUtils.validateString', () => {
  it('trims by default and returns the sanitized value', () => {
    expect(ValidationUtils.validateString('  hi  ')).toBe('hi');
  });
  it('respects trim:false', () => {
    expect(ValidationUtils.validateString('  hi  ', 'V', { trim: false })).toBe('  hi  ');
  });
  it('throws for non-strings and length violations', () => {
    expect(() => ValidationUtils.validateString(5)).toThrow('must be a string');
    expect(() => ValidationUtils.validateString('a', 'V', { minLength: 2 })).toThrow('at least 2');
    expect(() => ValidationUtils.validateString('abcdef', 'V', { maxLength: 3 })).toThrow('at most 3');
  });
});
