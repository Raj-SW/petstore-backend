const jwt = require('jsonwebtoken');

const PURPOSE = 'unsubscribe-sales';

// Long-lived, single-purpose token embedded in sale emails.
exports.makeUnsubscribeToken = (userId) =>
  jwt.sign({ id: userId.toString(), purpose: PURPOSE }, process.env.JWT_SECRET, {
    expiresIn: '180d',
  });

// Returns the userId string, or null if the token is invalid/expired/wrong-purpose.
exports.verifyUnsubscribeToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose !== PURPOSE) return null;
    return decoded.id;
  } catch {
    return null;
  }
};
