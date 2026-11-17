const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const auth = require('../middleware/auth');
const { User } = require('../models');

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many attempts, try again in 15 minutes' } });

router.post('/login', loginLimiter, async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const password = String(req.body.password || '');
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: 'Wrong email or password' });
  }
  const token = jwt.sign({ id: user.id, email: user.email }, config.jwtSecret, { expiresIn: '7d' });
  res.json({ token, email: user.email });
});

router.get('/me', auth, (req, res) => res.json({ email: req.user.email }));

router.post('/password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || String(newPassword).length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters' });
  const user = await User.findById(req.user.id);
  if (!user || !(await bcrypt.compare(String(currentPassword || ''), user.passwordHash))) {
    return res.status(400).json({ message: 'Current password is wrong' });
  }
  user.passwordHash = await bcrypt.hash(String(newPassword), 12);
  await user.save();
  res.json({ ok: true });
});

module.exports = router;
