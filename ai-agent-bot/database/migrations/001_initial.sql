create table if not exists users (
  id text primary key,
  telegram_id bigint unique,
  username text,
  first_name text,
  last_name text,
  role text not null default 'user',
  is_active boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_users_telegram_id on users (telegram_id);
create index if not exists idx_users_username on users (username);

create table if not exists projects (
  id text primary key,
  user_id text not null references users(id),
  name text not null,
  description text not null default '',
  status text not null default 'active',
  tech_stack text[] not null default '{}',
  repo_url text,
  deploy_url text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_user_id on projects (user_id);

create table if not exists tasks (
  id text primary key,
  project_id text references projects(id),
  user_id text not null references users(id),
  title text not null,
  description text not null default '',
  status text not null default 'pending',
  priority text not null default 'medium',
  agent text not null default 'supervisor',
  payload jsonb not null default '{}'::jsonb,
  result text,
  error text,
  parent_task_id text references tasks(id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists idx_tasks_user_id on tasks (user_id);
create index if not exists idx_tasks_project_id on tasks (project_id);
create index if not exists idx_tasks_status on tasks (status);
create index if not exists idx_tasks_parent_task_id on tasks (parent_task_id);

create table if not exists memories (
  id text primary key,
  user_id text references users(id),
  project_id text references projects(id),
  type text not null default 'note',
  content text not null,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_memories_user_id on memories (user_id);
create index if not exists idx_memories_project_id on memories (project_id);
create index if not exists idx_memories_type on memories (type);

create extension if not exists vector;

create or replace function match_memories (
  query_embedding vector(1536),
  match_user_id text,
  match_project_id text,
  match_type text,
  match_count int default 10
)
returns table (
  id text,
  content text,
  metadata jsonb,
  created_at timestamptz,
  similarity float
)
language sql stable
as $$
  select
    memories.id,
    memories.content,
    memories.metadata,
    memories.created_at,
    1 - (memories.embedding <=> query_embedding) as similarity
  from memories
  where
    (memories.user_id = match_user_id or memories.project_id = match_project_id)
    and (match_type is null or memories.type = match_type)
    and memories.embedding is not null
  order by memories.embedding <=> query_embedding
  limit match_count;
$$;

create table if not exists messages (
  id text primary key,
  user_id text not null references users(id),
  role text not null,
  content text not null,
  agent text,
  project_id text references projects(id),
  task_id text references tasks(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_user_id on messages (user_id);
create index if not exists idx_messages_project_id on messages (project_id);
create index if not exists idx_messages_task_id on messages (task_id);

create table if not exists subscriptions (
  id text primary key,
  user_id text not null references users(id),
  plan text not null default 'free',
  tokens_used integer not null default 0,
  tokens_limit integer not null default 100000,
  projects_limit integer not null default 3,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_user_id on subscriptions (user_id);
create index if not exists idx_subscriptions_plan on subscriptions (plan);

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger users_updated_at before update on users
  for each row execute function update_updated_at();

create or replace trigger projects_updated_at before update on projects
  for each row execute function update_updated_at();

create or replace trigger tasks_updated_at before update on tasks
  for each row execute function update_updated_at();

create or replace trigger subscriptions_updated_at before update on subscriptions
  for each row execute function update_updated_at();
