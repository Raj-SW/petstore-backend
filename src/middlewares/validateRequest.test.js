const Joi = require('joi');
const { validateRequest } = require('./validateRequest');
const { AppError } = require('./errorHandler');

const schema = Joi.object({
  name: Joi.string().required(),
  age: Joi.number().min(0),
});

const makeNext = () => jest.fn();

describe('validateRequest', () => {
  it('calls next() with no argument when the body is valid', () => {
    const req = { body: { name: 'Rex', age: 3 } };
    const next = makeNext();
    validateRequest(schema)(req, {}, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('forwards a 400 AppError when validation fails', () => {
    const req = { body: { age: -1 } };
    const next = makeNext();
    validateRequest(schema)(req, {}, next);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
  });

  it('aggregates every validation error into one message', () => {
    const req = { body: { age: -1 } }; // missing name + negative age
    const next = makeNext();
    validateRequest(schema)(req, {}, next);
    const { message } = next.mock.calls[0][0];
    expect(message).toContain('name');
    expect(message).toContain('age');
    expect(message).toContain(','); // joined with ", "
  });

  it('validates the requested property (e.g. query) instead of body', () => {
    const req = { query: { name: 'q' }, body: {} };
    const next = makeNext();
    validateRequest(schema, 'query')(req, {}, next);
    expect(next).toHaveBeenCalledWith();
  });
});
