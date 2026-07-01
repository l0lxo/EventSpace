const Booking = require('../models/Booking');
const notifyUser = require('./notify');
const { sendEventCancelledEmail, sendEventCancelledByAdminEmail } = require('./email');

// Shared by DELETE /api/events/:id and PATCH /api/admin/events/:id/moderate
// (force_cancel) — both flip an event to 'cancelled' and need the same fan-out:
// attendees are always notified; the organizer is notified only when an admin
// (not the organizer themselves) performed the cancellation. Assumes the
// caller has already set event.status = 'cancelled' and saved it, and that
// event.createdBy is populated with at least 'email'.
const cancelEventAndNotify = async ({ event, io, cancelledByAdmin, reason }) => {
  // wrapped independently so a failure notifying attendees never blocks the
  // organizer notification below, or vice versa — the cancellation itself
  // already succeeded by the time this runs
  try {
    const bookings = await Booking.find({ event: event._id, status: 'confirmed' })
      .populate('student', 'email');

    await Promise.all(
      bookings.map((booking) =>
        Promise.all([
          sendEventCancelledEmail(booking.student.email, event.title),
          notifyUser(io, {
            userId: booking.student._id,
            message: `"${event.title}" has been cancelled.`,
            type: 'booking_cancelled',
            relatedEvent: event._id,
          }),
        ])
      )
    );
  } catch (err) {
    console.error('Failed to notify attendees of cancellation:', err);
  }

  if (cancelledByAdmin && event.createdBy) {
    try {
      await sendEventCancelledByAdminEmail(event.createdBy.email, event.title, reason);
      await notifyUser(io, {
        userId: event.createdBy._id,
        message: reason
          ? `Your event "${event.title}" was cancelled by an administrator. Reason: ${reason}`
          : `Your event "${event.title}" was cancelled by an administrator.`,
        type: 'event_cancelled',
        relatedEvent: event._id,
      });
    } catch (err) {
      console.error('Failed to notify organizer of admin cancellation:', err);
    }
  }

  if (io) {
    io.to(`room:${event._id}`).emit('event_status_changed', {
      eventId: event._id,
      status: 'cancelled',
    });
  }
};

module.exports = cancelEventAndNotify;
