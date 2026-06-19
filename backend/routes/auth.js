/**
 * routes/auth.js
 *
 * Four endpoints:
 *   POST   /api/auth/register  — create a new account
 *   POST   /api/auth/login     — log in, receive a JWT
 *   GET    /api/auth/me        — get the current user (token required)
 *   POST   /api/auth/logout    — log out (client deletes token)
 *
 * Mounted in server.js as: app.use('/api/auth', authRoutes)
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const User = require('../models/User');
const { protect } = require('../middleware/auth');

// ─── Helper: generate a JWT ───────────────────────────────────────────────────
// Extracted into a function so both register and login can use the same logic.
// The token payload contains the user's id and role — just enough for the
// protect middleware to identify and authorize them on subsequent requests.
// We deliberately keep sensitive data (email, name) out of the token payload.
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// ─── Helper: format user for response ────────────────────────────────────────
// Returns a clean user object safe to send to the frontend.
// Never includes the password, even if somehow selected.
const formatUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  studentID: user.studentID || null,
  organizationName: user.organizationName || null,
  registrationDate: user.registrationDate,
});

// ─── Validation rules ────────────────────────────────────────────────────────
// express-validator rules are just an array of checks. We define them once
// here and pass them as middleware in the route definitions below.
// They run before the route handler and collect errors into a result object
// that we check at the top of each handler with validationResult(req).

const registerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .matches(/@strathmore\.edu$/).withMessage('Email must be a @strathmore.edu address')
    .toLowerCase(),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),

  body('role')
    .notEmpty().withMessage('Role is required')
    .isIn(['student', 'organizer']).withMessage('Role must be either student or organizer'),

  // studentID is conditionally required — validated manually in the handler
  // because express-validator's conditional logic is more awkward than a simple if
  body('studentID').optional().trim(),

  body('organizationName').optional().trim(),
];

const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address'),

  body('password')
    .notEmpty().withMessage('Password is required'),
];

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', registerValidation, async (req, res) => {
  // 1. Check if validation rules above found any problems
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Return the first error message — cleaner than dumping the whole array
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  const { name, email, password, role, studentID, organizationName } = req.body;

  // 2. Conditional field validation
  if (role === 'student' && !studentID) {
    return res.status(400).json({ message: 'studentID is required for student accounts' });
  }
  if (role === 'organizer' && !organizationName) {
    return res.status(400).json({ message: 'organizationName is required for organizer accounts' });
  }

  try {
    // 3. Check for duplicate email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    // 4. Hash the password
    // bcrypt.hash(password, saltRounds) — saltRounds: 12 means bcrypt runs
    // the hashing function 2^12 = 4096 times, making brute-force very slow.
    // Higher = more secure but slower. 12 is the industry standard balance.
    const hashedPassword = await bcrypt.hash(password, 12);

    // 5. Create the user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      studentID: role === 'student' ? studentID : null,
      organizationName: role === 'organizer' ? organizationName : null,
    });

    // 6. Generate JWT
    const token = generateToken(user);

    // 7. Respond — 201 Created
    res.status(201).json({
      token,
      user: formatUser(user),
    });
  } catch (err) {
    // Mongoose duplicate key error (race condition — two simultaneous registrations
    // with the same email both pass the findOne check but the second hits the
    // unique index at the database level)
    if (err.code === 11000) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    // Mongoose validation errors (schema-level, e.g. the pre('validate') hook)
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: messages[0] });
    }

    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', loginValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  const { email, password } = req.body;

  try {
    // 1. Find user — note .select('+password').
    // In the User schema, password has `select: false` which means it's
    // NEVER returned in normal queries. Here we explicitly opt back in
    // because we need it for bcrypt comparison. Nowhere else do we do this.
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      // Use a vague message intentionally — don't tell attackers whether
      // the email exists or the password is wrong. Always the same message.
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // 2. Check if account is disabled
    if (user.isDisabled) {
      return res.status(403).json({
        message: 'This account has been disabled. Contact the administrator.',
      });
    }

    // 3. Compare submitted password against the stored hash
    // bcrypt.compare() hashes the plain text password the same way and
    // checks if the result matches the stored hash. Returns true/false.
    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // 4. Generate JWT and respond
    const token = generateToken(user);

    res.status(200).json({
      token,
      user: formatUser(user),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
// Protected — requires a valid JWT. The `protect` middleware runs first,
// verifies the token, and attaches the user to req.user before this
// handler runs. So all we need to do here is return req.user.
router.get('/me', protect, async (req, res) => {
  try {
    // req.user is already attached by the protect middleware.
    // We re-query here to get the absolute freshest data (in case the user
    // was updated between when they logged in and now).
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ user: formatUser(user) });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
// JWTs are stateless — the server doesn't store them, so there's nothing
// to "delete" server-side. The real logout happens on the frontend when it
// removes the token from localStorage/memory.
// This endpoint exists so the frontend has a consistent call to make,
// and as a hook for future token-blacklisting if needed.
router.post('/logout', protect, (req, res) => {
  res.status(200).json({ message: 'Logged out successfully' });
});

module.exports = router;