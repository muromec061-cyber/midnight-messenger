const crypto = require('crypto');
const jwt = require('jsonwebtoken');

function resolveSecret() {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.trim()) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  // Dev fallback: ephemeral per-process secret (tokens do not survive restart,
  // and the value is not guessable from source).
  const ephemeral = crypto.randomBytes(32).toString('hex');
  console.warn('[auth] JWT_SECRET not set — using a random ephemeral secret for this process.');
  return ephemeral;
}

const JWT_SECRET = resolveSecret();
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
