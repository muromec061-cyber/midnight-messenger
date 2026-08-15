-- Telegram Agent Team Bot tables

create table if not exists public.telegram_threads (
  id uuid default gen_random_uuid() primary key,
  user_id bigint not null,
  chat_id bigint not null,
  title text not null default 'Новый поток',
  agent_key text not null default 'coordinator',
  power text not null default 'balanced',
  context jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.telegram_threads is 'Conversation threads per Telegram user for the multi-agent bot';

create index if not exists idx_telegram_threads_user on public.telegram_threads(user_id);
create index if not exists idx_telegram_threads_updated on public.telegram_threads(updated_at desc);

create table if not exists public.telegram_messages (
  id bigserial primary key,
  thread_id uuid references public.telegram_threads(id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

comment on table public.telegram_messages is 'History of bot/user messages per thread';

create index if not exists idx_telegram_messages_thread on public.telegram_messages(thread_id);

-- Disable RLS for service_role access. In production, expose only via Edge Function.
alter table public.telegram_threads force row level security;
alter table public.telegram_messages force row level security;

-- Allow service_role to bypass RLS. Edge Functions run with service_role.
-- Default grants for service_role already exist; explicit if needed:
-- grant all on public.telegram_threads to service_role;
-- grant all on public.telegram_messages to service_role;
-- grant usage, sequence on public.telegram_messages_id_seq to service_role;
