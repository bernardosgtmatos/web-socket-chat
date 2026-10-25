const { Server } = require('socket.io');
const { User, Room, Message, RoomMember } = require('../models');

async function isMember(roomId, userId) {
  const membership = await RoomMember.findOne({ where: { roomId, userId } });
  return !!membership;
}

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
      socket.data.user = socket.user;
      socket.data.joinedRooms = new Set();
      socket.data.callRooms = new Set();
      next();
    } catch (e) { next(e); }
  });

  async function socketsInRoom(roomName) {
    try {
      const nsp = io.in(roomName);
      if (nsp && typeof nsp.fetchSockets === 'function') {
        const sockets = await nsp.fetchSockets();
        if (Array.isArray(sockets)) return sockets;
      }
    } catch (e) {}
    const rooms = io && io.sockets && io.sockets.adapter && io.sockets.adapter.rooms;
    const room = rooms instanceof Map ? rooms.get(roomName) : (rooms ? rooms[roomName] : null);
    if (room) {
      const store = io.sockets.sockets;
      return [...room].map((id) => {
        if (store instanceof Map) return store.get(id);
        if (store && typeof store.get === 'function') return store.get(id);
        return store ? store[id] : null;
      }).filter(Boolean);
    }
    return [];
  }

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

    socket.on('call:join', async ({ roomId } = {}) => {
      try {
        if (!roomId) return;
        if (!(await isMember(roomId, socket.user.id))) { socket.emit('error', { message: 'not a member' }); return; }
        if (socket.data.callRooms.has(roomId)) return;
        const roomName = `call:${roomId}`;
        const existing = await socketsInRoom(roomName);
        const participants = existing.map((s) => {
          const u = (s && s.user) || (s && s.data && s.data.user) || {};
          return { userId: u.id, username: u.username, socketId: s.id };
        });
        socket.emit('call:participants', { roomId, participants });
        await socket.join(roomName);
        socket.data.callRooms.add(roomId);
        socket.to(roomName).emit('call:user-joined', { roomId, userId: socket.user.id, username: socket.user.username, socketId: socket.id });
      } catch (e) {
        socket.emit('error', { message: e.message });
      }
    });

    socket.on('call:leave', async ({ roomId } = {}) => {
      try {
        if (!roomId || !socket.data.callRooms.has(roomId)) return;
        const roomName = `call:${roomId}`;
        await socket.leave(roomName);
        socket.data.callRooms.delete(roomId);
        socket.to(roomName).emit('call:user-left', { roomId, socketId: socket.id, userId: socket.user.id });
      } catch (e) {
        socket.emit('error', { message: e.message });
      }
    });

    async function handleSignal(event, { roomId, to, ...rest } = {}) {
      try {
        if (!(await isMember(roomId, socket.user.id))) { socket.emit('error', { message: 'not a member' }); return; }
        io.to(to).emit(event, { from: socket.id, fromUserId: socket.user.id, ...rest });
      } catch (e) {
        socket.emit('error', { message: e.message });
      }
    }

    socket.on('webrtc:offer', (payload) => handleSignal('webrtc:offer', payload));
    socket.on('webrtc:answer', (payload) => handleSignal('webrtc:answer', payload));
    socket.on('webrtc:ice', (payload) => handleSignal('webrtc:ice', payload));

    socket.on('screen:start', async ({ roomId } = {}) => {
      try {
        if (!(await isMember(roomId, socket.user.id))) { socket.emit('error', { message: 'not a member' }); return; }
        if (!socket.data.callRooms.has(roomId)) { socket.emit('error', { message: 'not in call' }); return; }
        const roomName = `call:${roomId}`;
        socket.to(roomName).emit('screen:started', { roomId, socketId: socket.id, userId: socket.user.id, username: socket.user.username });
      } catch (e) {
        socket.emit('error', { message: e.message });
      }
    });

    socket.on('screen:stop', ({ roomId } = {}) => {
      try {
        if (!roomId) return;
        const roomName = `call:${roomId}`;
        socket.to(roomName).emit('screen:stopped', { roomId, socketId: socket.id });
      } catch (e) {
        socket.emit('error', { message: e.message });
      }
    });

    socket.on('call:mute', ({ roomId, muted } = {}) => {
      try {
        if (!roomId) return;
        const roomName = `call:${roomId}`;
        socket.to(roomName).emit('call:muted', { roomId, socketId: socket.id, muted });
      } catch (e) {
        socket.emit('error', { message: e.message });
      }
    });

    socket.on('disconnect', () => {
      for (const roomId of socket.data.joinedRooms) {
        socket.to(roomId).emit('user:left', { roomId, username: socket.user.username });
      }
      for (const roomId of socket.data.callRooms) {
        socket.to(`call:${roomId}`).emit('call:user-left', { roomId, socketId: socket.id, userId: socket.user.id });
      }
    });
  });

  return io;
}

setupSocket.isMember = isMember;
module.exports = setupSocket;
