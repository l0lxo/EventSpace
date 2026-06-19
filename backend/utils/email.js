/**
 * utils/email.js — PLACEHOLDER
 *
 * This file will be fully built out in the Nodemailer phase. For now it
 * exports functions with the correct names and signatures so other route
 * files (like events.js) can import and call them without errors.
 *
 * Each function currently just logs to the console instead of sending a
 * real email. Once we build the real Nodemailer transporter, we'll replace
 * the body of each function — nothing calling these functions will need
 * to change.
 */

const sendEventApprovedEmail = async (organizerEmail, eventTitle) => {
  console.log(`[EMAIL STUB] Would send "event approved" email to ${organizerEmail} for "${eventTitle}"`);
};

const sendEventRejectedEmail = async (organizerEmail, eventTitle, feedback) => {
  console.log(`[EMAIL STUB] Would send "event rejected" email to ${organizerEmail} for "${eventTitle}". Feedback: ${feedback}`);
};

const sendModificationRequestedEmail = async (organizerEmail, eventTitle, feedback) => {
  console.log(`[EMAIL STUB] Would send "modification requested" email to ${organizerEmail} for "${eventTitle}". Feedback: ${feedback}`);
};

const sendEventCancelledEmail = async (studentEmail, eventTitle) => {
  console.log(`[EMAIL STUB] Would send "event cancelled" email to ${studentEmail} for "${eventTitle}"`);
};

module.exports = {
  sendEventApprovedEmail,
  sendEventRejectedEmail,
  sendModificationRequestedEmail,
  sendEventCancelledEmail,
};