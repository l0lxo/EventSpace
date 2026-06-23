const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      // backstop — register route also validates this via express-validator
      match: [
        /^[a-zA-Z0-9._%+-]+@strathmore\.edu$/,
        'Email must be a valid @strathmore.edu address',
      ],
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never returned in queries unless explicitly requested
    },

    role: {
      type: String,
      enum: {
        values: ['student', 'organizer', 'admin'],
        message: '{VALUE} is not a valid role',
      },
      required: [true, 'Role is required'],
      default: 'student',
    },

    // required only for students — enforced in the pre-validate hook below
    studentID: {
      type: String,
      trim: true,
      default: null,
    },

    // required only for organizers (e.g. "Strathmore Drama Club")
    organizationName: {
      type: String,
      trim: true,
      default: null,
    },

    registrationDate: {
      type: Date,
      default: Date.now,
    },

    // Supports admin "disable user" function without losing historical data
    isDisabled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // adds createdAt / updatedAt automatically
  }
);

// mongoose has no clean "required if role === X" built in, so enforce it here
userSchema.pre('validate', function () {
  if (this.role === 'student' && !this.studentID) {
    this.invalidate('studentID', 'studentID is required for student accounts');
  }
  if (this.role === 'organizer' && !this.organizationName) {
    this.invalidate(
      'organizationName',
      'organizationName is required for organizer accounts'
    );
  }
});

// Virtual "id" field so frontend gets a clean `id` instead of `_id`
userSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.password; // extra safety even if select:false is bypassed
  },
});

userSchema.index({ email: 1 });
userSchema.index({ role: 1 });

module.exports = mongoose.model('User', userSchema);
