-- Portfolio module for PMS.
--
-- Adds three tables for the public portfolio website:
-- 1. portfolio_projects — data science / research project cards
-- 2. blog_posts — Medium-style blog articles
-- 3. site_config — single-row site-wide settings
--
-- All tables use the shared set_updated_at() trigger (created in init migration).
-- Public reads bypass RLS via the service role client.

-- ============================================================
-- Table: portfolio_projects
-- ============================================================
create table if not exists public.portfolio_projects (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  title            text not null,
  slug             text not null,
  tagline          text,
  description      text,
  content          jsonb,
  content_text     text,
  cover_image_url  text,
  tags             text[],
  links            jsonb not null default '[]'::jsonb,
  display_order    integer not null default 0,
  is_published     boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint portfolio_projects_slug_unique unique (user_id, slug)
);

create index if not exists idx_portfolio_projects_published
on public.portfolio_projects (is_published, display_order)
where is_published = true;

create index if not exists idx_portfolio_projects_user
on public.portfolio_projects (user_id, display_order);

alter table public.portfolio_projects enable row level security;

drop policy if exists portfolio_projects_select_own on public.portfolio_projects;
create policy portfolio_projects_select_own on public.portfolio_projects
  for select using (auth.uid() = user_id);

drop policy if exists portfolio_projects_insert_own on public.portfolio_projects;
create policy portfolio_projects_insert_own on public.portfolio_projects
  for insert with check (auth.uid() = user_id);

drop policy if exists portfolio_projects_update_own on public.portfolio_projects;
create policy portfolio_projects_update_own on public.portfolio_projects
  for update using (auth.uid() = user_id);

drop policy if exists portfolio_projects_delete_own on public.portfolio_projects;
create policy portfolio_projects_delete_own on public.portfolio_projects
  for delete using (auth.uid() = user_id);

drop trigger if exists set_portfolio_projects_updated_at on public.portfolio_projects;
create trigger set_portfolio_projects_updated_at
before update on public.portfolio_projects
for each row
execute function public.set_updated_at();

-- ============================================================
-- Table: blog_posts
-- ============================================================
create table if not exists public.blog_posts (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  title                 text not null,
  subtitle              text,
  slug                  text not null,
  content               jsonb,
  content_text          text,
  cover_image_url       text,
  tags                  text[],
  reading_time_minutes  integer,
  display_order         integer not null default 0,
  is_published          boolean not null default false,
  published_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint blog_posts_slug_unique unique (user_id, slug)
);

create index if not exists idx_blog_posts_published
on public.blog_posts (is_published, published_at desc)
where is_published = true;

create index if not exists idx_blog_posts_user
on public.blog_posts (user_id, display_order);

alter table public.blog_posts enable row level security;

drop policy if exists blog_posts_select_own on public.blog_posts;
create policy blog_posts_select_own on public.blog_posts
  for select using (auth.uid() = user_id);

drop policy if exists blog_posts_insert_own on public.blog_posts;
create policy blog_posts_insert_own on public.blog_posts
  for insert with check (auth.uid() = user_id);

drop policy if exists blog_posts_update_own on public.blog_posts;
create policy blog_posts_update_own on public.blog_posts
  for update using (auth.uid() = user_id);

drop policy if exists blog_posts_delete_own on public.blog_posts;
create policy blog_posts_delete_own on public.blog_posts
  for delete using (auth.uid() = user_id);

drop trigger if exists set_blog_posts_updated_at on public.blog_posts;
create trigger set_blog_posts_updated_at
before update on public.blog_posts
for each row
execute function public.set_updated_at();

-- ============================================================
-- Table: site_config (single row per user)
-- ============================================================
create table if not exists public.site_config (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade unique,
  name             text not null default 'Ze Wei',
  tagline          text not null default 'Building What''s Next',
  bio              text,
  avatar_url       text,
  social_github    text,
  social_linkedin  text,
  social_email     text,
  seo_title        text,
  seo_description  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.site_config enable row level security;

drop policy if exists site_config_select_own on public.site_config;
create policy site_config_select_own on public.site_config
  for select using (auth.uid() = user_id);

drop policy if exists site_config_insert_own on public.site_config;
create policy site_config_insert_own on public.site_config
  for insert with check (auth.uid() = user_id);

drop policy if exists site_config_update_own on public.site_config;
create policy site_config_update_own on public.site_config
  for update using (auth.uid() = user_id);

drop policy if exists site_config_delete_own on public.site_config;
create policy site_config_delete_own on public.site_config
  for delete using (auth.uid() = user_id);

drop trigger if exists set_site_config_updated_at on public.site_config;
create trigger set_site_config_updated_at
before update on public.site_config
for each row
execute function public.set_updated_at();

-- DOWN:
-- drop trigger if exists set_site_config_updated_at on public.site_config;
-- drop policy if exists site_config_delete_own on public.site_config;
-- drop policy if exists site_config_update_own on public.site_config;
-- drop policy if exists site_config_insert_own on public.site_config;
-- drop policy if exists site_config_select_own on public.site_config;
-- drop table if exists public.site_config;
--
-- drop trigger if exists set_blog_posts_updated_at on public.blog_posts;
-- drop policy if exists blog_posts_delete_own on public.blog_posts;
-- drop policy if exists blog_posts_update_own on public.blog_posts;
-- drop policy if exists blog_posts_insert_own on public.blog_posts;
-- drop policy if exists blog_posts_select_own on public.blog_posts;
-- drop index if exists public.idx_blog_posts_user;
-- drop index if exists public.idx_blog_posts_published;
-- drop table if exists public.blog_posts;
--
-- drop trigger if exists set_portfolio_projects_updated_at on public.portfolio_projects;
-- drop policy if exists portfolio_projects_delete_own on public.portfolio_projects;
-- drop policy if exists portfolio_projects_update_own on public.portfolio_projects;
-- drop policy if exists portfolio_projects_insert_own on public.portfolio_projects;
-- drop policy if exists portfolio_projects_select_own on public.portfolio_projects;
-- drop index if exists public.idx_portfolio_projects_user;
-- drop index if exists public.idx_portfolio_projects_published;
-- drop table if exists public.portfolio_projects;
