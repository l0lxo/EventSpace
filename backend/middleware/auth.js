/**
 * middleware/auth.js
 *
 * Two middleware functions that protect routes:
 *
 *   protect       — verifies the JWT token and attaches the user to req.user.
 *                   Use on any route that requires a logged-in user.
 *
 *   authorize     — checks that req.user has one of the allowed roles.
 *                   Always used AFTER protect, never alone.
 *
 * Usage in a route file:
 *
 *   const { protect, authorize } = require('../middleware/auth');
 *
 *   router.get('/my-events', protect, authorize('organizer'), handler);
 *   router.get('/analytics', protect, authorize('admin'), handler);
 *   router.get('/me',        protect, handler);  // any logged-in role
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * protect
 *
 * Reads the Authorization header, verifies the JWT, loads the matching
 * user from the database, and attaches them to req.user so route handlers
 * can access the current user without re-querying the DB themselves.
 *
 * Expected header format:
 *   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 */
const protect = async (req, res, next) => {
  let token;

  // Check the Authorization header exists and starts with "Bearer"
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    // Extract just the token part — everything after "Bearer "
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      message: 'Access denied. No token provided.',
    });
  }

  try {
    // jwt.verify() does two things at once:
    //   1. Checks the signature — was this token actually signed by us?
    //   2. Checks the expiry — has the token expired?
    // If either check fails it throws an error, caught below.
    // If both pass, it returns the payload we embedded when we created
    // the token (contains { id, role }).
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Load the full user from the database using the id from the token payload.
    // We do this (rather than just trusting the token payload) so that:
    //   - Disabled accounts are caught immediately (isDisabled check below)
    //   - Deleted accounts are caught immediately (null check below)
    //   - Role changes take effect immediately
    // .select('-password') means "give me everything EXCEPT the password field"
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        message: 'The account belonging to this token no longer exists.',
      });
    }

    if (user.isDisabled) {
      return res.status(403).json({
        message: 'This account has been disabled. Contact the administrator.',
      });
    }

    // Attach the user object to the request so every subsequent middleware
    // and route handler in this request chain can access it as req.user
    req.user = user;

    // Call next() to pass control to the next middleware or route handler.
    // Without this, the request hangs forever.
    next();
  } catch (err) {
    // jwt.verify() throws JsonWebTokenError for invalid signatures
    // and TokenExpiredError for expired tokens — both caught here.
    return res.status(401).json({
      message: 'Invalid or expired token. Please log in again.',
    });
  }
};

/**
 * authorize(...roles)
 *
 * A function that RETURNS a middleware function. This pattern lets you
 * pass arguments to middleware, which Express doesn't support directly.
 *
 * authorize('admin')              → only admins
 * authorize('organizer', 'admin') → organizers OR admins
 *
 * Always chain this after protect:
 *   router.post('/events', protect, authorize('organizer'), createEvent);
 *
 * By the time authorize runs, protect has already confirmed the token is
 * valid and attached req.user — so we can safely read req.user.role.
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. This action requires one of these roles: ${roles.join(', ')}. Your role: ${req.user.role}.`,
      });
    }
    next();
  };
};

module.exports = { protect, authorize };