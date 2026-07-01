const crypto = require('crypto');
const express = require('express');
const router = express.Router();

const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { verifyPayment } = require('../utils/paystack');
const notifyUser = require('../utils/notify');
const generateTicketImage = require('../utils/generateTicket');
const { sendBookingConfirmedEmail, sendCapacityFullEmail } = require('../utils/email');

// ── Webhook ──────────────────────────────────────────────────────────────────
//
// IMPORTANT: this route must be mounted in server.js BEFORE the global
// express.json() middleware so that express.raw() can capture the raw body
// buffer here. The HMAC-SHA512 signature check requires the exact byte
// sequence Paystack sent — once express.json() has parsed it to an object,
// the signature can no longer be computed correctly.

router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    // Verify HMAC-SHA512 signature — if this doesn't match, the request did
    // not come from Paystack and must be rejected
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET)
      .update(req.body) // req.body is a Buffer here, not parsed JSON
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).send('Invalid signature');
    }

    const event = JSON.parse(req.body);

    // Respond immediately — Paystack retries if it doesn't get a 200 quickly
    res.status(200).send('OK');

    if (event.event === 'charge.success') {
      handleSuccessfulPayment(event.data).catch((err) =>
        console.error('[Webhook] handleSuccessfulPayment error:', err)
      );
    } else if (event.event === 'charge.failed' || event.event === 'charge.abandoned') {
      handleFailedPayment(event.data).catch((err) =>
        console.error('[Webhook] handleFailedPayment error:', err)
      );
    }
  }
);

// ── Webhook helpers ───────────────────────────────────────────────────────────

const handleSuccessfulPayment = async (data) => {
  const { reference } = data;

  // Always verify independently — never trust the webhook payload alone
  const verification = await verifyPayment(reference);
  if (verification.status !== 'success') return;

  const payment = await Payment.findOne({ paystackReference: reference });
  if (!payment || payment.status === 'success') return; // already processed or not found

  payment.status = 'success';
  payment.paystackTransactionId = data.id?.toString() ?? null;
  payment.gatewayResponse = data;
  payment.paidAt = new Date();
  await payment.save();

  const booking = await Booking.findById(payment.booking);
  if (!booking) return;
  booking.status = 'confirmed';
  booking.paymentStatus = 'paid';
  booking.paymentExpiry = null;
  await booking.save();

  const [student, event] = await Promise.all([
    User.findById(payment.student),
    Event.findById(payment.event),
  ]);
  if (!student || !event) return;

  // global.io is set in server.js so the webhook handler (outside the normal
  // Express request cycle) can emit socket events without req.app.get('io')
  const io = global.io;

  io.to(`room:${event._id}`).emit('capacity_updated', {
    eventId: event._id,
    currentBookings: event.currentBookings,
    seatsRemaining: event.capacity - event.currentBookings,
  });

  // Ticket + confirmation email — same pattern as the free-event side effects
  let ticketAttachment;
  try {
    const ticketBuffer = await generateTicketImage({ booking, event, student });
    ticketAttachment = { filename: 'ticket.png', content: ticketBuffer, contentType: 'image/png' };
  } catch (ticketErr) {
    console.error('[Webhook] Ticket generation failed:', ticketErr);
  }

  try {
    await sendBookingConfirmedEmail(
      student.email,
      event.title,
      event.date,
      event.time,
      event.location,
      ticketAttachment
    );
  } catch (emailErr) {
    console.error('[Webhook] Confirmation email failed:', emailErr);
  }

  await notifyUser(io, {
    userId: student._id,
    message: `Payment confirmed. Your booking for "${event.title}" is confirmed.`,
    type: 'booking_confirmed',
    relatedEvent: event._id,
  });

  if (event.currentBookings >= event.capacity) {
    try {
      const organizer = await User.findById(event.createdBy);
      if (organizer) {
        await sendCapacityFullEmail(organizer.email, event.title);
        await notifyUser(io, {
          userId: organizer._id,
          message: `"${event.title}" has reached full capacity.`,
          type: 'capacity_full',
          relatedEvent: event._id,
        });
      }
    } catch (capErr) {
      console.error('[Webhook] Capacity-full notification failed:', capErr);
    }
  }
};

const handleFailedPayment = async (data) => {
  const { reference } = data;

  const payment = await Payment.findOne({ paystackReference: reference });
  if (!payment || payment.status !== 'pending') return;

  payment.status = data.status === 'abandoned' ? 'abandoned' : 'failed';
  payment.gatewayResponse = data;
  await payment.save();

  const booking = await Booking.findById(payment.booking);
  if (!booking) return;
  booking.status = 'cancelled';
  booking.paymentStatus = 'failed';
  booking.cancellationDate = new Date();
  await booking.save();

  const event = await Event.findByIdAndUpdate(
    payment.event,
    { $inc: { currentBookings: -1 } },
    { new: true }
  );

  const student = await User.findById(payment.student);
  if (student && event) {
    const io = global.io;
    io.to(`room:${event._id}`).emit('capacity_updated', {
      eventId: event._id,
      currentBookings: event.currentBookings,
      seatsRemaining: event.capacity - event.currentBookings,
    });

    await notifyUser(io, {
      userId: student._id,
      message: `Payment for "${event.title}" was unsuccessful. Your booking has been cancelled.`,
      type: 'booking_cancelled',
      relatedEvent: event._id,
    });
  }
};

// ── GET /api/payments/verify/:reference ──────────────────────────────────────
// Called by the frontend after Paystack redirects back, to get the current
// payment status before the webhook has necessarily fired.

router.get('/verify/:reference', protect, authorize('student'), async (req, res) => {
  try {
    const payment = await Payment.findOne({
      paystackReference: req.params.reference,
      student: req.user._id,
    }).populate('booking');

    if (!payment) {
      return res.status(404).json({ message: 'Payment record not found' });
    }

    res.status(200).json({
      status: payment.status,
      bookingStatus: payment.booking?.status ?? null,
      reference: payment.paystackReference,
    });
  } catch (err) {
    console.error('Payment verification error:', err);
    res.status(500).json({ message: 'Error verifying payment' });
  }
});

module.exports = router;
