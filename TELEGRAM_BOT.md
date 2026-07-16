# Telegram Agent Team Bot

Многопользовательский Telegram-бот с командой агентов, развёрнутый на **Supabase Edge Functions**.

## Возможности

- **Команда агентов**: Общий, Кодер, Творец, Исследователь, Планировщик и Командир (автовыбор).
- **Потоки** (threads): у каждого пользователя может быть несколько независимых диалогов со своей историей.
- **Мощность** (power): Лёгкий / Сбалансированный / Максимум — влияет на длину и детализацию ответов.
- **Красивое меню**: inline-клавиатуры, форматирование HTML, команды и приветствие.
- **LLM**: поддержка MiniMax и OpenAI (OpenAI-compatible). Без ключа бот работает в шаблонном режиме.

## Команды бота

| Команда | Описание |
|---|---|
| `/start` | Приветствие и главное меню |
| `/agents` | Выбрать агента |
| `/power` | Выбрать режим мощности |
| `/threads` | Список потоков |
| `/newthread` | Создать новый поток |
| `/help` | Помощь |

## Развёртывание

### 1. Подготовка схемы

В SQL Editor Supabase выполни файл:

```sql
supabase/migrations/20250716000000_telegram_bot_threads.sql
```

### 2. Секреты

Скопируй `.env.example` в `.env` локально, но **никогда не комить реальные токены**. Затем установи секреты в Supabase:

```bash
supabase login
supabase link --project-ref <PROJECT_REF>

supabase secrets set TELEGRAM_BOT_TOKEN=<токен от @BotFather>
supabase secrets set WEBHOOK_SECRET=<случайная строка>

# Опционально — для ИИ-ответов:
supabase secrets set MINIMAX_API_KEY=<ключ>
supabase secrets set OPENAI_API_KEY=<ключ>
```

### 3. Деплой

```bash
supabase functions deploy telegram-bot
```

### 4. Webhook Telegram

```bash
PROJECT_REF=<PROJECT_REF>
BOT_TOKEN=<TELEGRAM_BOT_TOKEN>
WEBHOOK_SECRET=<WEBHOOK_SECRET>

curl "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=https://${PROJECT_REF}.supabase.co/functions/v1/telegram-bot&secret_token=${WEBHOOK_SECRET}"
```

### 5. Меню команд

```bash
curl "https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands?commands=%5B%7B%22command%22%3A%22start%22%2C%22description%22%3A%22%D0%9D%D0%B0%D1%87%D0%B0%D1%82%D1%8C%22%7D%2C%7B%22command%22%3A%22agents%22%2C%22description%22%3A%22%D0%92%D1%8B%D0%B1%D1%80%D0%B0%D1%82%D1%8C%20%D0%B0%D0%B3%D0%B5%D0%BD%D1%82%D0%B0%22%7D%2C%7B%22command%22%3A%22threads%22%2C%22description%22%3A%22%D0%9C%D0%BE%D0%B8%20%D0%BF%D0%BE%D1%82%D0%BE%D0%BA%D0%B8%22%7D%2C%7B%22command%22%3A%22power%22%2C%22description%22%3A%22%D0%9C%D0%BE%D1%89%D0%BD%D0%BE%D1%81%D1%82%D1%8C%22%7D%2C%7B%22command%22%3A%22newthread%22%2C%22description%22%3A%22%D0%9D%D0%BE%D0%B2%D1%8B%D0%B9%20%D0%BF%D0%BE%D1%82%D0%BE%D0%BA%22%7D%2C%7B%22command%22%3A%22help%22%2C%22description%22%3A%22%D0%9F%D0%BE%D0%BC%D0%BE%D1%89%D1%8C%22%7D%5D"
```

## Архитектура

```
supabase/
├── config.toml
├── functions/
│   └── telegram-bot/
│       ├── index.ts        # HTTP-вход, валидация webhook
│       ├── handlers.ts     # Telegram update → действие
│       ├── agents.ts       # выбор агента и генерация ответа
│       ├── llm.ts          # MiniMax / OpenAI клиент
│       ├── markup.ts       # клавиатуры и HTML-оформление
│       ├── db.ts           # работа с Supabase
│       └── types.ts        # типы
└── migrations/
    └── 20250716000000_telegram_bot_threads.sql
```

## Локальный запуск

```bash
supabase start
supabase functions serve telegram-bot --env-file .env
```

Затем для тестов можно отправлять POST-запросы на `http://localhost:54321/functions/v1/telegram-bot` с телом Telegram update.
