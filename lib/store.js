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
  let raw;
  try {
    if (!fs.existsSync(file)) return [];
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    // A genuine I/O failure must not be masked as "empty data": returning []
    // here would let a subsequent save overwrite the file and lose everything.
    console.error('readJSON: failed to read', file, e.message);
    throw new Error(`failed to read ${path.basename(file)}: ${e.message}`);
  }
  if (!raw.trim()) return [];
  try {
    return JSON.parse(raw);
  } catch (e) {
    // Corrupt JSON is surfaced rather than swallowed, so we don't silently
    // treat a damaged store as empty and then clobber it on the next write.
    console.error('readJSON: corrupt JSON in', file, e.message);
    throw new Error(`corrupt data file ${path.basename(file)}: ${e.message}`);
  }
}

function writeJSON(file, data) {
  // Write to a temp file and rename so a crash mid-write can't truncate/corrupt
  // the store. rename() is atomic on the same filesystem.
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
  } catch (e) {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch { /* best-effort cleanup */ }
    console.error('writeJSON: failed to write', file, e.message);
    throw new Error(`failed to persist ${path.basename(file)}: ${e.message}`);
  }
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
