const nodemailer = require('nodemailer');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.resend.com',
  port: parseInt(process.env.SMTP_PORT || '465', 10),
  secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
  auth: {
    user: process.env.SMTP_USER || 'resend',
    pass: process.env.SMTP_PASS,
  },
});

// Render a Handlebars HTML template with data
function renderTemplate(templateName, data = {}) {
  const templatePath = path.join(__dirname, '../templates', `${templateName}.html`);
  const source = fs.readFileSync(templatePath, 'utf8');
  return handlebars.compile(source)(data);
}

/**
 * Send a templated email via Resend SMTP.
 *
 * @param {Object} opts
 * @param {string} opts.to        - Recipient address  (also accepts opts.email for backward compat)
 * @param {string} opts.subject   - Email subject line
 * @param {string} opts.template  - Template filename without .html  (e.g. 'welcome')
 * @param {Object} [opts.data]    - Data injected into the Handlebars template
 *
 * Throws on failure so callers can wrap in try/catch and decide criticality.
 */
exports.sendEmail = async ({ to, email, subject, template, data = {} }) => {
  const recipient = to || email;
  if (!recipient) throw new Error('sendEmail: recipient (to/email) is required');
  if (!template) throw new Error('sendEmail: template name is required');

  const html = renderTemplate(template, data);

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'onboarding@resend.dev',
    to: recipient,
    subject,
    html,
  });

  logger.info(`Email sent — subject: "${subject}" to: ${recipient}`);
};

exports.renderTemplate = renderTemplate;
