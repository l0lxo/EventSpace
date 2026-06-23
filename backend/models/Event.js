const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [150, "Title cannot exceed 150 characters"],
    },

    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: [3000, "Description cannot exceed 3000 characters"],
    },

    // Stored as a real Date so we can reliably compare against the
    // 14-day advance notice rule and sort chronologically.
    date: {
      type: Date,
      required: [true, "Event date is required"],
      validate: {
        validator: function (value) {
          // Only enforce on NEW events. Admins editing an already-approved
          // event shouldn't be blocked by this rule retroactively.
          if (!this.isNew) return true;

          const fourteenDaysFromNow = new Date();
          fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);
          return value >= fourteenDaysFromNow;
        },
        message: "Event date must be at least 14 days from today",
      },
    },

    // Stored separately from `date` as a simple "HH:MM" string since the
    // contract treats date and time as distinct fields for display purposes.
    time: {
      type: String,
      required: [true, "Event time is required"],
      match: [
        /^([01]\d|2[0-3]):([0-5]\d)$/,
        "Time must be in HH:MM 24-hour format",
      ],
    },

    location: {
      type: String,
      required: [true, "Location is required"],
      trim: true,
    },

    capacity: {
      type: Number,
      required: [true, "Capacity is required"],
      min: [1, "Capacity must be at least 1"],
      validate: {
        validator: Number.isInteger,
        message: "Capacity must be a whole number",
      },
    },

    // Tracked separately rather than computed from Booking documents on
    // every read, so capacity checks and Socket.io updates are fast and
    // atomic (see booking route: $inc operations).
    currentBookings: {
      type: Number,
      default: 0,
      min: 0,
    },

    category: {
      type: String,
      required: [true, "Category is required"],
      enum: {
        values: [
          "Technology",
          "Sports",
          "Cultural",
          "Academic",
          "Social",
          "Career",
          "Religious",
          "Other",
        ],
        message: "{VALUE} is not a valid category",
      },
    },

    status: {
      type: String,
      enum: {
        values: [
          "pending",
          "approved",
          "rejected",
          "modification_requested",
          "cancelled",
        ],
        message: "{VALUE} is not a valid status",
      },
      default: "pending",
    },

    fundingRequest: {
      requested: { type: Boolean, default: false },
      budget: {
        type: Number,
        min: [0, "Budget cannot be negative"],
        default: null,
      },
      justification: {
        type: String,
        trim: true,
        maxlength: [1000, "Justification cannot exceed 1000 characters"],
        default: null,
      },
    },

    externalGuests: {
      requested: { type: Boolean, default: false },
      reason: {
        type: String,
        trim: true,
        maxlength: [1000, "Reason cannot exceed 1000 characters"],
        default: null,
      },
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    createdDate: {
      type: Date,
      default: Date.now,
    },

    // Populated by admin when status is 'rejected' or 'modification_requested'
    feedback: {
      type: String,
      trim: true,
      default: null,
    },

    // Computed once on creation/review so the admin route doesn't need to
    // recalculate "following Wednesday" logic on every list fetch.
    reviewDeadline: {
      type: Date,
      default: null,
    },

    // Admin moderation flag (separate from status — a flagged event can
    // still be 'approved' while under review for content concerns)
    isFlagged: {
      type: Boolean,
      default: false,
    },
    flagReason: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// events must be reviewed by the FOLLOWING Wednesday, not this week's
eventSchema.pre('save', function () {
  if (this.isNew && !this.reviewDeadline) {
    const createdAt = this.createdDate || new Date();
    const dayOfWeek = createdAt.getDay(); // 0 = Sunday, 3 = Wednesday
    const daysUntilNextWednesday = ((3 - dayOfWeek + 7) % 7) + 7;

    const deadline = new Date(createdAt);
    deadline.setDate(createdAt.getDate() + daysUntilNextWednesday);
    deadline.setHours(23, 59, 59, 999);
 
    this.reviewDeadline = deadline;
  }
});

eventSchema.virtual("seatsRemaining").get(function () {
  return Math.max(this.capacity - this.currentBookings, 0);
});

eventSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});

// Supports the GET /api/events query params: search, category, date range
eventSchema.index({ title: "text", description: "text" });
eventSchema.index({ category: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ date: 1 });
eventSchema.index({ createdBy: 1 });

module.exports = mongoose.model("Event", eventSchema);
