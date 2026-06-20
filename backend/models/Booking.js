const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    // Named `student` here (referencing User) rather than `studentID` as a
    // raw string, since we need a real relational reference for .populate()
    // when building participant lists and booking history. The spec's
    // "studentID" field on the Booking collection is satisfied by this ref.
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
        values: ['confirmed', 'cancelled'],
        message: '{VALUE} is not a valid booking status',
      },
      default: 'confirmed',
    },

    // Set when status changes to 'cancelled', so the cancellation-window
    // business rule and reporting can reference exactly when it happened.
    cancellationDate: {
      type: Date,
      default: null,
    },

    // Tracks whether the 24-hour reminder email has already been sent for
    // this booking. Without this flag, the cron job (which runs every
    // hour) would re-send the same reminder repeatedly throughout the
    // entire 24-hour window leading up to the event, instead of exactly once.
    reminderSent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Prevents the same student from booking the same event twice while a
// 'confirmed' booking already exists. Implemented as a compound index
// rather than purely application-level logic, so it holds even under
// concurrent requests (closes the race condition the API route alone
// can't fully guard against).
bookingSchema.index(
  { student: 1, event: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'confirmed' },
  }
);

bookingSchema.index({ event: 1 });
bookingSchema.index({ student: 1 });

// Supports the reminder cron job's query: "confirmed bookings that haven't
// had a reminder sent yet" — run every hour, forever, so this needs to be fast.
bookingSchema.index({ status: 1, reminderSent: 1 });

bookingSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model('Booking', bookingSchema);