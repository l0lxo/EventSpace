/**
 * socket/index.js
 *
 * All Socket.io connection logic lives here instead of inline in server.js.
 * This file exports a single function that takes the httpServer and
 * returns a configured `io` instance.
 *
 * WHY AUTHENTICATE SOCKETS AT ALL?
 * Without this, anyone could open a websocket connection and call
 * `join_event_room` for any event, or worse, we'd have no way to know
 * WHICH user is connected — which we need for the personal notification
 * room (`user:${userId}`) that utils/notify.js relies on.
 *
 * HOW THE AUTH WORKS:
 * The frontend passes the same JWT it uses for REST requests, but through
 * the socket handshake instead of a header. Socket.io's `auth` option on
 * the client maps to `socket.handshake.auth` on the server. We verify it
 * with the exact same jwt.verify() logic as the REST `protect` middleware.
 *
 * Frontend connects like this:
 *   import { io } from 'socket.io-client';
 *   const socket = io(import.meta.env.VITE_SOCKET_URL, {
 *     auth: { token: localStorage.getItem('token') }
 *   });
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ['GET', 'POST'],
    },
  });

  // ─── Socket-level authentication middleware ────────────────────────────
  // Runs once, when a client first attempts to connect — before the
  // 'connection' event fires below. If we call next(new Error(...)), the
  // connection is rejected and the client receives a 'connect_error' event.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        // We deliberately allow unauthenticated connections through rather
        // than rejecting them outright — public pages (like browsing
        // approved events) still need capacity_updated broadcasts, and
        // those don't require login. We just won't have a user identity
        // attached for these sockets, so personal notifications won't reach them.
        socket.user = null;
        return next();
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

      if (!user || user.isDisabled) {
        socket.user = null;
        return next();
      }

      // Attach the user to the socket itself, same pattern as req.user
      // in the REST middleware — available in every event handler below
      // via socket.user.
      socket.user = user;
      next();
    } catch (err) {
      // Invalid/expired token — treat as anonymous rather than hard-rejecting,
      // since a stale token shouldn't break public event browsing.
      socket.user = null;
      next();
    }
  });

  // ─── Connection handling ─────────────────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(
      `Socket connected: ${socket.id}${socket.user ? ` (user: ${socket.user.email})` : ' (anonymous)'}`
    );

    // If this socket belongs to a logged-in user, join their personal
    // notification room immediately. utils/notify.js emits to
    // `user:${userId}` — this is the other half of that connection.
    if (socket.user) {
      socket.join(`user:${socket.user._id}`);
    }

    // ── join_event_room ───────────────────────────────────────────────────
    // Client → Server. Fired when a student opens an event's detail page.
    // Subscribes this socket to capacity_updated and event_status_changed
    // broadcasts for that specific event only.
    socket.on('join_event_room', ({ eventId }) => {
      if (!eventId) return;
      socket.join(`room:${eventId}`);
      console.log(`Socket ${socket.id} joined room:${eventId}`);
    });

    // ── leave_event_room ──────────────────────────────────────────────────
    // Client → Server. Fired when the student navigates away from that page.
    socket.on('leave_event_room', ({ eventId }) => {
      if (!eventId) return;
      socket.leave(`room:${eventId}`);
      console.log(`Socket ${socket.id} left room:${eventId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

module.exports = initSocket;