const express = require('express');
const bcrypt = require('bcryptjs');
const { User } = require('../models');

const router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    if (password.length < 4) return res.status(400).json({ error: 'password too short' });
    const existing = await User.findOne({ where: { username } });
    if (existing) return res.status(409).json({ error: 'username taken' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, passwordHash });
    req.session.userId = user.id;
    res.status(201).json({ id: user.id, username: user.username });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const user = await User.findOne({ where: { username } });
    if (!user) return res.status(401).json({ error: 'invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    req.session.userId = user.id;
    res.json({ id: user.id, username: user.username });
  } catch (e) { next(e); }
});

router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('sid');
    res.json({ ok: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ id: req.user.id, username: req.user.username });
});

module.exports = router;
