-- Diary entries table for PMS.
--
-- Stores rich-text diary entries with Tiptap JSON content,
-- plain text for full-text search, and tags for filtering.

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

-- Full-text search index on content_text
create index if not exists idx_diary_entries_content_text
on public.diary_entries
using gin (to_tsvector('english', coalesce(content_text, '')));

-- GIN index on tags for array containment queries
create index if not exists idx_diary_entries_tags
on public.diary_entries using gin (tags);

alter table public.diary_entries enable row level security;

drop policy if exists diary_entries_select_own on public.diary_entries;
create policy diary_entries_select_own on public.diary_entries
  for select using (auth.uid() = user_id);

drop policy if exists diary_entries_insert_own on public.diary_entries;
create policy diary_entries_insert_own on public.diary_entries
  for insert with check (auth.uid() = user_id);

drop policy if exists diary_entries_update_own on public.diary_entries;
create policy diary_entries_update_own on public.diary_entries
  for update using (auth.uid() = user_id);

drop policy if exists diary_entries_delete_own on public.diary_entries;
create policy diary_entries_delete_own on public.diary_entries
  for delete using (auth.uid() = user_id);
