const jwt = require('jsonwebtoken');
const config = require('../config');

module.exports = function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Not signed in' });
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    res.status(401).json({ message: 'Session expired, please sign in again' });
  }
};
