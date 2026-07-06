# Как поднять свой сервер за 5 минут (и переключить APK на него)

## Без OAuth, без своего VPS — пять рабочих вариантов

### Вариант 1. Render (Blueprint, без кнопок, по API)

1. Зайди на https://render.com → Sign Up → GitHub (или Google)
2. Создай новый репозиторий на GitHub: `midnight-messenger`
3. Залей туда содержимое `/workspace/messenger/` (исключая `node_modules/`, `android/build/`)
4. В Render → New → Blueprint → выбери репо
5. Render прочитает `render.yaml` и задеплоит автоматически
6. Через ~2 мин получишь URL вида `https://midnight-messenger-xxx.onrender.com`
7. В APK: кнопка «Сервер» → вставляешь этот URL

### Вариант 2. Railway

1. https://railway.app → Deploy from GitHub
2. Выбери репо, добавь env: `JWT_SECRET=anything_random_32_chars`
3. Деплой → получишь URL
4. То же самое в APK

### Вариант 3. Koyeb

https://koyeb.com → Deploy from GitHub → Node.js buildpack → Start: `node server.js`

### Вариант 4. VPS (полный контроль)

```bash
# Ubuntu 22.04
sudo apt update && sudo apt install -y nodejs npm
git clone <твой репо>
cd messenger
npm install --omit=dev

# переменные
export PORT=3000
export JWT_SECRET="$(openssl rand -hex 32)"

# запустить под systemd
sudo tee /etc/systemd/system/midnight.service > /dev/null <<'EOF'
[Unit]
Description=Midnight Messenger
After=network.target

[Service]
Environment=PORT=3000 JWT_SECRET=YOUR_SECRET
WorkingDirectory=/opt/midnight
ExecStart=/usr/bin/node server.js
Restart=always
User=midnight

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable --now midnight
# nginx + certbot для HTTPS
```

### Вариант 5. Cloudflare Tunnel на своём ноуте (бесплатно, без VPS)

```bash
# установить cloudflared: https://github.com/cloudflare/cloudflared/releases
cloudflared tunnel --url http://localhost:3000
# → получишь URL вида https://anything.trycloudflare.com
```

Или named tunnel (постоянный URL, привязанный к твоему домену):
```bash
cloudflared tunnel create midnight
cloudflared tunnel route dns midnight messenger.example.com
cloudflared tunnel run midnight
```

---

## Что внутри `messenger.tar.gz` (и в `messenger/` в репо)

```
messenger/
├── server.js                # бэкенд: Express + Socket.IO + JWT
├── package.json
├── render.yaml              # готовый Blueprint для Render
├── Procfile                 # для Heroku/Railway
├── README.md
├── HOW_TO_HOST.md           # этот файл
├── public/                  # SPA-фронтенд
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   ├── manifest.webmanifest
│   └── sw.js
├── lib/
│   ├── auth.js              # JWT-токены
│   └── store.js             # JSON-хранилище (users/messages/conversations)
├── android/                 # Gradle-проект для APK
│   ├── app/
│   └── gradlew
├── MidnightMessenger.apk    # ← готовый APK, 66 КБ
└── DEMO_LOGINS.txt          # тестовые логины
```

## Артефакты на этом деплое

| Что | Где |
|---|---|
| APK | `messenger/MidnightMessenger.apk` (66 КБ) |
| Архив проекта | https://h.uguu.se/tGitHKHc.tar.gz (156 КБ) |
| Живой сервер | https://greatest-only-bosnia-hotels.trycloudflare.com |
| Демо-логины | `alice / alice12345`, `bob / bob12345` |

⚠️ Живой сервер выше работает, пока активна сессия песочницы Mavis. Если уснёт — пересобери за 1 команду через вариант 5 или задеплой по-настоящему через вариант 1–4.
