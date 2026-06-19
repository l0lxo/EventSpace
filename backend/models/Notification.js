const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },

    // Matches the `type` enum listed in the API contract section 5.
    // Used by the frontend to pick an icon/style per notification type.
    type: {
      type: String,
      enum: {
        values: [
          'booking_confirmed',
          'booking_cancelled',
          'event_reminder',
          'event_approved',
          'event_rejected',
          'modification_requested',
          'capacity_full',
        ],
        message: '{VALUE} is not a valid notification type',
      },
      required: [true, 'Notification type is required'],
    },

    // Optional reference back to the event this notification relates to,
    // so the frontend can deep-link "View event" from the notification.
    relatedEvent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      default: null,
    },

    sentDate: {
      type: Date,
      default: Date.now,
    },

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

eventIndexes(notificationSchema);

function eventIndexes(schema) {
  // Powers GET /api/notifications?isRead=false and the unread-count badge
  schema.index({ user: 1, isRead: 1 });
  schema.index({ user: 1, sentDate: -1 });
}

notificationSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model('Notification', notificationSchema);
