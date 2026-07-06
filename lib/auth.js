const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'midnight-messenger-dev-secret-change-me';
const JWT_TTL = '30d';

function sign(user) {
  return jwt.sign({ uid: user.id, uname: user.username }, JWT_SECRET, { expiresIn: JWT_TTL });
}

function verify(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

function extractToken(req) {
  const h = req.headers.authorization || req.headers.Authorization;
  if (h && h.startsWith('Bearer ')) return h.slice(7);
  if (req.query && req.query.token) return req.query.token;
  return null;
}

module.exports = { sign, verify, extractToken };
