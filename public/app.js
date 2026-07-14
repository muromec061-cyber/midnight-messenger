/* Midnight Messenger — SPA */
(() => {
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  function getApiBase() {
    const stored = localStorage.getItem('mm.apiBase');
    if (stored) return stored.replace(/\/+$/, '');
    if (location.protocol === 'http:' || location.protocol === 'https:') return location.origin;
    return null;
  }

  // Один раз: если из APK открыли без сохранённого сервера — подставим вендорный дефолт
  // из data-атрибута <body data-default-server="..."> (зашит в Android-сборку).
  (function primeDefaultServer() {
    if (localStorage.getItem('mm.apiBase')) return;
    const body = document.body || document.documentElement;
    const def = body && body.dataset && body.dataset.defaultServer;
    if (def && /^https?:\/\//.test(def)) {
      localStorage.setItem('mm.apiBase', def.replace(/\/+$/, ''));
    }
  })();

  const state = {
    apiBase: getApiBase(),
    token: localStorage.getItem('mm.token') || null,
    me: null,
    socket: null,
    chats: new Map(),      // convId -> chat object
    chatOrder: [],         // sorted convIds
    messages: new Map(),   // convId -> message array
    typing: new Map(),     // convId -> Set<userId>
    activeChat: null,
    onlineUsers: new Set(),
    presence: new Map(),
  };

  function fmtTime(ts) {
    const d = new Date(ts);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    const diffDays = Math.floor((today - d) / (24 * 3600 * 1000));
    if (diffDays < 7) return d.toLocaleDateString('ru-RU', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
  function initials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return ((parts[0][0] || '') + (parts[1]?.[0] || '')).toUpperCase();
  }
  function avatarOf(user) {
    if (user?.avatar) return `<span class="avatar" style="background-image:url('${escapeHtml(user.avatar)}')"></span>`;
    return `<span class="avatar">${escapeHtml(initials(user?.displayName || user?.username || '?'))}</span>`;
  }
  function peerLabel(chat) {
    if (!chat) return '';
    const others = chat.others || [];
    return others.map(o => o.displayName || o.username).join(', ') || 'Сохранённые сообщения';
  }

  async function api(path, opts = {}) {
    if (!state.apiBase) throw new Error('сервер не настроен');
    const url = path.startsWith('http') ? path : (state.apiBase + path);
    const headers = Object.assign(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}, opts.headers || {});
    if (state.token) headers.Authorization = 'Bearer ' + state.token;
    const res = await fetch(url, Object.assign({}, opts, { headers }));
    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) throw new Error((data && data.error) || ('HTTP ' + res.status));
    return data;
  }

  // ---------- auth ----------
  function showScreen(name) {
    $('#auth').classList.toggle('hidden', name !== 'auth');
    $('#messenger').classList.toggle('hidden', name !== 'messenger');
  }

  $$('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab').forEach(b => b.classList.toggle('active', b === btn));
      $('#loginForm').classList.toggle('hidden', btn.dataset.tab !== 'login');
      $('#registerForm').classList.toggle('hidden', btn.dataset.tab !== 'register');
    });
  });

  $('#saveServerBtn').addEventListener('click', () => {
    const url = $('#serverInput').value.trim();
    if (!/^https?:\/\//i.test(url)) return alert('URL должен начинаться с http:// или https://');
    setServerBase(url);
    $('#serverModal').classList.add('hidden');
    bootstrap();
  });
  $('#serverModal').addEventListener('click', e => {
    if (e.target.id === 'serverModal') $('#serverModal').classList.add('hidden');
  });
  $('#changeServerBtn').addEventListener('click', openServerConfig);

  async function handleAuth(formId, url) {
    const form = $(formId);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(form);
      const body = { username: fd.get('username').trim(), password: fd.get('password'), displayName: fd.get('displayName') || undefined };
      const errBox = form.querySelector('.auth-error');
      errBox.textContent = '';
      try {
        const { token, user } = await api(url, { method: 'POST', body: JSON.stringify(body) });
        state.token = token;
        localStorage.setItem('mm.token', token);
        state.me = user;
        await enterApp();
      } catch (err) {
        errBox.textContent = err.message;
      }
    });
  }
  handleAuth('#loginForm', '/api/login');
  handleAuth('#registerForm', '/api/register');

  $('#logoutBtn').addEventListener('click', () => {
    if (state.socket) state.socket.disconnect();
    state.token = null;
    localStorage.removeItem('mm.token');
    location.reload();
  });

  // ---------- bootstrap ----------
  async function bootstrap() {
    if (!state.apiBase) { openServerConfig(); return; }
    if (!state.token) { showScreen('auth'); return; }
    try {
      const { user } = await api('/api/me');
      state.me = user;
      await enterApp();
    } catch (err) {
      console.warn('auth failed:', err.message);
      state.token = null;
      localStorage.removeItem('mm.token');
      if (/HTTP 0|failed|fetch|network|сервер/i.test(err.message)) openServerConfig();
      else showScreen('auth');
    }
  }

  function openServerConfig() {
    $('#serverModal').classList.remove('hidden');
    $('#serverInput').value = localStorage.getItem('mm.apiBase') || '';
    setTimeout(() => $('#serverInput').focus(), 50);
  }

  function setServerBase(url) {
    const clean = url.trim().replace(/\/+$/, '');
    localStorage.setItem('mm.apiBase', clean);
    state.apiBase = clean;
  }

  async function enterApp() {
    showScreen('messenger');
    renderMe();
    await loadChats();
    connectSocket();
  }

  function renderMe() {
    $('#meAvatar').style.backgroundImage = state.me.avatar ? `url('${state.me.avatar}')` : '';
    $('#meAvatar').textContent = state.me.avatar ? '' : initials(state.me.displayName || state.me.username);
    $('#meName').textContent = state.me.displayName || state.me.username;
    $('#meHandle').textContent = '@' + state.me.username;
    const sb = $('#serverBadge'); if (sb && state.apiBase) sb.textContent = 'сервер: ' + state.apiBase.replace(/^https?:\/\//, '');
  }

  // ---------- chats ----------
  async function loadChats() {
    const { conversations } = await api('/api/chats');
    state.chats.clear();
    state.chatOrder = [];
    for (const c of conversations) {
      state.chats.set(c.id, c);
      state.chatOrder.push(c.id);
      if (!state.messages.has(c.id)) state.messages.set(c.id, []);
    }
    renderChatList();
  }

  function renderChatList(filter = '') {
    const list = $('#chatList');
    list.innerHTML = '';
    let chats = state.chatOrder.map(id => state.chats.get(id)).filter(Boolean);
    if (filter) {
      const f = filter.toLowerCase();
      chats = chats.filter(c => peerLabel(c).toLowerCase().includes(f));
    }
    if (chats.length === 0) {
      list.innerHTML = `<div style="padding:24px;color:var(--muted);text-align:center;font-size:13px">Чатов пока нет. Нажми «+» чтобы начать.</div>`;
      return;
    }
    for (const chat of chats) {
      const row = document.createElement('div');
      row.className = 'chat-row' + (state.activeChat === chat.id ? ' active' : '');
      const others = chat.others || [];
      const peer = others[0];
      const online = peer ? state.onlineUsers.has(peer.id) : false;
      const preview = chat.lastMessage?.content || 'Нет сообщений';
      const time = chat.lastMessage ? fmtTime(chat.lastMessage.createdAt) : '';
      row.innerHTML = `
        ${avatarOf(peer)}
        <div class="meta">
          <div class="name"><span>${escapeHtml(peerLabel(chat))}${online ? ' <span class="presence-dot online"></span>' : ''}</span><small>${time}</small></div>
          <div class="preview">${escapeHtml(preview)}</div>
        </div>`;
      row.addEventListener('click', () => openChat(chat.id));
      list.appendChild(row);
    }
  }

  async function openChat(convId) {
    state.activeChat = convId;
    document.querySelector('.messenger').classList.add('show-chat');
    renderChatList($('#chatSearch').value);
    const chat = state.chats.get(convId);
    const peer = chat?.others?.[0];
    $('#peerName').textContent = peer ? (peer.displayName || peer.username) : 'Сохранённые сообщения';
    updatePeerStatus();
    $('#sendForm').classList.remove('hidden');
    try {
      await loadMessages(convId);
    } catch (err) {
      $('#messages').innerHTML = `<div class="system">Не удалось загрузить сообщения: ${escapeHtml(err.message)}</div>`;
      return;
    }
    socketEmit('join:conv', { conversationId: convId });
  }

  async function loadMessages(convId) {
    const { messages } = await api('/api/messages?conversationId=' + encodeURIComponent(convId) + '&limit=200');
    state.messages.set(convId, messages);
    renderMessages(convId);
  }

  function renderMessages(convId) {
    const box = $('#messages');
    const msgs = state.messages.get(convId) || [];
    if (msgs.length === 0) {
      box.innerHTML = `<div class="system">Сообщений ещё нет — напиши первым 👋</div>`;
      return;
    }
    box.innerHTML = '';
    for (const m of msgs) {
      const isOut = m.from === state.me.id;
      const el = document.createElement('div');
      el.className = 'message ' + (isOut ? 'out' : 'in');
      el.innerHTML = `<div class="bubble">${formatBubbleContent(m)}<span class="time">${fmtTime(m.createdAt)}${isOut ? '  ✓' : ''}</span></div>`;
      box.appendChild(el);
    }
    box.scrollTop = box.scrollHeight;
  }

  function formatBubbleContent(m) {
    if (m.type === 'file') {
      return `<div class="file"><a href="${escapeHtml(m.content.url)}" target="_blank" rel="noopener">📎 ${escapeHtml(m.content.name || 'файл')}</a></div>`;
    }
    return escapeHtml(m.content);
  }

  function updatePeerStatus() {
    const chat = state.activeChat ? state.chats.get(state.activeChat) : null;
    const peer = chat?.others?.[0];
    if (!peer) { $('#peerStatus').textContent = ''; return; }
    if (state.onlineUsers.has(peer.id)) {
      $('#peerStatus').textContent = 'в сети';
    } else {
      const last = state.presence.get(peer.id);
      $('#peerStatus').textContent = 'был(а) ' + (last ? new Date(last).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'давно');
    }
  }

  // ---------- send ----------
  $('#sendForm').addEventListener('submit', e => {
    e.preventDefault();
    const input = $('#messageInput');
    const text = input.value.trim();
    if (!text || !state.activeChat) return;
    const clientId = 'c_' + Math.random().toString(36).slice(2);
    // Only clear the input once the message actually left the client; otherwise
    // a disconnected socket would drop the text silently and lose it.
    const sent = socketEmit('message:send', { conversationId: state.activeChat, content: text, type: 'text', clientId });
    if (sent) input.value = '';
    else alert('Нет соединения с сервером — сообщение не отправлено');
  });

  let typingTimeout = null;
  $('#messageInput').addEventListener('input', () => {
    if (!state.activeChat) return;
    socketEmit('typing', { conversationId: state.activeChat, isTyping: true });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => socketEmit('typing', { conversationId: state.activeChat, isTyping: false }), 1500);
  });

  // ---------- search ----------
  $('#chatSearch').addEventListener('input', e => renderChatList(e.target.value));

  // ---------- socket ----------
  function connectSocket() {
    if (state.socket) state.socket.disconnect();
    if (!state.apiBase) return;
    state.socket = io(state.apiBase, { auth: { token: state.token }, transports: ['websocket', 'polling'] });
    state.socket.on('connect', () => {/* connected */});
    state.socket.on('connect_error', err => console.warn('socket err:', err.message));

    state.socket.on('message:new', m => {
      const list = state.messages.get(m.conversationId) || [];
      const chat = state.chats.get(m.conversationId);
      // optimistic dedup
      if (!list.find(x => x.id === m.id || (x.clientId && x.clientId === m.clientId))) list.push(m);
      state.messages.set(m.conversationId, list);
      // bump order
      if (chat) {
        chat.lastMessage = m;
        state.chatOrder = state.chatOrder.filter(id => id !== chat.id).concat(chat.id);
      } else {
        loadChats().catch(err => console.error('loadChats failed:', err));
      }
      if (state.activeChat === m.conversationId) renderMessages(m.conversationId);
      renderChatList($('#chatSearch').value);
    });

    state.socket.on('typing:event', ({ conversationId, userId, isTyping }) => {
      if (!state.typing.has(conversationId)) state.typing.set(conversationId, new Set());
      const s = state.typing.get(conversationId);
      if (isTyping) s.add(userId); else s.delete(userId);
      if (state.activeChat === conversationId) renderTypingIndicator();
    });

    state.socket.on('presence', ({ userId, online, lastSeen }) => {
      if (online) state.onlineUsers.add(userId);
      else state.onlineUsers.delete(userId);
      state.presence.set(userId, lastSeen);
      updatePeerStatus();
      renderChatList($('#chatSearch').value);
    });

    state.socket.on('user_updated', user => {
      // update chat previews
      for (const chat of state.chats.values()) {
        for (const o of chat.others || []) if (o.id === user.id) Object.assign(o, user);
      }
      if (state.activeChat) updatePeerStatus();
      renderChatList($('#chatSearch').value);
    });

    state.socket.on('message:read', ({ conversationId }) => {
      if (state.activeChat === conversationId) {
        const msgs = state.messages.get(conversationId) || [];
        msgs.forEach(m => { (m.readBy = m.readBy || []).push('them'); });
        renderMessages(conversationId);
      }
    });
  }

  function renderTypingIndicator() {
    const s = state.typing.get(state.activeChat) || new Set();
    const ids = Array.from(s).filter(id => id !== state.me.id);
    const existing = document.querySelector('.typing-indicator');
    if (existing) existing.remove();
    if (!ids.length) return;
    const div = document.createElement('div');
    div.className = 'system typing-indicator';
    div.textContent = 'печатает…';
    $('#messages').appendChild(div);
    $('#messages').scrollTop = $('#messages').scrollHeight;
  }

  function socketEmit(ev, payload) {
    if (state.socket && state.socket.connected) {
      state.socket.emit(ev, payload);
      return true;
    }
    console.warn('socket not connected, dropping', ev);
    return false;
  }

  // ---------- new chat ----------
  $('#openNewChat').addEventListener('click', () => {
    $('#newChatModal').classList.remove('hidden');
    $('#userSearch').value = '';
    $('#userResults').innerHTML = '';
    setTimeout(() => $('#userSearch').focus(), 50);
  });
  $('#closeNewChat').addEventListener('click', () => $('#newChatModal').classList.add('hidden'));
  $('#newChatModal').addEventListener('click', e => { if (e.target.id === 'newChatModal') $('#newChatModal').classList.add('hidden'); });

  let userSearchTimeout = null;
  $('#userSearch').addEventListener('input', e => {
    clearTimeout(userSearchTimeout);
    const q = e.target.value.trim();
    userSearchTimeout = setTimeout(() => searchUsers(q), 200);
  });

  async function searchUsers(q) {
    const { users } = await api('/api/users?q=' + encodeURIComponent(q));
    const box = $('#userResults');
    box.innerHTML = '';
    if (!users.length) {
      box.innerHTML = `<div style="padding:18px;color:var(--muted);font-size:13px;text-align:center">Никого не найдено</div>`;
      return;
    }
    for (const u of users) {
      const row = document.createElement('div');
      row.className = 'user-row';
      row.innerHTML = `${avatarOf(u)}<div class="info"><strong>${escapeHtml(u.displayName || u.username)}</strong><small>@${escapeHtml(u.username)}${u.online ? ' · в сети' : ''}</small></div>`;
      row.addEventListener('click', () => startChat(u));
      box.appendChild(row);
    }
  }

  async function startChat(u) {
    try {
      const { conversation } = await api('/api/chats/dm', { method: 'POST', body: JSON.stringify({ userId: u.id }) });
      $('#newChatModal').classList.add('hidden');
      await loadChats();
      openChat(conversation.id);
    } catch (e) {
      alert(e.message);
    }
  }

  // ---------- profile ----------
  $('#openProfile').addEventListener('click', () => openProfile(state.me, true));
  $('#closeProfile').addEventListener('click', () => $('#profileModal').classList.add('hidden'));
  $('#profileModal').addEventListener('click', e => { if (e.target.id === 'profileModal') $('#profileModal').classList.add('hidden'); });

  function openProfile(user, self) {
    $('#profileModal').classList.remove('hidden');
    const title = self ? 'Мой профиль' : '@' + user.username;
    $('#profileTitle').textContent = title;
    const body = $('#profileBody');
    if (self) {
      body.innerHTML = `
        <div id="profileAvatarWrap">${avatarOf(user)}</div>
        <div style="width:100%;text-align:center;color:var(--muted);font-size:12px">кликни по аватару чтобы загрузить</div>
        <label>Имя<input id="pName" maxlength="64" value="${escapeHtml(user.displayName || '')}" /></label>
        <label>О себе<input id="pBio" maxlength="256" value="${escapeHtml(user.bio || '')}" /></label>
        <button class="btn primary" id="pSave">Сохранить</button>
        <hr style="width:100%;border-color:rgba(255,255,255,0.06);margin:8px 0" />
        <label>Старый пароль<input id="pOld" type="password" autocomplete="current-password" /></label>
        <label>Новый пароль<input id="pNew" type="password" autocomplete="new-password" /></label>
        <button class="btn ghost" id="pChangePass">Сменить пароль</button>
      `;
      const av = body.querySelector('.avatar.lg');
      if (av) av.addEventListener('click', () => $('#hiddenFile').click());
      $('#pSave').addEventListener('click', saveProfile);
      $('#pChangePass').addEventListener('click', changePassword);
    } else {
      body.innerHTML = `
        ${avatarOf(user)}
        <div style="text-align:center"><div style="font-weight:700;font-size:18px">${escapeHtml(user.displayName || user.username)}</div><div style="color:var(--muted);font-size:13px">@${escapeHtml(user.username)}</div></div>
        <div style="text-align:center;color:var(--muted);font-size:13px;max-width:300px">${escapeHtml(user.bio || 'Привет, я пользуюсь Midnight!')}</div>
      `;
    }
  }

  async function saveProfile() {
    try {
      const displayName = $('#pName').value.trim();
      const bio = $('#pBio').value.trim();
      const { user } = await api('/api/me', { method: 'PATCH', body: JSON.stringify({ displayName, bio }) });
      Object.assign(state.me, user);
      renderMe();
      openProfile(state.me, true);
    } catch (e) {
      alert(e.message);
    }
  }

  async function changePassword() {
    const oldPassword = $('#pOld').value;
    const newPassword = $('#pNew').value;
    if (!oldPassword || !newPassword) return alert('Заполни оба поля');
    try {
      await api('/api/me', { method: 'PATCH', body: JSON.stringify({ oldPassword, newPassword }) });
      alert('Пароль изменён');
      $('#pOld').value = $('#pNew').value = '';
    } catch (e) {
      alert(e.message);
    }
  }

  // ---------- file upload ----------
  $('#attachBtn').addEventListener('click', () => $('#hiddenFile').click());
  $('#hiddenFile').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    if (!state.activeChat) return;
    try {
      const fd = new FormData(); fd.append('file', f);
      const out = await api('/api/upload', { method: 'POST', body: fd });
      if (!socketEmit('message:send', { conversationId: state.activeChat, content: out, type: 'file' }))
        alert('Нет соединения с сервером — файл загружен, но не отправлен');
    } catch (err) {
      alert(err.message);
    } finally {
      e.target.value = '';
    }
  });

  // ---------- back button on mobile ----------
  document.addEventListener('click', e => {
    if (window.innerWidth <= 800 && e.target.closest('.chat-header') && !e.target.closest('button')) {
      document.querySelector('.messenger').classList.remove('show-chat');
    }
  });

  // ---------- mobile header back ----------
  // add a back chevron dynamically
  const header = document.querySelector('.chat-header');
  const back = document.createElement('button');
  back.className = 'icon-btn';
  back.style.marginRight = '6px';
  back.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L11.83 12z"/></svg>';
  back.addEventListener('click', () => document.querySelector('.messenger').classList.remove('show-chat'));
  back.style.display = window.innerWidth <= 800 ? '' : 'none';
  window.addEventListener('resize', () => { back.style.display = window.innerWidth <= 800 ? '' : 'none'; });
  header.prepend(back);

  bootstrap();
})();
