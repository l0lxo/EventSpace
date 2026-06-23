const { format } = require('date-fns');
const sendEmail = require('../config/mailer');
const wrapEmail = require('./emailTemplates/layout');

const button = (text, url) => `
  <a href="${url}" style="display:inline-block; background-color:#003366; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:6px; font-size:14px; font-weight:bold; margin-top:16px;">
    ${text}
  </a>
`;

const FRONTEND_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const sendEventApprovedEmail = async (organizerEmail, eventTitle) => {
  const html = wrapEmail(`
    <h2 style="color:#1a7f37; margin-top:0;">Your event has been approved</h2>
    <p style="font-size:15px; color:#333333; line-height:1.5;">
      Good news — <strong>"${eventTitle}"</strong> has been reviewed and approved.
      It is now visible to students and open for booking.
    </p>
    ${button('View Your Event', `${FRONTEND_URL}/organizer/events`)}
  `);

  await sendEmail(organizerEmail, `Approved: ${eventTitle}`, html);
};

const sendEventRejectedEmail = async (organizerEmail, eventTitle, feedback) => {
  const html = wrapEmail(`
    <h2 style="color:#cf222e; margin-top:0;">Your event was not approved</h2>
    <p style="font-size:15px; color:#333333; line-height:1.5;">
      <strong>"${eventTitle}"</strong> was reviewed and was not approved at this time.
    </p>
    <div style="background-color:#fff1f0; border-left:4px solid #cf222e; padding:12px 16px; margin:16px 0;">
      <p style="margin:0; font-size:14px; color:#5c1a1a;"><strong>Administrator feedback:</strong></p>
      <p style="margin:8px 0 0; font-size:14px; color:#5c1a1a;">${feedback}</p>
    </div>
    <p style="font-size:14px; color:#333333; line-height:1.5;">
      You're welcome to submit a new event addressing the feedback above.
    </p>
    ${button('Submit a New Event', `${FRONTEND_URL}/organizer/create-event`)}
  `);

  await sendEmail(organizerEmail, `Update on: ${eventTitle}`, html);
};

const sendModificationRequestedEmail = async (organizerEmail, eventTitle, feedback) => {
  const html = wrapEmail(`
    <h2 style="color:#9a6700; margin-top:0;">Changes requested for your event</h2>
    <p style="font-size:15px; color:#333333; line-height:1.5;">
      The administrator has requested some changes before <strong>"${eventTitle}"</strong>
      can be approved.
    </p>
    <div style="background-color:#fff8e6; border-left:4px solid #9a6700; padding:12px 16px; margin:16px 0;">
      <p style="margin:0; font-size:14px; color:#5c4400;"><strong>Requested changes:</strong></p>
      <p style="margin:8px 0 0; font-size:14px; color:#5c4400;">${feedback}</p>
    </div>
    <p style="font-size:14px; color:#333333; line-height:1.5;">
      Edit your event to reflect this feedback — it will automatically be
      resubmitted for review.
    </p>
    ${button('Edit Your Event', `${FRONTEND_URL}/organizer/events`)}
  `);

  await sendEmail(organizerEmail, `Changes requested: ${eventTitle}`, html);
};

const sendEventCancelledEmail = async (studentEmail, eventTitle) => {
  const html = wrapEmail(`
    <h2 style="color:#cf222e; margin-top:0;">Event cancelled</h2>
    <p style="font-size:15px; color:#333333; line-height:1.5;">
      We're sorry to let you know that <strong>"${eventTitle}"</strong> has been
      cancelled by the organizer. Any booking you held for this event has
      been automatically cancelled — no action is needed on your part.
    </p>
    ${button('Browse Other Events', `${FRONTEND_URL}/events`)}
  `);

  await sendEmail(studentEmail, `Cancelled: ${eventTitle}`, html);
};

const sendBookingConfirmedEmail = async (studentEmail, eventTitle, eventDate, eventTime, location) => {
  const formattedDate = format(new Date(eventDate), 'EEEE, MMMM d, yyyy');

  const html = wrapEmail(`
    <h2 style="color:#1a7f37; margin-top:0;">Booking confirmed</h2>
    <p style="font-size:15px; color:#333333; line-height:1.5;">
      You're booked for <strong>"${eventTitle}"</strong>. Here are the details:
    </p>
    <table style="width:100%; margin:16px 0; font-size:14px; color:#333333;">
      <tr>
        <td style="padding:6px 0; width:90px; color:#666666;">Date</td>
        <td style="padding:6px 0;"><strong>${formattedDate}</strong></td>
      </tr>
      <tr>
        <td style="padding:6px 0; color:#666666;">Time</td>
        <td style="padding:6px 0;"><strong>${eventTime}</strong></td>
      </tr>
      <tr>
        <td style="padding:6px 0; color:#666666;">Location</td>
        <td style="padding:6px 0;"><strong>${location}</strong></td>
      </tr>
    </table>
    <p style="font-size:14px; color:#333333; line-height:1.5;">
      We'll send you a reminder 24 hours before the event. You can cancel
      your booking any time from your booking history, subject to the
      cancellation window.
    </p>
    ${button('View My Bookings', `${FRONTEND_URL}/bookings`)}
  `);

  await sendEmail(studentEmail, `Booking confirmed: ${eventTitle}`, html);
};

const sendBookingCancelledEmail = async (studentEmail, eventTitle) => {
  const html = wrapEmail(`
    <h2 style="color:#333333; margin-top:0;">Booking cancelled</h2>
    <p style="font-size:15px; color:#333333; line-height:1.5;">
      Your booking for <strong>"${eventTitle}"</strong> has been cancelled
      as requested. Your seat has been released back to other students.
    </p>
    ${button('Browse Other Events', `${FRONTEND_URL}/events`)}
  `);

  await sendEmail(studentEmail, `Booking cancelled: ${eventTitle}`, html);
};

const sendCapacityFullEmail = async (organizerEmail, eventTitle) => {
  const html = wrapEmail(`
    <h2 style="color:#003366; margin-top:0;">Your event is fully booked</h2>
    <p style="font-size:15px; color:#333333; line-height:1.5;">
      <strong>"${eventTitle}"</strong> has reached full capacity. No further
      students will be able to book a seat unless someone cancels.
    </p>
    ${button('View Participant List', `${FRONTEND_URL}/organizer/events`)}
  `);

  await sendEmail(organizerEmail, `Fully booked: ${eventTitle}`, html);
};

const sendEventReminderEmail = async (studentEmail, eventTitle, eventTime, location) => {
  const html = wrapEmail(`
    <h2 style="color:#003366; margin-top:0;">Reminder: tomorrow</h2>
    <p style="font-size:15px; color:#333333; line-height:1.5;">
      This is a reminder that <strong>"${eventTitle}"</strong> is happening
      in about 24 hours.
    </p>
    <table style="width:100%; margin:16px 0; font-size:14px; color:#333333;">
      <tr>
        <td style="padding:6px 0; width:90px; color:#666666;">Time</td>
        <td style="padding:6px 0;"><strong>${eventTime}</strong></td>
      </tr>
      <tr>
        <td style="padding:6px 0; color:#666666;">Location</td>
        <td style="padding:6px 0;"><strong>${location}</strong></td>
      </tr>
    </table>
    <p style="font-size:14px; color:#333333; line-height:1.5;">
      We look forward to seeing you there.
    </p>
  `);

  await sendEmail(studentEmail, `Reminder: ${eventTitle} is tomorrow`, html);
};

module.exports = {
  sendEventApprovedEmail,
  sendEventRejectedEmail,
  sendModificationRequestedEmail,
  sendEventCancelledEmail,
  sendBookingConfirmedEmail,
  sendBookingCancelledEmail,
  sendCapacityFullEmail,
  sendEventReminderEmail,
};