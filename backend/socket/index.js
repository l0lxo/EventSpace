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

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        // public browsing still needs capacity_updated broadcasts, so let anonymous
        // sockets through — they just won't get personal notifications
        socket.user = null;
        return next();
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

      if (!user || user.isDisabled) {
        socket.user = null;
        return next();
      }

      socket.user = user;
      next();
    } catch (err) {
      // stale/invalid token — treat as anonymous rather than rejecting the connection
      socket.user = null;
      next();
    }
  });

  io.on('connection', (socket) => {
    console.log(
      `Socket connected: ${socket.id}${socket.user ? ` (user: ${socket.user.email})` : ' (anonymous)'}`
    );

    if (socket.user) {
      socket.join(`user:${socket.user._id}`); // utils/notify.js emits to this room
    }

    socket.on('join_event_room', ({ eventId }) => {
      if (!eventId) return;
      socket.join(`room:${eventId}`);
      console.log(`Socket ${socket.id} joined room:${eventId}`);
    });

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
