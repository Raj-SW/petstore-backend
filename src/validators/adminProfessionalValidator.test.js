const {
  createProfessionalSchema,
  promoteSchema,
  updateProfessionalInfoSchema,
  listQuerySchema,
} = require('./adminProfessionalValidator');

const validProfessionalInfo = {
  specialization: 'Feline surgery',
  experience: 6,
  qualifications: ['BVSc'],
  bio: 'Cats only.',
  services: [{ name: 'Checkup', price: 500, duration: 30, description: 'Routine' }],
  availability: { monday: { startTime: '09:00', endTime: '17:00', isAvailable: true } },
};

describe('createProfessionalSchema', () => {
  const base = {
    name: 'Dr Lee',
    email: 'lee@example.com',
    phoneNumber: '12345678',
    address: '1 Vet Lane',
    role: 'veterinarian',
    professionalInfo: validProfessionalInfo,
  };

  it('accepts a valid create payload', () => {
    const { error } = createProfessionalSchema.validate(base);
    expect(error).toBeUndefined();
  });

  it('rejects a non-professional role', () => {
    const { error } = createProfessionalSchema.validate({ ...base, role: 'customer' });
    expect(error).toBeDefined();
  });

  it('requires specialization and experience', () => {
    const { error } = createProfessionalSchema.validate({
      ...base,
      professionalInfo: { bio: 'x' },
    });
    expect(error).toBeDefined();
  });

  it('rejects a malformed availability time', () => {
    const { error } = createProfessionalSchema.validate({
      ...base,
      professionalInfo: {
        ...validProfessionalInfo,
        availability: { monday: { startTime: '9am', endTime: '17:00', isAvailable: true } },
      },
    });
    expect(error).toBeDefined();
  });
});

describe('promoteSchema', () => {
  it('requires a userId and professional role', () => {
    const ok = promoteSchema.validate({
      userId: '507f1f77bcf86cd799439011',
      role: 'groomer',
      professionalInfo: validProfessionalInfo,
    });
    expect(ok.error).toBeUndefined();
    const bad = promoteSchema.validate({ role: 'groomer', professionalInfo: validProfessionalInfo });
    expect(bad.error).toBeDefined();
  });
});

describe('updateProfessionalInfoSchema', () => {
  it('accepts a partial professionalInfo update', () => {
    const { error } = updateProfessionalInfoSchema.validate({ professionalInfo: { bio: 'New bio' } });
    expect(error).toBeUndefined();
  });
});

describe('listQuerySchema', () => {
  it('defaults page/limit and rejects an unknown status', () => {
    const { value } = listQuerySchema.validate({});
    expect(value.page).toBe(1);
    expect(value.limit).toBe(20);
    const { error } = listQuerySchema.validate({ status: 'archived' });
    expect(error).toBeDefined();
  });
});
