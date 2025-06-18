const nodemailer = require('nodemailer');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Utility to render an HTML template with data
function renderTemplate(templateName, data) {
  const templatePath = path.join(__dirname, '../templates', `${templateName}.html`);
  const source = fs.readFileSync(templatePath, 'utf8');
  const compiled = handlebars.compile(source);
  return compiled(data);
}

/**
 * Send an email using a template and data
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.template - Template file name (without .html)
 * @param {Object} options.data - Data for template rendering
 */
exports.sendEmail = async ({ to, subject, template, data }) => {
  try {
    const html = renderTemplate(template, data);
    const mailOptions = {
      from: process.env.SMTP_USER,
      to,
      subject,
      html,
    };
    await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${to}`);
  } catch (error) {
    logger.error('Error sending email:', error);
    // Fallback: log the failed email details for retry or manual review
    logger.error('Failed email details:', { to, subject, template, data });
    // Optionally, push to a retry queue here
  }
};

exports.renderTemplate = renderTemplate;
