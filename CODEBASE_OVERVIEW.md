# PMS (Personal Management System) — Comprehensive Codebase Overview

> **Purpose of this document**: Provide enough detail for an AI coding agent to reproduce the entire codebase in one shot. Every file, every type, every database column, every API contract, every component prop is documented below.

## Table of Contents
1. [System Overview](#1-system-overview)
2. [Project Structure](#2-project-structure)
3. [Configuration Files](#3-configuration-files)
4. [Environment Variables](#4-environment-variables)
5. [Database Schema & Migrations](#5-database-schema--migrations)
6. [TypeScript Types](#6-typescript-types)
7. [Validation Schemas (Zod)](#7-validation-schemas-zod)
8. [Data Access Layer (`lib/supabase.ts`)](#8-data-access-layer)
9. [Utility Libraries](#9-utility-libraries)
10. [API Routes](#10-api-routes)
11. [React Query Hooks](#11-react-query-hooks)
12. [Components](#12-components)
13. [Root Layout & Providers](#13-root-layout--providers)
14. [Middleware](#14-middleware)
15. [Global Styles (`globals.css`)](#15-global-styles)
16. [Cross-Feature Integrations](#16-cross-feature-integrations)
17. [Mobile Responsiveness](#17-mobile-responsiveness)
18. [CI / Development / Deployment](#18-ci--development--deployment)
---

## 1. System Overview

PMS is a **single-user, privacy-focused** productivity application combining task management, calendar integration, analytics, journaling, and exercise tracking. Built with Next.js App Router and Supabase.

### Core Features
- **Task Management** — Kanban board with drag-and-drop, subtasks, priorities, tags, deadlines, recurring tasks, archive
- **Calendar** — Local event management + one-way Outlook iCal sync with multiple feed support
- **Analytics** — Task completion trends, streaks, heatmaps, overdue patterns, time-of-day analysis, tag success rates
- **Diary** — Rich-text journaling (Tiptap) with folders, D3 graph view, image upload, math (KaTeX), code blocks
- **Exercise** — Running tracker with PR detection, swimming tracker, calorie/nutrition tracking, exercise analytics
- **Settings** — iCal feed management, calendar preferences, BMR setup

### Tech Stack (exact versions from `package.json`)
- **Framework**: Next.js 15.3.1 (`next`), React 19.1.0, TypeScript 5.8.3
- **Database**: Supabase (`@supabase/supabase-js` 2.49.4, `@supabase/ssr` 0.6.1)
- **UI**: Tailwind CSS 4.1.4, `@tailwindcss/postcss` 4.1.4, `radix-ui` 1.3.2 (unified)
- **State**: `@tanstack/react-query` 5.74.4
- **Drag & Drop**: `@dnd-kit/core` 6.3.1, `@dnd-kit/sortable` 10.0.0, `@dnd-kit/utilities` 3.2.2
- **Rich Text**: `@tiptap/react` 2.12.0 + extensions (starter-kit, underline, link, image, placeholder, character-count, code-block-lowlight, mathematics)
- **Calendar**: `@fullcalendar/react` 6.1.17 + daygrid, timegrid, interaction plugins
- **Charts**: `recharts` 2.15.3
- **Graph**: `d3` 7.9.0
- **iCal Parsing**: `node-ical` 0.21.0
- **Date Utils**: `date-fns` 4.1.0, `date-fns-tz` 3.2.0
- **Validation**: `zod` 3.24.4
- **Math Rendering**: `katex` 0.16.21
- **Code Highlighting**: `lowlight` 3.3.0
- **Icons**: `lucide-react` 0.484.0
- **Utilities**: `clsx` 2.1.1, `tailwind-merge` 3.2.0, `class-variance-authority` 0.7.1, `cmdk` 1.1.1

---

## 2. Project Structure

```
personal_management_system/
├── .env.local.example              # Environment variable template
├── .github/workflows/ci.yml       # GitHub Actions CI pipeline
├── components.json                 # shadcn/ui configuration
├── eslint.config.mjs               # Flat ESLint config
├── middleware.ts                    # Route protection middleware
├── next.config.mjs                 # Next.js configuration
├── package.json                    # Dependencies and scripts
├── postcss.config.mjs              # PostCSS with @tailwindcss/postcss
├── tsconfig.json                   # TypeScript configuration
│
├── types/
│   └── index.ts                    # All TypeScript interfaces (30+ types)
│
├── lib/
│   ├── supabase.ts                 # Server-side data access layer (~2756 lines, 60+ exported functions)
│   ├── supabase-browser.ts         # Browser-safe Supabase client (createBrowserSupabaseClient)
│   ├── analytics.ts                # Task analytics computation engine (pure functions)
│   ├── exercise-analytics.ts       # Exercise analytics computation engine
│   ├── exercise-utils.ts           # Pure utility functions (pace, calories, BMR, etc.)
│   ├── ical-sync.ts                # iCal sync algorithm (fetch, parse, diff, upsert)
│   ├── utils.ts                    # cn() utility for Tailwind class merging
│   ├── validations/
│   │   ├── task.ts                 # Zod schemas for task API
│   │   ├── diary.ts                # Zod schemas for diary API
│   │   ├── calendar.ts             # Zod schemas for calendar/feeds/preferences API
│   │   ├── exercise.ts             # Zod schemas for exercise session API
│   │   └── nutrition.ts            # Zod schemas for food log/saved food/body metric API
│   └── hooks/
│       ├── useTasks.ts             # Task CRUD with optimistic updates
│       ├── useTags.ts              # Tag fetching (combined tasks + diary)
│       ├── useTaskTagCounts.ts     # Sidebar badge counts
│       ├── useToggleSubtask.ts     # Subtask toggle with auto-complete parent
│       ├── useCalendarEvents.ts    # Calendar event fetching
│       ├── useDiaryEntries.ts      # Diary CRUD with infinite scroll + optimistic updates
│       ├── useDiaryFolders.ts      # Diary folder CRUD (direct Supabase, not via API)
│       ├── useDiaryFolderCollapseState.ts  # localStorage-persisted folder collapse state
│       ├── useAnalytics.ts         # Task analytics fetching
│       ├── useExercise.ts          # Exercise session CRUD + PR fetching
│       ├── useNutrition.ts         # Food logs, saved foods, body metrics, daily nutrition
│       ├── useSidebarState.ts      # localStorage-persisted secondary sidebar state
│       └── use-toast.ts            # Toast notification hook (shadcn/ui pattern)
│
├── app/
│   ├── globals.css                 # Global styles: CSS variables, FullCalendar, Tiptap, KaTeX
│   ├── layout.tsx                  # Root layout with providers
│   ├── page.tsx                    # Root redirect (authenticated → /tasks, else → /login)
│   ├── login/page.tsx              # Login page with email/password auth
│   ├── tasks/page.tsx              # Kanban board with filters, drag-drop, modals, archive
│   ├── calendar/page.tsx           # FullCalendar with sidebar filters, iCal sync
│   ├── analytics/page.tsx          # Analytics dashboard with dynamic chart components
│   ├── diary/page.tsx              # Two-panel diary with editor, graph view, folder tree
│   ├── exercise/page.tsx           # Tab navigation: Running, Swimming, Calories, Analytics
│   ├── settings/page.tsx           # iCal feed management + calendar preferences
│   └── api/                        # 29 API route files (see Section 10)
│       ├── auth/login/route.ts
│       ├── tasks/route.ts
│       ├── tasks/[id]/route.ts
│       ├── tasks/[id]/subtasks/route.ts
│       ├── tasks/tag-counts/route.ts
│       ├── tags/route.ts
│       ├── calendar/route.ts
│       ├── calendar/events/route.ts
│       ├── calendar/events/[id]/route.ts
│       ├── calendar/feeds/route.ts
│       ├── calendar/feeds/[id]/route.ts
│       ├── calendar/sync/route.ts
│       ├── calendar/sync/[feedId]/route.ts
│       ├── calendar/preferences/route.ts
│       ├── analytics/route.ts
│       ├── diary/route.ts
│       ├── diary/[id]/route.ts
│       ├── diary/upload/route.ts
│       ├── exercise/sessions/route.ts
│       ├── exercise/sessions/[id]/route.ts
│       ├── exercise/personal-records/route.ts
│       ├── exercise/analytics/route.ts
│       ├── exercise/nutrition/route.ts
│       ├── exercise/food-logs/route.ts
│       ├── exercise/food-logs/[id]/route.ts
│       ├── exercise/saved-foods/route.ts
│       ├── exercise/saved-foods/[id]/route.ts
│       └── exercise/body-metrics/route.ts
│
├── components/
│   ├── AppSidebar.tsx              # Desktop sidebar (shadcn Sidebar, collapsible, overdue badge)
│   ├── BottomNav.tsx               # Mobile bottom navigation (5 tabs)
│   ├── MobileHeader.tsx            # Mobile sticky header with SidebarTrigger
│   ├── QueryProvider.tsx           # React Query client provider
│   ├── ui/                         # shadcn/ui primitives (button, input, dialog, sheet, etc.)
│   ├── tasks/
│   │   ├── KanbanCard.tsx          # Draggable task card with subtask progress
│   │   ├── TaskModal.tsx           # Create/edit task dialog
│   │   └── TaskDetailPanel.tsx     # Side panel with full task details + subtask list
│   ├── calendar/
│   │   └── EventModal.tsx          # Create/view/edit calendar event dialog
│   ├── analytics/
│   │   ├── CompletionOverTimeChart.tsx
│   │   ├── CompletionByTagChart.tsx
│   │   ├── StreakHeatmap.tsx
│   │   ├── TimeOfDayChart.tsx
│   │   ├── OverduePatternsCard.tsx
│   │   ├── WeeklyReviewCard.tsx
│   │   └── SuccessRateByTagChart.tsx
│   ├── diary/
│   │   ├── DiaryEditor.tsx         # Tiptap rich text editor with toolbar, auto-save, image upload
│   │   ├── DiaryList.tsx           # Entry list sidebar with search, tags, folder tree, dnd
│   │   ├── DiaryFolderTree.tsx     # Recursive folder tree with context menus, inline rename
│   │   └── DiaryGraphView.tsx      # D3 force-directed graph (entries ↔ tags)
│   └── exercise/
│       ├── RunningTab.tsx          # Running session list, weekly stats, PR display
│       ├── SwimmingTab.tsx         # Swimming session list, weekly stats, stroke breakdown
│       ├── CaloriesTab.tsx         # Daily nutrition, food log, BMR/TDEE display
│       ├── AnalyticsTab.tsx        # Exercise analytics dashboard with Recharts
│       ├── RunLogModal.tsx         # Log/edit run dialog with lap support
│       ├── SwimLogModal.tsx        # Log/edit swim dialog
│       ├── AddFoodModal.tsx        # Add food log dialog with saved food quick-select
│       ├── BMRSetupModal.tsx       # BMR calculator dialog
│       ├── PRCard.tsx              # Personal record display card
│       └── SessionDetailPanel.tsx  # Session detail side panel
│
└── supabase/
    └── migrations/                 # 9 SQL migration files (see Section 5)
```

---

## 3. Configuration Files

### `next.config.mjs`
```js
const nextConfig = {};
export default nextConfig;
```

### `tsconfig.json`
Key settings: `"strict": true`, path alias `"@/*": ["./*"]`, `target: "ES2017"`, `lib: ["dom", "dom.iterable", "esnext"]`, `module: "esnext"`, `moduleResolution: "bundler"`, `jsx: "preserve"`, `incremental: true`, Next.js plugin enabled.

### `eslint.config.mjs`
Uses flat config with `@next/eslint-plugin-next`, `eslint-plugin-react-hooks`. Key custom rules:
- `react-hooks/set-state-in-effect` — custom rule, set to `"warn"`
- `react-hooks/rules-of-hooks` — `"error"`
- `react-hooks/exhaustive-deps` — `"warn"`
- `@next/next/no-img-element` — `"off"` (Image component not enforced)

### `components.json`
shadcn/ui config: `style: "new-york"`, `tailwindcss: { config: "" }`, `aliases: { components: "@/components", utils: "@/lib/utils", ui: "@/components/ui", lib: "@/lib", hooks: "@/lib/hooks" }`.

### `postcss.config.mjs`
```js
const config = { plugins: { '@tailwindcss/postcss': {} } };
export default config;
```

---

## 4. Environment Variables

From `.env.local.example`:
```bash
NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"     # Server-only, admin privileges
MICROSOFT_CLIENT_ID="your-microsoft-client-id"         # Reserved for future
MICROSOFT_CLIENT_SECRET="your-microsoft-client-secret" # Reserved for future
MICROSOFT_TENANT_ID="your-microsoft-tenant-id"         # Reserved for future
```

**Usage**:
- `NEXT_PUBLIC_*` — available client-side and server-side
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, used only in `createServiceRoleClient()` for admin operations (listing users, creating storage buckets)

---

## 5. Database Schema & Migrations

### Migration Order (run sequentially with `supabase db push`)

1. **`20260313000000_init.sql`** — Core tables: `tasks`, `calendar_events` + `set_updated_at()` trigger function
2. **`20260313000001_ical_feeds.sql`** — `ical_feeds` table
3. **`20260313000002_user_preferences.sql`** — `user_preferences` table with `updated_at` trigger
4. **`20260313000003_diary_entries.sql`** — `diary_entries` table with FTS + GIN indexes
5. **`20260313000004_performance_indexes.sql`** — Performance indexes for tasks, calendar_events, diary_entries
6. **`20260315000001_exercise_module.sql`** — 6 tables: `exercise_sessions`, `run_laps`, `personal_records`, `food_logs`, `saved_foods`, `body_metrics` + ALTER `user_preferences`
7. **`20260315000002_db_maintenance.sql`** — Additional indexes for tasks and saved_foods
8. **`20260316000001_task_performance_indexes.sql`** — Subtask-specific indexes, composite indexes
9. **`20260319000001_diary_folders.sql`** — `diary_folders` table + ALTER `diary_entries` add `folder_id`

### Shared Trigger Function
```sql
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
```

### Table: `tasks`
```sql
CREATE TABLE public.tasks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            text NOT NULL,
  description      text,
  status           text NOT NULL DEFAULT 'todo',          -- 'todo' | 'in_progress' | 'done'
  priority         text NOT NULL DEFAULT 'medium',        -- 'low' | 'medium' | 'high'
  tags             text[],
  deadline         timestamptz,
  estimated_minutes integer,
  is_recurring     boolean NOT NULL DEFAULT false,
  recurrence_rule  text,
  parent_task_id   uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  outlook_event_id text,                                  -- links to calendar_events.id for task↔calendar sync
  completed_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
-- Trigger: set_tasks_updated_at → set_updated_at()
-- RLS: 4 policies (select_own, insert_own, update_own, delete_own) using auth.uid() = user_id
```

### Table: `calendar_events`
```sql
CREATE TABLE public.calendar_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title               text NOT NULL,
  description         text,
  start_time          timestamptz NOT NULL,
  end_time            timestamptz NOT NULL,
  is_all_day          boolean NOT NULL DEFAULT false,
  calendar_type       text,                               -- e.g. 'TASKS', 'EXERCISE', 'Lectures', user-defined
  outlook_event_id    text,                               -- UID from .ics file for dedup
  outlook_calendar_id uuid REFERENCES public.ical_feeds(id) ON DELETE SET NULL,
  source              text NOT NULL DEFAULT 'local',      -- 'local' | 'outlook'
  task_id             uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
-- Trigger: set_calendar_events_updated_at → set_updated_at()
-- RLS: 4 policies
```

### Table: `ical_feeds`
```sql
CREATE TABLE public.ical_feeds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  ical_url        text NOT NULL,
  calendar_type   text NOT NULL,
  color           text,                                   -- hex color e.g. '#3B82F6'
  is_active       boolean NOT NULL DEFAULT true,
  last_synced_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
-- RLS: 4 policies
```

### Table: `user_preferences`
```sql
CREATE TABLE public.user_preferences (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  calendar_default_view    text NOT NULL DEFAULT 'dayGridMonth',
  calendar_week_starts_on  text NOT NULL DEFAULT 'monday',
  -- Exercise fields (added by migration 6):
  distance_unit            text NOT NULL DEFAULT 'km',     -- 'km' | 'mi'
  bmr_calories             integer,
  daily_calorie_goal       integer DEFAULT 2000,
  height_cm                numeric,
  weight_kg                numeric,
  age                      integer,
  biological_sex           text,                           -- 'male' | 'female'
  last_exercise_date       date,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
-- Trigger: set_user_preferences_updated_at → set_updated_at()
-- RLS: 4 policies
```

### Table: `diary_entries`
```sql
CREATE TABLE public.diary_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         text,
  content       jsonb,                                     -- Tiptap JSON document
  content_text  text,                                      -- Plain text for FTS
  tags          text[],
  folder_id     uuid REFERENCES public.diary_folders(id) ON DELETE SET NULL,  -- Added by migration 9
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
-- Trigger: set_diary_entries_updated_at → set_updated_at()
-- Indexes: GIN on tags, GIN on to_tsvector('english', content_text)
-- RLS: 4 policies
```

### Table: `diary_folders`
```sql
CREATE TABLE public.diary_folders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              text NOT NULL,
  parent_folder_id  uuid REFERENCES public.diary_folders(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
-- Trigger: set_diary_folders_updated_at → set_updated_at()
-- RLS: 4 policies
```

### Table: `exercise_sessions`
```sql
CREATE TABLE public.exercise_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type                text NOT NULL,                       -- 'run' | 'swim' | 'other'
  date                date NOT NULL,
  started_at          timestamptz,
  duration_seconds    integer NOT NULL,
  distance_metres     numeric,                             -- NOTE: metres, not km
  calories_burned     integer,
  route_name          text,                                -- Running only
  effort_level        integer,                             -- 1-5, running only
  is_pr               boolean NOT NULL DEFAULT false,
  pr_distance_bucket  text,                                -- '1km' | '5km' | '10km' | 'half_marathon'
  notes               text,
  pool_length_metres  integer,                             -- 25 or 50, swimming only
  total_laps          integer,                             -- Swimming only
  stroke_type         text,                                -- Swimming only
  swolf_score         numeric,                             -- Swimming only
  calendar_event_id   uuid REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
-- Trigger: set_exercise_sessions_updated_at → set_updated_at()
-- Indexes: (user_id, date DESC), (user_id, type), GIN on type
-- RLS: 4 policies
```

### Table: `run_laps`
```sql
CREATE TABLE public.run_laps (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            uuid NOT NULL REFERENCES public.exercise_sessions(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lap_number            integer NOT NULL,
  distance_metres       numeric NOT NULL,
  duration_seconds      integer NOT NULL,
  pace_seconds_per_km   numeric,                           -- Computed on insert
  created_at            timestamptz NOT NULL DEFAULT now()
);
-- Index: (session_id, lap_number)
-- RLS: 4 policies
```

### Table: `personal_records`
```sql
CREATE TABLE public.personal_records (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  distance_bucket          text NOT NULL,                  -- '1km' | '5km' | '10km' | 'half_marathon'
  best_pace_seconds_per_km numeric NOT NULL,
  best_session_id          uuid REFERENCES public.exercise_sessions(id) ON DELETE SET NULL,
  achieved_at              date NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
-- UNIQUE: (user_id, distance_bucket)
-- RLS: 4 policies
```

### Table: `food_logs`
```sql
CREATE TABLE public.food_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date           date NOT NULL,
  meal_slot      text NOT NULL,                            -- 'breakfast' | 'lunch' | 'dinner' | 'snack'
  food_name      text NOT NULL,
  calories       integer NOT NULL DEFAULT 0,
  carbs_g        numeric,
  fat_g          numeric,
  protein_g      numeric,
  water_ml       integer NOT NULL DEFAULT 0,
  saved_food_id  uuid REFERENCES public.saved_foods(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
-- Indexes: (user_id, date)
-- RLS: 4 policies
```

### Table: `saved_foods`
```sql
CREATE TABLE public.saved_foods (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_name   text NOT NULL,
  calories    integer NOT NULL DEFAULT 0,
  carbs_g     numeric,
  fat_g       numeric,
  protein_g   numeric,
  use_count   integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
-- Indexes: (user_id, use_count DESC)
-- RLS: 4 policies
```

### Table: `body_metrics`
```sql
CREATE TABLE public.body_metrics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        date NOT NULL,
  weight_kg   numeric,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
-- UNIQUE: (user_id, date) — upsert on conflict
-- RLS: 4 policies
```

### RLS Pattern (all tables)
Every table uses 4 identical policies:
```sql
ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY <table>_select_own ON public.<table> FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY <table>_insert_own ON public.<table> FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY <table>_update_own ON public.<table> FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY <table>_delete_own ON public.<table> FOR DELETE USING (auth.uid() = user_id);
```

---

## 6. TypeScript Types

All types defined in `types/index.ts`:

```typescript
// === Task Types ===
interface Task {
  id: string; user_id: string; title: string; description: string | null;
  status: "todo" | "in_progress" | "done"; priority: "low" | "medium" | "high";
  tags: string[] | null; deadline: string | null; estimated_minutes: number | null;
  is_recurring: boolean; recurrence_rule: string | null;
  parent_task_id: string | null; outlook_event_id: string | null;
  completed_at: string | null; created_at: string; updated_at: string;
  subtask_count?: number; subtask_done_count?: number;  // Computed by getTasks()
}
interface TaskWithSubtasks extends Task { subtasks: Task[]; }
interface TaskFilters { tag?: string; status?: string; search?: string; sortBy?: string; }
interface TaskInput {
  title?: string; description?: string | null; status?: string; priority?: string;
  tags?: string[] | null; deadline?: string | null; estimated_minutes?: number | null;
  is_recurring?: boolean; recurrence_rule?: string | null; parent_task_id?: string | null;
}

// === Calendar Types ===
interface CalendarEvent {
  id: string; user_id: string; title: string; description: string | null;
  start_time: string; end_time: string; is_all_day: boolean;
  calendar_type: string | null; outlook_event_id: string | null;
  outlook_calendar_id: string | null; source: "local" | "outlook";
  task_id: string | null; created_at: string; updated_at: string;
}
interface CalendarEventInput {
  title?: string; description?: string | null; start_time?: string; end_time?: string;
  is_all_day?: boolean; calendar_type?: string | null;
}
interface IcalFeed {
  id: string; user_id: string; name: string; ical_url: string;
  calendar_type: string; color: string | null; is_active: boolean;
  last_synced_at: string | null; created_at: string;
}
interface IcalFeedInput {
  name?: string; ical_url?: string; calendar_type?: string;
  color?: string | null; is_active?: boolean;
}
interface UserPreferences {
  id: string; user_id: string;
  calendar_default_view: string; calendar_week_starts_on: string;
  distance_unit: "km" | "mi";
  bmr_calories: number | null; daily_calorie_goal: number | null;
  height_cm: number | null; weight_kg: number | null;
  age: number | null; biological_sex: string | null;
  last_exercise_date: string | null;
  created_at: string; updated_at: string;
}
interface SyncResult { created: number; updated: number; deleted: number; errors: string[]; }

// === Diary Types ===
interface DiaryEntry {
  id: string; user_id: string; title: string | null;
  content: Record<string, unknown> | null; content_text: string | null;
  tags: string[] | null; folder_id: string | null;
  created_at: string; updated_at: string;
}
interface DiaryFolder {
  id: string; user_id: string; name: string;
  parent_folder_id: string | null; created_at: string; updated_at: string;
}

// === Exercise Types ===
interface ExerciseSession {
  id: string; user_id: string; type: "run" | "swim" | "other";
  date: string; started_at: string | null; duration_seconds: number;
  distance_metres: number | null; calories_burned: number | null;
  route_name: string | null; effort_level: number | null;
  is_pr: boolean; pr_distance_bucket: string | null;
  notes: string | null; pool_length_metres: number | null;
  total_laps: number | null; stroke_type: string | null;
  swolf_score: number | null; calendar_event_id: string | null;
  created_at: string; updated_at: string;
}
interface RunLap {
  id: string; session_id: string; user_id: string;
  lap_number: number; distance_metres: number;
  duration_seconds: number; pace_seconds_per_km: number | null;
  created_at: string;
}
interface PersonalRecord {
  id: string; user_id: string;
  distance_bucket: PRDistanceBucket;
  best_pace_seconds_per_km: number; best_session_id: string | null;
  achieved_at: string; created_at: string; updated_at: string;
}
type PRDistanceBucket = "1km" | "5km" | "10km" | "half_marathon";

// === Nutrition Types ===
interface FoodLog {
  id: string; user_id: string; date: string;
  meal_slot: string; food_name: string;
  calories: number; carbs_g: number | null;
  fat_g: number | null; protein_g: number | null;
  water_ml: number; saved_food_id: string | null;
  created_at: string;
}
interface SavedFood {
  id: string; user_id: string; food_name: string;
  calories: number; carbs_g: number | null;
  fat_g: number | null; protein_g: number | null;
  use_count: number; created_at: string; updated_at: string;
}
interface BodyMetric {
  id: string; user_id: string; date: string;
  weight_kg: number | null; notes: string | null;
  created_at: string; updated_at: string;
}
interface DailyNutritionSummary {
  date: string; total_calories: number; total_carbs_g: number;
  total_fat_g: number; total_protein_g: number;
  total_water_ml: number; calorie_goal: number;
  calories_burned: number; net_calories: number;
}

// === Exercise Analytics Types ===
interface ExerciseAnalytics {
  running: RunningAnalytics; swimming: SwimmingAnalytics;
  combined: CombinedAnalytics; personalRecords: PersonalRecord[];
}
interface RunningAnalytics {
  totalRuns: number; totalDistanceM: number; totalDuration: number;
  avgPaceSecondsPerKm: number;
  weeklyDistance: { week: string; distanceM: number }[];
  effortDistribution: { level: number; count: number }[];
  heatmap: { date: string; count: number }[];
}
interface SwimmingAnalytics {
  totalSwims: number; totalDistanceM: number; totalDuration: number;
  avgSwolfScore: number | null;
  weeklyDistance: { week: string; distanceM: number }[];
  strokeDistribution: { stroke: string; count: number }[];
}
interface CombinedAnalytics {
  totalSessions: number; totalDuration: number;
  totalCaloriesBurned: number;
  weeklyFrequency: { week: string; count: number }[];
  currentStreak: number; longestStreak: number;
}

// === Placeholder Types ===
interface OutlookSyncState { id: string; user_id: string; }
interface OAuthToken { id: string; user_id: string; }
```

---

## 7. Validation Schemas (Zod)

### `lib/validations/task.ts`
```typescript
const statusEnum = z.enum(["todo", "in_progress", "done"]);
const priorityEnum = z.enum(["low", "medium", "high"]);

export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).nullable().optional(),
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  tags: z.array(z.string().max(100)).nullable().optional(),
  deadline: z.string().datetime({ offset: true }).nullable().optional(),
  estimated_minutes: z.number().int().min(0).nullable().optional(),
  is_recurring: z.boolean().optional(),
  recurrence_rule: z.string().max(500).nullable().optional(),
  parent_task_id: z.string().uuid().nullable().optional(),
});

export const updateTaskSchema = z.object({ /* all fields optional, same shapes */ });
```

### `lib/validations/diary.ts`
```typescript
export const createDiaryEntrySchema = z.object({
  title: z.string().max(500).nullish(),
  content: z.record(z.string(), z.unknown()).nullish(),
  content_text: z.string().nullish(),
  tags: z.array(z.string().max(50)).max(20).nullish(),
  folder_id: z.string().uuid().nullish(),
});
export const updateDiaryEntrySchema = z.object({ /* same shapes */ });
export const diaryQuerySchema = z.object({
  tag: z.string().optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
```

### `lib/validations/calendar.ts`
```typescript
export const createCalendarEventSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).nullable().optional(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  is_all_day: z.boolean().optional().default(false),
  calendar_type: z.string().max(100).nullable().optional(),
});
export const updateCalendarEventSchema = z.object({ /* all optional */ });
export const createIcalFeedSchema = z.object({
  name: z.string().min(1).max(200),
  ical_url: z.string().url().refine(url => url.startsWith("http://") || url.startsWith("https://")),
  calendar_type: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
});
export const updateIcalFeedSchema = z.object({ /* all optional + is_active */ });
export const updateUserPreferencesSchema = z.object({
  calendar_default_view: z.enum(["dayGridMonth", "timeGridWeek", "timeGridDay"]).optional(),
  calendar_week_starts_on: z.enum(["sunday", "monday"]).optional(),
});
```

### `lib/validations/exercise.ts`
```typescript
const exerciseTypeEnum = z.enum(["run", "swim", "other"]);
const strokeTypeEnum = z.enum(["freestyle", "backstroke", "breaststroke", "butterfly", "mixed"]);
const lapSchema = z.object({
  lap_number: z.number().int().positive(),
  distance_metres: z.number().positive(),
  duration_seconds: z.number().int().positive(),
});
export const createSessionSchema = z.object({
  type: exerciseTypeEnum,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  started_at: z.string().datetime({ offset: true }).optional(),
  duration_seconds: z.number().int().positive(),
  distance_metres: z.number().positive().optional(),
  calories_burned: z.number().int().min(0).optional(),
  notes: z.string().max(1000).optional(),
  route_name: z.string().max(200).optional(),
  effort_level: z.number().int().min(1).max(5).optional(),
  pool_length_metres: z.union([z.literal(25), z.literal(50)]).optional(),
  total_laps: z.number().int().positive().optional(),
  stroke_type: strokeTypeEnum.optional(),
  swolf_score: z.number().min(0).optional(),
  laps: z.array(lapSchema).optional(),
});
export const updateSessionSchema = z.object({ /* all optional, nullable where appropriate */ });
```

### `lib/validations/nutrition.ts`
```typescript
export const createFoodLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meal_slot: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  food_name: z.string().min(1).max(200),
  calories: z.number().int().min(0),
  carbs_g: z.number().min(0).optional(),
  fat_g: z.number().min(0).optional(),
  protein_g: z.number().min(0).optional(),
  water_ml: z.number().int().min(0).default(0),
  saved_food_id: z.string().uuid().optional(),
});
export const createSavedFoodSchema = z.object({
  food_name: z.string().min(1).max(200),
  calories: z.number().int().min(0),
  carbs_g/fat_g/protein_g: z.number().min(0).optional(),
});
export const upsertBodyMetricSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weight_kg: z.number().min(0).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});
```

---

## 8. Data Access Layer

`lib/supabase.ts` (~2756 lines) — **ALL database access goes through this file**. No raw Supabase queries in components or API routes.

### Architecture Pattern
```typescript
type SupabaseQueryResult<T> = { data: T | null; error: Error | null };
// Every function returns this shape. Errors are caught and wrapped.
```

### Client Creation Functions
| Function | Import Context | Key |
|---|---|---|
| `createBrowserSupabaseClient()` | Client components | anon key, `@supabase/ssr` `createBrowserClient` |
| `createServerSupabaseClient()` | Server (API routes) | anon key + cookies, `@supabase/ssr` `createServerClient` |
| `createServiceRoleClient()` | Server admin only | service role key, no cookie |
| `requireUserId(client)` | Server | Extracts user ID from session, throws if unauthenticated |

**Note**: `lib/supabase-browser.ts` exports a separate `createBrowserSupabaseClient()` that is safe for `"use client"` components (does not import `next/headers`). Client components import from `supabase-browser.ts`, not from `supabase.ts`.

### Auth Functions
- `signIn(email, password)` → signs in with `signInWithPassword`
- `signOut()` → signs out current user
- `getExistingUsersUpTo2()` → admin function, checks if users exist (uses service role)

### Task Functions
- `getTasks(filters?)` → top-level tasks with optional tag/status/search/sort filtering, pagination, subtask counts
- `getTaskById(taskId)` → single task + subtasks array
- `createTask(data)` → creates task, auto-creates calendar event if deadline set
- `updateTask(taskId, updates)` → updates task, syncs calendar event if deadline changes
- `deleteTask(taskId)` → deletes task + cascade subtasks, deletes linked calendar event
- `getSubtasks(parentTaskId)` → subtasks ordered by created_at ASC
- `duplicateTask(taskId)` → duplicates with "Copy of" prefix, strips completed_at
- `getAllTags()` → unique tags from tasks
- `getTaskTagCounts()` → `Record<string, number>` of incomplete task counts per tag
- `getTasksForAnalytics(startDate?)` → all tasks (no pagination) for analytics engine

### Calendar Functions
- `getCalendarEvents(filters?)` → events with optional start/end/calendarTypes filtering
- `getCalendarEventById(eventId)` → single event
- `createCalendarEvent(data)` → local event creation
- `updateCalendarEvent(eventId, updates)` → blocks editing source='outlook' events
- `deleteCalendarEvent(eventId)` → blocks deleting source='outlook' events
- `upsertOutlookCalendarEvent(userId, data)` → used by iCal sync only
- `batchUpsertOutlookCalendarEvents(userId, rows)` → batch upsert for sync (≤500 per call)
- `deleteOutlookEventsForFeed(userId, feedId)` → remove all events for a feed
- `getOutlookEventsForFeed(userId, feedId)` → get events for diff during sync
- `deleteCalendarEventById(userId, eventId)` → unconditional delete (sync only)

### iCal Feed Functions
- `getIcalFeeds()` → all feeds ordered by created_at
- `getIcalFeedById(feedId)` → single feed
- `createIcalFeed(data)` → new feed
- `updateIcalFeed(feedId, updates)` → update feed
- `deleteIcalFeed(feedId)` → delete feed
- `updateIcalFeedLastSynced(feedId)` → update timestamp after sync

### User Preferences Functions
- `getUserPreferences()` → single row or null
- `upsertUserPreferences(prefs)` → upsert on user_id conflict; accepts calendar + exercise fields

### Diary Functions
- `getDiaryEntries(filters?)` → entries with tag/search/limit/offset filtering, ordered by updated_at DESC
- `getDiaryEntryById(entryId)` → single entry
- `createDiaryEntry(data?)` → new entry (can be empty)
- `updateDiaryEntry(entryId, updates)` → update fields
- `deleteDiaryEntry(entryId)` → delete entry
- `duplicateDiaryEntry(entryId)` → duplicate with "Copy of" prefix
- `getDiaryFolders()` → all folders ordered by name
- `createDiaryFolder(name, parentId?)` → new folder
- `renameDiaryFolder(folderId, newName)` → rename
- `deleteDiaryFolder(folderId)` → deletes only if empty (checks children + entries)
- `moveEntryToFolder(entryId, folderId)` → move entry (null = ungrouped)
- `moveFolderToFolder(folderId, newParentId)` → move folder with cycle detection
- `getAllTagsCombined()` → `{ allTags, taskTags, diaryTags }` from both tables
- `ensureDiaryImagesBucket()` → idempotent bucket creation (service role)
- `uploadDiaryImage(userId, fileName, body, contentType)` → upload to `diary-images` bucket, returns public URL

### Exercise Functions
- `getExerciseSessions(filters?)` → sessions with type/from/to/limit/offset filtering
- `getExerciseSessionById(sessionId)` → session + run laps
- `createExerciseSession(data)` → creates session + laps + PR detection + calendar event + habit flag
- `updateExerciseSession(sessionId, updates)` → updates session, recalculates PR if distance/duration changed
- `deleteExerciseSession(sessionId)` → deletes session, recalculates PR, deletes calendar event
- `getPersonalRecords()` → PRs with joined session date/route

### Nutrition Functions
- `getFoodLogsForDate(date)` → food logs for date, ordered by created_at ASC
- `createFoodLog(data)` → creates food log, increments saved_food use_count
- `deleteFoodLog(logId)` → delete food log
- `getSavedFoods()` → ordered by use_count DESC, food_name ASC
- `createSavedFood(data)` → new saved food
- `updateSavedFood(foodId, updates)` → update saved food
- `deleteSavedFood(foodId)` → delete saved food
- `upsertBodyMetric(data)` → upsert on (user_id, date) conflict
- `getBodyMetrics(filters?)` → body metrics with from/to/limit
- `calculateDailyNutrition(date)` → aggregates food logs + exercise calories + calorie goal

### Internal Functions (not exported)
- `createCalendarEventFromTask(userId, task)` → creates TASKS-type calendar event
- `updateCalendarEventFromTask(calEventId, task)` → updates task-linked event
- `deleteCalendarEventForTask(calEventId)` → deletes task-linked event
- `createCalendarEventFromExercise(client, userId, session)` → creates EXERCISE-type all-day event
- `detectAndUpdatePR(client, userId, sessionId, distance, duration, date)` → PR detection logic
- `recalculatePRForBucket(client, userId, bucket)` → recalculates PR after edit/delete

---

## 9. Utility Libraries

### `lib/exercise-utils.ts` — 13 Pure Functions
```typescript
calculatePace(distanceMetres: number, durationSeconds: number): number
// Returns seconds per km

formatPace(secondsPerKm: number): string
// Returns "M:SS" format e.g. "5:30"

formatDuration(totalSeconds: number): string
// Returns "Xh Ym Zs" or "Ym Zs" format

metresToDisplay(metres: number, unit: "km" | "mi"): string
// Converts and formats with unit suffix

displayToMetres(value: number, unit: "km" | "mi"): number
// Reverse conversion

getDistanceBucket(distanceMetres: number): PRDistanceBucket | null
// Maps distance to PR bucket: 750-1250→"1km", 4750-5250→"5km", 9750-10250→"10km", 20900-21300→"half_marathon"

calculateCaloriesBurned(type: "run" | "swim" | "other", durationSeconds: number, distanceMetres?: number, weightKg?: number): number
// MET-based estimation

calculateBMR(weightKg: number, heightCm: number, age: number, sex: "male" | "female"): number
// Mifflin-St Jeor equation

calculateTDEE(bmr: number, activityLevel: string): number
// BMR × activity multiplier (1.2 sedentary → 1.9 extra_active)

calculateSWOLF(lapTimeSeconds: number, strokeCount: number): number
// Simple addition: time + strokes

estimateSwimCalories(durationSeconds: number, strokeType: string, weightKg?: number): number
// MET-based by stroke type

formatSwolf(score: number | null): string
// Returns formatted string or "—"

getEffortLabel(level: number): string
// 1→"Easy", 2→"Moderate", 3→"Hard", 4→"Very Hard", 5→"Maximum"
```

### `lib/analytics.ts` — Task Analytics Engine
Pure functions that accept `Task[]` arrays and return computed analytics. Used server-side in `/api/analytics`.

**Exported types**:
```typescript
interface AnalyticsPayload {
  completionOverTime: { date: string; count: number }[];
  completionByTag: { tag: string; count: number }[];
  streaks: { current: number; longest: number; heatmap: { date: string; count: number }[] };
  timeOfDay: { hour: number; count: number }[];
  overduePatterns: { onTimeCount: number; overdueCount: number; averageDaysOverdueByTag: { tag: string; avgDays: number }[]; currentlyOverdue: Task[] };
  weeklyReview: { completedLastWeek: number; createdLastWeek: number; missedLastWeek: number; mostProductiveDay: string; currentStreak: number; focusTags: string[] };
  successRateByTag: { tag: string; rate: number; total: number }[];
}
```

**Key functions**: `computeCompletionOverTime()`, `computeCompletionByTag()`, `computeStreaks()`, `computeTimeOfDay()`, `computeOverduePatterns()`, `computeWeeklyReview()`, `computeSuccessRateByTag()`, `computeAnalytics()` (orchestrator).

Uses `date-fns` for date manipulation: `startOfDay`, `endOfDay`, `subDays`, `subWeeks`, `differenceInDays`, `differenceInCalendarDays`, `format`, `getDay`, `getHours`, `startOfWeek`, `endOfWeek`, `isWithinInterval`, `eachDayOfInterval`, `isBefore`.

### `lib/exercise-analytics.ts` — Exercise Analytics Engine
Server-side function `calculateExerciseAnalytics(range)` that queries Supabase directly and returns `ExerciseAnalytics`.

**Sections computed**:
1. **Running**: totalRuns, totalDistance, avgPace, weeklyDistance bins, effort distribution, heatmap
2. **Swimming**: totalSwims, totalDistance, avgSwolf, weeklyDistance, stroke distribution
3. **Combined**: totalSessions, totalDuration, totalCalories, weeklyFrequency, streak calculation
4. **Personal Records**: fetched from `personal_records` table

Range options: `"7d"`, `"30d"`, `"90d"`, `"1y"`, `"all"`.

### `lib/ical-sync.ts` — iCal Sync Algorithm
One-way Outlook → PMS calendar import.

**Constants**: `UPSERT_BATCH_SIZE = 500`, `FETCH_TIMEOUT_MS = 60_000`, `RECURRENCE_MONTHS_BACK = 3`, `RECURRENCE_MONTHS_FORWARD = 6`.

**Algorithm** (`syncIcalFeed(feedId)`):
1. Fetch .ics file from URL (with timeout)
2. Parse with `node-ical` library
3. Expand recurring events (RRULE) into individual occurrences using `RECURRING_UID_SEP = "__"` to create unique UIDs
4. Fetch existing outlook events for this feed from DB
5. Diff: compute inserts, updates, deletes
6. Batch upsert new/changed events (≤500 per batch)
7. Delete events that no longer exist in feed
8. Update `last_synced_at` timestamp
9. Return `SyncResult` with counts

**Exported functions**: `fetchAndParseIcal(url)`, `syncIcalFeed(feedId)`, `syncAllFeeds()`.

### `lib/utils.ts`
```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export function assertNonEmptyString(value: unknown, label: string): string
// Throws if value is not a non-empty string. Used in API routes for required field validation.
```

---

## 10. API Routes

Every route follows this pattern:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, requireUserId } from "@/lib/supabase";
// 1. Parse & validate input with Zod
// 2. Call lib/supabase.ts helper
// 3. Return { data, error } JSON with appropriate status code
```

### Auth
| Route | Methods | Description |
|---|---|---|
| `/api/login` | POST | `signIn(email, password)` via `assertNonEmptyString` + `supabase.auth.signInWithPassword`. Returns 200 or 401. |

### Tasks
| Route | Methods | Description |
|---|---|---|
| `/api/tasks` | GET | `getTasks(filters)` with query params: `tag`, `status`, `search`, `sortBy`, `limit`, `offset` |
| `/api/tasks` | POST | `createTask(body)` validated with `createTaskSchema` |
| `/api/tasks/[id]` | GET | `getTaskById(id)` → task + subtasks |
| `/api/tasks/[id]` | PATCH | `updateTask(id, body)` validated with `updateTaskSchema` |
| `/api/tasks/[id]` | DELETE | `deleteTask(id)` |
| `/api/tasks/[id]` | POST | `duplicateTask(id)` — triggered by `?action=duplicate` query param |
| `/api/tasks/[id]/subtasks` | GET | `getSubtasks(id)` |
| `/api/tasks/tag-counts` | GET | `getTaskTagCounts()` → `Record<string, number>` |

### Tags
| Route | Methods | Description |
|---|---|---|
| `/api/tags` | GET | `getAllTagsCombined()` → `{ allTags, taskTags, diaryTags }` |

### Calendar
| Route | Methods | Description |
|---|---|---|
| `/api/calendar/events` | GET | `getCalendarEvents(filters)` with `start`, `end`, `calendarTypes` query params |
| `/api/calendar/events` | POST | `createCalendarEvent(body)` validated with `createCalendarEventSchema` |
| `/api/calendar/events/[id]` | GET | `getCalendarEventById(id)` |
| `/api/calendar/events/[id]` | PATCH | `updateCalendarEvent(id, body)` — 400 if source='outlook' |
| `/api/calendar/events/[id]` | DELETE | `deleteCalendarEvent(id)` — 400 if source='outlook' |
| `/api/calendar/feeds` | GET | `getIcalFeeds()` |
| `/api/calendar/feeds` | POST | `createIcalFeed(body)` + triggers initial `syncIcalFeed()` |
| `/api/calendar/feeds/[id]` | PATCH | `updateIcalFeed(id, body)` |
| `/api/calendar/feeds/[id]` | DELETE | `deleteOutlookEventsForFeed()` then `deleteIcalFeed()` |
| `/api/calendar/sync` | POST | `syncAllFeeds()` → returns `SyncResult[]` |
| `/api/calendar/sync/[feedId]` | POST | `syncIcalFeed(feedId)` → returns single `SyncResult` |
| `/api/calendar/preferences` | GET | `getUserPreferences()` |
| `/api/calendar/preferences` | PATCH | `upsertUserPreferences(body)` |

### Analytics
| Route | Methods | Description |
|---|---|---|
| `/api/analytics` | GET | `computeAnalytics(tasks, range)` with `range` and optional `tag` query params. Ranges: `7d`, `30d`, `90d`, `1y`, `all`. |

### Diary
| Route | Methods | Description |
|---|---|---|
| `/api/diary` | GET | `getDiaryEntries(filters)` with `tag` (comma-separated), `search`, `limit`, `offset` |
| `/api/diary` | POST | `createDiaryEntry(body)` validated with `createDiaryEntrySchema` |
| `/api/diary/[id]` | GET | `getDiaryEntryById(id)` |
| `/api/diary/[id]` | PATCH | `updateDiaryEntry(id, body)` |
| `/api/diary/[id]` | DELETE | `deleteDiaryEntry(id)` |
| `/api/diary/[id]` | POST | `duplicateDiaryEntry(id)` — triggered by `?action=duplicate` |
| `/api/diary/upload` | POST | `ensureDiaryImagesBucket()` then `uploadDiaryImage()`. Accepts `multipart/form-data` with `file` field. Returns `{ url }`. |

### Exercise
| Route | Methods | Description |
|---|---|---|
| `/api/exercise/sessions` | GET | `getExerciseSessions(filters)` with `type`, `from`, `to`, `limit`, `offset` |
| `/api/exercise/sessions` | POST | `createExerciseSession(body)` validated with `createSessionSchema` |
| `/api/exercise/sessions/[id]` | GET | `getExerciseSessionById(id)` → session + laps |
| `/api/exercise/sessions/[id]` | PATCH | `updateExerciseSession(id, body)` |
| `/api/exercise/sessions/[id]` | DELETE | `deleteExerciseSession(id)` |
| `/api/exercise/personal-records` | GET | `getPersonalRecords()` |
| `/api/exercise/analytics` | GET | `calculateExerciseAnalytics(range)` with `range` query param |
| `/api/exercise/nutrition` | GET | `calculateDailyNutrition(date)` with `date` query param |
| `/api/exercise/food-logs` | GET | `getFoodLogsForDate(date)` with `date` query param |
| `/api/exercise/food-logs` | POST | `createFoodLog(body)` validated with `createFoodLogSchema` |
| `/api/exercise/food-logs/[id]` | DELETE | `deleteFoodLog(id)` |
| `/api/exercise/saved-foods` | GET | `getSavedFoods()` |
| `/api/exercise/saved-foods` | POST | `createSavedFood(body)` |
| `/api/exercise/saved-foods/[id]` | PATCH | `updateSavedFood(id, body)` |
| `/api/exercise/saved-foods/[id]` | DELETE | `deleteSavedFood(id)` |
| `/api/exercise/body-metrics` | GET | `getBodyMetrics(filters)` with optional `from`, `to`, `limit` |
| `/api/exercise/body-metrics` | PATCH | `upsertBodyMetric(body)` |

---

## 11. React Query Hooks

All hooks are `"use client"` and located in `lib/hooks/`.

### `useTasks.ts`
```typescript
useTasks(filters?: TaskFilters)
// queryKey: ["tasks", filters]
// useInfiniteQuery, PAGE_SIZE = 30
// Returns: { tasks, loading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, queryClient }

useTaskMutation()
// Returns: { updateTask, createTask, deleteTask, duplicateTask }
// updateTask has optimistic updates: cancels queries, updates cache, rollback on error
// All mutations invalidate: ["tasks"], ["tags"], ["task-tag-counts"]
```

### `useTags.ts`
```typescript
useTags()
// queryKey: ["tags"]
// Fetches from /api/tags → getAllTagsCombined()
// Returns: { allTags, taskTags, diaryTags, loading, error }
// staleTime: 2 min
```

### `useTaskTagCounts.ts`
```typescript
useTaskTagCounts()
// queryKey: ["task-tag-counts"]
// Fetches from /api/tasks/tag-counts
// Returns: UseQueryResult<Record<string, number>>
// staleTime: 2 min
```

### `useSubtasks.ts`
```typescript
useSubtasks(parentTaskId: string | null, enabled = true)
// queryKey: ["subtasks", parentTaskId]
// useQuery, fetches /api/tasks/[parentTaskId]/subtasks
// enabled only when parentTaskId truthy AND enabled param is true (for lazy loading)
// staleTime: 30s
```

### `useToggleSubtask.ts`
```typescript
useToggleSubtask(parentTaskId: string)
// useMutation that PATCHes /api/tasks/[id] with { status: "done" | "todo" }
// On success: invalidates ["tasks"], ["task", parentTaskId], ["subtasks", parentTaskId], ["task-tag-counts"]
// Auto-completes parent if all subtasks done
```

### `useCalendarEvents.ts`
```typescript
useCalendarEvents(filters?: { start?: string; end?: string; calendarTypes?: string[] })
// queryKey: ["calendar-events", filters]
// useQuery (not infinite)
// Returns: { events, loading, error, refetch }
// staleTime: 1 min
```

### `useDiaryEntries.ts`
```typescript
useDiaryEntries(filters?: { tags?: string[]; search?: string })
// queryKey: ["diary-entries", filters]
// useInfiniteQuery, PAGE_SIZE = 20
// Returns: { entries, loading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, queryClient }

useDiaryMutation()
// Returns: { createEntry, updateEntry, deleteEntry, duplicateEntry }
// createEntry: optimistic prepend to first page
// updateEntry: optimistic in-place update
// deleteEntry: optimistic removal
// All mutations invalidate: ["diary-entries"], ["tags"]
```

### `useDiaryFolders.ts`
```typescript
useDiaryFolders()
// queryKey: ["diary-folders"]
// NOTE: This hook talks DIRECTLY to Supabase (via supabase-browser.ts), NOT via API routes
// Uses createBrowserSupabaseClient() from lib/supabase-browser.ts
// Returns: { folders, loading, error, refetch, createFolder, renameFolder, deleteFolder, moveEntryToFolder, moveFolderToFolder }
// Each mutation is a useMutation that calls Supabase client directly then invalidates ["diary-folders"] and ["diary-entries"]
```

### `useDiaryFolderCollapseState.ts`
```typescript
useDiaryFolderCollapseState()
// Persists collapsed folder IDs in localStorage under key "diary-folder-collapse"
// Returns: { isCollapsed(folderId), toggleCollapse(folderId) }
```

### `useAnalytics.ts`
```typescript
useAnalytics(range: string, tag: string | null)
// queryKey: ["analytics", range, tag]
// useQuery, fetches /api/analytics?range=...&tag=...
// Returns: { data: AnalyticsPayload | null, loading, error, refetch }
// staleTime: 5 min
```

### `useExercise.ts`
```typescript
useExerciseSessions(filters?: { type?: string; from?: string; to?: string })
// queryKey: ["exercise-sessions", filters]
// useInfiniteQuery, PAGE_SIZE = 20, staleTime: 2 min

useExerciseSession(sessionId: string | null)
// queryKey: ["exercise-session", sessionId]
// useQuery, enabled only when sessionId truthy, staleTime: 2 min

usePersonalRecords()
// queryKey: ["personal-records"]
// useQuery, staleTime: 5 min

useCreateExerciseSession()
// useMutation → POST /api/exercise/sessions
// Invalidates: ["exercise-sessions"], ["personal-records"], ["exercise-analytics"], ["daily-nutrition", date]

useUpdateExerciseSession()
// useMutation → PATCH /api/exercise/sessions/[id]
// Invalidates: ["exercise-sessions"], ["exercise-session", id], ["personal-records"], ["exercise-analytics"], ["daily-nutrition", date]

useDeleteExerciseSession()
// useMutation → DELETE /api/exercise/sessions/[id]
// Invalidates: ["exercise-sessions"], ["personal-records"], ["exercise-analytics"], ["daily-nutrition", date]
```

### `useNutrition.ts`
```typescript
useDailyNutrition(date: string)
// queryKey: ["daily-nutrition", date], staleTime: 30s

useFoodLogs(date: string)
// queryKey: ["food-logs", date], staleTime: 30s

useCreateFoodLog()
// Invalidates: ["food-logs", date], ["daily-nutrition", date], ["saved-foods"]

useDeleteFoodLog()
// Invalidates: ["food-logs", date], ["daily-nutrition", date]

useSavedFoods()
// queryKey: ["saved-foods"], staleTime: 2 min

useCreateSavedFood()
// Invalidates: ["saved-foods"]

useUpdateSavedFood()
// Invalidates: ["saved-foods"]

useDeleteSavedFood()
// Invalidates: ["saved-foods"]

useBodyMetrics(filters?)
// queryKey: ["body-metrics", filters], staleTime: 2 min

useUpsertBodyMetric()
// Invalidates: ["body-metrics"]

useUserPreferences()
// queryKey: ["user-preferences"], staleTime: 5 min
// Fetches from /api/calendar/preferences

useUpdateUserPreferences()
// Invalidates: ["user-preferences"]
```

### `useSidebarState.ts`
```typescript
useSidebarState(key: string, defaultOpen?: boolean)
// Persists sidebar open/closed in localStorage
// Returns: { isOpen, toggle, setOpen }
```

### `use-toast.ts`
Standard shadcn/ui toast hook pattern with reducer-based state management. Exports `useToast()` and `toast()` function.

---

## 12. Components

### Root-Level Components

#### `AppSidebar.tsx`
Desktop-only collapsible sidebar using shadcn `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`.

**Navigation items** (with Lucide icons):
- Home → `/` (LayoutDashboard)
- Tasks → `/tasks` (CheckSquare) — with overdue badge count
- Calendar → `/calendar` (Calendar)
- Analytics → `/analytics` (BarChart3)
- Diary → `/diary` (BookOpen)
- Exercise → `/exercise` (Dumbbell)
- Settings → `/settings` (Settings)

**Overdue badge**: Fetches count of tasks with `deadline < today AND status != 'done'` via `useCallback` + direct Supabase query in `useEffect`. Displayed as red Badge on Tasks item.

**Footer**: User email display + sign out button.

#### `BottomNav.tsx`
Mobile-only (`md:hidden`) fixed bottom navigation bar. 5 tabs: Home, Tasks, Calendar, Diary, Exercise. Uses `usePathname()` for active highlighting. Includes `safe-area-inset-bottom` padding.

#### `MobileHeader.tsx`
Mobile-only sticky header with page title (from `usePathname()`). Shows `SidebarTrigger` on left.

#### `SidebarToggle.tsx`
Reusable toggle button for feature-level sidebars (used in Tasks, Calendar, Diary pages).

**Props**: `isOpen: boolean`, `onToggle: () => void`, `label?: string`

**Behavior**: Shows `PanelLeftClose` / `PanelLeftOpen` Lucide icons. Wrapped in shadcn `Tooltip`.

#### `QueryProvider.tsx`
```typescript
"use client";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 2 * 60 * 1000, gcTime: 10 * 60 * 1000, retry: 1, refetchOnWindowFocus: false },
  },
});
// Wraps children in QueryClientProvider
```

### Task Components (`components/tasks/`)

#### `TaskCard.tsx`
List-view task card with checkbox, title, badges, deadline, progress, and three-dot menu.

**Props**: `task: Task`, `subtaskCount?`, `subtaskDoneCount?`, `onToggleDone`, `onClick`, `onEdit`, `onDuplicate`, `onDelete`

**Features**:
- Checkbox to toggle status (optimistic)
- Priority badge (red=high, yellow=medium, green=low)
- Tag chips
- Deadline display with overdue highlighting
- Subtask progress bar
- Estimated time badge
- Three-dot dropdown: Edit, Duplicate, Delete

#### `KanbanCard.tsx`
Draggable task card used in Kanban columns. Uses `@dnd-kit/sortable` `useSortable()`.

**Props**: `task: Task`, `onClick: () => void`, `isOverlay?: boolean`

**Features**:
- Drag handle (GripVertical icon) only on "todo" column cards
- Priority color indicator (left border: red=high, yellow=medium, green=low)
- Tag badges
- Deadline display with overdue highlighting (red text if past due)
- Subtask progress bar (`subtask_done_count / subtask_count`)
- Checkbox to toggle status to done/todo
- Estimated time badge

#### `SubtaskDropdown.tsx`
Collapsible dropdown showing subtasks in In Progress kanban cards.

**Props**: `parentTaskId: string`

**Features**:
- Lazy loads subtasks (only fetched when first opened via `useSubtasks` with `enabled=isOpen`)
- Chevron toggle with progress summary
- Individual subtask checkboxes via `useToggleSubtask`
- Auto-completes parent task when all subtasks are checked

#### `LinkedDescription.tsx`
Renders plain text with auto-detected URLs as clickable links (`target="_blank"`, `rel="noopener noreferrer"`). Uses regex `/(https?:\/\/[^\s]+)/g`. Preserves whitespace (`whitespace-pre-wrap`).

#### `TaskModal.tsx`
Dialog for creating/editing tasks. Uses shadcn `Dialog`, `Input`, `Textarea`, `Select`, `Popover` (date picker), `Badge`.

**Props**: `open`, `onOpenChange`, `task?: TaskWithSubtasks` (edit mode if provided), `parentTaskId?: string` (create subtask)

**Form fields**: title, description, status, priority, tags (comma-separated input), deadline (date picker), estimated_minutes, is_recurring + recurrence_rule, parent_task_id (hidden)

#### `TaskDetailPanel.tsx`
Side panel (Sheet on mobile, fixed panel on desktop) showing full task details.

**Props**: `taskId: string | null`, `onClose: () => void`

**Features**:
- Fetches task via `useQuery(["task", taskId])` → `/api/tasks/[id]`
- Editable fields: title, description, status, priority, tags, deadline, estimated time
- Subtask list with add subtask button, toggle checkboxes, individual detail click
- Action buttons: Edit (opens TaskModal), Duplicate, Delete
- Breadcrumb navigation for subtasks (shows parent)

### Calendar Components (`components/calendar/`)

#### `EventModal.tsx`
Dialog for creating/viewing/editing calendar events.

**Props**: `open`, `onOpenChange`, `event?: CalendarEvent` (view/edit mode), `defaultStart?: string`, `defaultEnd?: string`, `defaultAllDay?: boolean`

**Behavior**:
- **Create mode**: form with title, description, start/end datetime pickers, all-day toggle, calendar_type
- **View/edit mode**: read-only if `source === 'outlook'`, editable if `source === 'local'`
- **Delete**: only for local events, confirmation dialog

### Analytics Components (`components/analytics/`)

All are `"use client"` components using `recharts`. All dynamically imported in `app/analytics/page.tsx` via `next/dynamic` with SSR disabled and skeleton loading placeholders.

- **`CompletionChart.tsx`** — Recharts `LineChart` of daily task completions over selected range, with tag filter chips
- **`TagBreakdownChart.tsx`** — Left: Recharts `PieChart` (donut) of completed tasks by tag. Right: Horizontal `BarChart` of success rate per tag
- **`StreakSection.tsx`** — Current/longest streak stat cards + GitHub-style contribution heatmap (custom div grid, no third-party lib)
- **`TimeOfDayChart.tsx`** — `BarChart` of completions by hour (0-23)
- **`OverdueSection.tsx`** — On-time vs late stat cards, average days overdue by tag `BarChart`, currently overdue tasks table
- **`WeeklyReview.tsx`** — Collapsible panel (auto-expanded on Mondays): completed/created/missed last week, current streak, most productive day, focus tags

### Diary Components (`components/diary/`)

#### `DiaryEditor.tsx`
Tiptap-based rich text editor.

**Props**: `entry: DiaryEntry | null`, `onSave: (updates) => void`

**Tiptap extensions**:
- StarterKit (headings, lists, blockquote, code, horizontal rule)
- Underline
- Link (autolink, openOnClick)
- Image (inline, drag/resize)
- Placeholder ("Start writing...")
- CharacterCount
- CodeBlockLowlight (with `lowlight` for syntax highlighting)
- Mathematics (KaTeX — inline `$...$` and block `$$...$$`)

**Features**:
- Floating toolbar: bold, italic, underline, strikethrough, code, link, headings (1-3), lists (bullet/ordered), blockquote, code block, image upload, math insert
- Auto-save: debounced 1s after content change, calls `onSave` with Tiptap JSON + extracted plain text
- Image upload: opens file picker, POSTs to `/api/diary/upload`, inserts returned URL
- Math editing: inline math editor with preview, error display
- Title field: separate input above editor, auto-saved with content
- Tag editor: tag input with add/remove
- Character count display

#### `DiaryList.tsx`
Left sidebar panel showing diary entries with search, tag filter, and folder tree.

**Props**: `entries`, `selectedId`, `onSelect`, `onNewEntry`, `filters`, `onFiltersChange`, various folder-related props

**Features**:
- Search input (debounced 300ms)
- Tag filter toggle buttons
- Graph view toggle button
- New entry button
- Folder tree (DiaryFolderTree) with @dnd-kit DndContext for drag-drop entries into folders
- Ungrouped entries section
- Entry cards: title (or "Untitled"), preview text, date, tag badges
- Context menus: right-click on background (new folder, new entry), on folder (rename, delete, new subfolder), on entry (duplicate, delete, move to folder)

#### `DiaryFolderTree.tsx`
Recursive folder tree component.

**Props**: `folders: DiaryFolder[]`, `entries: DiaryEntry[]`, `selectedId`, `onSelect`, `collapsedIds`, `onToggleCollapse`, `onRenameFolder`, `onDeleteFolder`, `onCreateSubfolder`, `onDuplicateEntry`, `onDeleteEntry`, `onMoveEntryToFolder`

**Features**:
- Recursive rendering (nested folders via `parent_folder_id`)
- @dnd-kit `useDroppable` for each folder (drop entries to move)
- Context menu per folder: rename (inline), delete (only if empty), new subfolder
- Context menu per entry: duplicate, delete, move to folder submenu
- Inline rename: input field replaces folder name on rename action
- Collapse/expand with chevron icons

#### `DiaryGraphView.tsx`
D3 force-directed graph visualization.

**Props**: `entries: DiaryEntry[]`, `onSelectEntry: (id: string) => void`

**Nodes**: Each diary entry = circle node. Each unique tag = smaller colored node.
**Links**: Entry → Tag connections.
**Interactions**: Click entry node to select, hover for tooltip, zoom/pan with D3 zoom behavior.
**Layout**: Force simulation with center force, link force, many-body repulsion, collision avoidance.

### Exercise Components (`components/exercise/`)

#### `RunningTab.tsx`
Main running tab content.

**Props**: none (uses hooks internally)

**Features**:
- Weekly stats summary (total distance, runs, avg pace)
- PR cards row (usePersonalRecords)
- Session history list (useExerciseSessions with type="run"), infinite scroll
- Each session card: date, distance, duration, pace, effort, PR badge
- Log run button → RunLogModal
- Click session → edit mode in RunLogModal
- Delete session with confirmation
- Diary pre-population: after logging, offers toast with "Write note" button that stores session data in `sessionStorage("diary-prefill")` and navigates to `/diary?prefill=1`

#### `SwimmingTab.tsx`
Same pattern as RunningTab but for swimming.

**Features**:
- Weekly stats: total distance, swims, avg SWOLF
- Session history with stroke type, pool length, laps, SWOLF
- Log swim button → SwimLogModal
- Diary pre-population toast

#### `CaloriesTab.tsx`
Daily nutrition tracking view.

**Features**:
- Date picker (navigate days)
- Daily summary card: calories eaten vs goal, net calories (eaten - burned), macro breakdown (carbs/fat/protein)
- Meal sections (breakfast, lunch, dinner, snack) with food log list per meal
- Add food button per meal → AddFoodModal
- Delete food log
- BMR/TDEE display card, setup button → BMRSetupModal
- Body metric (weight) logging

#### `AnalyticsTab.tsx`
Exercise analytics dashboard using Recharts.

**Features**:
- Range selector (7d, 30d, 90d, 1y, all)
- Running section: total runs, distance, avg pace, weekly distance chart, effort distribution chart, activity heatmap
- Swimming section: total swims, distance, avg SWOLF, weekly distance chart, stroke distribution chart
- Combined section: total sessions, duration, calories burned, weekly frequency chart, streak display
- Personal records section

#### `RunLogModal.tsx`
Dialog for logging/editing a run session.

**Props**: `open`, `onOpenChange`, `onSave: (data: RunFormData) => void`, `editingSession?: ExerciseSession & { laps: RunLap[] }`

**Form fields**: date, duration (h:m:s inputs), distance (with unit toggle km/mi), route_name, effort_level (1-5 buttons), calories_burned, notes, laps (dynamic array: add/remove rows)

**Behavior**: Pre-populates from `editingSession` if provided. Calculates live pace display. Converts distance to metres on submit.

#### `SwimLogModal.tsx`
Dialog for logging/editing a swim session.

**Props**: `open`, `onOpenChange`, `onSave`, `editingSession?: ExerciseSession`

**Form fields**: date, duration, distance, pool_length_metres (25/50), total_laps, stroke_type (select), swolf_score, calories_burned, notes

**Behavior**: Live distance/pace calculation. Auto-calculates distance from laps × pool length if both provided.

#### `AddFoodModal.tsx`
Dialog for adding a food log entry.

**Props**: `open`, `onOpenChange`, `date`, `defaultMealSlot`

**Features**:
- Food name input
- Calorie input
- Optional macro inputs (carbs, fat, protein)
- Saved food quick-select (useSavedFoods): click to auto-fill name + calories + macros
- "Save as favorite" checkbox to also create a SavedFood entry
- Submit creates food log via useCreateFoodLog

#### `BMRSetupModal.tsx`
Dialog for setting up BMR/TDEE calculation.

**Props**: `open`, `onOpenChange`, `profile: UserPreferences | null`

**Form fields**: weight_kg, height_cm, age, biological_sex (male/female), activity_level (sedentary → extra_active)

**Behavior**: Calculates BMR (Mifflin-St Jeor) and TDEE live as user types. On submit, calls upsertUserPreferences with all fields + computed bmr_calories and daily_calorie_goal.

#### `PRCard.tsx`
Displays a single personal record.

**Props**: `record: PersonalRecord & { session_date, session_route }`, `distanceUnit`

**Display**: Distance bucket label, best pace (formatted), achieved date, route name if available.

#### `SessionDetailPanel.tsx`
Side panel showing full exercise session details.

**Props**: `sessionId: string | null`, `onClose: () => void`

**Features**: Fetches session + laps via useExerciseSession. Displays all fields. Edit/delete buttons. Laps table for runs.

#### `SessionCard.tsx`
Exercise session card for list display.

**Props**: `session: ExerciseSession`, `distanceUnit?`, `onClick?`, `onEdit?`, `onDelete?`

**Features**:
- Date, distance (with unit conversion), duration, pace display
- Run-specific: route name, effort dots (●○ 1-5)
- Swim-specific: stroke type badge, laps × pool length
- PR trophy badge
- Three-dot dropdown: Edit, Delete

### shadcn/ui Components (`components/ui/`)

Pre-built primitives from shadcn/ui (New York style). All are `"use client"` wrappers around Radix UI primitives + Tailwind styling:

`alert-dialog`, `badge`, `button`, `checkbox`, `context-menu`, `dialog`, `dropdown-menu`, `input`, `label`, `popover`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `textarea`, `toast`, `toaster`, `tooltip`

---

## 13. Root Layout & Providers

### `app/layout.tsx`
Server component. Provider nesting order (outermost → innermost):

```
<html>
  <body>
    <QueryProvider>               ← React Query client (staleTime: 2min, gcTime: 10min, retry: 1)
      <TooltipProvider>           ← Radix tooltip context
        <SidebarProvider>         ← shadcn sidebar (cookie "sidebar_state" persisted)
          <AppSidebar />          ← Desktop sidebar (hidden on mobile via CSS)
          <SidebarInset>          ← Main content area (flex-1, overflow-y-auto, pb-16 on mobile for BottomNav)
            {children}
          </SidebarInset>
          <BottomNav />           ← Mobile bottom nav (hidden on desktop via md:hidden)
        </SidebarProvider>
      </TooltipProvider>
      <Toaster />                 ← Toast notifications (outside SidebarProvider)
    </QueryProvider>
  </body>
</html>
```

**Font**: Geist (Google Fonts), loaded via `next/font/google`, applied as `--font-sans` CSS variable.

**Metadata**: `title: "PMS (Personal Management System)"`, `description: "A single-user personal productivity system."`.

**Viewport**: `width: device-width, initialScale: 1, maximumScale: 1` (prevents zoom on mobile inputs).

**Sidebar persistence**: Reads `sidebar_state` cookie via `await cookies()`. Passes `defaultOpen` to `SidebarProvider`.

### `app/page.tsx`
Root page. Server component that checks auth state:
- Authenticated → redirect to `/tasks`
- Unauthenticated → redirect to `/login`

### `app/login/page.tsx`
Email/password login form. Client component. Calls `/api/auth/login` on submit. Redirects to `/tasks` on success.

### `app/tasks/page.tsx`
Kanban board interface. Client component.
- Left sidebar (~220px): tag filters with count badges (useTaskTagCounts), collapsible via SidebarToggle + useSidebarState
- Main content: three-column Kanban (To Do | In Progress | Done) with @dnd-kit DndContext (drag only from To Do → In Progress)
- Right panel: TaskDetailPanel (slide-in Sheet on mobile, fixed panel on desktop)
- Archive section: completed tasks from previous days, with reopen action
- Search bar, sort dropdown, keyboard shortcut N (new task), optimistic updates

### `app/calendar/page.tsx`
FullCalendar integration. Client component.
- Left sidebar: navigation, sync button, calendar type filter checkboxes (Tasks, Outlook, Exercise, Personal)
- Main content: FullCalendar (month/week/day views via `@fullcalendar/react`)
- EventModal for create/view/edit
- Auto-sync stale feeds on mount (>10 min old)
- Color coding by calendar_type

### `app/analytics/page.tsx`
Analytics dashboard. Client component.
- Sticky header with date range selector (7d, 30d, 90d, 1y, all) and optional tag filter
- All chart components dynamically imported via `next/dynamic` (SSR disabled) with skeleton loaders
- Sections: WeeklyReview, StreakSection, CompletionChart, TimeOfDayChart, TagBreakdownChart, OverdueSection

### `app/diary/page.tsx`
Diary page. Client component.
- Left panel: DiaryList (search, tags, folder tree, entry list)
- Right panel: DiaryEditor (Tiptap rich text)
- Graph view toggle: replaces editor with DiaryGraphView
- Prefill support: checks `?prefill=1` + `sessionStorage("diary-prefill")` on mount

### `app/exercise/page.tsx`
Exercise tracker. Client component.
- Tab navigation: Running, Swimming, Calories, Analytics (shadcn Tabs)
- Each tab renders its respective component (RunningTab, SwimmingTab, CaloriesTab, AnalyticsTab)

### `app/settings/page.tsx`
Settings page. Client component.
- Section 1: Outlook Calendar Feeds — feed list table with status, sync now, edit, delete; add/edit inline form with collapsible instructions
- Section 2: Calendar Preferences — default view (month/week/day), week starts on (Sunday/Monday), timezone display (read-only)

### `lib/supabase-browser.ts`
Browser-safe Supabase client for `"use client"` components. Uses `@supabase/ssr` `createBrowserClient()`. Does NOT import `next/headers`. Used by `useDiaryFolders.ts` hook for direct Supabase queries.

---

## 14. Middleware

`middleware.ts` — Edge runtime route protection.

### Public Routes (no auth required)
- `/login`
- `/auth/callback`
- `/api/login`

### Matcher
```typescript
"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
```
Skips static assets, images, favicon.

### Flow
1. If Supabase env vars missing → redirect non-public routes to `/login`
2. Create `@supabase/ssr` `createServerClient` with request cookies
3. Call `supabase.auth.getUser()`
4. Public routes → pass through (return response with refreshed cookies)
5. Auth error or no user → redirect to `/login`
6. Authenticated user on `/login` → redirect to `/tasks`
7. Otherwise → pass through

---

## 15. Global Styles

`app/globals.css` — Imports and overrides.

### Structure
1. **Tailwind import**: `@import "tailwindcss"` (v4 syntax)
2. **shadcn/ui theme**: `@theme` block defining CSS variables for colors, border-radius, sidebar dimensions, fonts
3. **Dark/light mode**: `@layer base` with `:root` and `.dark` selectors (HSL color tokens)
4. **FullCalendar overrides**: Custom styles for `.fc` classes to match shadcn/ui theme (toolbar, day cells, events, popovers)
5. **Tiptap editor styles**: `.tiptap` class with prose-like typography, placeholder, image sizing, code block styles
6. **KaTeX styles**: `.katex-display` and `.Tiptap-mathematics-editor` styles for math rendering
7. **Sidebar overrides**: Custom `--sidebar-*` CSS variables
8. **Safe area**: Mobile viewport safe-area-inset padding

### Key CSS Variables
```css
--background, --foreground, --card, --popover, --primary, --secondary,
--muted, --accent, --destructive, --border, --input, --ring,
--sidebar-background, --sidebar-foreground, --sidebar-border,
--sidebar-primary, --sidebar-accent, --sidebar-ring,
--chart-1 through --chart-5, --radius
```

---

## 16. Cross-Feature Integrations

These are the key places where features connect to each other:

### Task ↔ Calendar
- **`createTask()`**: If `deadline` is set, calls `createCalendarEventFromTask()` to create an all-day `TASKS`-type calendar event. Stores the calendar event ID in `task.outlook_event_id`.
- **`updateTask()`**: If deadline changes, updates/creates/deletes the linked calendar event via `updateCalendarEventFromTask()` or `deleteCalendarEventForTask()`.
- **`deleteTask()`**: Deletes the linked calendar event via `deleteCalendarEventForTask()`.

### Exercise ↔ Calendar
- **`createExerciseSession()`**: Creates an all-day `EXERCISE`-type calendar event (non-blocking — error is swallowed). Stores `calendar_event_id` on the session.
- **`deleteExerciseSession()`**: Deletes the linked calendar event.

### Exercise ↔ Diary (Pre-population)
- **`RunningTab.tsx`** and **`SwimmingTab.tsx`**: After successfully logging a session, shows a toast with a "Write note" button.
- Clicking "Write note" stores session summary in `sessionStorage("diary-prefill")` as JSON `{ title, tags, contentTemplate }`.
- Navigates to `/diary?prefill=1`.
- **`diary/page.tsx`**: On mount, checks for `?prefill=1` query param. If present, reads `diary-prefill` from sessionStorage, creates a new diary entry pre-filled with the exercise data, then clears sessionStorage.

### Exercise ↔ Nutrition
- **`calculateDailyNutrition()`**: Queries `exercise_sessions` table for the same date to get `calories_burned`. Net calories = eaten - burned.
- **`createExerciseSession()`**: Updates `user_preferences.last_exercise_date` (habit tracking flag).

### Exercise ↔ Personal Records
- **`createExerciseSession()`**: After insert, calls `detectAndUpdatePR()` which:
  1. Gets the distance bucket via `getDistanceBucket()`
  2. If bucket exists, calculates pace
  3. Checks existing PR for that bucket
  4. If no PR or new pace is faster → upsert PR row, set `is_pr = true` and `pr_distance_bucket` on session
- **`updateExerciseSession()`**: If distance/duration changed, recalculates PR for affected bucket via `recalculatePRForBucket()`
- **`deleteExerciseSession()`**: Recalculates PR for the session's bucket

### Outlook ↔ Calendar (iCal Sync)
- **Auto-sync**: Calendar page checks feed staleness on mount. If any feed's `last_synced_at` > 10 minutes ago, triggers background sync.
- **Manual sync**: "Sync" button in calendar sidebar calls `/api/calendar/sync` (all feeds) or `/api/calendar/sync/[feedId]` (single feed).
- **Feed creation**: POST to `/api/calendar/feeds` creates the feed then immediately calls `syncIcalFeed()`.
- **Feed deletion**: DELETE `/api/calendar/feeds/[id]` first calls `deleteOutlookEventsForFeed()` to remove all synced events, then deletes the feed row.

---

## 17. Mobile Responsiveness

### Breakpoint Strategy
- **Mobile**: `< 768px` (below Tailwind `md` breakpoint)
- **Desktop**: `≥ 768px`

### Desktop Layout
- **AppSidebar**: Collapsible left sidebar (shadcn `Sidebar` with `collapsible="icon"`)
  - Cookie-persisted state (`sidebar_state` cookie)
  - Collapsed mode: icon-only, ~48px wide
  - Expanded mode: full nav with labels, ~256px wide
  - Keyboard shortcut: Cmd/Ctrl+B
- **SidebarInset**: Main content fills remaining width, `overflow-y-auto`

### Mobile Layout
- **AppSidebar**: Hidden via `hidden md:flex` CSS classes
- **BottomNav**: Fixed bottom bar with 5 tabs (Home, Tasks, Calendar, Diary, Exercise)
  - `safe-area-inset-bottom` padding for iOS notch/home bar
  - Active route highlighting via `usePathname()` comparison
- **MobileHeader**: Sticky top header with page title, SidebarTrigger (hamburger) on left
- **SidebarInset**: Has `pb-16` (padding-bottom 64px) to avoid BottomNav overlap

### Page-Specific Responsiveness
- **Tasks (Kanban)**: Columns stack vertically on mobile (`flex-col`), horizontal on desktop (`flex-row`)
- **Diary**: Two-panel layout uses `Sheet` (slide-over) for entry list on mobile, fixed side panel on desktop
- **Calendar**: Sidebar filters hidden by default on mobile, toggled via button
- **Exercise**: Tab navigation works on both, content adapts via Tailwind responsive classes
- **Analytics**: Charts resize via Recharts `ResponsiveContainer`
- **Task/Session detail panels**: Full-screen `Sheet` on mobile, side panel on desktop

---

## 18. CI / Development / Deployment

### GitHub Actions CI (`.github/workflows/ci.yml`)
```yaml
name: CI
on: [push, pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npx tsc --noEmit       # Type check
      - run: npm run lint            # ESLint
      - run: npm run build           # Next.js production build
```

### Package Scripts
```json
{
  "dev": "next dev --turbopack",
  "build": "next build",
  "start": "next start",
  "lint": "next lint"
}
```

### Local Development Setup
```bash
# 1. Clone and install
git clone <repo>
cd personal_management_system
npm install

# 2. Environment setup
cp .env.local.example .env.local
# Fill in: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# 3. Database setup
supabase link --project-ref <your-project-ref>
supabase db push   # Runs all 9 migrations in order

# 4. Start dev server
npm run dev        # Starts on http://localhost:3000 with Turbopack
```

### Deployment (Vercel)
- Framework: Next.js (auto-detected)
- Build command: `next build`
- Output: `.next/` directory
- Environment variables: Set in Vercel dashboard (same as `.env.local`)
- Node.js version: 22.x

### Database Management
- Migrations in `supabase/migrations/` — run in filename order
- All tables use RLS — no public access without authentication
- Storage bucket `diary-images` created on demand by `ensureDiaryImagesBucket()`
- No seed data — single-user app, user creates account via Supabase Auth

---

*End of Codebase Overview*
