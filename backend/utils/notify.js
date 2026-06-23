const Notification = require('../models/Notification');

const notifyUser = async (io, { userId, message, type, relatedEvent = null }) => {
  try {
    const notification = await Notification.create({
      user: userId,
      message,
      type,
      relatedEvent,
    });

    // every authenticated socket joins a room named after its own user id (socket/index.js)
    if (io) {
      io.to(`user:${userId}`).emit('new_notification', {
        notification: notification.toJSON(),
      });
    }

    return notification;
  } catch (err) {
    // a broken notification should never roll back the booking/approval that triggered it
    console.error('Failed to create/send notification:', err);
    return null;
  }
};

module.exports = notifyUser;
