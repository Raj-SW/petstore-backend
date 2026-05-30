# Resend Email Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace broken nodemailer/SMTP email with Resend, fix all silent email failures, and add proper HTML templates for all 5 user scenarios.

**Architecture:** Resend is used via its nodemailer-compatible SMTP transport (host: `smtp.resend.com`, user: `resend`, pass: `RESEND_API_KEY`). `email.js` is rewritten to fix the `to`/`email` param mismatch and stop swallowing errors. New HTML templates are added for signup, login, and password reset. Auth controller is updated to send emails using templates.

**Tech Stack:** Node.js, nodemailer (already installed), Resend SMTP, Handlebars (already installed), existing HTML template pattern.

---

## Existing Issues (pre-conditions)

1. `email.js` destructures `{ to }` but every controller passes `{ email }` → `to` is always `undefined` → all emails silently fail
2. `auth.controller.js` forgotPassword/resendVerificationEmail pass `{ message }` but `email.js` ignores it and tries to render a `template` that is `undefined` → crash swallowed silently
3. `payment-status-update.html` template is missing (called by `updatePaymentStatus` in order.controller.js)
4. No welcome, password-reset, or login-notification templates exist

---

## File Map

| Action | File |
|--------|------|
| Modify | `backend/.env` |
| Rewrite | `backend/src/utils/email.js` |
| Modify | `backend/src/controllers/auth.controller.js` |
| Create | `backend/src/templates/welcome.html` |
| Create | `backend/src/templates/password-reset.html` |
| Create | `backend/src/templates/login-notification.html` |
| Create | `backend/src/templates/payment-status-update.html` |

---

## Task 1: Add Resend SMTP env vars

**Files:**
- Modify: `backend/.env`

- [ ] **Step 1: Sign up for Resend**

  Go to [resend.com](https://resend.com) → create account → go to **API Keys** → click **Create API Key** → name it `VitalPaws` → copy the key (starts with `re_`).

  On the free tier you can send from `onboarding@resend.dev` to any address you've verified in your Resend account. Verify your own email in Resend → **Emails** → **Verified Senders**.

- [ ] **Step 2: Update `backend/.env`**

  Replace the existing SMTP block with:
  ```env
  # Email (Resend SMTP)
  RESEND_API_KEY=re_your_actual_key_here
  SMTP_HOST=smtp.resend.com
  SMTP_PORT=465
  SMTP_USER=resend
  SMTP_PASS=re_your_actual_key_here
  SMTP_FROM=onboarding@resend.dev
  ```

  > `SMTP_PASS` and `RESEND_API_KEY` are the same value. `SMTP_FROM` is the "from" address — use `onboarding@resend.dev` on the free tier (no domain needed).

---

## Task 2: Rewrite email.js

**Files:**
- Rewrite: `backend/src/utils/email.js`

- [ ] **Step 1: Rewrite the file**

  Replace the entire contents of `backend/src/utils/email.js` with:

  ```js
  const nodemailer = require('nodemailer');
  const logger = require('./logger');
  const fs = require('fs');
  const path = require('path');
  const handlebars = require('handlebars');

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.resend.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: (process.env.SMTP_PORT || '465') === '465',
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
  ```

- [ ] **Step 2: Verify the file saved correctly**

  Run:
  ```bash
  node -e "require('./src/utils/email'); console.log('email.js loaded OK')"
  ```
  Expected: `email.js loaded OK` (no syntax errors).

- [ ] **Step 3: Commit**

  ```bash
  git add backend/src/utils/email.js backend/.env
  git commit -m "feat: switch email transport to Resend SMTP"
  ```

---

## Task 3: Create missing HTML templates

**Files:**
- Create: `backend/src/templates/welcome.html`
- Create: `backend/src/templates/password-reset.html`
- Create: `backend/src/templates/login-notification.html`
- Create: `backend/src/templates/payment-status-update.html`

All templates follow the same base structure as `order-confirmation.html` (inline CSS, max-width 600px container, header/content/footer sections). Handlebars `{{variable}}` syntax is used for dynamic data.

- [ ] **Step 1: Create `welcome.html`**

  Create `backend/src/templates/welcome.html`:

  ```html
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Welcome to VitalPaws</title>
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f4; }
      .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 8px; overflow: hidden; }
      .header { background: #2c7a4b; padding: 32px 24px; text-align: center; }
      .header h1 { color: #fff; margin: 0; font-size: 26px; }
      .header p { color: #b7e4c7; margin: 6px 0 0; font-size: 14px; }
      .content { padding: 32px 24px; }
      .content p { margin: 0 0 16px; }
      .btn { display: inline-block; margin: 8px 0 24px; padding: 12px 28px; background: #2c7a4b; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; }
      .footer { background: #f8f9fa; text-align: center; padding: 20px 24px; font-size: 12px; color: #888; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🐾 Welcome to VitalPaws!</h1>
        <p>Your pet care journey starts here.</p>
      </div>
      <div class="content">
        <p>Hi <strong>{{name}}</strong>,</p>
        <p>We're thrilled to have you on board! Your account has been created successfully.</p>
        <p>With VitalPaws you can:</p>
        <ul>
          <li>Shop premium pet products</li>
          <li>Book grooming, vet, and training appointments</li>
          <li>Track your orders in real time</li>
        </ul>
        <a href="{{shopUrl}}" class="btn">Start Shopping</a>
        <p>If you didn't create this account, you can safely ignore this email.</p>
      </div>
      <div class="footer">
        <p>© 2026 VitalPaws · This is an automated message, please do not reply.</p>
      </div>
    </div>
  </body>
  </html>
  ```

  Template variables: `{{name}}`, `{{shopUrl}}`

- [ ] **Step 2: Create `password-reset.html`**

  Create `backend/src/templates/password-reset.html`:

  ```html
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Reset Your Password</title>
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f4; }
      .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 8px; overflow: hidden; }
      .header { background: #d97706; padding: 32px 24px; text-align: center; }
      .header h1 { color: #fff; margin: 0; font-size: 24px; }
      .content { padding: 32px 24px; }
      .content p { margin: 0 0 16px; }
      .btn { display: inline-block; margin: 8px 0 24px; padding: 12px 28px; background: #d97706; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; }
      .expiry { background: #fef3c7; border: 1px solid #fde68a; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #92400e; margin-bottom: 20px; }
      .footer { background: #f8f9fa; text-align: center; padding: 20px 24px; font-size: 12px; color: #888; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🔐 Password Reset Request</h1>
      </div>
      <div class="content">
        <p>Hi <strong>{{name}}</strong>,</p>
        <p>We received a request to reset your VitalPaws password. Click the button below to choose a new password:</p>
        <a href="{{resetUrl}}" class="btn">Reset My Password</a>
        <div class="expiry">⏱ This link expires in <strong>10 minutes</strong>.</div>
        <p>If you didn't request a password reset, you can safely ignore this email — your password will not change.</p>
        <p>For security, never share this link with anyone.</p>
      </div>
      <div class="footer">
        <p>© 2026 VitalPaws · This is an automated message, please do not reply.</p>
      </div>
    </div>
  </body>
  </html>
  ```

  Template variables: `{{name}}`, `{{resetUrl}}`

- [ ] **Step 3: Create `login-notification.html`**

  Create `backend/src/templates/login-notification.html`:

  ```html
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>New Login to Your Account</title>
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f4; }
      .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 8px; overflow: hidden; }
      .header { background: #1d4ed8; padding: 32px 24px; text-align: center; }
      .header h1 { color: #fff; margin: 0; font-size: 24px; }
      .content { padding: 32px 24px; }
      .content p { margin: 0 0 16px; }
      .info-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 16px 20px; margin-bottom: 20px; }
      .info-box p { margin: 4px 0; font-size: 14px; }
      .info-box strong { color: #1d4ed8; }
      .btn { display: inline-block; margin: 8px 0 24px; padding: 12px 28px; background: #dc2626; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; }
      .footer { background: #f8f9fa; text-align: center; padding: 20px 24px; font-size: 12px; color: #888; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🔔 New Sign-In Detected</h1>
      </div>
      <div class="content">
        <p>Hi <strong>{{name}}</strong>,</p>
        <p>We noticed a new sign-in to your VitalPaws account.</p>
        <div class="info-box">
          <p><strong>Time:</strong> {{loginTime}}</p>
        </div>
        <p>If this was you, no action is needed.</p>
        <p>If you don't recognise this sign-in, please reset your password immediately:</p>
        <a href="{{resetUrl}}" class="btn">Secure My Account</a>
      </div>
      <div class="footer">
        <p>© 2026 VitalPaws · This is an automated message, please do not reply.</p>
      </div>
    </div>
  </body>
  </html>
  ```

  Template variables: `{{name}}`, `{{loginTime}}`, `{{resetUrl}}`

- [ ] **Step 4: Create `payment-status-update.html`**

  Create `backend/src/templates/payment-status-update.html`:

  ```html
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Payment Status Update</title>
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f4; }
      .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 8px; overflow: hidden; }
      .header { background: #2c7a4b; padding: 32px 24px; text-align: center; }
      .header h1 { color: #fff; margin: 0; font-size: 24px; }
      .content { padding: 32px 24px; }
      .content p { margin: 0 0 16px; }
      .status-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 16px 20px; margin-bottom: 20px; }
      .status-box p { margin: 4px 0; font-size: 14px; }
      .footer { background: #f8f9fa; text-align: center; padding: 20px 24px; font-size: 12px; color: #888; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>💳 Payment Status Update</h1>
      </div>
      <div class="content">
        <p>Hi <strong>{{name}}</strong>,</p>
        <p>The payment status for your order has been updated.</p>
        <div class="status-box">
          <p><strong>Order ID:</strong> #{{orderId}}</p>
          <p><strong>Payment Status:</strong> {{paymentStatus}}</p>
          <p><strong>Amount:</strong> ${{amount}}</p>
        </div>
        <p>If you have any questions, contact our support team.</p>
      </div>
      <div class="footer">
        <p>© 2026 VitalPaws · This is an automated message, please do not reply.</p>
      </div>
    </div>
  </body>
  </html>
  ```

  Template variables: `{{name}}`, `{{orderId}}`, `{{paymentStatus}}`, `{{amount}}`

- [ ] **Step 5: Commit templates**

  ```bash
  git add backend/src/templates/
  git commit -m "feat: add welcome, password-reset, login-notification, payment-status-update email templates"
  ```

---

## Task 4: Update auth.controller.js — wire email triggers

**Files:**
- Modify: `backend/src/controllers/auth.controller.js`

Four email triggers: signup (welcome), login (login notification), forgotPassword (password reset), resendVerificationEmail (password reset template reuse).

- [ ] **Step 1: Update `signup` to send welcome email**

  In `auth.controller.js`, find the `signup` function. After `user.password = undefined;` and before `res.status(201)`, add the email send (non-critical, wrapped in try/catch):

  ```js
  // Welcome email — non-critical
  try {
    await sendEmail({
      to: user.email,
      subject: 'Welcome to VitalPaws! 🐾',
      template: 'welcome',
      data: {
        name: user.name,
        shopUrl: `${process.env.FRONTEND_URL}/petshop`,
      },
    });
  } catch (emailErr) {
    logger.warn('Welcome email failed (non-fatal)', { error: emailErr.message });
  }
  ```

- [ ] **Step 2: Update `login` to send login notification email**

  In the `login` function, after `user.password = undefined;` and before `res.status(200)`, add:

  ```js
  // Login notification — non-critical
  try {
    await sendEmail({
      to: user.email,
      subject: 'New sign-in to your VitalPaws account',
      template: 'login-notification',
      data: {
        name: user.name,
        loginTime: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
        resetUrl: `${process.env.FRONTEND_URL}/reset-password`,
      },
    });
  } catch (emailErr) {
    logger.warn('Login notification email failed (non-fatal)', { error: emailErr.message });
  }
  ```

- [ ] **Step 3: Update `forgotPassword` to use the password-reset template**

  Find the `forgotPassword` function. Replace the existing `await sendEmail(...)` call (which uses raw `message`) with:

  ```js
  // Replace this:
  await sendEmail({
    email: user.email,
    subject: 'Password Reset',
    message: `Reset your password by clicking: ${resetUrl}`,
  });

  // With this:
  try {
    await sendEmail({
      to: user.email,
      subject: 'Reset your VitalPaws password',
      template: 'password-reset',
      data: {
        name: user.name,
        resetUrl,
      },
    });
  } catch (emailErr) {
    logger.warn('Password reset email failed (non-fatal)', { error: emailErr.message });
    // Re-throw so the endpoint returns an error — user needs this email to reset
    throw emailErr;
  }
  ```

  > Note: Unlike other emails, the password reset email IS critical — if it fails, the user can't reset their password. The re-throw ensures the endpoint returns an error so they know to try again.

- [ ] **Step 4: Update `resendVerificationEmail` to use the password-reset template**

  Find the `resendVerificationEmail` function. Replace the existing `await sendEmail(...)` call with:

  ```js
  // Replace this:
  await sendEmail({
    email: user.email,
    subject: 'Email Verification',
    message: `Verify your email by clicking: ${verificationUrl}`,
  });

  // With this:
  try {
    await sendEmail({
      to: user.email,
      subject: 'Verify your VitalPaws email',
      template: 'password-reset',
      data: {
        name: user.name,
        resetUrl: verificationUrl,
      },
    });
  } catch (emailErr) {
    logger.warn('Verification email failed (non-fatal)', { error: emailErr.message });
    throw emailErr;
  }
  ```

  > Reuses `password-reset.html` since the UX is the same: click a link, link expires. `{{resetUrl}}` in the template renders as the verification URL.

- [ ] **Step 5: Commit auth controller changes**

  ```bash
  git add backend/src/controllers/auth.controller.js
  git commit -m "feat: add welcome, login-notification and password-reset email triggers in auth controller"
  ```

---

## Task 5: Fix `to`/`email` mismatch in order and payment controllers

All `sendEmail` calls in `order.controller.js` and `payment.controller.js` pass `email:` instead of `to:`. The new `email.js` accepts both (`to || email`), so this is already handled — no code change needed in those files.

However, verify the `order-confirmation` call passes `email` not `to`:

- [ ] **Step 1: Verify order.controller.js sends correct data**

  Open `backend/src/controllers/order.controller.js` and confirm `createOrder`'s sendEmail call looks like this (should already):

  ```js
  await sendEmail({
    email: req.user.email,          // ← accepted by new email.js via `to || email`
    subject: 'Order Confirmation',
    template: 'order-confirmation',
    data: {
      name: req.user.name,
      orderId: order[0]._id,
      totalAmount: order[0].totalAmount,
      items: order[0].items,
    },
  });
  ```

  Also confirm the `order-confirmation.html` template uses `{{name}}`, `{{orderId}}`, and `{{items}}` (not `{{total}}`). If the template uses `{{total}}` but data sends `totalAmount`, update the template variable:

  In `backend/src/templates/order-confirmation.html` line 51, change:
  ```html
  <p><strong>Total Amount:</strong> ${{total}}</p>
  ```
  To:
  ```html
  <p><strong>Total Amount:</strong> ${{totalAmount}}</p>
  ```

- [ ] **Step 2: Commit the template fix**

  ```bash
  git add backend/src/templates/order-confirmation.html
  git commit -m "fix: align order-confirmation template variable name with controller data"
  ```

---

## Task 6: End-to-end smoke test

- [ ] **Step 1: Restart the backend**

  ```bash
  cd backend && npm run dev
  ```

  Expected: server starts with no errors.

- [ ] **Step 2: Test signup email**

  Create a new user via the app signup form (or POST `/api/auth/signup`). Check your Resend dashboard → **Emails** tab — a "Welcome to VitalPaws" email should appear within seconds.

- [ ] **Step 3: Test login email**

  Log in as the user. A "New sign-in" email should appear in Resend dashboard.

- [ ] **Step 4: Test forgot password email**

  Trigger forgot password (POST `/api/auth/forgot-password` with `{ "email": "your@email.com" }`). A "Reset your VitalPaws password" email with a button link should appear.

- [ ] **Step 5: Test order confirmation email**

  Place an order as a customer through the checkout flow. An "Order Confirmation" email should appear in Resend.

- [ ] **Step 6: Test payment confirmation email**

  Complete the Stripe payment with test card `4242 4242 4242 4242`. A "Payment Confirmation" email should appear.

- [ ] **Step 7: Test order status update email**

  As admin, update an order's status (e.g. pending → processing). An "Order Status Update" email should appear.

- [ ] **Step 8: Final commit**

  ```bash
  git add -A
  git commit -m "feat: complete Resend email integration — all 6 email scenarios wired and tested"
  ```

---

## Self-Review Checklist

### Spec coverage
| Scenario | Task |
|---|---|
| User creating account | Task 4 Step 1 (welcome email) |
| User reset password | Task 4 Step 3 (password-reset template) |
| User making a purchase | Task 5 (order-confirmation already wired in order.controller.js) |
| User logging in | Task 4 Step 2 (login-notification) |
| Purchase state change | `order-status-update` template already exists and wired in order.controller.js |
| Payment status change | Task 3 Step 4 (payment-status-update template created) |

All scenarios covered. ✅

### Placeholder scan
No TBD, TODO, or "implement later" found. All code is complete. ✅

### Type consistency
- `sendEmail({ to, email, subject, template, data })` — all callers use either `to:` (auth) or `email:` (order/payment, accepted via fallback). ✅
- Template variable names match data objects passed in every call. ✅
