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
      // Enforces @strathmore.edu domain restriction at the schema level.
      // This is a backstop — the real validation also happens in the
      // register route via express-validator, but defense in depth matters.
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

    // Required only when role === 'student'. Enforced in a pre-validate
    // hook below rather than a hardcoded `required: true`, since this
    // field is conditional on role.
    studentID: {
      type: String,
      trim: true,
      default: null,
    },

    // Required only when role === 'organizer' (e.g. "Strathmore Drama Club")
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

// Conditional field requirements based on role.
// Mongoose doesn't support "required if another field equals X" natively
// in a clean way, so this hook enforces it before validation runs.
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
