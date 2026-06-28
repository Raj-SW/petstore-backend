const {
  AppError,
  createError,
  errorHandler,
  notFoundHandler,
} = require('./errorHandler');

// logger.error writes to stderr/files; silence it so test output stays clean.
jest.mock('../utils/logger', () => ({ error: jest.fn() }));

const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe('AppError', () => {
  it('sets status "fail" for 4xx codes and marks the error operational', () => {
    const err = new AppError('bad input', 400);
    expect(err.message).toBe('bad input');
    expect(err.statusCode).toBe(400);
    expect(err.status).toBe('fail');
    expect(err.isOperational).toBe(true);
    expect(err).toBeInstanceOf(Error);
  });

  it('sets status "error" for 5xx codes', () => {
    expect(new AppError('boom', 500).status).toBe('error');
  });

  it('captures a stack trace', () => {
    expect(typeof new AppError('x', 400).stack).toBe('string');
  });
});

describe('createError', () => {
  it('builds an AppError with (statusCode, message) argument order', () => {
    const err = createError(404, 'not found');
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('not found');
    expect(err.status).toBe('fail');
  });
});

describe('errorHandler', () => {
  const ORIGINAL_ENV = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = ORIGINAL_ENV; });

  it('defaults missing statusCode/status to 500/error', () => {
    process.env.NODE_ENV = 'production';
    const res = makeRes();
    errorHandler({ isOperational: false }, {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('in development exposes the stack and full error', () => {
    process.env.NODE_ENV = 'development';
    const res = makeRes();
    const err = new AppError('dev detail', 422);
    errorHandler(err, {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(422);
    const payload = res.json.mock.calls[0][0];
    expect(payload).toMatchObject({ status: 'fail', message: 'dev detail' });
    expect(payload.stack).toBeDefined();
  });

  it('in production returns clean message for operational errors', () => {
    process.env.NODE_ENV = 'production';
    const res = makeRes();
    errorHandler(new AppError('rate limited', 429), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(429);
    const payload = res.json.mock.calls[0][0];
    expect(payload).toEqual({ status: 'fail', message: 'rate limited' });
    expect(payload.stack).toBeUndefined();
  });

  it('in production hides details for non-operational errors', () => {
    process.env.NODE_ENV = 'production';
    const res = makeRes();
    errorHandler(new Error('secret db string'), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0]).toEqual({
      status: 'error',
      message: 'Something went wrong!',
    });
  });
});

describe('notFoundHandler', () => {
  it('forwards a 404 AppError naming the original url', () => {
    const next = jest.fn();
    notFoundHandler({ originalUrl: '/api/ghost' }, {}, next);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain('/api/ghost');
  });
});
