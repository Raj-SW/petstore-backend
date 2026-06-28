const {
  updateProfessionalSchema,
  querySchema,
  availabilitySchema,
  ratingSchema,
} = require('./professionalValidator');

// These are raw Joi schemas consumed by the validateRequest middleware.
describe('updateProfessionalSchema', () => {
  it('accepts user + nested professionalInfo fields', () => {
    const { error } = updateProfessionalSchema.validate({
      name: 'Dr Vet',
      phoneNumber: '+1 555-123-4567',
      professionalInfo: { specialization: 'Surgery', experience: 10, rating: 4.5 },
    });
    expect(error).toBeUndefined();
  });

  it('rejects experience above 50', () => {
    const { error } = updateProfessionalSchema.validate({
      professionalInfo: { experience: 99 },
    });
    expect(error).toBeDefined();
  });

  it('rejects a malformed phone number', () => {
    const { error } = updateProfessionalSchema.validate({ phoneNumber: '12' });
    expect(error).toBeDefined();
  });
});

describe('querySchema', () => {
  it('applies defaults for page/limit/sort', () => {
    const { value, error } = querySchema.validate({});
    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      page: 1, limit: 10, sortBy: 'professionalInfo.rating', sortOrder: 'desc',
    });
  });

  it('rejects an unknown role', () => {
    expect(querySchema.validate({ role: 'astronaut' }).error).toBeDefined();
  });

  it('rejects limit above 100', () => {
    expect(querySchema.validate({ limit: 500 }).error).toBeDefined();
  });

  it('rejects a disallowed sortBy', () => {
    expect(querySchema.validate({ sortBy: 'secret' }).error).toBeDefined();
  });
});

describe('availabilitySchema', () => {
  it('accepts valid HH:MM day entries', () => {
    const { error } = availabilitySchema.validate({
      availability: { monday: { startTime: '09:00', endTime: '17:00' } },
    });
    expect(error).toBeUndefined();
  });

  it('rejects a malformed time', () => {
    const { error } = availabilitySchema.validate({
      availability: { monday: { startTime: '9am', endTime: '17:00' } },
    });
    expect(error).toBeDefined();
  });

  it('requires the availability object', () => {
    expect(availabilitySchema.validate({}).error).toBeDefined();
  });
});

describe('ratingSchema', () => {
  it('accepts 1–5', () => {
    expect(ratingSchema.validate({ rating: 4 }).error).toBeUndefined();
  });
  it('rejects out-of-range and missing ratings', () => {
    expect(ratingSchema.validate({ rating: 6 }).error).toBeDefined();
    expect(ratingSchema.validate({}).error).toBeDefined();
  });
});
