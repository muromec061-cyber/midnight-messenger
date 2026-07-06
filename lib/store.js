// Simple JSON-file storage layer.
// In production replace with SQLite/Postgres/Mongo — interface is small.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILES = {
  users: path.join(DATA_DIR, 'users.json'),
  messages: path.join(DATA_DIR, 'messages.json'),
  conversations: path.join(DATA_DIR, 'conversations.json'),
  sessions: path.join(DATA_DIR, 'sessions.json'),
};

function readJSON(file) {
  try {
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw.trim()) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('readJSON error', file, e.message);
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const Store = {
  // Users
  getUsers() { return readJSON(FILES.users); },
  saveUsers(users) { writeJSON(FILES.users, users); },
  findUserById(id) { return this.getUsers().find(u => u.id === id); },
  findUserByUsername(username) {
    if (!username) return null;
    const u = username.toLowerCase();
    return this.getUsers().find(x => x.username.toLowerCase() === u);
  },

  // Messages
  getMessages() { return readJSON(FILES.messages); },
  saveMessages(msgs) { writeJSON(FILES.messages, msgs); },

  // Conversations
  getConversations() { return readJSON(FILES.conversations); },
  saveConversations(convs) { writeJSON(FILES.conversations, convs); },

  // Sessions (active sockets per user)
  getSessions() { return readJSON(FILES.sessions); },
  saveSessions(s) { writeJSON(FILES.sessions, s); },
};

module.exports = Store;
