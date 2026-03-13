## PMS (Personal Management System)

PMS is a **single-user**, private web app for personal productivity:
- Tasks
- Calendar (local + later Outlook sync)
- Diary
- Analytics

Tech stack:
- Next.js (App Router) + TypeScript (strict)
- Supabase (Postgres + Auth)
- Tailwind CSS + shadcn/ui (UI primitives)

## Supabase setup + run migration

### 1) Create a Supabase project
- Create a new project in Supabase.
- In the Supabase Dashboard, ensure Email auth is enabled:
  - Authentication → Providers → Email (magic link / OTP)

### 2) Install the Supabase CLI
Follow Supabase’s official instructions for your OS.

### 3) Link this repo to your Supabase project
From the repo root:

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

### 4) Apply the migration
This repo includes a single migration file:
- `supabase/migrations/20260313000000_init.sql`

Run:

```bash
supabase db push
```

## Environment variables

1. Copy the example file:

```bash
cp .env.local.example .env.local
```

2. Fill in values in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT_ID` (reserved for later)

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Deploy to Vercel

1. Create a new Vercel project from this repo.
2. Add the same environment variables in Vercel:
   - Project Settings → Environment Variables
3. Deploy.

Notes:
- Supabase Auth magic-link redirects back to your site via `/auth/callback`.
- If you use a custom domain, ensure it’s included in Supabase Auth redirect URL settings.
