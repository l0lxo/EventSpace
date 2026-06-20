/**
 * routes/notifications.js
 *
 * Three endpoints, all requiring a logged-in user (any role):
 *   GET    /api/notifications            — list the current user's notifications
 *   PATCH  /api/notifications/:id/read    — mark one as read
 *   PATCH  /api/notifications/read-all    — mark all as read
 *
 * Notifications themselves are CREATED elsewhere — inside events.js,
 * bookings.js, and the cron reminder job — using the helper function
 * exported from utils/notify.js (see Part 2 of this delivery). This file
 * only handles a user READING their own notifications, never creating them
 * on someone else's behalf.
 *
 * Mounted in server.js as: app.use('/api/notifications', notificationRoutes)
 */

const express = require('express');
const router = express.Router();

const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

// Every route here just needs a logged-in user — no specific role required,
// since every role receives notifications. Applied once at router level.
router.use(protect);

// ════════════════════════════════════════════════════════════════════════════
// GET /api/notifications
// ════════════════════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const { isRead } = req.query;

    const filter = { user: req.user._id };

    // Query params arrive as strings, so 'false' (the string) needs an
    // explicit comparison — `if (isRead)` alone would be true even for
    // the string 'false', since any non-empty string is truthy in JS.
    if (isRead === 'true') filter.isRead = true;
    if (isRead === 'false') filter.isRead = false;

    const notifications = await Notification.find(filter)
      .sort({ sentDate: -1 })
      .populate('relatedEvent', 'title date');

    res.status(200).json({
      data: notifications.map((n) => n.toJSON()),
      count: notifications.length,
    });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ message: 'Server error fetching notifications' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// PATCH /api/notifications/:id/read
// ════════════════════════════════════════════════════════════════════════════
router.patch('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Ownership check — a user can only mark THEIR OWN notifications as
    // read, never someone else's, even if they guess a valid ID.
    if (notification.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only modify your own notifications' });
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({ message: 'Marked as read' });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Notification not found' });
    }
    console.error('Mark notification read error:', err);
    res.status(500).json({ message: 'Server error updating notification' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// PATCH /api/notifications/read-all
// Must be defined separately from '/:id/read' above — there's no route
// ordering conflict here since Express matches '/read-all' literally
// before it would ever try to interpret it as an ':id' parameter, but
// worth noting for consistency with the pattern used in events.js.
// ════════════════════════════════════════════════════════════════════════════
router.patch('/read-all', async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );

    res.status(200).json({
      message: 'All notifications marked as read',
      count: result.modifiedCount,
    });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ message: 'Server error updating notifications' });
  }
});

module.exports = router;