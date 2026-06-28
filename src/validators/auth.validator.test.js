const {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
} = require('./auth.validator');
const { AppError } = require('../middlewares/errorHandler');

// Invoke a validator middleware and return the error handed to next(), or null.
const run = (validator, body) => {
  let captured = null;
  validator({ body }, {}, (err) => { captured = err || null; });
  return captured;
};

const validSignup = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  phoneNumber: '59001234',
  address: '123 Main St',
  password: 'StrongPass1*',
};

describe('validateRegister', () => {
  it('passes a fully valid signup', () => {
    expect(run(validateRegister, validSignup)).toBeNull();
  });

  it('rejects an invalid email', () => {
    const err = run(validateRegister, { ...validSignup, email: 'not-an-email' });
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
  });

  it('rejects a phone number that is not 8 digits', () => {
    expect(run(validateRegister, { ...validSignup, phoneNumber: '123' })).toBeInstanceOf(AppError);
  });

  it('rejects a weak password with the custom message', () => {
    const err = run(validateRegister, { ...validSignup, password: 'weak' });
    expect(err.message).toMatch(/at least 8 characters/);
  });

  it('rejects a disallowed role', () => {
    expect(run(validateRegister, { ...validSignup, role: 'superuser' })).toBeInstanceOf(AppError);
  });

  it('requires the name field', () => {
    const { name, ...noName } = validSignup;
    expect(run(validateRegister, noName)).toBeInstanceOf(AppError);
  });
});

describe('validateLogin', () => {
  it('passes valid credentials', () => {
    expect(run(validateLogin, { email: 'a@b.com', password: 'StrongPass1*' })).toBeNull();
  });
  it('rejects a missing password', () => {
    expect(run(validateLogin, { email: 'a@b.com' })).toBeInstanceOf(AppError);
  });
});

describe('validateForgotPassword', () => {
  it('passes a valid email', () => {
    expect(run(validateForgotPassword, { email: 'a@b.com' })).toBeNull();
  });
  it('rejects a malformed email', () => {
    expect(run(validateForgotPassword, { email: 'bad' })).toBeInstanceOf(AppError);
  });
});

describe('validateResetPassword', () => {
  it('passes token + 8-char password', () => {
    expect(run(validateResetPassword, { token: 'abc', password: 'longenough' })).toBeNull();
  });
  it('rejects a short password', () => {
    expect(run(validateResetPassword, { token: 'abc', password: 'short' })).toBeInstanceOf(AppError);
  });
  it('requires the token', () => {
    expect(run(validateResetPassword, { password: 'longenough' })).toBeInstanceOf(AppError);
  });
});
