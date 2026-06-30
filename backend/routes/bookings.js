// capacity checks use findOneAndUpdate with $expr baked into the filter (see the
// POST / handler below) rather than read-then-write, since two students booking
// the last seat at once would otherwise both pass a separate check and overbook it
const express = require('express');
const router = express.Router();
const { Parser: CsvParser } = require('json2csv');

const Booking = require('../models/Booking');
const Event = require('../models/Event');
const { protect, authorize } = require('../middleware/auth');
const notifyUser = require('../utils/notify');
const generateTicketImage = require('../utils/generateTicket');
const {
  sendBookingConfirmedEmail,
  sendBookingCancelledEmail,
  sendCapacityFullEmail,
} = require('../utils/email');

const CANCELLATION_WINDOW_HOURS = 24;

// Event stores date and time as separate fields for display — combine them here
// for comparisons against "now" (cancellation window, reminder cron)
const getEventDateTime = (event) => {
  const [hours, minutes] = event.time.split(':').map(Number);
  const dt = new Date(event.date);
  dt.setHours(hours, minutes, 0, 0);
  return dt;
};

const formatBooking = (booking) => (booking.toJSON ? booking.toJSON() : booking);

// Runs after the booking response has already been sent — ticket rendering and
// email delivery take seconds and shouldn't make the student wait to see their
// booking confirmed. Any failure here is logged only; the booking itself already succeeded.
const sendBookingSideEffects = async ({ booking, updatedEvent, student, io, seatsRemaining }) => {
  let ticketAttachment;
  try {
    const ticketBuffer = await generateTicketImage({
      booking,
      event: updatedEvent,
      student,
    });
    ticketAttachment = {
      filename: 'ticket.png',
      content: ticketBuffer,
      contentType: 'image/png',
    };
  } catch (ticketErr) {
    console.error('Failed to generate booking ticket image:', ticketErr);
  }

  // wrapped independently so an email failure never undoes the booking that already succeeded
  let organizer = null;
  try {
    await sendBookingConfirmedEmail(
      student.email,
      updatedEvent.title,
      updatedEvent.date,
      updatedEvent.time,
      updatedEvent.location,
      ticketAttachment
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

  await notifyUser(io, {
    userId: student._id,
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
};

// POST /api/bookings — Student. Book a seat on an approved event.
router.post('/', protect, authorize('student'), async (req, res) => {
  const { eventId } = req.body;

  if (!eventId) {
    return res.status(400).json({ message: 'eventId is required' });
  }

  try {
    // these eligibility checks aren't race-condition-safe, but they don't need to be —
    // they just give clear error messages for the common cases; the atomic check is below
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

    // friendly pre-check — the unique compound index on Booking backs this up at the DB level too
    const existingBooking = await Booking.findOne({
      student: req.user._id,
      event: eventId,
      status: 'confirmed',
    });

    if (existingBooking) {
      return res.status(409).json({ message: 'You already have a booking for this event' });
    }

    // atomic: finds the event and increments currentBookings in one step, only if
    // currentBookings < capacity at that exact moment — no other request can interleave
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

    let booking;
    try {
      booking = await Booking.create({
        student: req.user._id,
        event: eventId,
        status: 'confirmed',
      });
    } catch (bookingErr) {
      // roll back the increment if booking creation fails, or currentBookings drifts out of sync
      await Event.findByIdAndUpdate(eventId, { $inc: { currentBookings: -1 } });

      if (bookingErr.code === 11000) {
        return res.status(409).json({ message: 'You already have a booking for this event' });
      }
      throw bookingErr;
    }

    const seatsRemaining = updatedEvent.capacity - updatedEvent.currentBookings;

    const io = req.app.get('io');
    io.to(`room:${eventId}`).emit('capacity_updated', {
      eventId,
      currentBookings: updatedEvent.currentBookings,
      seatsRemaining,
    });

    // respond as soon as the booking itself is confirmed — ticket rendering and
    // email/notification delivery happen after, so the UI doesn't wait on a
    // multi-second ticket render or an SMTP round trip to reflect the booking
    res.status(201).json({
      booking: formatBooking(booking),
      seatsRemaining,
    });

    sendBookingSideEffects({
      booking,
      updatedEvent,
      student: req.user,
      io,
      seatsRemaining,
    }).catch((sideEffectErr) => {
      console.error('Booking confirmation side effects failed:', sideEffectErr);
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Event not found' });
    }
    console.error('Create booking error:', err);
    res.status(500).json({ message: 'Server error creating booking' });
  }
});

// Same reasoning as sendBookingSideEffects above — runs after the cancellation
// response has already been sent, so the UI updates without waiting on an SMTP round trip.
const sendCancellationSideEffects = async ({ studentId, studentEmail, event, io }) => {
  try {
    await sendBookingCancelledEmail(studentEmail, event.title);
  } catch (emailErr) {
    console.error('Failed to send cancellation email:', emailErr);
  }

  await notifyUser(io, {
    userId: studentId,
    message: `Your booking for "${event.title}" has been cancelled.`,
    type: 'booking_cancelled',
    relatedEvent: event._id,
  });
};

// DELETE /api/bookings/:id — Student (own bookings only). Cancel a booking.
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

    const updatedEvent = await Event.findByIdAndUpdate(
      booking.event._id,
      { $inc: { currentBookings: -1 } },
      { new: true }
    );

    const seatsRemaining = updatedEvent.capacity - updatedEvent.currentBookings;

    const io = req.app.get('io');
    io.to(`room:${booking.event._id}`).emit('capacity_updated', {
      eventId: booking.event._id,
      currentBookings: updatedEvent.currentBookings,
      seatsRemaining,
    });

    // respond as soon as the cancellation itself is saved — email/notification
    // delivery happens after, so the UI doesn't wait on an SMTP round trip
    res.status(200).json({
      message: 'Booking cancelled successfully',
      seatsRemaining,
    });

    sendCancellationSideEffects({
      studentId: req.user._id,
      studentEmail: req.user.email,
      event: booking.event,
      io,
    }).catch((sideEffectErr) => {
      console.error('Cancellation confirmation side effects failed:', sideEffectErr);
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Booking not found' });
    }
    console.error('Cancel booking error:', err);
    res.status(500).json({ message: 'Server error cancelling booking' });
  }
});

// GET /api/bookings/my-bookings — Student. Their own booking history.
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

// GET /api/bookings/event/:eventId — Organizer (own event) or Admin.
// Participant list for a specific event.
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

// GET /api/bookings/event/:eventId/export — Organizer (own event) or Admin.
// Same data as above, returned as a downloadable CSV file.
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

    const csvParser = new CsvParser({
      fields: ['studentName', 'studentEmail', 'studentID', 'bookingDate', 'status'],
    });
    const csv = csvParser.parse(rows);

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