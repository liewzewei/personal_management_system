-- Diary folders for PMS.
--
-- Adds nested folder organization for diary entries.
-- Folder deletion never deletes entries; entry folder_id is set null.

create table if not exists public.diary_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  parent_folder_id uuid null references public.diary_folders(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diary_folders_not_own_parent check (id is distinct from parent_folder_id)
);

create index if not exists idx_diary_folders_user_parent
on public.diary_folders (user_id, parent_folder_id);

alter table public.diary_folders enable row level security;

drop policy if exists diary_folders_select_own on public.diary_folders;
create policy diary_folders_select_own on public.diary_folders
  for select using (auth.uid() = user_id);

drop policy if exists diary_folders_insert_own on public.diary_folders;
create policy diary_folders_insert_own on public.diary_folders
  for insert with check (auth.uid() = user_id);

drop policy if exists diary_folders_update_own on public.diary_folders;
create policy diary_folders_update_own on public.diary_folders
  for update using (auth.uid() = user_id);

drop policy if exists diary_folders_delete_own on public.diary_folders;
create policy diary_folders_delete_own on public.diary_folders
  for delete using (auth.uid() = user_id);

drop trigger if exists set_diary_folders_updated_at on public.diary_folders;
create trigger set_diary_folders_updated_at
before update on public.diary_folders
for each row
execute function public.set_updated_at();

alter table public.diary_entries
  add column if not exists folder_id uuid null references public.diary_folders(id) on delete set null;

create index if not exists idx_diary_entries_user_folder
on public.diary_entries (user_id, folder_id);

-- DOWN:
-- drop index if exists public.idx_diary_entries_user_folder;
-- alter table public.diary_entries drop column if exists folder_id;
-- drop trigger if exists set_diary_folders_updated_at on public.diary_folders;
-- drop policy if exists diary_folders_delete_own on public.diary_folders;
-- drop policy if exists diary_folders_update_own on public.diary_folders;
-- drop policy if exists diary_folders_insert_own on public.diary_folders;
-- drop policy if exists diary_folders_select_own on public.diary_folders;
-- drop index if exists public.idx_diary_folders_user_parent;
-- drop table if exists public.diary_folders;
