const cron = require('node-cron');
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const Payment = require('../models/Payment');
const notifyUser = require('../utils/notify');
const { sendEventReminderEmail } = require('../utils/email');

const REMINDER_HOURS_BEFORE = 24;

// runs hourly, so it checks a 1-hour sliding window around the 24h mark rather than
// one exact instant — every event passes through the window exactly once
const runReminderCheck = async (io) => {
  console.log('[Reminder Cron] Running hourly reminder check...');

  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + REMINDER_HOURS_BEFORE * 60 * 60 * 1000);
    const windowStart = new Date(now.getTime() + (REMINDER_HOURS_BEFORE - 1) * 60 * 60 * 1000);

    // event.date is midnight on the calendar day, time is a separate "HH:MM" string,
    // so query the whole day here and do the precise per-event check below
    const candidateEvents = await Event.find({
      status: 'approved',
      date: {
        $gte: new Date(windowStart.toDateString()),
        $lte: new Date(windowEnd.toDateString() + ' 23:59:59'),
      },
    });

    let remindersSent = 0;

    for (const event of candidateEvents) {
      const eventDateTime = getEventDateTime(event);

      if (eventDateTime < windowStart || eventDateTime > windowEnd) {
        continue;
      }

      // reminderSent lives on the booking, not the event, since each student needs
      // their own flag — otherwise a late booking after the window passes would never get one
      const bookingsNeedingReminder = await Booking.find({
        event: event._id,
        status: 'confirmed',
        reminderSent: false,
      }).populate('student', 'name email');

      for (const booking of bookingsNeedingReminder) {
        if (!booking.student) continue;

        try {
          await sendEventReminderEmail(
            booking.student.email,
            event.title,
            event.time,
            event.location
          );

          await notifyUser(io, {
            userId: booking.student._id,
            message: `Reminder: "${event.title}" is happening in about 24 hours.`,
            type: 'event_reminder',
            relatedEvent: event._id,
          });

          booking.reminderSent = true;
          await booking.save();

          remindersSent += 1;
        } catch (err) {
          console.error(
            `[Reminder Cron] Failed to remind ${booking.student.email} for event ${event._id}:`,
            err.message
          );
          // leave reminderSent false so this gets retried next hour
        }
      }
    }

    console.log(`[Reminder Cron] Done. Sent ${remindersSent} reminder(s).`);
  } catch (err) {
    console.error('[Reminder Cron] Unexpected error during reminder check:', err);
  }
};

// duplicated from routes/bookings.js rather than shared, to avoid a cross-folder import
const getEventDateTime = (event) => {
  const [hours, minutes] = event.time.split(':').map(Number);
  const dt = new Date(event.date);
  dt.setHours(hours, minutes, 0, 0);
  return dt;
};

// Runs every 5 minutes. Releases seats held by paid bookings whose 15-minute
// payment window has expired without a completed payment.
const runPaymentCleanup = async () => {
  try {
    const expiredBookings = await Booking.find({
      status: 'pending',
      paymentStatus: 'pending',
      paymentExpiry: { $lt: new Date() },
    });

    for (const booking of expiredBookings) {
      booking.status = 'cancelled';
      booking.paymentStatus = 'failed';
      booking.cancellationDate = new Date();
      await booking.save();

      await Event.findByIdAndUpdate(booking.event, { $inc: { currentBookings: -1 } });
      await Payment.findOneAndUpdate(
        { booking: booking._id, status: 'pending' },
        { status: 'abandoned' }
      );

      console.log(`[Payment Cleanup] Released expired booking ${booking._id}`);
    }
  } catch (err) {
    console.error('[Payment Cleanup] Error:', err);
  }
};

const registerReminderCron = (io) => {
  cron.schedule('0 * * * *', () => {
    runReminderCheck(io);
  });

  cron.schedule('*/5 * * * *', () => {
    runPaymentCleanup();
  });

  console.log('[Reminder Cron] Scheduled — will run at the top of every hour.');
  console.log('[Payment Cleanup] Scheduled — will run every 5 minutes.');
};

module.exports = registerReminderCron;

// exported separately so a test can trigger one run manually without waiting for the clock
module.exports.runReminderCheck = runReminderCheck;
