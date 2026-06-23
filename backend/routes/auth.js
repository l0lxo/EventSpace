const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const User = require('../models/User');
const { protect } = require('../middleware/auth');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

const formatUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  studentID: user.studentID || null,
  organizationName: user.organizationName || null,
  registrationDate: user.registrationDate,
});

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

  // studentID/organizationName are conditionally required based on role — checked in the handler
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

router.post('/register', registerValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  const { name, email, password, role, studentID, organizationName } = req.body;

  if (role === 'student' && !studentID) {
    return res.status(400).json({ message: 'studentID is required for student accounts' });
  }
  if (role === 'organizer' && !organizationName) {
    return res.status(400).json({ message: 'organizationName is required for organizer accounts' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      studentID: role === 'student' ? studentID : null,
      organizationName: role === 'organizer' ? organizationName : null,
    });

    const token = generateToken(user);

    res.status(201).json({
      token,
      user: formatUser(user),
    });
  } catch (err) {
    // two simultaneous registrations can both pass the findOne check above and
    // race to the unique index — catch it here too
    if (err.code === 11000) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: messages[0] });
    }

    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

router.post('/login', loginValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      // same message either way — don't reveal whether the email exists
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.isDisabled) {
      return res.status(403).json({
        message: 'This account has been disabled. Contact the administrator.',
      });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

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

router.get('/me', protect, async (req, res) => {
  try {
    // re-query rather than trusting req.user, in case the account changed since login
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

// JWTs are stateless — nothing to invalidate server-side, the frontend just drops the token.
// This endpoint exists for a consistent client call and as a hook for future blacklisting.
router.post('/logout', protect, (req, res) => {
  res.status(200).json({ message: 'Logged out successfully' });
});

module.exports = router;
