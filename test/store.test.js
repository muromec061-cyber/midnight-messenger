const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Store = require('../lib/store');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILES = ['users.json', 'messages.json', 'conversations.json', 'sessions.json']
  .map(f => path.join(DATA_DIR, f));

// Snapshot any pre-existing data files so real dev data is never destroyed,
// then restore them (or remove test-created files) afterwards.
const snapshot = new Map();

test.before(() => {
  for (const file of FILES) {
    snapshot.set(file, fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);
  }
});

test.after(() => {
  for (const file of FILES) {
    const original = snapshot.get(file);
    if (original === null) {
      if (fs.existsSync(file)) fs.rmSync(file);
    } else {
      fs.writeFileSync(file, original);
    }
  }
});

test('getUsers() returns an empty array when the file is missing', () => {
  if (fs.existsSync(FILES[0])) fs.rmSync(FILES[0]);
  assert.deepEqual(Store.getUsers(), []);
});

test('getMessages() returns [] for an empty (whitespace-only) file', () => {
  fs.writeFileSync(FILES[1], '   \n');
  assert.deepEqual(Store.getMessages(), []);
});

test('getConversations() returns [] and does not throw on invalid JSON', () => {
  fs.writeFileSync(FILES[2], '{not valid json');
  assert.deepEqual(Store.getConversations(), []);
});

test('saveUsers()/getUsers() round-trips data through disk', () => {
  const users = [{ id: 'a', username: 'Alice' }, { id: 'b', username: 'Bob' }];
  Store.saveUsers(users);
  assert.deepEqual(Store.getUsers(), users);
});

test('saveUsers() writes pretty-printed JSON', () => {
  Store.saveUsers([{ id: 'a' }]);
  const raw = fs.readFileSync(FILES[0], 'utf8');
  assert.ok(raw.includes('\n  '), 'expected 2-space indentation');
});

test('findUserById() finds a user by id and returns undefined when absent', () => {
  Store.saveUsers([{ id: 'a', username: 'Alice' }, { id: 'b', username: 'Bob' }]);
  assert.equal(Store.findUserById('b').username, 'Bob');
  assert.equal(Store.findUserById('missing'), undefined);
});

test('findUserByUsername() matches case-insensitively', () => {
  Store.saveUsers([{ id: 'a', username: 'Alice' }]);
  assert.equal(Store.findUserByUsername('alice').id, 'a');
  assert.equal(Store.findUserByUsername('ALICE').id, 'a');
});

test('findUserByUsername() returns null for a falsy username', () => {
  Store.saveUsers([{ id: 'a', username: 'Alice' }]);
  assert.equal(Store.findUserByUsername(''), null);
  assert.equal(Store.findUserByUsername(null), null);
  assert.equal(Store.findUserByUsername(undefined), null);
});

test('findUserByUsername() returns undefined when no user matches', () => {
  Store.saveUsers([{ id: 'a', username: 'Alice' }]);
  assert.equal(Store.findUserByUsername('nobody'), undefined);
});

test('saveMessages()/getMessages() round-trips data', () => {
  const msgs = [{ id: 'm1', content: 'hi' }];
  Store.saveMessages(msgs);
  assert.deepEqual(Store.getMessages(), msgs);
});

test('saveConversations()/getConversations() round-trips data', () => {
  const convs = [{ id: 'dm:a_b', members: ['a', 'b'] }];
  Store.saveConversations(convs);
  assert.deepEqual(Store.getConversations(), convs);
});

test('saveSessions()/getSessions() round-trips data', () => {
  const sessions = [{ userId: 'a', socket: 's1' }];
  Store.saveSessions(sessions);
  assert.deepEqual(Store.getSessions(), sessions);
});
