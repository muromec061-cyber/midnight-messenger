const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { sign, verify, extractToken } = require('../lib/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'midnight-messenger-dev-secret-change-me';

test('sign() returns a token carrying uid and uname claims', () => {
  const token = sign({ id: 'u1', username: 'alice' });
  assert.equal(typeof token, 'string');
  const decoded = jwt.verify(token, JWT_SECRET);
  assert.equal(decoded.uid, 'u1');
  assert.equal(decoded.uname, 'alice');
});

test('sign() sets a 30-day expiry', () => {
  const token = sign({ id: 'u1', username: 'alice' });
  const decoded = jwt.verify(token, JWT_SECRET);
  const thirtyDays = 30 * 24 * 60 * 60;
  assert.equal(decoded.exp - decoded.iat, thirtyDays);
});

test('verify() round-trips a token produced by sign()', () => {
  const token = sign({ id: 'abc', username: 'bob' });
  const payload = verify(token);
  assert.ok(payload);
  assert.equal(payload.uid, 'abc');
  assert.equal(payload.uname, 'bob');
});

test('verify() returns null for a null/empty token', () => {
  assert.equal(verify(null), null);
  assert.equal(verify(undefined), null);
  assert.equal(verify(''), null);
});

test('verify() returns null for a malformed token', () => {
  assert.equal(verify('not-a-jwt'), null);
});

test('verify() returns null for a token signed with a different secret', () => {
  const foreign = jwt.sign({ uid: 'x' }, 'some-other-secret');
  assert.equal(verify(foreign), null);
});

test('verify() returns null for an expired token', () => {
  const expired = jwt.sign({ uid: 'x' }, JWT_SECRET, { expiresIn: -10 });
  assert.equal(verify(expired), null);
});

test('extractToken() reads a Bearer token from the Authorization header', () => {
  assert.equal(extractToken({ headers: { authorization: 'Bearer tok123' } }), 'tok123');
});

test('extractToken() reads a capitalized Authorization header', () => {
  assert.equal(extractToken({ headers: { Authorization: 'Bearer tokABC' } }), 'tokABC');
});

test('extractToken() falls back to the query token', () => {
  assert.equal(extractToken({ headers: {}, query: { token: 'qtok' } }), 'qtok');
});

test('extractToken() prefers the Bearer header over the query token', () => {
  const req = { headers: { authorization: 'Bearer header-tok' }, query: { token: 'query-tok' } };
  assert.equal(extractToken(req), 'header-tok');
});

test('extractToken() returns null when no token is present', () => {
  assert.equal(extractToken({ headers: {} }), null);
  assert.equal(extractToken({ headers: {}, query: {} }), null);
});

test('extractToken() ignores a non-Bearer Authorization scheme', () => {
  assert.equal(extractToken({ headers: { authorization: 'Basic abc123' } }), null);
});
