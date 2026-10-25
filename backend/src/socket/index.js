const { Server } = require('socket.io');
const { User, Room, Message, RoomMember } = require('../models');

function setupSocket(server, sessionMiddleware) {
  const io = new Server(server, {
    cors: { origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true },
  });

  io.use((socket, next) => sessionMiddleware(socket.request, {}, next));
  io.use(async (socket, next) => {
    try {
      const userId = socket.request.session && socket.request.session.userId;
      if (!userId) return next(new Error('Unauthorized'));
      const user = await User.findByPk(userId, { attributes: ['id', 'username'] });
      if (!user) return next(new Error('Unauthorized'));
      socket.user = { id: user.id, username: user.username };
      socket.data.joinedRooms = new Set();
      next();
    } catch (e) { next(e); }
  });

  io.on('connection', (socket) => {
    socket.on('room:join', async ({ roomId } = {}) => {
      try {
        const membership = await RoomMember.findOne({ where: { roomId, userId: socket.user.id } });
        if (!membership) { socket.emit('error', { message: 'not a member' }); return; }
        await socket.join(roomId);
        socket.data.joinedRooms.add(roomId);
        const msgs = await Message.findAll({
          where: { roomId },
          order: [['createdAt', 'DESC']],
          limit: 50,
          include: [{ model: User, as: 'author', attributes: ['username'] }],
        });
        const history = msgs.reverse().map((m) => ({
          id: m.id, roomId: m.roomId, userId: m.userId,
          username: m.author ? m.author.username : null,
          text: m.text, createdAt: m.createdAt,
        }));
        socket.emit('room:history', { roomId, messages: history });
        socket.to(roomId).emit('user:joined', { roomId, username: socket.user.username });
      } catch (e) {
        socket.emit('error', { message: e.message });
      }
    });

    socket.on('room:leave', async ({ roomId } = {}) => {
      try {
        socket.leave(roomId);
        socket.data.joinedRooms.delete(roomId);
        socket.to(roomId).emit('user:left', { roomId, username: socket.user.username });
      } catch (e) {
        socket.emit('error', { message: e.message });
      }
    });

    socket.on('message:send', async ({ roomId, text } = {}) => {
      try {
        if (!text || !text.trim()) return;
        const membership = await RoomMember.findOne({ where: { roomId, userId: socket.user.id } });
        if (!membership) { socket.emit('error', { message: 'not a member' }); return; }
        const msg = await Message.create({ roomId, userId: socket.user.id, text: text.trim() });
        io.to(roomId).emit('message:new', {
          id: msg.id, roomId: msg.roomId, userId: msg.userId,
          username: socket.user.username, text: msg.text, createdAt: msg.createdAt,
        });
      } catch (e) {
        socket.emit('error', { message: e.message });
      }
    });

    socket.on('typing', ({ roomId, isTyping } = {}) => {
      socket.to(roomId).emit('typing', { roomId, username: socket.user.username, isTyping: !!isTyping });
    });

    socket.on('disconnect', () => {
      for (const roomId of socket.data.joinedRooms) {
        socket.to(roomId).emit('user:left', { roomId, username: socket.user.username });
      }
    });
  });

  return io;
}

module.exports = setupSocket;
