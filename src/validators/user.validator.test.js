const { validateUpdateProfile, validateChangePassword } = require('./user.validator');
const { AppError } = require('../middlewares/errorHandler');

const run = (validator, body) => {
  let captured = null;
  validator({ body }, {}, (err) => { captured = err || null; });
  return captured;
};

describe('validateUpdateProfile', () => {
  it('passes a partial valid update', () => {
    expect(run(validateUpdateProfile, { name: 'Jane' })).toBeNull();
  });

  it('accepts emailPreferences booleans', () => {
    expect(run(validateUpdateProfile, { emailPreferences: { sales: false, news: true } })).toBeNull();
  });

  it('rejects a too-short name', () => {
    expect(run(validateUpdateProfile, { name: 'J' })).toBeInstanceOf(AppError);
  });

  it('rejects an invalid email', () => {
    expect(run(validateUpdateProfile, { email: 'bad' })).toBeInstanceOf(AppError);
  });

  it('rejects a non-8-digit phone with the custom message', () => {
    const err = run(validateUpdateProfile, { phoneNumber: '12' });
    expect(err.message).toBe('Phone number must be 8 digits');
  });
});

describe('validateChangePassword', () => {
  it('passes a strong new password', () => {
    expect(run(validateChangePassword, {
      currentPassword: 'old', newPassword: 'StrongPass1!',
    })).toBeNull();
  });

  it('requires the current password', () => {
    expect(run(validateChangePassword, { newPassword: 'StrongPass1!' })).toBeInstanceOf(AppError);
  });

  it('rejects a weak new password', () => {
    const err = run(validateChangePassword, { currentPassword: 'old', newPassword: 'weakpass' });
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toMatch(/uppercase/);
  });
});
