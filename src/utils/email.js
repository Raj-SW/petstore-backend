const nodemailer = require('nodemailer');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const { formatMUR } = require('./currency');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.resend.com',
  port: parseInt(process.env.SMTP_PORT || '465', 10),
  secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
  auth: {
    user: process.env.SMTP_USER || 'resend',
    pass: process.env.SMTP_PASS,
  },
});

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@vitalpaws.com';
const LAYOUT_NAME = '_layout';

// Shared Handlebars helpers used across email fragments.
handlebars.registerHelper('eq', (a, b) => a === b);
handlebars.registerHelper('mur', (value) => formatMUR(Number(value) || 0));
handlebars.registerHelper('date', (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value)
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
});

function compileTemplate(templateName, data) {
  const templatePath = path.join(__dirname, '../templates', `${templateName}.html`);
  const source = fs.readFileSync(templatePath, 'utf8');
  return handlebars.compile(source)(data);
}

// Render a content fragment and wrap it in the branded `_layout.html` shell.
function renderTemplate(templateName, data = {}) {
  if (templateName === LAYOUT_NAME) return compileTemplate(LAYOUT_NAME, data);
  const body = compileTemplate(templateName, data);
  return compileTemplate(LAYOUT_NAME, {
    ...data,
    body,
    year: new Date().getFullYear(),
    supportEmail: SUPPORT_EMAIL,
  });
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
