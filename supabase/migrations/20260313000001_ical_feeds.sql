-- iCal feeds table for one-way Outlook → PMS calendar import.
--
-- Each row represents a single iCal URL the user has added.
-- Events imported from this feed are stored in calendar_events
-- with source='outlook' and outlook_calendar_id = ical_feeds.id.

create table if not exists public.ical_feeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  ical_url text not null,
  calendar_type text not null,
  color text,
  is_active boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.ical_feeds enable row level security;

drop policy if exists ical_feeds_select_own on public.ical_feeds;
create policy ical_feeds_select_own
on public.ical_feeds
for select
using (auth.uid() = user_id);

drop policy if exists ical_feeds_insert_own on public.ical_feeds;
create policy ical_feeds_insert_own
on public.ical_feeds
for insert
with check (auth.uid() = user_id);

drop policy if exists ical_feeds_update_own on public.ical_feeds;
create policy ical_feeds_update_own
on public.ical_feeds
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists ical_feeds_delete_own on public.ical_feeds;
create policy ical_feeds_delete_own
on public.ical_feeds
for delete
using (auth.uid() = user_id);
