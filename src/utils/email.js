const nodemailer = require('nodemailer');
const logger = require('./logger');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

exports.sendEmail = async ({ email, subject, message }) => {
  try {
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject,
      text: message,
      html: message,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${email}`);
  } catch (error) {
    logger.error('Error sending email:', error);
    throw new Error('Error sending email');
  }
}; 