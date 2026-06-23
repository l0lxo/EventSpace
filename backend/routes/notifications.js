const express = require('express');
const router = express.Router();

const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const { isRead } = req.query;

    const filter = { user: req.user._id };

    // query params arrive as strings — 'false' is truthy in JS, so compare explicitly
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

router.patch('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

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
