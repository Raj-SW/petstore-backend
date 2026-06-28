const {
  validateAppointment,
  validateAppointmentStatus,
  validateCancellation,
} = require('./appointment.validator');
const { AppError } = require('../middlewares/errorHandler');

const run = (validator, body) => {
  let captured = null;
  validator({ body }, {}, (err) => { captured = err || null; });
  return captured;
};

const validAppointment = {
  appointmentType: 'veterinarian',
  professionalName: 'Dr Vet',
  professionalId: 'pro1',
  dateTime: '2026-07-01T10:00:00Z',
  petName: 'Rex',
  petId: 'pet1',
  description: 'Annual checkup for the dog.',
  address: '123 Main St',
};

describe('validateAppointment (returns Joi result, abortEarly:false)', () => {
  it('returns no error for a complete appointment', () => {
    expect(validateAppointment(validAppointment).error).toBeUndefined();
  });

  it('reports an invalid appointment type', () => {
    const { error } = validateAppointment({ ...validAppointment, appointmentType: 'wizard' });
    expect(error).toBeDefined();
  });

  it('collects multiple errors at once', () => {
    const { error } = validateAppointment({});
    expect(error.details.length).toBeGreaterThan(1);
  });

  it('rejects a too-short description', () => {
    const { error } = validateAppointment({ ...validAppointment, description: 'short' });
    expect(error).toBeDefined();
  });
});

describe('validateAppointmentStatus', () => {
  it('accepts a valid status', () => {
    expect(run(validateAppointmentStatus, { status: 'accepted' })).toBeNull();
  });
  it('rejects an unknown status', () => {
    expect(run(validateAppointmentStatus, { status: 'maybe' })).toBeInstanceOf(AppError);
  });
});

describe('validateCancellation', () => {
  it('accepts a reason of 10+ chars', () => {
    expect(run(validateCancellation, { cancellationReason: 'Cannot make it today.' })).toBeNull();
  });
  it('rejects a too-short reason', () => {
    expect(run(validateCancellation, { cancellationReason: 'no' })).toBeInstanceOf(AppError);
  });
});
