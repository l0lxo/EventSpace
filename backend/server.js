/**
 * server.js — the entry point for the entire backend.
 *
 * This file does four things, in this order:
 *   1. Loads environment variables from .env
 *   2. Creates the Express app and attaches all middleware
 *   3. Mounts all route files onto the app
 *   4. Connects to MongoDB, then starts listening for requests
 *
 * You should rarely need to edit this file after today. New features
 * get added by creating new route files and mounting them here.
 */

// ─── 1. Environment variables ────────────────────────────────────────────────
// Must be the very first thing — everything below may depend on process.env
require('dotenv').config();

// ─── 2. Core imports ─────────────────────────────────────────────────────────
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');

// ─── 3. Route imports ────────────────────────────────────────────────────────
// Each of these files handles one "section" of the API.
// We'll uncomment them as we build each file — for now only auth exists.
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
// const bookingRoutes      = require('./routes/bookings');
// const adminRoutes        = require('./routes/admin');
// const notificationRoutes = require('./routes/notifications');

// ─── 4. App + HTTP server setup ──────────────────────────────────────────────
const app = express();

// Socket.io needs a raw Node HTTP server, not the Express app directly.
// We wrap Express in one so both can share the same port.
const httpServer = createServer(app);

// ─── 5. Socket.io setup ──────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ['GET', 'POST'],
  },
});

// Make `io` available inside route handlers without importing it everywhere.
// Usage inside any route file: req.app.get('io').emit(...)
app.set('io', io);

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Student opens an event detail page → subscribe them to that event's room.
  // Any server emit to `room:${eventId}` will reach only clients in that room.
  socket.on('join_event_room', ({ eventId }) => {
    socket.join(`room:${eventId}`);
    console.log(`Socket ${socket.id} joined room:${eventId}`);
  });

  // Student navigates away from the event page → unsubscribe.
  socket.on('leave_event_room', ({ eventId }) => {
    socket.leave(`room:${eventId}`);
    console.log(`Socket ${socket.id} left room:${eventId}`);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// ─── 6. Security middleware ───────────────────────────────────────────────────
// helmet() sets ~15 HTTP security headers automatically (prevents clickjacking,
// XSS, sniffing attacks, etc.). Call it first, before any routes.
app.use(helmet());

// CORS — tells browsers which frontend URL is allowed to talk to this API.
// Without this, the browser blocks requests from localhost:5173 to localhost:5000.
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true, // allows cookies/auth headers to be sent cross-origin
  })
);

// ─── 7. Request logging ───────────────────────────────────────────────────────
// morgan('dev') prints a one-line summary of every request to your terminal:
//   POST /api/auth/login 200 42ms
// Invaluable while building — you can see every request and its status code.
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── 8. Body parsing ─────────────────────────────────────────────────────────
// Without these two lines, req.body is always undefined.
// express.json()        → parses requests with Content-Type: application/json
// express.urlencoded()  → parses HTML form submissions (less common in APIs)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── 9. Rate limiting ────────────────────────────────────────────────────────
// Applies to ALL routes. Caps each IP at 100 requests per 15 minutes.
// This is a broad baseline — the auth route applies its own tighter limit.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { message: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Tighter limiter specifically for auth endpoints — prevents brute-force
// password attacks by limiting to 20 attempts per 15 minutes per IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── 10. Health check route ───────────────────────────────────────────────────
// A simple GET / that returns 200. Useful for confirming the server is up
// before testing anything else in Postman.
app.get('/', (req, res) => {
  res.json({
    message: 'Strathmore Events API is running',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ─── 11. API routes ───────────────────────────────────────────────────────────
// The second argument to app.use() is the "prefix" — all routes defined
// inside routes/auth.js will automatically start with /api/auth.
// e.g. a route defined as router.post('/login') becomes POST /api/auth/login
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/events', eventRoutes);
// app.use('/api/bookings',      bookingRoutes);
// app.use('/api/admin',         adminRoutes);
// app.use('/api/notifications', notificationRoutes);

// ─── 12. 404 handler ─────────────────────────────────────────────────────────
// Catches any request that didn't match a route above.
// Must come AFTER all routes.
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found` });
});

// ─── 13. Global error handler ────────────────────────────────────────────────
// Express calls this automatically whenever a route calls next(error) or
// throws inside an async handler. The four parameters (err, req, res, next)
// are what tell Express this is an error handler, not a regular middleware.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  // Mongoose validation error — e.g. required field missing, enum violated
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: messages.join(', ') });
  }

  // Mongoose duplicate key error — e.g. email already registered
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({ message: `${field} already exists` });
  }

  // JWT errors — malformed or expired token
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ message: 'Invalid token' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'Token has expired' });
  }

  // Everything else — don't leak internal error details in production
  res.status(err.statusCode || 500).json({
    message:
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message,
  });
});

// ─── 14. Database connection + server start ───────────────────────────────────
// We only start listening for HTTP requests AFTER the database is connected.
// If MongoDB fails, the server doesn't start — better than starting and
// silently failing on every DB operation.
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected successfully');
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
      console.log(`Health check: http://localhost:${PORT}/`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1); // crash immediately rather than running without a database
  });