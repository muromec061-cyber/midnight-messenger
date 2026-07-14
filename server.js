const path = require('path');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const http = require('http');
const { Server } = require('socket.io');

const Store = require('./lib/store');
const { sign, verify, extractToken } = require('./lib/auth');
const { newId } = require('./lib/ids');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(__dirname, 'data', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(PUBLIC_DIR));
app.use('/uploads', express.static(UPLOAD_DIR));

// ---------- helpers ----------
function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName || u.username,
    avatar: u.avatar || null,
    bio: u.bio || '',
    lastSeen: u.lastSeen || null,
    online: !!u.online,
  };
}

function authMiddleware(req, res, next) {
  const token = extractToken(req);
  const payload = verify(token);
  if (!payload) return res.status(401).json({ error: 'unauthorized' });
  const user = Store.findUserById(payload.uid);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  req.user = user;
  next();
}

function dmConvId(a, b) {
  return ['dm', [a, b].sort().join('_')].join(':');
}

// ---------- uploads ----------
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '';
      cb(null, `${newId(12)}${ext}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});
app.post('/api/upload', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  res.json({ url: `/uploads/${req.file.filename}`, name: req.file.originalname, size: req.file.size });
});

// ---------- auth ----------
app.post('/api/register', async (req, res) => {
  const { username, password, displayName } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username и password обязательны' });
  if (!/^[a-zA-Z0-9_]{3,32}$/.test(username))
    return res.status(400).json({ error: 'логин: 3-32 символа, только латиница/цифры/_' });
  if (password.length < 6) return res.status(400).json({ error: 'пароль минимум 6 символов' });
  if (Store.findUserByUsername(username))
    return res.status(409).json({ error: 'этот логин уже занят' });

  const id = newId();
  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id,
    username,
    displayName: displayName || username,
    passwordHash,
    avatar: null,
    bio: '',
    createdAt: Date.now(),
    lastSeen: Date.now(),
    online: false,
  };
  const users = Store.getUsers();
  users.push(user);
  Store.saveUsers(users);
  const token = sign(user);
  res.json({ token, user: publicUser(user) });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'введите логин и пароль' });
  const user = Store.findUserByUsername(username);
  if (!user) return res.status(401).json({ error: 'неверный логин или пароль' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'неверный логин или пароль' });
  const token = sign(user);
  res.json({ token, user: publicUser(user) });
});

app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.patch('/api/me', authMiddleware, async (req, res) => {
  const { displayName, bio, avatar, oldPassword, newPassword } = req.body || {};
  const users = Store.getUsers();
  const idx = users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'user not found' });
  if (typeof displayName === 'string' && displayName.trim()) users[idx].displayName = displayName.trim().slice(0, 64);
  if (typeof bio === 'string') users[idx].bio = bio.slice(0, 256);
  if (typeof avatar === 'string') users[idx].avatar = avatar;
  if (newPassword) {
    if (!oldPassword) return res.status(400).json({ error: 'нужен старый пароль' });
    const ok = await bcrypt.compare(oldPassword, users[idx].passwordHash);
    if (!ok) return res.status(400).json({ error: 'старый пароль неверный' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'новый пароль минимум 6 символов' });
    users[idx].passwordHash = await bcrypt.hash(newPassword, 10);
  }
  users[idx].lastSeen = Date.now();
  Store.saveUsers(users);
  // notify profile change
  io.emit('user_updated', publicUser(users[idx]));
  res.json({ user: publicUser(users[idx]) });
});

// ---------- users ----------
app.get('/api/users', authMiddleware, (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  const users = Store.getUsers()
    .filter(u => u.id !== req.user.id)
    .filter(u => !q || u.username.toLowerCase().includes(q) || (u.displayName || '').toLowerCase().includes(q))
    .slice(0, 50);
  res.json({ users: users.map(publicUser) });
});

app.get('/api/users/:id', authMiddleware, (req, res) => {
  const u = Store.findUserById(req.params.id);
  if (!u) return res.status(404).json({ error: 'not found' });
  res.json({ user: publicUser(u) });
});

// ---------- chats ----------
app.post('/api/chats/dm', authMiddleware, (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });
  if (userId === req.user.id) return res.status(400).json({ error: 'нельзя писать самому себе' });
  const other = Store.findUserById(userId);
  if (!other) return res.status(404).json({ error: 'user not found' });
  const id = dmConvId(req.user.id, other.id);
  let convs = Store.getConversations();
  let conv = convs.find(c => c.id === id);
  if (!conv) {
    conv = { id, type: 'dm', members: [req.user.id, other.id], createdAt: Date.now() };
    convs.push(conv);
    Store.saveConversations(convs);
  }
  res.json({ conversation: conv });
});

app.get('/api/chats', authMiddleware, (req, res) => {
  const myId = req.user.id;
  const convs = Store.getConversations().filter(c => c.members.includes(myId));
  const messages = Store.getMessages();
  const users = Store.getUsers();
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));
  const result = convs.map(c => {
    const otherIds = c.members.filter(m => m !== myId);
    const others = otherIds.map(id => publicUser(userMap[id])).filter(Boolean);
    const cMsgs = messages.filter(m => m.conversationId === c.id);
    const last = cMsgs[cMsgs.length - 1] || null;
    return {
      ...c,
      others,
      lastMessage: last ? sanitize(last) : null,
    };
  });
  result.sort((a, b) => (b.lastMessage?.createdAt || b.createdAt) - (a.lastMessage?.createdAt || a.createdAt));
  res.json({ conversations: result });
});

function sanitize(m) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    from: m.from,
    type: m.type || 'text',
    content: m.content,
    createdAt: m.createdAt,
    readBy: m.readBy || [],
    clientId: m.clientId || null,
  };
}

// ---------- messages ----------
app.get('/api/messages', authMiddleware, (req, res) => {
  const { conversationId, limit = 50, before } = req.query;
  if (!conversationId) return res.status(400).json({ error: 'conversationId required' });
  const conv = Store.findConversationForMember(conversationId, req.user.id);
  if (!conv) return res.status(403).json({ error: 'forbidden' });
  let msgs = Store.getMessages().filter(m => m.conversationId === conversationId);
  if (before) msgs = msgs.filter(m => m.id < before);
  msgs = msgs.slice(-Number(limit));
  res.json({ messages: msgs.map(sanitize) });
});

app.post('/api/messages', authMiddleware, (req, res) => {
  const { conversationId, content, type = 'text', clientId } = req.body || {};
  if (!conversationId || !content) return res.status(400).json({ error: 'conversationId и content обязательны' });
  const conv = Store.findConversationForMember(conversationId, req.user.id);
  if (!conv) return res.status(403).json({ error: 'forbidden' });
  const m = persistMessage({
    conversationId,
    from: req.user.id,
    content,
    type,
    clientId,
  });
  emitMessage(m, conv);
  res.json({ message: sanitize(m) });
});

function persistMessage({ conversationId, from, content, type = 'text', clientId = null }) {
  const id = newId();
  const msg = {
    id,
    conversationId,
    from,
    type,
    content,
    createdAt: Date.now(),
    readBy: [from],
    clientId,
  };
  const msgs = Store.getMessages();
  msgs.push(msg);
  Store.saveMessages(msgs);
  return msg;
}

function emitToMembers(conv, event, payload) {
  for (const memberId of conv.members) {
    const set = onlineSockets.get(memberId);
    if (!set) continue;
    for (const sock of set) sock.emit(event, payload);
  }
}

function emitMessage(m, conv) {
  emitToMembers(conv, 'message:new', sanitize(m));
}

// ---------- socket.io ----------
const onlineSockets = new Map(); // userId -> Set<socket>
const userSockets = new Map(); // socket.id -> userId

io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  const payload = verify(token);
  if (!payload) return next(new Error('unauthorized'));
  const user = Store.findUserById(payload.uid);
  if (!user) return next(new Error('unauthorized'));
  socket.userId = user.id;
  next();
});

io.on('connection', (socket) => {
  const uid = socket.userId;
  if (!onlineSockets.has(uid)) onlineSockets.set(uid, new Set());
  onlineSockets.get(uid).add(socket);
  userSockets.set(socket.id, uid);

  // mark online
  setOnline(uid, true);
  socket.join(`user:${uid}`);

  socket.on('message:send', (data, ack) => {
    try {
      const { conversationId, content, type = 'text', clientId = null } = data || {};
      if (!conversationId || !content) return ack && ack({ error: 'bad params' });
      const conv = Store.findConversationForMember(conversationId, uid);
      if (!conv) return ack && ack({ error: 'forbidden' });
      const m = persistMessage({ conversationId, from: uid, content, type, clientId });
      emitMessage(m, conv);
      ack && ack({ ok: true, message: sanitize(m) });
    } catch (e) {
      ack && ack({ error: e.message });
    }
  });

  socket.on('typing', ({ conversationId, isTyping }) => {
    if (!conversationId) return;
    const conv = Store.findConversationForMember(conversationId, uid);
    if (!conv) return;
    socket.to(`conv:${conversationId}`).emit('typing:event', { conversationId, userId: uid, isTyping: !!isTyping });
  });

  socket.on('message:read', ({ conversationId, messageIds }) => {
    if (!conversationId || !Array.isArray(messageIds)) return;
    const msgs = Store.getMessages();
    let changed = false;
    for (const m of msgs) {
      if (m.conversationId === conversationId && messageIds.includes(m.id)) {
        m.readBy = Array.from(new Set([...(m.readBy || []), uid]));
        changed = true;
      }
    }
    if (changed) {
      Store.saveMessages(msgs);
      const conv = Store.getConversations().find(c => c.id === conversationId);
      if (conv) emitToMembers(conv, 'message:read', { conversationId, userId: uid, messageIds });
    }
  });

  socket.on('join:conv', ({ conversationId }) => {
    if (!conversationId) return;
    socket.join(`conv:${conversationId}`);
  });

  socket.on('disconnect', () => {
    const set = onlineSockets.get(uid);
    if (set) {
      set.delete(socket);
      if (set.size === 0) {
        onlineSockets.delete(uid);
        setOnline(uid, false);
      }
    }
    userSockets.delete(socket.id);
  });
});

function setOnline(uid, online) {
  const users = Store.getUsers();
  const idx = users.findIndex(u => u.id === uid);
  if (idx === -1) return;
  users[idx].online = online;
  users[idx].lastSeen = Date.now();
  Store.saveUsers(users);
  io.emit('presence', { userId: uid, online, lastSeen: users[idx].lastSeen });
}

// ---------- root ----------
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Midnight Messenger running on http://0.0.0.0:${PORT}`);
});
