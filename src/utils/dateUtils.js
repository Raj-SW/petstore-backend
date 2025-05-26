const { AppError } = require('../middlewares/errorHandler');

const getStartDate = (period) => {
  const startDate = new Date();

  switch (period) {
    case 'weekly':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'monthly':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'yearly':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    default:
      throw new AppError('Invalid period specified', 400);
  }

  return startDate;
};

const getDateFormat = (period) => {
  return period === 'yearly' ? '%Y-%m' : '%Y-%m-%d';
};

module.exports = {
  getStartDate,
  getDateFormat,
};
