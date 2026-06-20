/**
 * config/mailer.js
 *
 * Configures and exports a single reusable Nodemailer "transporter" — the
 * object that actually connects to an SMTP server and sends mail.
 *
 * WHY GMAIL NEEDS AN "APP PASSWORD", NOT YOUR REGULAR PASSWORD:
 * Gmail blocks third-party apps from logging in with your normal account
 * password for security reasons. Instead, you generate a special 16-character
 * "App Password" specifically for this purpose:
 *
 *   1. Go to myaccount.google.com/security
 *   2. Enable 2-Step Verification if not already on (required for App Passwords)
 *   3. Go to myaccount.google.com/apppasswords
 *   4. Create a new app password, name it "Strathmore Events"
 *   5. Copy the 16-character password it gives you (no spaces)
 *   6. Put THAT in your .env as EMAIL_PASS, not your real Gmail password
 *
 * For production (not just local dev), consider switching to a dedicated
 * transactional email service instead of Gmail — SendGrid, Mailgun, or AWS
 * SES are built for this and won't throttle/flag you the way personal Gmail
 * can under volume. The code below would only need the transport config
 * changed, not anything that calls sendEmail().
 */

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false, // true for port 465, false for 587 (STARTTLS)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify the connection once when the server starts, so a misconfigured
// .env shows up immediately in your terminal instead of silently failing
// the first time a real user triggers an email three days from now.
transporter.verify((err) => {
  if (err) {
    console.error('Nodemailer configuration error — emails will NOT send:', err.message);
  } else {
    console.log('Nodemailer is configured correctly and ready to send emails');
  }
});

/**
 * sendEmail — the one low-level function every template function in
 * utils/email.js calls. Centralizing the actual transporter.sendMail()
 * call here means there's only one place that needs to change if you ever
 * switch email providers.
 *
 * @param {string} to - recipient email address
 * @param {string} subject - email subject line
 * @param {string} html - the email body, as HTML
 */
const sendEmail = async (to, subject, html) => {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });
};

module.exports = sendEmail;