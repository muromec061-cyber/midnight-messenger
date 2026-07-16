# Midnight Messenger

Свой мессенджер: регистрация по логину/паролю (без номера!), real-time чаты на WebSocket, отправка файлов, индикатор набора, «онлайн/был(а)», профили с аватаром. UI в стиле Telegram, полностью тёмная тема.

Готовый **APK лежит в корне проекта** — `MidnightMessenger.apk` (~66 КБ).

## Состав

```
messenger/
├── server.js               # Express + Socket.IO бэкенд
├── lib/store.js            # JSON-хранилище (users/messages/conversations)
├── lib/auth.js             # JWT
├── public/                 # Web-клиент (SPA)
│   ├── index.html
│   ├── style.css
│   ├── app.js              # SPA-логика, Socket.IO, конфиг сервера
│   ├── manifest.webmanifest
│   └── sw.js               # service worker для PWA
├── data/                   # JSON-файлы с пользователями/чатами
├── android/                # Android WebView-проект (Gradle)
│   └── app/build/outputs/apk/release/app-release.apk
├── MidnightMessenger.apk   # ← готовый APK, ставится напрямую
└── README.md
```

## Что умеет

- Регистрация/вход по логину + пароль (без номера телефона, без SMS)
- Личные чаты 1-на-1, поиск пользователей
- Real-time доставка сообщений через WebSocket (Socket.IO)
- История сообщений на сервере, чтение с диска
- Индикатор «печатает…»
- Статус «в сети / был(а) такой-то»
- Вложения (файлы до 20 МБ)
- Профиль: имя, био, аватар
- Смена пароля
- PWA (можно добавить на домашний экран в браузере)
- APK с поддержкой Android 5.0+ (API 21+)

## Как пользоваться APK

1. Поставь `MidnightMessenger.apk` на телефон
   - включи «Установка из неизвестных источников»
   - или скинь в Telegram-канал самому себе и открой на телефоне
2. Запусти. На первом экране введи URL сервера (см. ниже, как поднять)
3. Зарегистрируй аккаунт или войди — и чаться

URL сервера сохранится в локальном хранилище, его можно сменить в левом нижнем углу (кнопка «Сервер»).

## Как поднять свой сервер

`messenger` — это обычное Node.js приложение. Подойдёт любой хостинг с Node 18+.

### Локально для тестов

```bash
cd messenger
npm install
npm start          # слушает http://localhost:3000
```

Открой в браузере `http://localhost:3000` — там же работает web-клиент.

### На VPS (вариант «хочу свой мессенджер на сервере»)

```bash
# 1) на сервере
git clone <этот репо>
cd messenger
npm install --omit=dev

# 2) переменные окружения
export PORT=3000
export JWT_SECRET="$(openssl rand -hex 32)"

# 3) запустить под pm2/systemd
npx pm2 start server.js --name midnight
```

Перед сервером ставь nginx/caddy для HTTPS (обязательно для микрофона/гео/уведомлений и чтобы PWA ставилась).

Пример `caddy`:
```
messenger.example.com {
    reverse_proxy localhost:3000
}
```

После этого в APK вводи `https://messenger.example.com` и готово.

### Хостинг без своей VPS

Проще всего задеплоить одной кнопкой:
- **Render** — `New Web Service → из репо → Build: npm ci, Start: node server.js`
- **Railway** — кнопка «Deploy from GitHub»
- **fly.io** — `fly launch`, указать Node 18

Получишь публичный URL вида `https://midnight-xxx.up.railway.app` — вставляй в APK.

## API вручную

Все запросы — JSON, кроме `/api/upload` (multipart).

| Метод | Путь                       | Описание                                      |
|------:|----------------------------|-----------------------------------------------|
| POST  | `/api/register`            | Создать аккаунт `{username, password, displayName?}` |
| POST  | `/api/login`               | Войти `{username, password}` → `{token, user}` |
| GET   | `/api/me`                  | Текущий пользователь                          |
| PATCH | `/api/me`                  | Обновить имя/био/аватар/пароль                |
| GET   | `/api/users?q=...`         | Поиск пользователей                           |
| POST  | `/api/chats/dm`            | Открыть/создать DM `{userId}`                 |
| GET   | `/api/chats`               | Мои чаты + last message preview               |
| GET   | `/api/messages?conversationId=...&limit=50` | Сообщения из чата                       |
| POST  | `/api/messages`            | Отправить сообщение `{conversationId, content, type?, clientId?}` |
| POST  | `/api/upload`              | Загрузить файл (multipart) → `{url,name,size}` |

Все, кроме register/login, требуют заголовок `Authorization: Bearer <token>`.

### WebSocket (Socket.IO)

`io(url, { auth: { token } })`

| Событие (in)   | Payload                                              |
|-----------------|------------------------------------------------------|
| `message:send`  | `{conversationId, content, type?, clientId?}`        |
| `typing`        | `{conversationId, isTyping}`                         |
| `message:read`  | `{conversationId, messageIds}`                       |
| `join:conv`     | `{conversationId}`                                   |

| Событие (out)      | Payload                                              |
|---------------------|------------------------------------------------------|
| `message:new`       | новое сообщение                                      |
| `typing:event`      | `{conversationId, userId, isTyping}`                 |
| `message:read`      | `{conversationId, userId, messageIds}`               |
| `presence`          | `{userId, online, lastSeen}`                         |
| `user_updated`      | обновление профиля                                   |

## Хранилище

JSON-файлы в `data/`:
- `users.json` — `{id, username, passwordHash, displayName, avatar, bio, ...}`
- `conversations.json` — DM-диалоги
- `messages.json` — все сообщения
- `uploads/` — загруженные файлы

Для прод-версии с большим числом пользователей поменяй `lib/store.js` на SQLite/Postgres — API узкий, переписать просто.

## Как пересобрать APK

```bash
# зависимости (один раз)
apt-get install -y openjdk-17-jdk-headless
# + установить Android SDK cmdline-tools, platform 34, build-tools 34

# сборка
cd android
./gradlew :app:assembleRelease

# подписать персональным ключом + zipalign
zipalign -p 4 app/build/outputs/apk/release/app-release.apk /tmp/x.apk
apksigner sign --ks midnight-release.keystore --ks-pass pass:midnight2026 \
  --key-pass pass:midnight2026 --ks-key-alias midnight \
  --out ../MidnightMessenger.apk /tmp/x.apk
```

Keystore в репо — публичный dev-ключ, перед публикацией в Google Play перегенерируй.

## Технологический стек

- **Backend**: Node.js 22, Express, Socket.IO, JWT, bcryptjs, multer
- **Storage**: JSON-файлы (легко поменять на SQLite/Postgres)
- **Frontend**: vanilla JS SPA, никаких фреймворков, кастомный CSS в стиле Telegram
- **Android**: Java Activity + системный WebView, no third-party deps → 66 КБ APK
- **PWA**: манифест + service worker для оффлайна

## Roadmap (что легко добавить)

- Групповые чаты (broadcast sockets уже поддерживают `conv:ID` rooms)
- E2E-шифрование (вставить libsodium на клиенте)
- Push-уведомления через FCM (нужен google-services.json)
- Реакции на сообщения
- Пересылка, цитаты, удаление
- Голосовые сообщения (MediaRecorder на стороне Android)

## Telegram Agent Bot

В проект добавлен многопользовательский Telegram-бот с командой агентов, потоками и режимами мощности. Бот развёртывается на Supabase Edge Functions.

См. [TELEGRAM_BOT.md](TELEGRAM_BOT.md) для настройки и деплоя.

---

Сделано как MVP на один сеанс. Серверная часть production-ready (JWT, bcrypt, валидация, multer, Socket.IO с auth handshake). UI — полнофункциональный мессенджер без рекламы и без номера телефона.

## Генерация своего release-ключа для подписи APK

Файл `android/midnight-release.keystore` исключён из репо (это секрет). Чтобы пересобрать APK под себя:

```bash
keytool -genkey -v -keystore android/midnight-release.keystore \
  -alias midnight -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass YOUR_PASS -keypass YOUR_PASS \
  -dname "CN=Your Name, OU=Personal, O=Self"
```

И поменять пароли/alias в `android/app/build.gradle` → `signingConfigs { midnight { ... } }`.

