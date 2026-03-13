-- PMS initial schema migration.
--
-- Creates core tables with user scoping, timestamps, and strict RLS policies.
-- This application is intentionally single-user at the app layer, but the DB
-- schema is still multi-tenant-safe via `user_id` + RLS.

create extension if not exists pgcrypto;

-- Shared trigger to keep `updated_at` current on UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================
-- tasks
-- =========================
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  tags text[],
  deadline timestamptz,
  estimated_minutes integer,
  is_recurring boolean not null default false,
  recurrence_rule text,
  parent_task_id uuid references public.tasks(id) on delete cascade,
  outlook_event_id text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

alter table public.tasks enable row level security;

drop policy if exists tasks_select_own on public.tasks;
create policy tasks_select_own
on public.tasks
for select
using (auth.uid() = user_id);

drop policy if exists tasks_insert_own on public.tasks;
create policy tasks_insert_own
on public.tasks
for insert
with check (auth.uid() = user_id);

drop policy if exists tasks_update_own on public.tasks;
create policy tasks_update_own
on public.tasks
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists tasks_delete_own on public.tasks;
create policy tasks_delete_own
on public.tasks
for delete
using (auth.uid() = user_id);

-- =========================
-- calendar_events
-- =========================
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  is_all_day boolean not null default false,
  calendar_type text,
  outlook_event_id text unique,
  outlook_calendar_id text,
  source text not null default 'local' check (source in ('local', 'outlook')),
  task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_calendar_events_updated_at on public.calendar_events;
create trigger set_calendar_events_updated_at
before update on public.calendar_events
for each row
execute function public.set_updated_at();

alter table public.calendar_events enable row level security;

drop policy if exists calendar_events_select_own on public.calendar_events;
create policy calendar_events_select_own
on public.calendar_events
for select
using (auth.uid() = user_id);

drop policy if exists calendar_events_insert_own on public.calendar_events;
create policy calendar_events_insert_own
on public.calendar_events
for insert
with check (auth.uid() = user_id);

drop policy if exists calendar_events_update_own on public.calendar_events;
create policy calendar_events_update_own
on public.calendar_events
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists calendar_events_delete_own on public.calendar_events;
create policy calendar_events_delete_own
on public.calendar_events
for delete
using (auth.uid() = user_id);

-- =========================
-- diary_entries
-- =========================
create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  content jsonb,
  content_text text,
  tags text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_diary_entries_updated_at on public.diary_entries;
create trigger set_diary_entries_updated_at
before update on public.diary_entries
for each row
execute function public.set_updated_at();

alter table public.diary_entries enable row level security;

drop policy if exists diary_entries_select_own on public.diary_entries;
create policy diary_entries_select_own
on public.diary_entries
for select
using (auth.uid() = user_id);

drop policy if exists diary_entries_insert_own on public.diary_entries;
create policy diary_entries_insert_own
on public.diary_entries
for insert
with check (auth.uid() = user_id);

drop policy if exists diary_entries_update_own on public.diary_entries;
create policy diary_entries_update_own
on public.diary_entries
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists diary_entries_delete_own on public.diary_entries;
create policy diary_entries_delete_own
on public.diary_entries
for delete
using (auth.uid() = user_id);

-- =========================
-- outlook_sync_state
-- =========================
create table if not exists public.outlook_sync_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  calendar_id text,
  delta_link text,
  last_synced_at timestamptz
);

alter table public.outlook_sync_state enable row level security;

drop policy if exists outlook_sync_state_select_own on public.outlook_sync_state;
create policy outlook_sync_state_select_own
on public.outlook_sync_state
for select
using (auth.uid() = user_id);

drop policy if exists outlook_sync_state_insert_own on public.outlook_sync_state;
create policy outlook_sync_state_insert_own
on public.outlook_sync_state
for insert
with check (auth.uid() = user_id);

drop policy if exists outlook_sync_state_update_own on public.outlook_sync_state;
create policy outlook_sync_state_update_own
on public.outlook_sync_state
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists outlook_sync_state_delete_own on public.outlook_sync_state;
create policy outlook_sync_state_delete_own
on public.outlook_sync_state
for delete
using (auth.uid() = user_id);

-- =========================
-- oauth_tokens
-- =========================
create table if not exists public.oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz
);

alter table public.oauth_tokens enable row level security;

drop policy if exists oauth_tokens_select_own on public.oauth_tokens;
create policy oauth_tokens_select_own
on public.oauth_tokens
for select
using (auth.uid() = user_id);

drop policy if exists oauth_tokens_insert_own on public.oauth_tokens;
create policy oauth_tokens_insert_own
on public.oauth_tokens
for insert
with check (auth.uid() = user_id);

drop policy if exists oauth_tokens_update_own on public.oauth_tokens;
create policy oauth_tokens_update_own
on public.oauth_tokens
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists oauth_tokens_delete_own on public.oauth_tokens;
create policy oauth_tokens_delete_own
on public.oauth_tokens
for delete
using (auth.uid() = user_id);

