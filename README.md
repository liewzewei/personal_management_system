![Next.js](https://img.shields.io/badge/Next.js-16-black)
![Supabase](https://img.shields.io/badge/Supabase-green)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![Tailwind](https://img.shields.io/badge/Tailwind-v4.2.1-blue)

# PMS - Personal Management System

A privacy-focused, all-in-one productivity web application for personal task management, calendar sync, exercise tracking, analytics, and journaling. Built with Next.js, Supabase, and Tailwind CSS v4.

## Features

### Task Management
- Kanban board with drag-and-drop between To Do, In Progress, and Done columns
- Subtasks, priorities, tags, and deadlines
- Archive panel for completed tasks
- Automatic calendar event creation for deadlines
- Mobile-responsive with vertical stacking on small screens

### Calendar
- Local event management with FullCalendar integration
- One-way Outlook iCal sync (read-only)
- Month, week, and day views
- Color-coded by calendar type
- Auto-sync from task deadlines

### Analytics
- Task completion trends and streaks
- Weekly review charts
- Time-of-day productivity heatmap
- Tag-based success rate breakdown
- Overdue pattern analysis

### Diary
- Rich-text editor with Tiptap (bold, italic, links, images)
- Full-text search across all entries
- Tag-based organization
- Image uploads to Supabase Storage

### Exercise Tracking
- **Running**: Distance, pace, duration, personal records
- **Swimming**: Pool/open water, stroke types, SWOLF score
- **Nutrition**: BMR/TDEE calculator, food logging, macro tracking
- **Analytics**: Unified dashboard with trends and progress charts

### Mobile-Responsive Design
- Collapsible sidebar on desktop (Cmd/Ctrl+\\ to toggle)
- Bottom navigation on mobile (< 768px)
- Touch-optimized Kanban board
- Safe area support for iOS notch/home bar

## Tech Stack

| Technology | Purpose | Version |
|------------|---------|---------|
| Next.js | React framework with App Router | 16.1.6 |
| Supabase | PostgreSQL + Auth + Storage | - |
| Tailwind CSS | Utility-first CSS framework | **4.2.1** |
| shadcn/ui | UI component library | **v4** |
| radix-ui | Unified primitives package | 1.4.3 |
| Recharts | Analytics charts | 3.8.0 |
| FullCalendar | Calendar component | 6.1.20 |
| Tiptap | Rich-text editor | 3.20.1 |
| React Query | Server state management | 5.90.21 |
| @dnd-kit | Drag and drop | 6.3.1 |
| Zod | Schema validation | 4.3.6 |
| TypeScript | Type safety | 5 |

## Quick Start

### 1. Clone and Install
```bash
git clone <your-repo-url>
cd personal_management_system
npm install
```

### 2. Supabase Setup
1. Create a project at [supabase.com](https://supabase.com)
2. Enable Email/Password auth in Authentication settings
3. Note your project URL and anon key from Settings → API

### 3. Run Migrations
```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

### 4. Configure Environment
Create `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) and create your user account in Supabase Dashboard → Authentication → Users.

## Deployment to Vercel

1. Push code to GitHub
2. Import repository in [Vercel](https://vercel.com)
3. Add environment variables from `.env.local`
4. Deploy
5. Update Supabase Auth redirect URLs to include your Vercel domain

## Keyboard Shortcuts

### Global Shortcuts
| Shortcut | Function |
|----------|----------|
| **Ctrl+\\** (or **Cmd+\\** on Mac) | Toggle sidebar collapse/expand |
| **N** | Open new task modal (when not in input field) |
| **Ctrl+S** (or **Cmd+S**) | Save diary entry |

### Diary Editor Shortcuts
#### Text Formatting
| Shortcut | Function |
|----------|----------|
| **Ctrl+B** (or **Cmd+B**) | Bold text |
| **Ctrl+I** (or **Cmd+I**) | Italic text |
| **Ctrl+U** (or **Cmd+U**) | Underline text |
| **Ctrl+E** (or **Cmd+E**) | Inline code |
| **Ctrl+Shift+S** (or **Cmd+Shift+S**) | Strikethrough |

#### Structure & Lists
| Shortcut | Function |
|----------|----------|
| **Ctrl+Alt+1/2/3** (or **Cmd+Option+1/2/3**) | Heading 1/2/3 |
| **Ctrl+Alt+0** (or **Cmd+Option+0**) | Paragraph |
| **Ctrl+Shift+8** (or **Cmd+Shift+8**) | Bullet list |
| **Ctrl+Shift+7** (or **Cmd+Shift+7**) | Numbered list |
| **Ctrl+Shift+9** (or **Cmd+Shift+9**) | Task list |
| **Ctrl+Shift+B** (or **Cmd+Shift+B**) | Blockquote |
| **Ctrl+Alt+C** (or **Cmd+Option+C**) | Code block |

#### Navigation & Editing
| Shortcut | Function |
|----------|----------|
| **Ctrl+Z** (or **Cmd+Z**) | Undo |
| **Ctrl+Shift+Z** (or **Cmd+Shift+Z**) | Redo |
| **Tab** | Indent (2 spaces in code blocks) |
| **Enter** | Add tag/subtask in forms |

## Documentation

For detailed technical information, see:
- **[Codebase Overview](./CODEBASE_OVERVIEW.md)** - Architecture, database schema, and technical decisions
- **[Database Schema](./CODEBASE_OVERVIEW.md#database-schema)** - Complete table definitions and indexes
- **[API Routes](./CODEBASE_OVERVIEW.md#backend-architecture)** - API endpoint structure
- **[Feature Deep Dives](./CODEBASE_OVERVIEW.md#feature-deep-dives)** - Implementation details for each module

## Common Issues

| Problem | Solution |
|---------|----------|
| Supabase connection error | Verify `.env.local` has correct `NEXT_PUBLIC_SUPABASE_URL` and keys |
| Login not working | Enable Email/Password auth in Supabase Dashboard → Authentication |
| iCal sync failing | Ensure URL ends in `.ics` and is publicly accessible |
| Build failing on Vercel | Add all environment variables from `.env.local` to Vercel dashboard |

## Outlook Calendar Sync

To sync your Outlook calendar (read-only):
1. Go to [outlook.office.com](https://outlook.office.com) → Settings → Calendar
2. Under "Shared calendars", publish your calendar and copy the ICS link
3. In PMS, go to Settings → Add iCal Feed and paste the URL
4. Click "Sync Now" to import events

Sync is one-way (Outlook → PMS) and runs automatically every 10 minutes.

## Architecture

**Single-User Design**: Built for one person per deployment. Database schema supports multi-tenancy via RLS, but UI assumes single user for simplicity.

**Key Decisions**:
- **Supabase**: All-in-one PostgreSQL + Auth + Storage solution
- **React Query**: Automatic caching, optimistic updates, 2-min stale time
- **Server-Side Analytics**: Computed in API routes using PostgreSQL date functions
- **iCal Sync**: Simple read-only sync without OAuth complexity

**Performance**:
- Strategic database indexes on all tables
- Lazy loading for heavy components (FullCalendar, Tiptap, Recharts)
- Optimistic UI updates for instant feedback
- Infinite scroll for large lists (30 tasks/page, 20 diary entries/page)

For complete technical details, see [CODEBASE_OVERVIEW.md](./CODEBASE_OVERVIEW.md).

## License

MIT
