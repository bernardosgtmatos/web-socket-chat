const { User } = require('../models');

async function attachUser(req, res, next) {
  try {
    const userId = req.session && req.session.userId;
    if (userId) {
      const user = await User.findByPk(userId, { attributes: ['id', 'username', 'createdAt'] });
      req.user = user || null;
    } else {
      req.user = null;
    }
    next();
  } catch (e) {
    next(e);
  }
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

module.exports = { attachUser, requireAuth };
