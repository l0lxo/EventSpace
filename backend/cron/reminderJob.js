/**
 * cron/reminderJob.js
 *
 * Runs automatically every hour, forever, for as long as the server process
 * is alive. Finds every CONFIRMED booking for an event happening in roughly
 * the next 24 hours, and — if a reminder hasn't already been sent for that
 * booking — sends one and marks it sent.
 *
 * WHY "ROUGHLY" 24 HOURS, NOT EXACTLY:
 * The job runs once per hour, so it checks a 1-hour-wide WINDOW around the
 * 24-hour mark rather than one exact instant. If we only checked for events
 * starting in EXACTLY 24h00m0s from right now, we'd almost always miss
 * everything — the cron job runs at the top of every hour, and an event's
 * actual start time is very unlikely to land on that exact same minute.
 *
 *   window: REMINDER_HOURS_BEFORE to (REMINDER_HOURS_BEFORE - 1)
 *   e.g.:   24 hours to 23 hours before the event start
 *
 * Any event whose start time falls inside that 1-hour sliding window, at
 * the moment this job happens to run, gets its reminders sent during that
 * run. Since the job runs every hour, every event passes through this
 * window exactly once.
 *
 * WHY reminderSent EXISTS ON THE BOOKING, NOT THE EVENT:
 * An event might have 100 confirmed bookings. Each individual student/booking
 * needs its own independent "have I been reminded yet" flag — marking the
 * EVENT as reminded would either send to everyone at once (fine) or, if a
 * student books in the last few hours before the event after the window
 * already passed, they'd never get reminded at all if we'd already flagged
 * the whole event as done. Per-booking tracking handles this correctly.
 *
 * Registered once in server.js via: require('./cron/reminderJob')();
 */

const cron = require('node-cron');
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const notifyUser = require('../utils/notify');
const { sendEventReminderEmail } = require('../utils/email');

const REMINDER_HOURS_BEFORE = 24;

/**
 * The actual reminder logic, extracted into its own function so it can be
 * called directly for manual testing (see the bottom of this file) without
 * waiting for an actual hourly tick.
 *
 * @param {import('socket.io').Server} io - needed to push in-app notifications
 */
const runReminderCheck = async (io) => {
  console.log('[Reminder Cron] Running hourly reminder check...');

  try {
    const now = new Date();

    // The far edge of the window: events starting in slightly MORE than
    // 24 hours from now are not yet due for a reminder.
    const windowEnd = new Date(now.getTime() + REMINDER_HOURS_BEFORE * 60 * 60 * 1000);

    // The near edge: events starting in slightly LESS than 23 hours from
    // now have already passed through the window on a previous run (or
    // will be caught by the next run if this is the very first time).
    const windowStart = new Date(now.getTime() + (REMINDER_HOURS_BEFORE - 1) * 60 * 60 * 1000);

    // Find approved events whose date falls inside this window.
    // NOTE: event.date is stored as a Date (midnight on that calendar day),
    // and event.time is a separate "HH:MM" string — so we can't filter
    // precisely by date range alone here. We widen the DB query to the
    // whole day, then do the precise hour-level check per-event below
    // using getEventDateTime(), since combining date+time has to happen
    // in JS, not in the MongoDB query itself.
    const candidateEvents = await Event.find({
      status: 'approved',
      date: {
        $gte: new Date(windowStart.toDateString()), // start of that calendar day
        $lte: new Date(windowEnd.toDateString() + ' 23:59:59'), // end of that calendar day
      },
    });

    let remindersSent = 0;

    for (const event of candidateEvents) {
      const eventDateTime = getEventDateTime(event);

      // Precise check: does this specific event's real start time fall
      // inside our exact 1-hour window?
      if (eventDateTime < windowStart || eventDateTime > windowEnd) {
        continue; // not due yet, or already past — skip silently
      }

      // Find confirmed bookings for this event that haven't been reminded yet
      const bookingsNeedingReminder = await Booking.find({
        event: event._id,
        status: 'confirmed',
        reminderSent: false,
      }).populate('student', 'name email');

      for (const booking of bookingsNeedingReminder) {
        if (!booking.student) continue; // defensive — skip orphaned bookings

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

          // Mark sent ONLY after both succeed — if either throws, this
          // booking stays reminderSent: false and gets retried on the
          // next hourly run instead of being silently skipped forever.
          booking.reminderSent = true;
          await booking.save();

          remindersSent += 1;
        } catch (err) {
          console.error(
            `[Reminder Cron] Failed to remind ${booking.student.email} for event ${event._id}:`,
            err.message
          );
          // Deliberately don't mark reminderSent — will retry next hour.
        }
      }
    }

    console.log(`[Reminder Cron] Done. Sent ${remindersSent} reminder(s).`);
  } catch (err) {
    console.error('[Reminder Cron] Unexpected error during reminder check:', err);
  }
};

/**
 * Combines an event's separate `date` (Date) and `time` ("HH:MM" string)
 * fields into one real JavaScript Date object representing the actual
 * start moment. Identical helper to the one in routes/bookings.js — kept
 * duplicated rather than shared to avoid a cross-folder import for one
 * small function, but worth knowing both exist if you ever refactor.
 */
const getEventDateTime = (event) => {
  const [hours, minutes] = event.time.split(':').map(Number);
  const dt = new Date(event.date);
  dt.setHours(hours, minutes, 0, 0);
  return dt;
};

/**
 * registerReminderCron — call this once from server.js after the database
 * connection is established. Schedules runReminderCheck to fire at the top
 * of every hour, forever, using standard cron syntax.
 *
 * Cron syntax reminder: '0 * * * *' means "at minute 0 of every hour" —
 * i.e. 1:00, 2:00, 3:00, etc. The five positions are:
 *   minute(0-59)  hour(0-23)  day-of-month(1-31)  month(1-12)  day-of-week(0-6)
 *
 * @param {import('socket.io').Server} io
 */
const registerReminderCron = (io) => {
  cron.schedule('0 * * * *', () => {
    runReminderCheck(io);
  });

  console.log('[Reminder Cron] Scheduled — will run at the top of every hour.');
};

module.exports = registerReminderCron;

// Exported separately so you can manually trigger one run for testing,
// without waiting for the clock to hit a new hour. See the testing
// instructions for how to use this.
module.exports.runReminderCheck = runReminderCheck;