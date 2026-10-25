const express = require('express');
const { Room, RoomMember } = require('../models');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const rooms = await Room.findAll({ order: [['createdAt', 'DESC']] });
    const memberships = await RoomMember.findAll({ where: { userId: req.user.id } });
    const memberSet = new Set(memberships.map((m) => m.roomId));
    res.json(rooms.map((r) => ({
      id: r.id, name: r.name, isPrivate: r.isPrivate, createdBy: r.createdBy,
      createdAt: r.createdAt, isMember: memberSet.has(r.id),
    })));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, isPrivate } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const room = await Room.create({ name, isPrivate: !!isPrivate, createdBy: req.user.id });
    await RoomMember.create({ roomId: room.id, userId: req.user.id });
    res.status(201).json({ id: room.id, name: room.name, isPrivate: room.isPrivate, createdBy: room.createdBy, isMember: true });
  } catch (e) { next(e); }
});

router.post('/:id/join', async (req, res, next) => {
  try {
    const room = await Room.findByPk(req.params.id);
    if (!room) return res.status(404).json({ error: 'room not found' });
    if (room.isPrivate) return res.status(403).json({ error: 'private room' });
    const [m, created] = await RoomMember.findOrCreate({ where: { roomId: room.id, userId: req.user.id }, defaults: { joinedAt: new Date() } });
    res.json({ ok: true, joined: created });
  } catch (e) { next(e); }
});

module.exports = router;
