const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    // a real ref rather than a raw studentID string, so .populate() works for participant lists
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },

    bookingDate: {
      type: Date,
      default: Date.now,
    },

    status: {
      type: String,
      enum: {
        values: ['pending', 'confirmed', 'cancelled'],
        message: '{VALUE} is not a valid booking status',
      },
      default: 'confirmed',
    },

    paymentStatus: {
      type: String,
      enum: ['not_required', 'pending', 'paid', 'failed'],
      default: 'not_required',
    },

    // Deadline after which a pending paid booking is considered expired and
    // the held seat is released by the payment cleanup cron. null for free
    // events and for bookings that have completed payment.
    paymentExpiry: {
      type: Date,
      default: null,
    },

    // Set when status changes to 'cancelled', so the cancellation-window
    // business rule and reporting can reference exactly when it happened.
    cancellationDate: {
      type: Date,
      default: null,
    },

    // prevents the hourly reminder cron from re-sending the same email all day
    reminderSent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// blocks double-booking even under concurrent requests — app-level checks alone can race
bookingSchema.index(
  { student: 1, event: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'confirmed' },
  }
);

bookingSchema.index({ event: 1 });
bookingSchema.index({ student: 1 });

bookingSchema.index({ status: 1, reminderSent: 1 }); // for the hourly reminder cron query
bookingSchema.index({ paymentStatus: 1, paymentExpiry: 1 }); // for the payment expiry cleanup cron

bookingSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model('Booking', bookingSchema);