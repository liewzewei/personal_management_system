/**
 * Supabase access layer for PMS.
 *
 * Exports:
 * - `createBrowserSupabaseClient()`: client-side Supabase instance (uses anon key).
 * - `createServerSupabaseClient()`: server-side instance bound to Next.js cookies (uses anon key).
 * - `createServiceRoleClient()`: server-side admin instance (uses service role key). Never import this
 *   in client components; use only in server route handlers for admin operations.
 *
 * Rule for this codebase:
 * - UI components and route handlers must not write raw Supabase queries.
 * - Add/extend typed helper functions below and call those instead.
 */

import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import type { CalendarEvent, DiaryEntry, OAuthToken, OutlookSyncState, Task } from "@/types";

type PublicSchema = "public";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getSupabaseUrl(): string {
  return getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
}

function getSupabaseAnonKey(): string {
  return getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

function getSupabaseServiceRoleKey(): string {
  return getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function createBrowserSupabaseClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          cookieStore.set(cookie);
        }
      },
    },
  });
}

export function createServiceRoleClient(): SupabaseClient {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { persistSession: false },
  });
}

function createAnonServerClient(): SupabaseClient {
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: false },
  });
}

type SupabaseQueryResult<T> = { data: T; error: null } | { data: null; error: Error };

function asError(message: string, cause: unknown): Error {
  if (cause instanceof Error) {
    const wrapped = new Error(message);
    (wrapped as unknown as { cause?: unknown }).cause = cause;
    return wrapped;
  }
  return new Error(message);
}

async function requireUserId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error) throw asError("Failed to read authenticated user", error);
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
}

/**
 * Single-user enforcement support.
 *
 * Returns up to 2 existing users so callers can check “more than one”.
 * We intentionally do not fetch the full user list for safety/performance.
 */
export async function getExistingUsersUpTo2(): Promise<SupabaseQueryResult<{ id: string }[]>> {
  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 2 });
    if (error) return { data: null, error: asError("Failed to list users", error) };
    return { data: data.users.map((u) => ({ id: u.id })), error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to list users", cause) };
  }
}

/**
 * Sends a magic-link email using Supabase Auth OTP flow.
 *
 * The session is established when the user returns to the app via the
 * `/auth/callback` route (code exchange).
 */
export async function sendMagicLinkEmail(input: {
  email: string;
  emailRedirectTo: string;
}): Promise<SupabaseQueryResult<null>> {
  try {
    const anon = createAnonServerClient();
    const { error } = await anon.auth.signInWithOtp({
      email: input.email,
      options: { emailRedirectTo: input.emailRedirectTo },
    });
    if (error) return { data: null, error: asError("Failed to send magic link", error) };
    return { data: null, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to send magic link", cause) };
  }
}

// =========================
// Typed database helpers
// =========================

export async function getTasks(): Promise<SupabaseQueryResult<Task[]>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);
    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return { data: null, error: asError("Failed to fetch tasks", error) };
    return { data: data as unknown as Task[], error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch tasks", cause) };
  }
}

// Placeholders for upcoming domains (kept typed so API routes don’t inline queries).
export async function getCalendarEvents(): Promise<SupabaseQueryResult<CalendarEvent[]>> {
  return { data: [], error: null };
}

export async function getDiaryEntries(): Promise<SupabaseQueryResult<DiaryEntry[]>> {
  return { data: [], error: null };
}

export async function getOutlookSyncState(): Promise<SupabaseQueryResult<OutlookSyncState[]>> {
  return { data: [], error: null };
}

export async function getOAuthTokens(): Promise<SupabaseQueryResult<OAuthToken[]>> {
  return { data: [], error: null };
}

