/**
 * routes/admin.js
 *
 * Six endpoints, all requiring the 'admin' role:
 *   GET    /api/admin/analytics                  — dashboard summary stats
 *   GET    /api/admin/reports/participation       — per-event participation report
 *   GET    /api/admin/users                       — list/search/filter users
 *   PATCH  /api/admin/users/:id/disable           — toggle a user's disabled status
 *   DELETE /api/admin/users/:id                   — permanently delete a user
 *   PATCH  /api/admin/events/:id/moderate         — flag/unflag/force-cancel an event
 *
 * Every route in this file uses protect + authorize('admin') — there is no
 * route here a non-admin should ever reach.
 *
 * Mounted in server.js as: app.use('/api/admin', adminRoutes)
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

const User = require('../models/User');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const { protect, authorize } = require('../middleware/auth');

// Every single route below requires admin. Applying it once here at the
// router level means we don't have to repeat `protect, authorize('admin')`
// on every individual route declaration.
router.use(protect, authorize('admin'));

// ════════════════════════════════════════════════════════════════════════════
// GET /api/admin/analytics
// ════════════════════════════════════════════════════════════════════════════
router.get('/analytics', async (req, res) => {
  try {
    // Run independent counts in parallel rather than sequentially —
    // Promise.all fires all these queries at once and waits for all to
    // finish, instead of waiting for each one before starting the next.
    const [
      totalEvents,
      totalBookings,
      totalUsers,
      pendingCount,
      approvedCount,
      rejectedCount,
      cancelledCount,
      studentCount,
      organizerCount,
      adminCount,
      upcomingEventsCount,
      categoryAggregation,
    ] = await Promise.all([
      Event.countDocuments({}),
      Booking.countDocuments({ status: 'confirmed' }),
      User.countDocuments({}),
      Event.countDocuments({ status: 'pending' }),
      Event.countDocuments({ status: 'approved' }),
      Event.countDocuments({ status: 'rejected' }),
      Event.countDocuments({ status: 'cancelled' }),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'organizer' }),
      User.countDocuments({ role: 'admin' }),
      Event.countDocuments({ status: 'approved', date: { $gte: new Date() } }),

      // Aggregation pipeline: group bookings by the category of the event
      // they belong to, and count both events and bookings per category.
      // This is the MongoDB equivalent of a SQL "GROUP BY category".
      Event.aggregate([
        { $match: { status: 'approved' } },
        {
          $group: {
            _id: '$category',
            eventCount: { $sum: 1 },
            totalBookings: { $sum: '$currentBookings' },
          },
        },
        { $sort: { totalBookings: -1 } },
        {
          $project: {
            _id: 0,
            category: '$_id',
            eventCount: 1,
            totalBookings: 1,
          },
        },
      ]),
    ]);

    const averageBookingsPerEvent =
      approvedCount > 0 ? Number((totalBookings / approvedCount).toFixed(1)) : 0;

    res.status(200).json({
      totalEvents,
      eventsByStatus: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        cancelled: cancelledCount,
      },
      totalBookings,
      totalUsers,
      usersByRole: {
        student: studentCount,
        organizer: organizerCount,
        admin: adminCount,
      },
      popularCategories: categoryAggregation,
      upcomingEventsCount,
      averageBookingsPerEvent,
    });
  } catch (err) {
    console.error('Get analytics error:', err);
    res.status(500).json({ message: 'Server error fetching analytics' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/admin/reports/participation
// ════════════════════════════════════════════════════════════════════════════
router.get('/reports/participation', async (req, res) => {
  try {
    const { startDate, endDate, category } = req.query;

    const filter = { status: 'approved' };
    if (category) filter.category = category;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const events = await Event.find(filter).sort({ date: 1 });

    // For each event, count cancellations separately from currentBookings
    // (which only reflects CONFIRMED bookings — cancellations need their
    // own query against the Booking collection).
    const data = await Promise.all(
      events.map(async (event) => {
        const cancellations = await Booking.countDocuments({
          event: event._id,
          status: 'cancelled',
        });

        const fillRate =
          event.capacity > 0
            ? `${Math.round((event.currentBookings / event.capacity) * 100)}%`
            : '0%';

        return {
          eventId: event._id,
          eventTitle: event.title,
          date: event.date,
          category: event.category,
          capacity: event.capacity,
          totalBookings: event.currentBookings,
          cancellations,
          fillRate,
        };
      })
    );

    res.status(200).json({ data, count: data.length });
  } catch (err) {
    console.error('Get participation report error:', err);
    res.status(500).json({ message: 'Server error generating participation report' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/admin/users
// ════════════════════════════════════════════════════════════════════════════
router.get('/users', async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (role) filter.role = role;
    if (search) {
      // Search across both name and email — $or means "match either condition"
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
    const skip = (pageNum - 1) * limitNum;

    const [users, count] = await Promise.all([
      User.find(filter)
        .sort({ registrationDate: -1 })
        .skip(skip)
        .limit(limitNum),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      data: users.map((u) => u.toJSON()),
      count,
      page: pageNum,
      totalPages: Math.ceil(count / limitNum) || 1,
    });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ message: 'Server error fetching users' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// PATCH /api/admin/users/:id/disable
// ════════════════════════════════════════════════════════════════════════════
router.patch(
  '/users/:id/disable',
  [body('isDisabled').isBoolean().withMessage('isDisabled must be true or false')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    try {
      const targetUser = await User.findById(req.params.id);

      if (!targetUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Prevent an admin from disabling their own account — would lock
      // them out with no way back in if they're the only admin.
      if (targetUser._id.toString() === req.user._id.toString()) {
        return res.status(400).json({ message: 'You cannot disable your own account' });
      }

      targetUser.isDisabled = req.body.isDisabled;
      await targetUser.save();

      res.status(200).json({
        message: `User ${req.body.isDisabled ? 'disabled' : 're-enabled'} successfully`,
        user: targetUser.toJSON(),
      });
    } catch (err) {
      if (err.name === 'CastError') {
        return res.status(404).json({ message: 'User not found' });
      }
      console.error('Disable user error:', err);
      res.status(500).json({ message: 'Server error updating user status' });
    }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// DELETE /api/admin/users/:id
//
// Business rule (from the open decisions in the API contract): deletion is
// BLOCKED if the user has any active bookings or — for organizers — any
// events with existing bookings. This protects booking history integrity.
// Admins should use disable instead for users with history; delete is only
// for genuinely empty/unused accounts.
// ════════════════════════════════════════════════════════════════════════════
router.delete('/users/:id', async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (targetUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    // Check for active (confirmed) bookings if this is a student
    const activeBookings = await Booking.countDocuments({
      student: targetUser._id,
      status: 'confirmed',
    });

    if (activeBookings > 0) {
      return res.status(400).json({
        message: `Cannot delete: this user has ${activeBookings} active booking(s). Disable the account instead.`,
      });
    }

    // Check for events with bookings if this is an organizer
    if (targetUser.role === 'organizer') {
      const theirEvents = await Event.find({ createdBy: targetUser._id }).select('_id');
      const eventIds = theirEvents.map((e) => e._id);

      const bookingsOnTheirEvents = await Booking.countDocuments({
        event: { $in: eventIds },
        status: 'confirmed',
      });

      if (bookingsOnTheirEvents > 0) {
        return res.status(400).json({
          message: `Cannot delete: this organizer has events with ${bookingsOnTheirEvents} active booking(s). Disable the account instead.`,
        });
      }
    }

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'User not found' });
    }
    console.error('Delete user error:', err);
    res.status(500).json({ message: 'Server error deleting user' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// PATCH /api/admin/events/:id/moderate
// ════════════════════════════════════════════════════════════════════════════
router.patch(
  '/events/:id/moderate',
  [
    body('action')
      .isIn(['flag', 'unflag', 'force_cancel'])
      .withMessage('action must be flag, unflag, or force_cancel'),
    body('reason')
      .if(body('action').equals('flag'))
      .notEmpty()
      .withMessage('reason is required when flagging an event'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    try {
      const event = await Event.findById(req.params.id);

      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      const { action, reason } = req.body;

      if (action === 'flag') {
        event.isFlagged = true;
        event.flagReason = reason;
      } else if (action === 'unflag') {
        event.isFlagged = false;
        event.flagReason = null;
      } else if (action === 'force_cancel') {
        event.status = 'cancelled';
      }

      await event.save();

      // If force-cancelling, notify the real-time room same as the
      // organizer-initiated cancellation in routes/events.js
      if (action === 'force_cancel') {
        const io = req.app.get('io');
        io.to(`room:${event._id}`).emit('event_status_changed', {
          eventId: event._id,
          status: 'cancelled',
        });
      }

      res.status(200).json({ event: event.toJSON() });
    } catch (err) {
      if (err.name === 'CastError') {
        return res.status(404).json({ message: 'Event not found' });
      }
      console.error('Moderate event error:', err);
      res.status(500).json({ message: 'Server error moderating event' });
    }
  }
);

module.exports = router;