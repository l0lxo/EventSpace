// route order matters here — '/my-events' and '/pending' must come before '/:id',
// otherwise Express matches them as an event id
const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');

const Event = require('../models/Event');
const Booking = require('../models/Booking');
const { protect, authorize } = require('../middleware/auth');
const uploadPoster = require('../middleware/upload');
const notifyUser = require('../utils/notify');
const cancelEventAndNotify = require('../utils/cancelEvent');
const {
  sendEventApprovedEmail,
  sendEventRejectedEmail,
  sendModificationRequestedEmail,
  sendEventUpdatedEmail,
} = require('../utils/email');

const formatEvent = (event) => {
  const obj = event.toJSON ? event.toJSON() : event;
  return obj;
};

const fourteenDaysFromNow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d;
};

// multipart fields arrive as strings — the frontend JSON-stringifies these two
// nested objects, so parse them back before validation/creation runs
const parseJsonFields = (req, res, next) => {
  ['fundingRequest', 'externalGuests'].forEach((field) => {
    if (typeof req.body[field] === 'string') {
      try {
        req.body[field] = JSON.parse(req.body[field]);
      } catch {
        // leave as-is — validation below will reject whatever this resolves to
      }
    }
  });
  next();
};

const createEventValidation = [
  body('title').trim().notEmpty().withMessage('Title is required')
    .isLength({ max: 150 }).withMessage('Title cannot exceed 150 characters'),

  body('description').trim().notEmpty().withMessage('Description is required')
    .isLength({ max: 3000 }).withMessage('Description cannot exceed 3000 characters'),

  body('date').notEmpty().withMessage('Date is required')
    .isISO8601().withMessage('Date must be a valid date (YYYY-MM-DD)')
    .custom((value) => {
      if (new Date(value) < fourteenDaysFromNow()) {
        throw new Error('Event date must be at least 14 days from today');
      }
      return true;
    }),

  body('time').trim().notEmpty().withMessage('Time is required')
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Time must be in HH:MM 24-hour format'),

  body('location').trim().notEmpty().withMessage('Location is required'),

  body('capacity').notEmpty().withMessage('Capacity is required')
    .isInt({ min: 1 }).withMessage('Capacity must be a positive whole number'),

  body('category')
    .isIn(['Technology', 'Sports', 'Cultural', 'Academic', 'Social', 'Career', 'Religious', 'Other'])
    .withMessage('Invalid category'),

  body('fundingRequest.budget').optional().isFloat({ min: 0 })
    .withMessage('Budget cannot be negative'),

  body('externalGuests.reason').optional().trim()
    .isLength({ max: 1000 }).withMessage('Reason cannot exceed 1000 characters'),

  body('isPaid').optional().isBoolean().withMessage('isPaid must be true or false'),

  body('price')
    .if(body('isPaid').equals('true'))
    .notEmpty().withMessage('Price is required for paid events')
    .isFloat({ min: 0.01 }).withMessage('Price must be greater than 0'),
];

const reviewValidation = [
  body('decision')
    .isIn(['approved', 'rejected', 'modification_requested'])
    .withMessage('Decision must be approved, rejected, or modification_requested'),

  body('feedback')
    .if(body('decision').not().equals('approved'))
    .notEmpty()
    .withMessage('Feedback is required when rejecting or requesting modifications'),
];

// GET /api/events  — Public. Browse approved, upcoming events.
router.get('/', async (req, res) => {
  try {
    const {
      search,
      category,
      startDate,
      endDate,
      location,
      page = 1,
      limit = 20,
    } = req.query;

    // Base filter: only approved events that haven't already happened
    const filter = {
      status: 'approved',
      date: { $gte: new Date() },
    };

    if (category) filter.category = category;
    if (location) filter.location = { $regex: location, $options: 'i' };

    // Date range filter — overrides the default "$gte: now" if startDate is given
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    // Text search across title/description — uses the text index defined
    // in the Event schema (eventSchema.index({ title: 'text', description: 'text' }))
    if (search) {
      filter.$text = { $search: search };
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100); // cap at 100 to prevent abuse
    const skip = (pageNum - 1) * limitNum;

    const [events, count] = await Promise.all([
      Event.find(filter)
        .sort({ date: 1 }) // chronological, soonest first
        .skip(skip)
        .limit(limitNum)
        .populate('createdBy', 'name organizationName'),
      Event.countDocuments(filter),
    ]);

    res.status(200).json({
      data: events.map(formatEvent),
      count,
      page: pageNum,
      totalPages: Math.ceil(count / limitNum) || 1,
    });
  } catch (err) {
    console.error('Get events error:', err);
    res.status(500).json({ message: 'Server error fetching events' });
  }
});

// GET /api/events/my-events — Organizer. Their own events, any status.
// Must come BEFORE /:id.
router.get('/my-events', protect, authorize('organizer'), async (req, res) => {
  try {
    const events = await Event.find({ createdBy: req.user._id })
      .sort({ createdDate: -1 });

    res.status(200).json({
      data: events.map(formatEvent),
      count: events.length,
    });
  } catch (err) {
    console.error('Get my-events error:', err);
    res.status(500).json({ message: 'Server error fetching your events' });
  }
});

// GET /api/events/pending — Admin. Review queue, oldest first.
// Must come BEFORE /:id.
router.get('/pending', protect, authorize('admin'), async (req, res) => {
  try {
    const events = await Event.find({ status: 'pending' })
      .sort({ createdDate: 1 }) // oldest first — clear the backlog in order
      .populate('createdBy', 'name email organizationName');

    res.status(200).json({
      data: events.map(formatEvent),
      count: events.length,
    });
  } catch (err) {
    console.error('Get pending events error:', err);
    res.status(500).json({ message: 'Server error fetching pending events' });
  }
});

// GET /api/events/:id — Public. Single event detail.
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('createdBy', 'name organizationName');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.status(200).json({ event: formatEvent(event) });
  } catch (err) {
    // CastError happens when req.params.id isn't a valid MongoDB ObjectId
    // format at all (e.g. someone requests /api/events/abc)
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Event not found' });
    }
    console.error('Get event error:', err);
    res.status(500).json({ message: 'Server error fetching event' });
  }
});

// POST /api/events — Organizer. Create event, status defaults to 'pending'.
router.post(
  '/',
  protect,
  authorize('organizer'),
  uploadPoster,
  parseJsonFields,
  createEventValidation,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    try {
      const {
        title, description, date, time, location, capacity, category,
        fundingRequest, externalGuests, isPaid, price,
      } = req.body;

      const isPaidBool = isPaid === true || isPaid === 'true';

      const event = await Event.create({
        title,
        description,
        date,
        time,
        location,
        capacity,
        category,
        isPaid: isPaidBool,
        price: isPaidBool ? Number(price) : 0,
        createdBy: req.user._id,
        posterUrl: req.file ? `/uploads/posters/${req.file.filename}` : null,
        fundingRequest: fundingRequest?.requested
          ? {
              requested: true,
              budget: fundingRequest.budget,
              justification: fundingRequest.justification,
            }
          : { requested: false },
        externalGuests: externalGuests?.requested
          ? {
              requested: true,
              reason: externalGuests.reason,
            }
          : { requested: false },
        // status defaults to 'pending' via the schema — not set explicitly here
      });

      res.status(201).json({ event: formatEvent(event) });
    } catch (err) {
      if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map((e) => e.message);
        return res.status(400).json({ message: messages[0] });
      }
      console.error('Create event error:', err);
      res.status(500).json({ message: 'Server error creating event' });
    }
  }
);

// PUT /api/events/:id — Organizer (own; pending, modification_requested, or
//                        approved) or Admin (any event, any status).
router.put(
  '/:id',
  protect,
  authorize('organizer', 'admin'),
  uploadPoster,
  parseJsonFields,
  async (req, res) => {
    try {
      const event = await Event.findById(req.params.id);

      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      const isOwner = event.createdBy.toString() === req.user._id.toString();
      const isAdmin = req.user.role === 'admin';

      if (!isAdmin) {
        if (!isOwner) {
          return res.status(403).json({ message: 'You can only edit your own events' });
        }
        if (!['pending', 'modification_requested', 'approved'].includes(event.status)) {
          return res.status(403).json({
            message: 'Cannot edit an event that has been rejected or cancelled',
          });
        }
      }

      // track before mutating — needed below to decide whether to notify attendees
      const wasApproved = !isAdmin && event.status === 'approved';

      // Whitelist of fields allowed to be edited — prevents a request body
      // from sneaking in changes to e.g. currentBookings or createdBy.
      const editableFields = [
        'title', 'description', 'date', 'time', 'location',
        'capacity', 'category', 'fundingRequest', 'externalGuests',
        'isPaid', 'price',
      ];

      editableFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          event[field] = req.body[field];
        }
      });

      if (req.file) {
        // replacing an existing poster — remove the old file rather than leaving it orphaned
        if (event.posterUrl) {
          fs.unlink(path.join(__dirname, '..', event.posterUrl), () => {});
        }
        event.posterUrl = `/uploads/posters/${req.file.filename}`;
      }

      // If an organizer edits after a modification request, send it back
      // into the review queue automatically — approved events stay approved.
      if (!isAdmin && event.status === 'modification_requested') {
        event.status = 'pending';
        event.feedback = null;
      }

      await event.save();

      const io = req.app.get('io');

      // respond to the organizer immediately — they shouldn't wait on attendee
      // emails before their save is confirmed
      res.status(200).json({ event: formatEvent(event) });

      // Push a live update to anyone currently viewing this event's detail page
      io.to(`room:${event._id}`).emit('event_details_updated', {
        eventId: event._id,
      });

      // When a live approved event is edited, notify every booked student —
      // runs after the response so the organizer's UI updates instantly;
      // wrapped independently so a notification failure never reverts the edit
      if (wasApproved) {
        (async () => {
          try {
            const bookings = await Booking.find({ event: event._id, status: 'confirmed' })
              .populate('student', 'email');

            await Promise.all(
              bookings.map((booking) =>
                Promise.all([
                  sendEventUpdatedEmail(booking.student.email, event.title),
                  notifyUser(io, {
                    userId: booking.student._id,
                    message: `Details for "${event.title}" have been updated. Please review the changes.`,
                    type: 'event_updated',
                    relatedEvent: event._id,
                  }),
                ])
              )
            );
          } catch (notifyErr) {
            console.error('Failed to notify students of event update:', notifyErr);
          }
        })();
      }
    } catch (err) {
      if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map((e) => e.message);
        return res.status(400).json({ message: messages[0] });
      }
      if (err.name === 'CastError') {
        return res.status(404).json({ message: 'Event not found' });
      }
      console.error('Update event error:', err);
      res.status(500).json({ message: 'Server error updating event' });
    }
  }
);

// DELETE /api/events/:id — Organizer (own; pending, approved, or
// modification_requested) or Admin (any, any status).
// Soft-deletes by setting status to 'cancelled' rather than removing the
// document, so booking history and reporting stay intact.
router.delete('/:id', protect, authorize('organizer', 'admin'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate('createdBy', 'name email');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.status === 'cancelled') {
      return res.status(400).json({ message: 'This event has already been cancelled' });
    }

    const isOwner = event.createdBy._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin) {
      if (!isOwner) {
        return res.status(403).json({ message: 'You can only cancel your own events' });
      }
      if (!['pending', 'approved', 'modification_requested'].includes(event.status)) {
        return res.status(403).json({
          message: 'This event cannot be cancelled in its current state.',
        });
      }
    }

    event.status = 'cancelled';
    await event.save();

    // Attendee notification always; organizer notification only when an
    // admin (not the organizer themselves) performed the cancellation —
    // wrapped independently so a notification failure never undoes the
    // cancellation that already succeeded above.
    try {
      await cancelEventAndNotify({
        event,
        io: req.app.get('io'),
        cancelledByAdmin: isAdmin,
        reason: req.body.reason,
      });
    } catch (notifyErr) {
      console.error('Failed to notify after event cancellation:', notifyErr);
    }

    res.status(200).json({ message: 'Event cancelled successfully' });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Event not found' });
    }
    console.error('Cancel event error:', err);
    res.status(500).json({ message: 'Server error cancelling event' });
  }
});

// PATCH /api/events/:id/review — Admin. Approve / reject / request modifications.
router.patch('/:id/review', protect, authorize('admin'), reviewValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  try {
    const event = await Event.findById(req.params.id).populate('createdBy', 'name email');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.status !== 'pending') {
      return res.status(400).json({
        message: `This event has already been reviewed (current status: ${event.status})`,
      });
    }

    const { decision, feedback } = req.body;

    event.status = decision;
    event.feedback = decision === 'approved' ? null : feedback;
    await event.save();

    // Send the appropriate email based on decision — wrapped independently
    // so an email failure never blocks the review action itself.
    try {
      if (decision === 'approved') {
        await sendEventApprovedEmail(event.createdBy.email, event.title);
      } else if (decision === 'rejected') {
        await sendEventRejectedEmail(event.createdBy.email, event.title, feedback);
      } else if (decision === 'modification_requested') {
        await sendModificationRequestedEmail(event.createdBy.email, event.title, feedback);
      }
    } catch (emailErr) {
      console.error('Failed to send review decision email:', emailErr);
    }

    // Real-time: if anyone is viewing this event's page already, let them know
    const io = req.app.get('io');
    io.to(`room:${event._id}`).emit('event_status_changed', {
      eventId: event._id,
      status: event.status,
    });

    // Create a persistent Notification document for the organizer, and
    // push it instantly if they're connected (their personal user:room,
    // joined automatically in socket/index.js on connection).
    const notificationMessages = {
      approved: `Your event "${event.title}" has been approved.`,
      rejected: `Your event "${event.title}" was not approved. Feedback: ${feedback}`,
      modification_requested: `Changes were requested for your event "${event.title}". Feedback: ${feedback}`,
    };
    const notificationTypes = {
      approved: 'event_approved',
      rejected: 'event_rejected',
      modification_requested: 'modification_requested',
    };

    await notifyUser(io, {
      userId: event.createdBy._id,
      message: notificationMessages[decision],
      type: notificationTypes[decision],
      relatedEvent: event._id,
    });

    res.status(200).json({ event: formatEvent(event) });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Event not found' });
    }
    console.error('Review event error:', err);
    res.status(500).json({ message: 'Server error reviewing event' });
  }
});

module.exports = router;