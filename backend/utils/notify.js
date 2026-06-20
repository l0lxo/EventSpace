/**
 * utils/notify.js
 *
 * A single shared helper used by events.js, bookings.js, and the future
 * cron reminder job to create a Notification document AND push it to the
 * user in real time over Socket.io, in one call.
 *
 * Without this helper, every route that needs to notify a user would have
 * to duplicate: create the DB document, then find the right socket room,
 * then emit. Centralizing it here means that logic only exists once.
 *
 * Usage from any route file:
 *
 *   const notifyUser = require('../utils/notify');
 *
 *   await notifyUser(req.app.get('io'), {
 *     userId: organizer._id,
 *     message: `Your event "${event.title}" has been approved.`,
 *     type: 'event_approved',
 *     relatedEvent: event._id,
 *   });
 */

const Notification = require('../models/Notification');

/**
 * @param {import('socket.io').Server} io - the Socket.io server instance
 * @param {Object} params
 * @param {string} params.userId - the recipient's User _id
 * @param {string} params.message - human-readable notification text
 * @param {string} params.type - one of the enum values in Notification schema
 * @param {string} [params.relatedEvent] - optional Event _id to link back to
 */
const notifyUser = async (io, { userId, message, type, relatedEvent = null }) => {
  try {
    const notification = await Notification.create({
      user: userId,
      message,
      type,
      relatedEvent,
    });

    // Every authenticated socket connection joins a personal room named
    // after their own user ID (wired up in socket/index.js). Emitting to
    // that room reaches only this specific user, on any device/tab they
    // currently have open — not broadcast to everyone.
    if (io) {
      io.to(`user:${userId}`).emit('new_notification', {
        notification: notification.toJSON(),
      });
    }

    return notification;
  } catch (err) {
    // Notifications are a side effect, never the main point of whatever
    // route called this. We log the failure but deliberately don't throw —
    // a broken notification should never roll back a successful booking
    // or event approval that already happened.
    console.error('Failed to create/send notification:', err);
    return null;
  }
};

module.exports = notifyUser;