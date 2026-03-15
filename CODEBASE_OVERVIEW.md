# PMS (Personal Management System) - Comprehensive Codebase Overview

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Frontend Architecture](#frontend-architecture)
5. [Backend Architecture](#backend-architecture)
6. [Feature Deep Dives](#feature-deep-dives)
7. [Key Technical Decisions](#key-technical-decisions)
8. [Development Workflow](#development-workflow)
9. [Performance Optimizations](#performance-optimizations)
10. [Security Considerations](#security-considerations)
11. [Deployment Architecture](#deployment-architecture)
12. [Future Extensibility](#future-extensibility)

---

## System Overview

PMS is a single-user, privacy-focused productivity application that combines task management, calendar integration, analytics, and journaling into one cohesive system. It's built with a modern stack focused on developer experience and performance.

### Core Features
- **Task Management**: Kanban board with drag-and-drop, subtasks, priorities, tags, deadlines, recurring tasks
- **Calendar**: Local event management with one-way Outlook iCal sync
- **Analytics**: Visual insights into productivity patterns, streaks, and completion rates
- **Diary**: Rich-text journaling with search, tagging, and image uploads
- **Exercise Tracking**: Running, swimming, and nutrition tracking with analytics and progress insights

### Tech Stack
- **Framework**: Next.js 16.1.6 with App Router
- **Database**: Supabase (PostgreSQL + Auth + Real-time)
- **UI**: Tailwind CSS v4.2.1 + shadcn/ui v4 components
- **Component Library**: radix-ui unified package for primitives
- **State Management**: React Query (TanStack Query) for server state
- **Drag & Drop**: @dnd-kit for Kanban board
- **Rich Text**: Tiptap editor for diary entries
- **Calendar**: FullCalendar with custom integrations
- **Charts**: Recharts for analytics visualizations

---

## Architecture

### High-Level Architecture
```
┌─────────────────┐    HTTP/HTTPS    ┌─────────────────┐
│   Web Browser   │ ◄──────────────► │   Next.js App   │
│                 │                  │   (Vercel)      │
└─────────────────┘                  └─────────────────┘
                                               │
                                               ▼
                                        ┌─────────────────┐
                                        │   Supabase      │
                                        │ (PostgreSQL +   │
                                        │  Auth + Storage)│
                                        └─────────────────┘
```

### Application Structure
- **Client-Side**: React components with local state management
- **Server-Side**: Next.js API routes handle all database operations
- **Database**: PostgreSQL with Row Level Security (RLS)
- **Authentication**: Supabase Auth with email/password

---

## Database Schema

### Core Tables

#### `tasks`
```sql
id: uuid (PK)
user_id: uuid (FK to auth.users)
title: text
description: text
status: text (todo/in_progress/done)
priority: text (low/medium/high)
tags: text[]
deadline: timestamptz
estimated_minutes: integer
is_recurring: boolean
recurrence_rule: text
parent_task_id: uuid (self-reference for subtasks)
outlook_event_id: text
completed_at: timestamptz
created_at: timestamptz
updated_at: timestamptz
```

**Indexes**:
- `idx_tasks_user_id` (user_id)
- `idx_tasks_status` (user_id, status)
- `idx_tasks_deadline` (user_id, deadline) WHERE deadline IS NOT NULL
- `idx_tasks_completed_at` (user_id, completed_at) WHERE completed_at IS NOT NULL
- `idx_tasks_parent_task_id` (parent_task_id) WHERE parent_task_id IS NOT NULL
- `idx_tasks_tags` (GIN on tags)

#### `calendar_events`
```sql
id: uuid (PK)
user_id: uuid (FK)
title: text
description: text
start_time: timestamptz
end_time: timestamptz
is_all_day: boolean
calendar_type: text
outlook_event_id: text
outlook_calendar_id: text
source: text (local/outlook)
task_id: uuid (FK)
created_at: timestamptz
updated_at: timestamptz
```

#### `diary_entries`
```sql
id: uuid (PK)
user_id: uuid (FK)
title: text
content: jsonb (Tiptap JSON)
content_text: text (for search)
tags: text[]
created_at: timestamptz
updated_at: timestamptz
```

#### `ical_feeds`
```sql
id: uuid (PK)
user_id: uuid (FK)
name: text
ical_url: text
calendar_type: text
color: text
is_active: boolean
last_synced_at: timestamptz
created_at: timestamptz
```

#### `user_preferences`
```sql
id: uuid (PK)
user_id: uuid (unique)
calendar_default_view: text
calendar_week_starts_on: text
bmr: integer
tdee: integer
calorie_goal: integer
last_exercise_date: date
created_at: timestamptz
updated_at: timestamptz
```

#### `exercise_sessions`
```sql
id: uuid (PK)
user_id: uuid (FK)
exercise_type: text (run/swim/other)
date: date
distance_km: numeric
duration_minutes: integer
pace_min_per_km: numeric
stroke_type: text (freestyle/backstroke/breaststroke/butterfly/mixed)
pool_length_m: integer
is_open_water: boolean
notes: text
created_at: timestamptz
```

#### `food_logs`
```sql
id: uuid (PK)
user_id: uuid (FK)
date: date
food_name: text
calories: integer
protein_g: numeric
carbs_g: numeric
fat_g: numeric
meal_type: text (breakfast/lunch/dinner/snack)
created_at: timestamptz
```

#### `saved_foods`
```sql
id: uuid (PK)
user_id: uuid (FK)
name: text
calories: integer
protein_g: numeric
carbs_g: numeric
fat_g: numeric
serving_size: text
created_at: timestamptz
```

#### `body_metrics`
```sql
id: uuid (PK)
user_id: uuid (unique)
weight_kg: numeric
height_cm: integer
age: integer
gender: text (male/female/other)
activity_level: text (sedentary/light/moderate/active/very_active)
updated_at: timestamptz
```

### RLS Policies
- All tables have RLS enabled
- Policies ensure users can only access their own data
- Public read access only for authenticated users

---

## Frontend Architecture

### Component Structure
```
/app
├── (pages)/
│   ├── tasks/          # Kanban board implementation
│   ├── calendar/       # FullCalendar integration
│   ├── analytics/      # Charts and insights
│   ├── diary/          # Rich text editor
│   └── settings/       # Configuration
├── api/                # API routes
└── layout.tsx          # Root layout with providers

/components
├── ui/                 # shadcn/ui primitives
├── tasks/              # Task-specific components
├── calendar/           # Calendar components
├── analytics/          # Chart components
└── diary/              # Diary components
```

### State Management Strategy
- **Server State**: React Query with optimistic updates
- **Client State**: React hooks and local state
- **Global State**: Minimal, mostly for UI (modals, panels)
- **Form State**: Controlled components with validation

### Key React Query Keys
```typescript
["tasks", filters]           // Main task list with filters
["task", taskId]            // Single task with subtasks
["subtasks", parentTaskId]  // Independent subtask cache
["task-tag-counts"]         // Sidebar badge counts
["calendar_events", filters] // Calendar events
["diary_entries", filters]  // Diary entries
["analytics", dateRange]    // Analytics data
["tags", "tasks"]           // Task tags
["tags", "diary"]           // Diary tags
```

---

## Backend Architecture

### API Route Structure
```
/api
├── auth/
│   └── login/              # Email/password authentication
├── tasks/
│   ├── route.ts            # GET (list), POST (create)
│   ├── [id]/
│   │   ├── route.ts        # GET, PATCH, DELETE, POST (duplicate)
│   │   └── subtasks/
│   │       └── route.ts    # GET subtasks for parent
│   └── tag-counts/
│       └── route.ts        # GET tag counts for badges
├── calendar/
│   ├── events/             # CRUD operations
│   ├── feeds/              # iCal feed management
│   ├── sync/               # Manual sync triggers
│   └── preferences/        # User preferences
├── diary/
│   └── route.ts            # CRUD operations
├── tags/
│   └── route.ts            # GET all tags
└── analytics/
    └── route.ts            # GET analytics data
```

### Database Access Pattern
All database operations go through `lib/supabase.ts`:
```typescript
// Consistent error handling
type SupabaseQueryResult<T> = {
  data: T | null;
  error: Error | null;
};

// Session verification
async function requireUserId(client: SupabaseClient): Promise<string>

// Example function
export async function getTasks(filters?: TaskFilters): Promise<SupabaseQueryResult<Task[]>>
```

---

## Feature Deep Dives

### 1. Task Management System

#### Kanban Board Implementation
- **Drag & Drop**: @dnd-kit with PointerSensor and KeyboardSensor
- **Three Columns**: To Do, In Progress, Done Today
- **Drag Handle**: GripVertical icon on left edge of To Do cards
- **Visual Feedback**: Ghost card during drag, opacity changes
- **Auto-Scroll**: Columns scroll when dragging near edges

#### Subtask System
- **Independent Cache**: `["subtasks", parentTaskId]` React Query key
- **Real-time Updates**: Shared between KanbanCard and TaskDetailPanel
- **Optimistic UI**: Updates instantly, rolls back on error
- **Auto-complete**: Parent task moves to Done when all subtasks complete
- **Lazy Loading**: Subtasks only fetched when dropdown opens

#### Task Filtering & Search
- **Tags**: Multi-select with independent counts
- **Status**: Todo/In Progress/Done/Archive
- **Priority**: High/Medium/Low
- **Date Range**: Created/Updated/Completed dates
- **Text Search**: Searches title and description

### 2. Calendar Integration

#### iCal Sync System
```typescript
// One-way sync from Outlook to PMS
1. Fetch .ics file from public URL
2. Parse with node-ical library
3. Deduplicate by UID (outlook_event_id)
4. Insert/update as source='outlook'
5. Delete events not in latest feed
```

#### Event Types
- **Local Events**: Created in PMS, fully editable
- **Outlook Events**: Read-only, synced via iCal
- **Task Events**: Auto-created for tasks with deadlines

#### Calendar Features
- **Multiple Views**: Month/Week/Day
- **Event Creation**: Click empty space or drag
- **Color Coding**: By calendar type
- **Timezone Support**: User's local timezone

### 3. Analytics Engine

#### Calculated Metrics
```typescript
interface AnalyticsData {
  completionRate: number;           // Tasks completed / total
  streakData: StreakDay[];          // Daily completion heatmap
  completionTrend: TrendPoint[];    // Over time line chart
  timeOfDayData: TimeSlot[];        // Productive hours heatmap
  tagBreakdown: TagStats[];         // Success by tag
  overduePatterns: OverdueStat[];   // Deadline analysis
}
```

#### Performance Optimizations
- **Server-side Calculation**: PostgreSQL date functions
- **Caching**: 5-minute stale time for analytics
- **Incremental Updates**: Only recalculate when needed

### 4. Diary System

#### Rich Text Editor
- **Tiptap**: Extensible rich text editor
- **Features**: Bold, italic, links, lists, images
- **Image Upload**: Direct to Supabase Storage
- **Content Storage**: JSON (Tiptap) + plain text (for search)

#### Search & Organization
- **Full-text Search**: PostgreSQL GIN index on content_text
- **Tag Filtering**: Independent from task tags
- **Chronological**: Sorted by updated_at

### 5. Exercise Module

#### Running Tracker
- **Session Logging**: Distance, duration, pace, date
- **Personal Records**: Automatic detection of fastest pace, longest distance, longest duration
- **Analytics**: Weekly/monthly trends, total distance, average pace
- **Calendar Integration**: Auto-create calendar events for runs
- **Diary Integration**: Pre-populate diary with session details

#### Swimming Tracker
- **Pool Swimming**: Track laps, pool length (25m/50m), stroke type
- **Open Water**: Distance and duration tracking
- **SWOLF Score**: Automatic calculation (strokes + seconds per length)
- **Stroke Types**: Freestyle, backstroke, breaststroke, butterfly, mixed
- **Analytics**: Distance trends, stroke breakdown, SWOLF improvement

#### Nutrition Tracking
- **BMR/TDEE Calculator**: Based on weight, height, age, gender, activity level
- **Food Logging**: Calories, protein, carbs, fat per meal
- **Saved Foods**: Quick-add frequently eaten foods
- **Daily Summary**: Total calories vs goal, macro breakdown
- **Progress Charts**: Calorie intake trends, macro distribution

#### Exercise Analytics
- **Unified Dashboard**: Combined running, swimming, and nutrition metrics
- **Time Range Selection**: 7 days, 30 days, 90 days, 1 year
- **Charts**: Distance trends, calorie balance, workout frequency
- **Personal Records Display**: All-time bests across activities

### 6. Mobile-Responsive Design

#### Desktop Experience
- **Collapsible Sidebar**: Cookie-persisted state, icon-only collapsed view
- **Keyboard Shortcut**: Cmd/Ctrl+B to toggle sidebar
- **Smooth Transitions**: 200ms ease-linear animations
- **Dynamic Layout**: Main content shifts when sidebar expands/collapses

#### Mobile Experience (< 768px)
- **Bottom Navigation**: Fixed 5-tab bar with Home, Tasks, Calendar, Diary, Exercise
- **No Sidebar**: Sidebar hidden on mobile, replaced by bottom nav
- **Touch-Optimized**: Larger tap targets, swipe-friendly Kanban
- **Safe Area**: iOS notch/home bar support with safe-area-inset-bottom

#### Responsive Components
- **AppSidebar**: Desktop-only collapsible navigation with user profile
- **BottomNav**: Mobile-only tab bar with active route highlighting
- **MobileHeader**: Sticky header with page title and optional actions
- **Kanban Board**: Vertical stacking on mobile, horizontal on desktop

#### Breakpoint Strategy
- **Mobile**: < 768px (md breakpoint)
- **Desktop**: ≥ 768px
- **Tailwind Classes**: `md:flex`, `md:hidden`, `md:flex-row` for responsive layouts

---

## Key Technical Decisions

### 1. Single-User Architecture
- **Rationale**: Simplifies mental model, reduces complexity
- **Implementation**: RLS ensures data isolation even though schema supports multi-tenancy
- **Benefits**: No collaboration features to maintain, faster development

### 2. Supabase over Traditional Backend
- **Pros**: All-in-one solution, generous free tier, real-time capabilities
- **Cons**: Vendor lock-in, potential scaling limits
- **Mitigation**: Keep business logic in API routes, use standard PostgreSQL

### 3. React Query for State Management
- **Why**: Automatic caching, background refetching, optimistic updates
- **Configuration**: 2-minute stale time, 10-minute garbage collection
- **Pattern**: Each feature has its own query key structure

### 4. iCal over OAuth for Calendar Sync
- **Simplicity**: No OAuth flow, works with any iCal source
- **Limitation**: Read-only, manual sync
- **Future**: Could add OAuth for two-way sync

### 5. Component Architecture
- **shadcn/ui**: Copy-paste components, full customization
- **Tailwind CSS**: Utility-first, consistent design
- **TypeScript**: Strict mode for type safety

---

## Development Workflow

### Local Development
```bash
# 1. Clone and install
git clone <repo>
npm install

# 2. Environment setup
cp .env.local.example .env.local
# Add Supabase credentials

# 3. Database setup
supabase link --project-ref <ref>
supabase db push  # Run migrations

# 4. Start dev server
npm run dev
```

### Database Migrations
- Located in `supabase/migrations/`
- Run in order using `supabase db push`
- Include RLS policies and indexes

### Code Organization
- **Feature-based**: Group related files together
- **Shared utilities**: `lib/utils.ts`, `lib/hooks/`
- **Type definitions**: Centralized in `types/index.ts`
- **Validation**: Zod schemas in `lib/validations/`

---

## Performance Optimizations

### Database Level
1. **Strategic Indexes**: Covering indexes for common queries
2. **Column Selection**: Explicit SELECT to reduce payload
3. **Query Optimization**: Use PostgreSQL functions where beneficial
4. **Connection Pooling**: Handled by Supabase

### Application Level
1. **React Query Caching**: Intelligent cache management
2. **Infinite Scroll**: For large lists (tasks, diary)
3. **Lazy Loading**: Components loaded on demand
4. **Optimistic Updates**: Instant UI feedback
5. **Debounced Search**: 300ms delay for search inputs

### Frontend Optimizations
1. **Code Splitting**: Dynamic imports for heavy components
2. **Image Optimization**: Next.js Image component
3. **Bundle Analysis**: Regular checks for bundle size
4. **Memoization**: React.memo for expensive renders

---

## Security Considerations

### Authentication & Authorization
1. **Supabase Auth**: JWT-based authentication
2. **RLS Policies**: Row-level security on all tables
3. **Session Validation**: Server-side verification on all API routes
4. **CORS**: Configured for production domain

### Data Protection
1. **Environment Variables**: Sensitive data server-side only
2. **Input Validation**: Zod schemas on all API endpoints
3. **SQL Injection**: Parameterized queries via Supabase client
4. **XSS Protection**: React's built-in protections, content sanitization

### API Security
```typescript
// Example: Protected route pattern
export async function GET(request: NextRequest) {
  const client = await createServerSupabaseClient();
  const userId = await requireUserId(client);
  // Proceed with user-specific data
}
```

---

## Deployment Architecture

### Vercel Deployment
```
┌─────────────────┐
│     Vercel      │
│  (Edge Network) │
└─────────┬───────┘
          │
    ┌─────▼─────┐
    │ Next.js   │
    │ App       │
    └─────┬─────┘
          │
    ┌─────▼─────┐
    │ Supabase  │
    │ (us-east) │
    └───────────┘
```

### Environment Configuration
- **Production**: Vercel environment variables
- **Development**: Local `.env.local`
- **Feature Flags**: Environment-based feature toggles

### Build Process
```json
{
  "scripts": {
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  }
}
```

---

## Future Extensibility

### Planned Features
1. **Mobile App**: React Native + Expo
2. **PWA Support**: Offline capabilities
3. **Data Export**: CSV/JSON exports
4. **Advanced Analytics**: More insights and predictions
5. **Habit Tracking**: Integrated with tasks
6. **Goal Setting**: Track progress towards objectives

### Architectural Considerations
1. **Multi-tenancy**: Schema already supports, just need UI changes
2. **Real-time Collaboration**: Supabase real-time ready
3. **API Rate Limiting**: Add middleware for API protection
4. **Microservices**: Could extract services as needed
5. **Database Scaling**: Read replicas for analytics queries

### Code Patterns for Extensibility
```typescript
// 1. Consistent error handling
return { data: result, error: null };

// 2. Type-safe API routes
const parsed = schema.safeParse(body);
if (!parsed.success) { ... }

// 3. Reusable query patterns
export function useEntityQuery<T>(key: string, fetcher: () => Promise<T>) {
  return useQuery({ queryKey: [key], queryFn: fetcher });
}

// 4. Component composition
<FeatureWrapper>
  <FeatureHeader />
  <FeatureContent />
  <FeatureFooter />
</FeatureWrapper>
```

---

## Conclusion

PMS demonstrates a modern full-stack application with:
- Clean architecture with separation of concerns
- Comprehensive type safety with TypeScript
- Optimistic UI with intelligent caching
- Security-first approach with RLS
- Performance optimizations at all levels
- Extensible design for future growth

The codebase serves as a reference implementation for building production-ready applications with Next.js and Supabase.
