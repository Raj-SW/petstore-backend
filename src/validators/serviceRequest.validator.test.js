const {
  validateAppointmentRequest,
  validateMobileVetRequest,
  validateRequestUpdate,
  validateRequestNote,
} = require('./serviceRequest.validator');
const { AppError } = require('../middlewares/errorHandler');

const runWith = (validator) => (body) => {
  const req = { body: { ...body } };
  let err = null;
  validator(req, {}, (e) => { err = e || null; });
  return { err, body: req.body };
};

const runAppointment = runWith(validateAppointmentRequest);
const runMobileVet = runWith(validateMobileVetRequest);
const runUpdate = runWith(validateRequestUpdate);
const runNote = runWith(validateRequestNote);

const validAppointment = {
  ownerName: 'Sarah Mitchell',
  phone: '+230 5 123 4567',
  petName: 'Max',
  petType: 'Dog',
  reason: 'Vaccination',
};

const validMobileVet = {
  ...validAppointment,
  reason: 'Sick Pet',
};

describe('validateAppointmentRequest', () => {
  it('passes a valid request and strips unknown fields', () => {
    const { err, body } = runAppointment({ ...validAppointment, status: 'completed' });
    expect(err).toBeNull();
    expect(body.status).toBeUndefined();
  });

  it('accepts Mauritian phone formatting', () => {
    expect(runAppointment({ ...validAppointment, phone: '(230) 5758-0480' }).err).toBeNull();
  });

  it('rejects a phone number containing letters', () => {
    expect(runAppointment({ ...validAppointment, phone: 'call me' }).err).toBeInstanceOf(AppError);
  });

  it('rejects a reason outside the dropdown', () => {
    expect(runAppointment({ ...validAppointment, reason: 'Haircut' }).err).toBeInstanceOf(AppError);
  });

  it('rejects a mobile-vet-only reason', () => {
    expect(runAppointment({ ...validAppointment, reason: 'Home Visit' }).err)
      .toBeInstanceOf(AppError);
  });

  it('requires owner name, phone, pet name, pet type and reason', () => {
    expect(runAppointment({}).err).toBeInstanceOf(AppError);
  });

  it('allows blank preferred day and time', () => {
    expect(runAppointment({ ...validAppointment, preferredDay: '', preferredTime: '' }).err)
      .toBeNull();
  });
});

describe('validateMobileVetRequest', () => {
  it('passes a valid request with no optional fields', () => {
    expect(runMobileVet(validMobileVet).err).toBeNull();
  });

  it('coerces multipart string values', () => {
    const { err, body } = runMobileVet({
      ...validMobileVet, lat: '-20.16', lng: '57.5', isEmergency: 'true',
    });
    expect(err).toBeNull();
    expect(body.lat).toBe(-20.16);
    expect(body.isEmergency).toBe(true);
  });

  it('defaults isEmergency to false', () => {
    expect(runMobileVet(validMobileVet).body.isEmergency).toBe(false);
  });

  it('rejects a lone coordinate', () => {
    expect(runMobileVet({ ...validMobileVet, lat: -20.16 }).err).toBeInstanceOf(AppError);
    expect(runMobileVet({ ...validMobileVet, lng: 57.5 }).err).toBeInstanceOf(AppError);
  });

  it('rejects out-of-range coordinates', () => {
    expect(runMobileVet({ ...validMobileVet, lat: 120, lng: 57.5 }).err).toBeInstanceOf(AppError);
  });

  it('rejects an appointment-only reason', () => {
    expect(runMobileVet({ ...validMobileVet, reason: 'Skin Problem' }).err)
      .toBeInstanceOf(AppError);
  });
});

describe('validateRequestUpdate', () => {
  it('accepts a status-only update', () => {
    expect(runUpdate({ status: 'contacted' }).err).toBeNull();
  });

  it('rejects an unknown status', () => {
    expect(runUpdate({ status: 'archived' }).err).toBeInstanceOf(AppError);
  });

  it('rejects an empty update', () => {
    expect(runUpdate({}).err).toBeInstanceOf(AppError);
  });

  it('strips fields an admin may not set directly', () => {
    const { err, body } = runUpdate({ status: 'confirmed', notes: [{ text: 'sneaky' }] });
    expect(err).toBeNull();
    expect(body.notes).toBeUndefined();
  });
});

describe('validateRequestNote', () => {
  it('accepts a note', () => {
    expect(runNote({ text: 'Called owner, visit confirmed for 5pm.' }).err).toBeNull();
  });

  it('rejects a blank note', () => {
    expect(runNote({ text: '   ' }).err).toBeInstanceOf(AppError);
  });
});
