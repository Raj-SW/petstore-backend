const { AppError } = require('./errorHandler');

/**
 * Guards cron-only endpoints. Vercel Cron (and our manual triggers) must send
 * `Authorization: Bearer <CRON_SECRET>`. Rejects everything else with 401.
 */
const verifyCronSecret = (req, res, next) => {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!secret || !token || token !== secret) {
    return next(new AppError('Unauthorized', 401));
  }
  next();
};

module.exports = { verifyCronSecret };
