![Next.js](https://img.shields.io/badge/Next.js-16-black)
![Supabase](https://img.shields.io/badge/Supabase-green)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black)

# PMS (Personal Management System)

PMS is a single-user, privacy-focused web application for personal productivity. It combines task management, calendar integration, analytics, and journaling into one cohesive system designed for individuals who want full control over their data.

## Table of Contents
- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Outlook Calendar Sync Setup](#outlook-calendar-sync-setup)
- [Deploying to Vercel](#deploying-to-vercel)
- [Environment Variables Reference](#environment-variables-reference)
- [Key Architectural Decisions](#key-architectural-decisions)
- [Performance Optimisations](#performance-optimisations)
- [Feature Walkthroughs](#feature-walkthroughs)
- [Known Limitations](#known-limitations)
- [Troubleshooting](#troubleshooting)
- [Future Roadmap](#future-roadmap)

## Project Overview

PMS solves the problem of scattered productivity tools by providing a unified system for:
- **Task Management** - Kanban board with drag-and-drop, priorities, tags, deadlines, and subtasks
- **Calendar** - Local event management with one-way Outlook iCal sync integration
- **Analytics Dashboard** - Visual insights into productivity patterns, streaks, and completion rates
- **Diary** - Rich-text journaling with search, tagging, and image uploads

### Screenshots
[Screenshot: Task List] [Screenshot: Calendar] [Screenshot: Analytics] [Screenshot: Diary]

## Tech Stack

| Technology | Purpose | Version |
|------------|---------|---------|
| Next.js | React framework with App Router for server-side rendering | 16.1.6 |
| Supabase | PostgreSQL database + Authentication + Real-time | - |
| Vercel | Hosting and deployment platform | - |
| Tailwind CSS | Utility-first CSS framework | 3.4.17 |
| shadcn/ui | High-quality UI component library | - |
| Recharts | Chart library for analytics visualizations | 3.8.0 |
| FullCalendar | Interactive calendar component | 6.1.20 |
| Tiptap | Rich-text editor for diary entries | 3.20.1 |
| React Query | Data fetching, caching, and state management | 5.90.21 |
| @dnd-kit | Drag and drop functionality for Kanban board | 6.3.1 |
| date-fns | Date manipulation and formatting | 4.1.0 |
| node-ical | iCal file parsing for Outlook sync | 0.25.5 |
| Zod | Schema validation and TypeScript inference | 4.3.6 |
| TypeScript | Static type checking | 5 |

## Project Structure

```
/app
├── analytics/          # Analytics dashboard and charts
├── api/                # All API route handlers
│   ├── analytics/       # Analytics data endpoint
│   ├── calendar/        # Calendar event and iCal sync endpoints
│   ├── diary/           # Diary entry endpoints
│   ├── login/           # Authentication endpoint
│   ├── outlook/         # Microsoft Graph API (reserved)
│   └── tasks/           # CRUD endpoints for tasks
├── auth/               # Supabase auth callback handler
├── calendar/           # Calendar view and event management
├── diary/              # Diary editor and entry list
├── globals.css         # Global styles and Tailwind imports
├── layout.tsx          # Root layout with QueryProvider
├── login/              # Email/password login page
├── page.tsx            # Root redirect (tasks if authed, login if not)
├── settings/           # Calendar settings and iCal feed management
└── tasks/              # Task management pages and Kanban board

/components
├── QueryProvider.tsx   # React Query provider configuration
├── SidebarNav.tsx      # Main navigation sidebar
├── analytics/          # Chart and analytics components
├── calendar/           # Calendar-specific components
├── diary/              # Diary editor and list components
├── tasks/              # Task-specific components (KanbanCard, TaskModal, etc.)
└── ui/                 # shadcn/ui primitive components

/lib
├── analytics.ts        # Analytics calculation functions
├── hooks/              # React Query hooks for data fetching
├── ical-sync.ts        # Outlook iCal parsing and sync logic
├── microsoft-graph.ts  # Microsoft Graph API client (reserved)
├── supabase-browser.ts # Client-safe Supabase client
├── supabase.ts         # Supabase client + all database helper functions
├── utils.ts            # Shared utility functions
└── validations/        # Zod schemas for API validation

/types
└── index.ts            # All shared TypeScript interfaces

/supabase
└── migrations/         # SQL migration files (run in order)
    ├── 20260313000000_init.sql      # Core schema (tasks, calendar_events, RLS)
    ├── 0002_ical_feeds.sql          # iCal feeds table
    ├── 0003_user_preferences.sql    # User preferences table
    ├── 0004_diary_entries.sql       # Diary entries table
    └── 0005_performance_indexes.sql # Database performance indexes
```

## Database Schema

### tasks
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Foreign key to auth.users |
| title | text | Task title |
| description | text | Optional description |
| status | text | todo/in_progress/done |
| priority | text | low/medium/high |
| tags | text[] | Array of tags |
| deadline | timestamptz | Optional deadline |
| estimated_minutes | integer | Time estimate |
| is_recurring | boolean | Whether task recurs |
| recurrence_rule | text | RRULE for recurring tasks |
| parent_task_id | uuid | Self-reference for subtasks |
| outlook_event_id | text | Reference to Outlook event |
| completed_at | timestamptz | When task was completed |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

**Indexes:**
- idx_tasks_user_id (user_id)
- idx_tasks_status (user_id, status)
- idx_tasks_deadline (user_id, deadline) WHERE deadline IS NOT NULL
- idx_tasks_completed_at (user_id, completed_at) WHERE completed_at IS NOT NULL
- idx_tasks_parent_task_id (parent_task_id) WHERE parent_task_id IS NOT NULL
- idx_tasks_tags (GIN on tags)

### calendar_events
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Foreign key to auth.users |
| title | text | Event title |
| description | text | Optional description |
| start_time | timestamptz | Event start |
| end_time | timestamptz | Event end |
| is_all_day | boolean | All-day event flag |
| calendar_type | text | Calendar category |
| outlook_event_id | text | Outlook event UID |
| outlook_calendar_id | text | Associated iCal feed |
| source | text | local/outlook |
| task_id | uuid | Link to task |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

**Indexes:**
- idx_calendar_events_user_id (user_id)
- idx_calendar_events_time_range (user_id, start_time, end_time)
- idx_calendar_events_outlook_id (outlook_event_id) WHERE outlook_event_id IS NOT NULL
- idx_calendar_events_task_id (task_id) WHERE task_id IS NOT NULL

### diary_entries
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Foreign key to auth.users |
| title | text | Optional entry title |
| content | jsonb | Tiptap JSON content |
| content_text | text | Plain text for search |
| tags | text[] | Array of tags |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

**Indexes:**
- idx_diary_entries_user_id (user_id)
- idx_diary_entries_updated_at (user_id, updated_at DESC)
- idx_diary_entries_tags (GIN on tags)
- idx_diary_entries_search (GIN to_tsvector on content_text)

### ical_feeds
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Foreign key to auth.users |
| name | text | Feed display name |
| ical_url | text | URL to .ics file |
| calendar_type | text | Calendar category |
| color | text | Display color |
| is_active | boolean | Whether sync is enabled |
| last_synced_at | timestamptz | Last successful sync |
| created_at | timestamptz | Creation timestamp |

### user_preferences
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Foreign key to auth.users (unique) |
| calendar_default_view | text | Default calendar view |
| calendar_week_starts_on | text | monday/sunday |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

### outlook_sync_state
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Foreign key to auth.users (unique) |
| last_sync_at | timestamptz | Last sync timestamp |
| sync_token | text | Microsoft Graph sync token |

## Prerequisites

Before setting up PMS, you'll need:

- **Node.js** 18.x or later (check `package.json` engines field)
- **npm** 9.x or later
- A **Supabase** account (free tier works)
- A **Vercel** account (free tier works for hosting)
- **Git** for version control

## Local Development Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd personal_management_system
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and anon key from Settings → API
3. In Supabase Dashboard → Authentication → Settings, ensure Email/Password auth is enabled

### 4. Run Database Migrations

Install the Supabase CLI first (follow [official instructions](https://supabase.com/docs/reference/cli)):

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

Apply migrations in order:

```bash
supabase db push
```

This will run all migrations in `/supabase/migrations/`:
1. `20260313000000_init.sql` - Core schema and RLS policies
2. `0002_ical_feeds.sql` - iCal feeds table
3. `0003_user_preferences.sql` - User preferences
4. `0004_diary_entries.sql` - Diary entries with search indexes
5. `0005_performance_indexes.sql` - Performance optimization indexes

### 5. Set Up Environment Variables

Copy the example file:

```bash
cp .env.local.example .env.local
```

Fill in the values in `.env.local`:

```bash
# Supabase Configuration
# Get from: Supabase Dashboard → Project Settings → API
NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"

# Server-only admin key
# Get from: Supabase Dashboard → Project Settings → API → service_role
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Microsoft/Outlook (reserved for future OAuth integration)
MICROSOFT_CLIENT_ID="your-microsoft-client-id"
MICROSOFT_CLIENT_SECRET="your-microsoft-client-secret"
MICROSOFT_TENANT_ID="your-microsoft-tenant-id"
```

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 7. Create Your User Account

Since PMS is single-user, create your account directly in Supabase:

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User"
3. Enter your email and set a password
4. The user will appear with "confirmed" status

### 8. Verify Everything Works

- Navigate to `/login` and sign in with your created account
- You should be redirected to `/tasks`
- Try creating a task, adding a calendar event, and writing a diary entry
- Check that the analytics dashboard loads correctly

## Outlook Calendar Sync Setup

PMS supports one-way iCal sync from Outlook to PMS (read-only).

### How iCal Sync Works

- Fetches events from a public iCal URL
- Imports them as `source='outlook'` in calendar_events
- Deduplicates using the UID field from the .ics file
- Deleted events in Outlook disappear on next sync
- Syncs manually or automatically (every 10 minutes max)

### Get Your Outlook iCal URL

1. Go to [outlook.office.com](https://outlook.office.com)
2. Click Settings (gear) → View all Outlook settings → Calendar
3. Under "Shared calendars", click "Publish a calendar"
4. Select your calendar and set permission to "Can view all details"
5. Copy the ICS link (ends with `.ics`)
6. In PMS, go to Settings → Calendar → Outlook iCal URL and paste it

### Add Feed in PMS

1. Go to `/settings`
2. Under "Calendar", click "Add iCal Feed"
3. Enter:
   - Name: "Outlook Calendar" (or any name)
   - iCal URL: The URL copied from Outlook
   - Calendar Type: Choose a category (e.g., WORK, PERSONAL)
   - Color: Optional display color
4. Click "Add Feed"
5. Click "Sync Now" to import events

### Sync Behavior

- **Frequency**: Manual sync button + auto-sync on calendar load (max once per 10 minutes)
- **Direction**: One-way only (Outlook → PMS). Changes in PMS don't affect Outlook
- **Deduplication**: Uses the UID field from iCal events
- **Deleted Events**: Removed from PMS on next sync
- **Recurring Events**: Fully supported via RRULE parsing

## Deploying to Vercel

### 1. Push Code to GitHub

```bash
git add .
git commit -m "Initial setup"
git push origin main
```

### 2. Connect Repository to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project" → Import Git Repository
3. Select your GitHub repository
4. Vercel will detect it's a Next.js project

### 3. Add Environment Variables

In Vercel Dashboard → Project Settings → Environment Variables, add all variables from `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_TENANT_ID`

**Important**: Set `NEXT_PUBLIC_APP_URL` to your Vercel deployment URL (not localhost).

### 4. Deploy

Click "Deploy". Vercel will build and deploy your application.

### 5. Post-Deployment Setup

Update Supabase Auth redirect URLs:

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add your Vercel URL to "Redirect URLs" (e.g., `https://your-app.vercel.app`)
3. Add `https://your-app.vercel.app/auth/callback` for auth callbacks

## Environment Variables Reference

| Variable | Required | Description | Where to Find |
|----------|----------|-------------|---------------|
| NEXT_PUBLIC_SUPABASE_URL | Yes | Supabase project URL | Supabase Dashboard → Settings → API → Project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Yes | Supabase anonymous key | Supabase Dashboard → Settings → API → anon key |
| SUPABASE_SERVICE_ROLE_KEY | Yes | Supabase service role key | Supabase Dashboard → Settings → API → service_role |
| MICROSOFT_CLIENT_ID | No | Microsoft app ID | Azure Portal → App registrations |
| MICROSOFT_CLIENT_SECRET | No | Microsoft app secret | Azure Portal → App registrations → Certificates & secrets |
| MICROSOFT_TENANT_ID | No | Microsoft tenant ID | Azure Portal overview |

## Key Architectural Decisions

### Supabase over Other Databases
Chosen for its all-in-one solution: PostgreSQL database, built-in authentication, and real-time capabilities. The free tier is generous for single-user apps.

### Single-User Architecture
The app is designed for one person per deployment. While the database schema supports multi-tenancy via `user_id` and RLS, the UI and features assume a single user, simplifying the mental model and reducing complexity.

### iCal over Microsoft Graph OAuth
iCal sync is simpler, doesn't require OAuth setup, and works with any calendar that supports iCal publishing (not just Outlook). It's read-only, which matches most users' needs.

### Email/Password over Magic Link
Traditional email/password login provides a more familiar experience and works reliably across all email providers without the deliverability issues of magic links.

### Server-Side Analytics Calculation
Analytics are computed in the API route (`/api/analytics`) rather than client-side to reduce payload size and leverage PostgreSQL's powerful date functions.

### React Query for Data Fetching
Provides automatic caching, background refetching, and optimistic updates. The 2-minute stale time and 10-minute garbage collection time balance freshness with performance.

## Performance Optimisations

### Database Indexes
- **tasks**: user_id, status, deadline, completed_at, parent_task_id, tags (GIN)
- **calendar_events**: user_id, time range, outlook_event_id, task_id
- **diary_entries**: user_id, updated_at, tags (GIN), full-text search

### React Query Caching
- Stale time: 2 minutes for fresh data
- Garbage collection: 10 minutes
- Infinite scroll with 30 tasks/page and 20 diary entries/page

### Column Selection Optimization
All Supabase queries select explicit columns instead of `SELECT *` to reduce payload size:
- Tasks: Excludes `description` from list views
- Diary: Excludes `content` JSON from list views (uses `content_text` for search)

### Lazy Loading
Heavy components are loaded on-demand:
- **Analytics charts** (Recharts components)
- **Diary editor** (Tiptap rich text editor)
- **Calendar** (FullCalendar - client-side only)

### Parallel Data Fetching
Sequential fetches replaced with `Promise.all`:
- Calendar page: preferences + feeds
- Settings page: feeds + preferences

### Optimistic Updates
UI updates happen instantly:
- Task status toggles
- Task creation/deletion
- Diary entry creation/deletion

## Feature Walkthroughs

### Tasks

**Kanban Board Interface**
- Three columns: To Do, In Progress, Done Today
- Drag and drop cards between columns using the grip handle
- Archive panel for older completed tasks
- Tag-based filtering in sidebar

**Creating a Task**
- Press `N` key or click "+" button
- Enter title, set priority (low/medium/high), add tags, set deadline
- Click "Create Task" or press Ctrl+Enter

**Managing Tasks**
- **Drag and drop**: Use grip handle on left edge of To Do cards to move to In Progress
- **Quick complete**: Click checkbox on In Progress cards to move to Done
- **Detail panel**: Click card body to view details, add subtasks, or edit
- **Archive**: View older completed tasks in archive panel

**Task Features**
- **Keyboard shortcuts**: `N` for new task, `Ctrl+S` to save
- **Drag and drop**: Visual feedback with ghost card during drag
- **Subtasks**: Click a task → Detail panel → Add subtask
- **Recurring tasks**: Set `is_recurring=true` and provide RRULE
- **Deadline sync**: Tasks with deadlines create calendar events
- **Tag badges**: Independent count badges in sidebar

### Calendar

**Navigation**
- Switch between Month, Week, and Day views
- Navigate with arrow buttons or "Today" button
- Drag to create events, click to edit

**Event Management**
- Click empty space to create new event
- Click existing event to view/edit
- Set all-day events or specific times
- Color-code by calendar type

**Outlook Sync**
- Settings → Calendar → Add iCal Feed
- Paste Outlook iCal URL
- Choose calendar type and color
- Click "Sync Now" to import

### Analytics

**Date Range Selection**
- Use dropdown to select: 30 days, 90 days, 1 year, or all time
- Charts update automatically based on range

**Understanding Charts**
- **Weekly Review**: Completion rate and task count by week
- **Streak Heatmap**: Daily completion patterns (green = completed, gray = missed)
- **Completion Over Time**: Line chart of task completion trends
- **Time of Day**: Heatmap showing productive hours
- **Tag Breakdown**: Success rate by tag category
- **Overdue Patterns**: Analysis of missed deadlines

### Diary

**Creating Entries**
- Click "+" button or press `N`
- Title is optional
- Rich text editor supports formatting shortcuts

**Rich Text Editing**
- `Cmd+B` for bold
- `Cmd+I` for italic
- `Cmd+K` for links
- Paste images directly (uploads to Supabase Storage)

**Organization**
- Add tags for categorization
- Search across all entries
- Filter by tags in sidebar
- Entries sorted by updated_at (newest first)

## Known Limitations

- **Single user only** - No multi-user support or collaboration
- **Outlook sync is one-way** - Read-only from Outlook to PMS
- **No mobile app** - Web only (PWA installable)
- **No real-time collaboration** - Single-user design
- **No data export** - Cannot export to CSV/JSON (yet)
- **Recurring tasks display** - Limited UI for managing RRULE patterns
- **No offline access** - Requires internet connection

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|--------------|-----|
| Supabase connection error | Missing or wrong env vars | Check `.env.local` has correct `NEXT_PUBLIC_SUPABASE_URL` and keys |
| Login not working | Supabase Auth not configured | Enable Email/Password auth in Supabase Dashboard → Authentication |
| iCal sync failing | Invalid iCal URL | Verify URL ends in `.ics` and is publicly accessible |
| Calendar events not showing | RLS policy issue | Ensure all tables have RLS enabled with correct policies |
| Slow queries | Missing indexes | Run migration `0005_performance_indexes.sql` |
| Build failing on Vercel | Missing env vars | Add all variables from `.env.local` to Vercel dashboard |
| Tasks not appearing | Database query error | Check Supabase logs for column errors (e.g., missing `calendar_event_id`) |
| Diary editor not loading | SSR hydration error | Ensure `immediatelyRender: false` in Tiptap config |
| Analytics charts empty | No data in date range | Create some tasks with completion dates |

## Recent Changes

### March 2026 - Kanban Board Migration
- **Migrated from task list to Kanban board** with three columns (To Do, In Progress, Done Today)
- **Implemented drag-and-drop** using @dnd-kit with visual feedback and ghost cards
- **Added archive panel** for older completed tasks with infinite scroll
- **Separated diary and task tags** with independent count badges in sidebar
- **Added task tag counts API** for accurate sidebar badge counts
- **Improved task management** with grip handles and smooth transitions

## Future Roadmap

- [ ] Mobile app (React Native + Expo)
- [ ] PWA support (offline access, home screen install)
- [ ] Data export (CSV, JSON)
- [ ] Pomodoro timer integration
- [ ] Weekly email digest
- [ ] Phosphorus research project tracker (custom tag category)
- [ ] Multi-device push notifications
- [ ] Dark/light mode toggle
- [ ] Backup and restore functionality
- [ ] Microsoft Graph OAuth integration (two-way sync)
- [ ] Task templates
- [ ] Habit tracking
- [ ] Goal setting and progress tracking
