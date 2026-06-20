/**
 * routes/bookings.js
 *
 * Five endpoints covering booking creation, cancellation, history, and
 * the organizer-facing participant list + CSV export.
 *
 * THE HARD PROBLEM THIS FILE SOLVES: race conditions on capacity.
 *
 * Naive approach (DON'T do this):
 *   1. Read event.currentBookings
 *   2. Check if currentBookings < capacity
 *   3. Create the booking
 *   4. Increment event.currentBookings
 *
 * If two students hit "Book" in the same instant on the last available
 * seat, BOTH requests can pass step 2 before either reaches step 4 —
 * because step 1's read happens before either write. Result: capacity 100,
 * but 101 confirmed bookings. This is a classic race condition.
 *
 * THE FIX: use MongoDB's findOneAndUpdate with the capacity check baked
 * directly into the query filter, using the $expr operator. MongoDB
 * guarantees this read-and-write happens as a single atomic operation —
 * no other request can interleave between the check and the increment.
 * If the filter doesn't match (because capacity was already hit by another
 * request a millisecond earlier), the update simply returns null, and we
 * treat that as "sorry, no seats left."
 *
 * Mounted in server.js as: app.use('/api/bookings', bookingRoutes)
 */

const express = require('express');
const router = express.Router();
const { Parser: CsvParser } = require('json2csv');

const Booking = require('../models/Booking');
const Event = require('../models/Event');
const { protect, authorize } = require('../middleware/auth');
const notifyUser = require('../utils/notify');
const {
  sendBookingConfirmedEmail,
  sendBookingCancelledEmail,
  sendCapacityFullEmail,
} = require('../utils/email');

// ─── Config: cancellation window ─────────────────────────────────────────────
// How many hours before an event starts that cancellation is still allowed.
// Flagged as an "open decision" in the API contract — set here as a single
// constant so it's easy to change in one place if the team picks a
// different number later.
const CANCELLATION_WINDOW_HOURS = 24;

// ─── Helper: combine an event's date + time into one real Date object ───────
// The Event schema stores `date` (a Date) and `time` (a "HH:MM" string)
// separately for display purposes, but we need a single timestamp to
// compare against "right now" for the cancellation window check and for
// the reminder cron job later.
const getEventDateTime = (event) => {
  const [hours, minutes] = event.time.split(':').map(Number);
  const dt = new Date(event.date);
  dt.setHours(hours, minutes, 0, 0);
  return dt;
};

// ─── Helper: format a booking for API responses ──────────────────────────────
const formatBooking = (booking) => (booking.toJSON ? booking.toJSON() : booking);

// ════════════════════════════════════════════════════════════════════════════
// POST /api/bookings — Student. Book a seat on an approved event.
// ════════════════════════════════════════════════════════════════════════════
router.post('/', protect, authorize('student'), async (req, res) => {
  const { eventId } = req.body;

  if (!eventId) {
    return res.status(400).json({ message: 'eventId is required' });
  }

  try {
    // Load the event first to run basic eligibility checks (status, timing)
    // BEFORE attempting the atomic capacity increment. These checks alone
    // aren't race-condition-safe, but they don't need to be — they're just
    // here to give clear, specific error messages for the common cases.
    // The capacity check below is the one that actually has to be atomic.
    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.status !== 'approved') {
      return res.status(400).json({ message: 'Event is not open for booking' });
    }

    if (new Date(event.date) < new Date()) {
      return res.status(400).json({ message: 'This event has already taken place' });
    }

    // Check for an existing confirmed booking by this student for this event.
    // The unique compound index on Booking (student + event + status:'confirmed')
    // backs this up at the database level too, so this is a friendly
    // pre-check, not the only line of defense.
    const existingBooking = await Booking.findOne({
      student: req.user._id,
      event: eventId,
      status: 'confirmed',
    });

    if (existingBooking) {
      return res.status(409).json({ message: 'You already have a booking for this event' });
    }

    // ─── THE ATOMIC CAPACITY CHECK ────────────────────────────────────────
    // This single operation finds the event AND increments currentBookings
    // in one indivisible step, but ONLY if currentBookings < capacity at
    // the moment MongoDB executes it. If another request already pushed
    // currentBookings to capacity microseconds earlier, this filter simply
    // won't match anything, and updatedEvent comes back null.
    const updatedEvent = await Event.findOneAndUpdate(
      {
        _id: eventId,
        $expr: { $lt: ['$currentBookings', '$capacity'] }, // currentBookings < capacity
      },
      { $inc: { currentBookings: 1 } },
      { new: true } // return the document AFTER the update
    );

    if (!updatedEvent) {
      return res.status(409).json({ message: 'This event is at full capacity' });
    }

    // Capacity secured. Now create the actual booking record.
    let booking;
    try {
      booking = await Booking.create({
        student: req.user._id,
        event: eventId,
        status: 'confirmed',
      });
    } catch (bookingErr) {
      // If booking creation fails for any reason (including the rare case
      // where the unique index catches a duplicate we missed above), we
      // must roll back the increment we just made — otherwise currentBookings
      // drifts out of sync with actual confirmed bookings forever.
      await Event.findByIdAndUpdate(eventId, { $inc: { currentBookings: -1 } });

      if (bookingErr.code === 11000) {
        return res.status(409).json({ message: 'You already have a booking for this event' });
      }
      throw bookingErr;
    }

    const seatsRemaining = updatedEvent.capacity - updatedEvent.currentBookings;

    // ─── Real-time update ──────────────────────────────────────────────────
    // Tell every client currently viewing this event's page that the seat
    // count just changed, so their UI updates without a page refresh.
    const io = req.app.get('io');
    io.to(`room:${eventId}`).emit('capacity_updated', {
      eventId,
      currentBookings: updatedEvent.currentBookings,
      seatsRemaining,
    });

    // ─── Emails — wrapped independently so a failure here never undoes
    // the booking that already succeeded ───────────────────────────────────
    let organizer = null;
    try {
      await sendBookingConfirmedEmail(
        req.user.email,
        updatedEvent.title,
        updatedEvent.date,
        updatedEvent.time,
        updatedEvent.location
      );

      // If this booking just filled the event to capacity, alert the organizer
      if (seatsRemaining === 0) {
        organizer = await require('../models/User').findById(updatedEvent.createdBy);
        if (organizer) {
          await sendCapacityFullEmail(organizer.email, updatedEvent.title);
        }
      }
    } catch (emailErr) {
      console.error('Failed to send booking emails:', emailErr);
    }

    // ─── In-app notifications ────────────────────────────────────────────
    // Mirrors the emails above: a persistent Notification document plus an
    // instant push if the recipient is currently connected.
    await notifyUser(io, {
      userId: req.user._id,
      message: `Your booking for "${updatedEvent.title}" is confirmed.`,
      type: 'booking_confirmed',
      relatedEvent: updatedEvent._id,
    });

    if (seatsRemaining === 0 && organizer) {
      await notifyUser(io, {
        userId: organizer._id,
        message: `"${updatedEvent.title}" has reached full capacity.`,
        type: 'capacity_full',
        relatedEvent: updatedEvent._id,
      });
    }

    res.status(201).json({
      booking: formatBooking(booking),
      seatsRemaining,
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Event not found' });
    }
    console.error('Create booking error:', err);
    res.status(500).json({ message: 'Server error creating booking' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// DELETE /api/bookings/:id — Student (own bookings only). Cancel a booking.
// ════════════════════════════════════════════════════════════════════════════
router.delete('/:id', protect, authorize('student'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('event');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only cancel your own bookings' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ message: 'This booking has already been cancelled' });
    }

    // Cancellation window check
    const eventDateTime = getEventDateTime(booking.event);
    const hoursUntilEvent = (eventDateTime - new Date()) / (1000 * 60 * 60);

    if (hoursUntilEvent < CANCELLATION_WINDOW_HOURS) {
      return res.status(400).json({
        message: `Cancellation window has passed. Bookings must be cancelled at least ${CANCELLATION_WINDOW_HOURS} hours before the event.`,
      });
    }

    booking.status = 'cancelled';
    booking.cancellationDate = new Date();
    await booking.save();

    // Decrement currentBookings — this is a single atomic $inc with a
    // negative value, so it's safe even with concurrent cancellations.
    const updatedEvent = await Event.findByIdAndUpdate(
      booking.event._id,
      { $inc: { currentBookings: -1 } },
      { new: true }
    );

    const seatsRemaining = updatedEvent.capacity - updatedEvent.currentBookings;

    // Real-time update
    const io = req.app.get('io');
    io.to(`room:${booking.event._id}`).emit('capacity_updated', {
      eventId: booking.event._id,
      currentBookings: updatedEvent.currentBookings,
      seatsRemaining,
    });

    // Email confirmation
    try {
      await sendBookingCancelledEmail(req.user.email, booking.event.title);
    } catch (emailErr) {
      console.error('Failed to send cancellation email:', emailErr);
    }

    // In-app notification — same pattern as booking confirmation above
    await notifyUser(io, {
      userId: req.user._id,
      message: `Your booking for "${booking.event.title}" has been cancelled.`,
      type: 'booking_cancelled',
      relatedEvent: booking.event._id,
    });

    res.status(200).json({
      message: 'Booking cancelled successfully',
      seatsRemaining,
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Booking not found' });
    }
    console.error('Cancel booking error:', err);
    res.status(500).json({ message: 'Server error cancelling booking' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/bookings/my-bookings — Student. Their own booking history.
// Must come BEFORE any /:something routes that could collide — there are
// none here that would, but keeping this near the top for consistency.
// ════════════════════════════════════════════════════════════════════════════
router.get('/my-bookings', protect, authorize('student'), async (req, res) => {
  try {
    const { status } = req.query;

    const filter = { student: req.user._id };
    if (status) filter.status = status;

    const bookings = await Booking.find(filter)
      .sort({ bookingDate: -1 })
      .populate('event', 'title date time location');

    const data = bookings.map((b) => ({
      id: b._id,
      event: b.event
        ? {
            id: b.event._id,
            title: b.event.title,
            date: b.event.date,
            time: b.event.time,
            location: b.event.location,
          }
        : null,
      bookingDate: b.bookingDate,
      status: b.status,
    }));

    res.status(200).json({ data, count: data.length });
  } catch (err) {
    console.error('Get my-bookings error:', err);
    res.status(500).json({ message: 'Server error fetching booking history' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/bookings/event/:eventId — Organizer (own event) or Admin.
// Participant list for a specific event.
// ════════════════════════════════════════════════════════════════════════════
router.get('/event/:eventId', protect, authorize('organizer', 'admin'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const isOwner = event.createdBy.toString() === req.user._id.toString();
    if (req.user.role !== 'admin' && !isOwner) {
      return res.status(403).json({
        message: 'You can only view participants for your own events',
      });
    }

    const bookings = await Booking.find({ event: req.params.eventId })
      .sort({ bookingDate: -1 })
      .populate('student', 'name email studentID');

    const data = bookings.map((b) => ({
      bookingId: b._id,
      studentName: b.student?.name || 'Unknown',
      studentEmail: b.student?.email || 'Unknown',
      studentID: b.student?.studentID || 'N/A',
      bookingDate: b.bookingDate,
      status: b.status,
    }));

    res.status(200).json({ data, count: data.length });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Event not found' });
    }
    console.error('Get participants error:', err);
    res.status(500).json({ message: 'Server error fetching participants' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/bookings/event/:eventId/export — Organizer (own event) or Admin.
// Same data as above, returned as a downloadable CSV file.
// ════════════════════════════════════════════════════════════════════════════
router.get('/event/:eventId/export', protect, authorize('organizer', 'admin'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const isOwner = event.createdBy.toString() === req.user._id.toString();
    if (req.user.role !== 'admin' && !isOwner) {
      return res.status(403).json({
        message: 'You can only export participants for your own events',
      });
    }

    const bookings = await Booking.find({ event: req.params.eventId })
      .sort({ bookingDate: -1 })
      .populate('student', 'name email studentID');

    const rows = bookings.map((b) => ({
      studentName: b.student?.name || 'Unknown',
      studentEmail: b.student?.email || 'Unknown',
      studentID: b.student?.studentID || 'N/A',
      bookingDate: b.bookingDate.toISOString(),
      status: b.status,
    }));

    // json2csv converts the array of plain objects above into a raw CSV string.
    // The fields array controls column order and header names explicitly,
    // rather than relying on whatever key order the objects happen to have.
    const csvParser = new CsvParser({
      fields: ['studentName', 'studentEmail', 'studentID', 'bookingDate', 'status'],
    });
    const csv = csvParser.parse(rows);

    // Build a filesystem-safe filename from the event title
    const safeFilename = event.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    res.header('Content-Type', 'text/csv');
    res.attachment(`${safeFilename}-participants.csv`);
    res.send(csv);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Event not found' });
    }
    console.error('Export CSV error:', err);
    res.status(500).json({ message: 'Server error exporting participant list' });
  }
});

module.exports = router;