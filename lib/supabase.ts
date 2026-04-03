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
 *
 * Connection Pooling (important for serverless / Vercel):
 * -------------------------------------------------------
 * The Supabase JS client (`createBrowserClient` / `createServerClient`) connects
 * via the **PostgREST HTTP API** — it does NOT open a raw Postgres TCP connection.
 * This means the JS SDK already benefits from Supabase's built-in connection pooler
 * (Supavisor) without any URL changes.
 *
 * If you ever add a **direct Postgres connection** (e.g. via `pg`, Drizzle ORM,
 * Prisma, or raw SQL), use the **pooler URL** from the Supabase dashboard
 * (port 6543, mode=transaction) instead of the direct URL (port 5432):
 *
 *   Direct:  postgresql://postgres.[ref]:@aws-0-[region].pooler.supabase.com:5432/postgres
 *   Pooler:  postgresql://postgres.[ref]:@aws-0-[region].pooler.supabase.com:6543/postgres
 *
 * This prevents "too many connections" errors in serverless environments where
 * each invocation would otherwise open a fresh Postgres connection.
 */

import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import type { BodyMetric, CalendarEvent, CalendarEventInput, DailyNutritionSummary, DiaryEntry, DiaryFolder, ExerciseSession, FoodLog, IcalFeed, IcalFeedInput, OAuthToken, OutlookSyncState, PersonalRecord, RunLap, SavedFood, Task, TaskFilters, TaskInput, TaskWithSubtasks, UserPreferences, PortfolioProject, PortfolioProjectInput, BlogPost, BlogPostInput, SiteConfig, SiteConfigInput } from "@/types";
import type { PRDistanceBucket } from "@/types";
import { calculatePace, getDistanceBucket } from "@/lib/exercise-utils";

export type PublicSchema = "public";

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

export async function requireUserId(client: SupabaseClient): Promise<string> {
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
 * Authentication helper functions for PMS.
 */

/**
 * Signs in a user with email and password.
 * Creates a session that persists via cookies.
 */
export async function signIn(email: string, password: string): Promise<SupabaseQueryResult<null>> {
  try {
    const client = await createServerSupabaseClient();
    const { error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { data: null, error: asError("Failed to sign in", error) };
    return { data: null, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to sign in", cause) };
  }
}

/**
 * Signs out the current user.
 * Clears the session cookies.
 */
export async function signOut(): Promise<SupabaseQueryResult<null>> {
  try {
    const client = await createServerSupabaseClient();
    const { error } = await client.auth.signOut();
    if (error) return { data: null, error: asError("Failed to sign out", error) };
    return { data: null, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to sign out", cause) };
  }
}

// =========================
// Task helpers
// =========================

/**
 * Fetches top-level tasks (where parent_task_id IS NULL) with optional filters.
 * @param filters - Optional tag, status, search, and sortBy parameters.
 * @returns Array of top-level tasks matching the filters.
 */
export async function getTasks(filters?: TaskFilters & { limit?: number; offset?: number }): Promise<SupabaseQueryResult<Task[]>> {
  try {
    const client = await createServerSupabaseClient();
    const userId = await requireUserId(client);

    let query = client
      .schema<PublicSchema>("public")
      .from("tasks")
      .select("id,title,status,priority,tags,deadline,estimated_minutes,completed_at,parent_task_id,is_recurring,outlook_event_id,created_at,updated_at,user_id,description")
      .is("parent_task_id", null);

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }

    if (filters?.tag) {
      query = query.contains("tags", [filters.tag]);
    }

    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    const sortBy = filters?.sortBy ?? "created_at";
    switch (sortBy) {
      case "deadline":
        query = query.order("deadline", { ascending: true, nullsFirst: false });
        break;
      case "priority": {
        // priority_order: high=0, medium=1, low=2 — we sort by raw text which happens to sort correctly (high < low < medium)
        // Actually we need a custom ordering. We'll do a secondary sort after fetch.
        query = query.order("created_at", { ascending: false });
        break;
      }
      case "title":
        query = query.order("title", { ascending: true });
        break;
      default:
        query = query.order("created_at", { ascending: false });
    }

    // Pagination
    if (filters?.limit) {
      const offset = filters.offset ?? 0;
      query = query.range(offset, offset + filters.limit - 1);
    }

    const { data, error } = await query;
    if (error) return { data: null, error: asError("Failed to fetch tasks", error) };

    let tasks = data as unknown as Task[];

    // Fetch subtask counts in a single query for all tasks
    const taskIds = tasks.map(t => t.id);
    if (taskIds.length > 0) {
      const { data: subtasks } = await client
        .schema<PublicSchema>("public")
        .from("tasks")
        .select("parent_task_id,status")
        .in("parent_task_id", taskIds)
        .eq("user_id", userId);

      if (subtasks) {
        // Compute counts per parent task
        const counts: Record<string, { total: number; done: number }> = {};
        for (const sub of subtasks as unknown as Task[]) {
          if (!sub.parent_task_id) continue;
          if (!counts[sub.parent_task_id]) {
            counts[sub.parent_task_id] = { total: 0, done: 0 };
          }
          counts[sub.parent_task_id].total++;
          if (sub.status === "done") {
            counts[sub.parent_task_id].done++;
          }
        }

        // Attach counts to tasks
        tasks = tasks.map(t => ({
          ...t,
          subtask_count: counts[t.id]?.total ?? 0,
          subtask_done_count: counts[t.id]?.done ?? 0,
        }));
      }
    }

    // Custom priority sorting since Postgres text ordering doesn't match our desired order
    if (sortBy === "priority") {
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      tasks = tasks.sort((a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1));
    }

    return { data: tasks, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch tasks", cause) };
  }
}

/**
 * Fetches a single task by ID along with its subtasks.
 * @param taskId - UUID of the task to fetch.
 * @returns The task with its subtasks array populated.
 */
export async function getTaskById(taskId: string): Promise<SupabaseQueryResult<TaskWithSubtasks>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    const { data: task, error: taskError } = await client
      .schema<PublicSchema>("public")
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    if (taskError) return { data: null, error: asError("Failed to fetch task", taskError) };

    const { data: subtasks, error: subError } = await client
      .schema<PublicSchema>("public")
      .from("tasks")
      .select("*")
      .eq("parent_task_id", taskId)
      .order("created_at", { ascending: true });

    if (subError) return { data: null, error: asError("Failed to fetch subtasks", subError) };

    const result: TaskWithSubtasks = {
      ...(task as unknown as Task),
      subtasks: (subtasks as unknown as Task[]) ?? [],
    };

    return { data: result, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch task", cause) };
  }
}

/**
 * Creates a new task.
 * @param taskData - Fields for the new task (title required).
 * @returns The created task row.
 */
export async function createTask(taskData: TaskInput & { title: string }): Promise<SupabaseQueryResult<Task>> {
  try {
    const client = await createServerSupabaseClient();
    const userId = await requireUserId(client);

    const row = {
      user_id: userId,
      title: taskData.title,
      description: taskData.description ?? null,
      status: taskData.status ?? "todo",
      priority: taskData.priority ?? "medium",
      tags: taskData.tags ?? null,
      deadline: taskData.deadline ?? null,
      estimated_minutes: taskData.estimated_minutes ?? null,
      is_recurring: taskData.is_recurring ?? false,
      recurrence_rule: taskData.recurrence_rule ?? null,
      parent_task_id: taskData.parent_task_id ?? null,
    };

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("tasks")
      .insert(row)
      .select("*")
      .single();

    if (error) return { data: null, error: asError("Failed to create task", error) };

    const task = data as unknown as Task;

    // Calendar sync: if the task has a deadline, create a calendar event for it
    if (task.deadline && !task.parent_task_id) {
      try {
        const calResult = await createCalendarEventFromTask(userId, task);
        if (calResult.data) {
          await client
            .schema<PublicSchema>("public")
            .from("tasks")
            .update({ outlook_event_id: calResult.data.id })
            .eq("id", task.id);
        }
      } catch {
        // Calendar sync failure should not break task creation
      }
    }

    return { data: task, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to create task", cause) };
  }
}

/**
 * Updates an existing task.
 * @param taskId - UUID of the task to update.
 * @param updates - Partial task fields to update.
 * @returns The updated task row.
 */
export async function updateTask(taskId: string, updates: TaskInput): Promise<SupabaseQueryResult<Task>> {
  try {
    const client = await createServerSupabaseClient();
    const userId = await requireUserId(client);

    // If status is being set to 'done', also set completed_at
    const extra: Record<string, unknown> = {};
    if (updates.status === "done") {
      extra.completed_at = new Date().toISOString();
    } else if (updates.status) {
      extra.completed_at = null;
    }

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("tasks")
      .update({ ...updates, ...extra })
      .eq("id", taskId)
      .select("*")
      .single();

    if (error) return { data: null, error: asError("Failed to update task", error) };

    const updatedTask = data as unknown as Task;

    // Calendar sync: handle deadline changes
    try {
      if (updates.deadline !== undefined) {
        if (updates.deadline) {
          // Deadline was added or changed → create or update calendar event
          await updateCalendarEventFromTask(userId, updatedTask);
        } else {
          // Deadline was removed → delete the linked calendar event
          await deleteCalendarEventForTask(userId, taskId);
        }
      }
    } catch {
      // Calendar sync failure should not break task update
    }

    return { data: updatedTask, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to update task", cause) };
  }
}

/**
 * Deletes a task and all its subtasks (cascade handled by DB FK).
 * @param taskId - UUID of the task to delete.
 */
export async function deleteTask(taskId: string): Promise<SupabaseQueryResult<{ deleted: true }>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    const { error } = await client
      .schema<PublicSchema>("public")
      .from("tasks")
      .delete()
      .eq("id", taskId);

    if (error) return { data: null, error: asError("Failed to delete task", error) };
    return { data: { deleted: true }, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to delete task", cause) };
  }
}

/**
 * Fetches subtasks for a given parent task.
 * @param parentTaskId - UUID of the parent task.
 * @returns Array of subtask rows.
 */
export async function getSubtasks(parentTaskId: string): Promise<SupabaseQueryResult<Task[]>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("tasks")
      .select("*")
      .eq("parent_task_id", parentTaskId)
      .order("created_at", { ascending: true });

    if (error) return { data: null, error: asError("Failed to fetch subtasks", error) };
    return { data: data as unknown as Task[], error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch subtasks", cause) };
  }
}

/**
 * Duplicates a task: creates a copy with "Copy of ..." title, status reset to
 * 'todo', and completed_at set to null.
 * @param taskId - UUID of the task to duplicate.
 * @returns The newly created duplicate task.
 */
export async function duplicateTask(taskId: string): Promise<SupabaseQueryResult<Task>> {
  try {
    const client = await createServerSupabaseClient();
    const userId = await requireUserId(client);

    const { data: original, error: fetchErr } = await client
      .schema<PublicSchema>("public")
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    if (fetchErr || !original) return { data: null, error: asError("Failed to find task to duplicate", fetchErr ?? new Error("Not found")) };

    const orig = original as unknown as Task;

    const row = {
      user_id: userId,
      title: `Copy of ${orig.title}`,
      description: orig.description,
      status: "todo" as const,
      priority: orig.priority,
      tags: orig.tags,
      deadline: orig.deadline,
      estimated_minutes: orig.estimated_minutes,
      is_recurring: orig.is_recurring,
      recurrence_rule: orig.recurrence_rule,
      parent_task_id: orig.parent_task_id,
      completed_at: null,
    };

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("tasks")
      .insert(row)
      .select("*")
      .single();

    if (error) return { data: null, error: asError("Failed to duplicate task", error) };
    return { data: data as unknown as Task, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to duplicate task", cause) };
  }
}

/**
 * Fetches all unique tags used across the user's tasks.
 * @returns Deduplicated, sorted array of tag strings.
 */
export async function getAllTags(): Promise<SupabaseQueryResult<string[]>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("tasks")
      .select("tags");

    if (error) return { data: null, error: asError("Failed to fetch tags", error) };

    const tagSet = new Set<string>();
    for (const row of data ?? []) {
      const tags = (row as { tags: string[] | null }).tags;
      if (tags) {
        for (const tag of tags) {
          tagSet.add(tag);
        }
      }
    }

    return { data: Array.from(tagSet).sort(), error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch tags", cause) };
  }
}

/**
 * Fetches tag counts for ALL incomplete tasks regardless of active filters.
 * Used exclusively for sidebar badge counts.
 * Only selects id + tags columns for performance.
 */
export async function getTaskTagCounts(): Promise<
  SupabaseQueryResult<Record<string, number>>
> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("tasks")
      .select("id,tags")
      .neq("status", "done")
      .is("parent_task_id", null);

    if (error) return { data: null, error: asError("Failed to fetch tag counts", error) };

    const counts: Record<string, number> = { "All Tasks": 0 };
    for (const row of (data ?? []) as { tags: string[] | null }[]) {
      counts["All Tasks"]++;
      if (row.tags) {
        for (const tag of row.tags) {
          counts[tag] = (counts[tag] ?? 0) + 1;
        }
      }
    }
    return { data: counts, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch tag counts", cause) };
  }
}

// =========================
// Task → Calendar sync helpers
// =========================

/**
 * Creates a calendar event from a task's deadline.
 * Inserts an all-day event with source='local' and calendar_type='TASKS'.
 */
async function createCalendarEventFromTask(
  userId: string,
  task: Task
): Promise<SupabaseQueryResult<CalendarEvent>> {
  try {
    const client = await createServerSupabaseClient();
    const deadlineDate = task.deadline ? new Date(task.deadline) : new Date();
    const startOfDay = new Date(Date.UTC(deadlineDate.getUTCFullYear(), deadlineDate.getUTCMonth(), deadlineDate.getUTCDate()));

    const row = {
      user_id: userId,
      title: `${task.title} (due)`,
      is_all_day: true,
      start_time: startOfDay.toISOString(),
      end_time: startOfDay.toISOString(),
      source: "local" as const,
      calendar_type: "TASKS",
      task_id: task.id,
    };

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("calendar_events")
      .insert(row)
      .select("*")
      .single();

    if (error) return { data: null, error: asError("Failed to create calendar event for task", error) };
    return { data: data as unknown as CalendarEvent, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to create calendar event for task", cause) };
  }
}

/**
 * Updates the calendar event linked to a task, or creates one if none exists.
 * Called when a task's deadline is added or changed.
 */
async function updateCalendarEventFromTask(
  userId: string,
  task: Task
): Promise<void> {
  const client = await createServerSupabaseClient();

  const { data: existing } = await client
    .schema<PublicSchema>("public")
    .from("calendar_events")
    .select("*")
    .eq("task_id", task.id)
    .maybeSingle();

  const deadlineDate = task.deadline ? new Date(task.deadline) : new Date();
  const startOfDay = new Date(Date.UTC(deadlineDate.getUTCFullYear(), deadlineDate.getUTCMonth(), deadlineDate.getUTCDate()));

  if (existing) {
    await client
      .schema<PublicSchema>("public")
      .from("calendar_events")
      .update({
        title: `${task.title} (due)`,
        start_time: startOfDay.toISOString(),
        end_time: startOfDay.toISOString(),
      })
      .eq("id", (existing as unknown as CalendarEvent).id);
  } else {
    await createCalendarEventFromTask(userId, task);
  }
}

/**
 * Deletes the calendar event linked to a task and clears the task's reference.
 * Called when a task's deadline is removed.
 */
async function deleteCalendarEventForTask(
  userId: string,
  taskId: string
): Promise<void> {
  const client = await createServerSupabaseClient();

  await client
    .schema<PublicSchema>("public")
    .from("calendar_events")
    .delete()
    .eq("task_id", taskId)
    .eq("user_id", userId);

  await client
    .schema<PublicSchema>("public")
    .from("tasks")
    .update({ outlook_event_id: null })
    .eq("id", taskId);
}

// =========================
// Calendar event helpers
// =========================

export async function getCalendarEvents(
  filters?: { start?: string; end?: string; calendarTypes?: string[] }
): Promise<SupabaseQueryResult<CalendarEvent[]>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    let query = client
      .schema<PublicSchema>("public")
      .from("calendar_events")
      .select("id,title,start_time,end_time,is_all_day,calendar_type,source,task_id,outlook_event_id,user_id,outlook_calendar_id,created_at,updated_at")
      .order("start_time", { ascending: true });

    if (filters?.start) {
      query = query.gte("start_time", filters.start);
    }
    if (filters?.end) {
      query = query.lte("start_time", filters.end);
    }
    if (filters?.calendarTypes && filters.calendarTypes.length > 0) {
      query = query.in("calendar_type", filters.calendarTypes);
    }

    const { data, error } = await query;
    if (error) return { data: null, error: asError("Failed to fetch calendar events", error) };
    return { data: data as unknown as CalendarEvent[], error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch calendar events", cause) };
  }
}

/**
 * Fetches a single calendar event by ID.
 */
export async function getCalendarEventById(eventId: string): Promise<SupabaseQueryResult<CalendarEvent>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("calendar_events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (error) return { data: null, error: asError("Failed to fetch calendar event", error) };
    return { data: data as unknown as CalendarEvent, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch calendar event", cause) };
  }
}

/**
 * Creates a local calendar event.
 */
export async function createCalendarEvent(
  eventData: CalendarEventInput & { title: string; start_time: string; end_time: string }
): Promise<SupabaseQueryResult<CalendarEvent>> {
  try {
    const client = await createServerSupabaseClient();
    const userId = await requireUserId(client);

    const row = {
      user_id: userId,
      title: eventData.title,
      description: eventData.description ?? null,
      start_time: eventData.start_time,
      end_time: eventData.end_time,
      is_all_day: eventData.is_all_day ?? false,
      calendar_type: eventData.calendar_type ?? "LOCAL",
      source: "local" as const,
    };

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("calendar_events")
      .insert(row)
      .select("*")
      .single();

    if (error) return { data: null, error: asError("Failed to create calendar event", error) };
    return { data: data as unknown as CalendarEvent, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to create calendar event", cause) };
  }
}

/**
 * Updates a local calendar event. Returns error if event has source='outlook'.
 */
export async function updateCalendarEvent(
  eventId: string,
  updates: CalendarEventInput
): Promise<SupabaseQueryResult<CalendarEvent>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    const { data: existing, error: fetchErr } = await client
      .schema<PublicSchema>("public")
      .from("calendar_events")
      .select("source")
      .eq("id", eventId)
      .single();

    if (fetchErr) return { data: null, error: asError("Event not found", fetchErr) };
    if ((existing as unknown as { source: string }).source === "outlook") {
      return { data: null, error: new Error("Outlook events can only be edited in Outlook. They will re-sync on next import.") };
    }

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("calendar_events")
      .update(updates)
      .eq("id", eventId)
      .select("*")
      .single();

    if (error) return { data: null, error: asError("Failed to update calendar event", error) };
    return { data: data as unknown as CalendarEvent, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to update calendar event", cause) };
  }
}

/**
 * Deletes a local calendar event. Returns error if event has source='outlook'.
 */
export async function deleteCalendarEvent(eventId: string): Promise<SupabaseQueryResult<{ deleted: true }>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    const { data: existing, error: fetchErr } = await client
      .schema<PublicSchema>("public")
      .from("calendar_events")
      .select("source")
      .eq("id", eventId)
      .single();

    if (fetchErr) return { data: null, error: asError("Event not found", fetchErr) };
    if ((existing as unknown as { source: string }).source === "outlook") {
      return { data: null, error: new Error("Outlook events cannot be deleted from PMS. Remove them in Outlook and they will disappear on next sync.") };
    }

    const { error } = await client
      .schema<PublicSchema>("public")
      .from("calendar_events")
      .delete()
      .eq("id", eventId);

    if (error) return { data: null, error: asError("Failed to delete calendar event", error) };
    return { data: { deleted: true }, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to delete calendar event", cause) };
  }
}

/**
 * Upserts a calendar event from an iCal sync by outlook_event_id.
 * Used only by the iCal sync module.
 */
export async function upsertOutlookCalendarEvent(
  userId: string,
  eventData: {
    outlook_event_id: string;
    outlook_calendar_id: string;
    title: string;
    description: string | null;
    start_time: string;
    end_time: string;
    is_all_day: boolean;
    calendar_type: string;
  }
): Promise<SupabaseQueryResult<CalendarEvent>> {
  try {
    const client = await createServerSupabaseClient();

    const row = {
      user_id: userId,
      source: "outlook" as const,
      ...eventData,
    };

    const { data: result, error } = await client
      .schema<PublicSchema>("public")
      .from("calendar_events")
      .upsert(row, { onConflict: "outlook_event_id" })
      .select("*")
      .single();

    if (error) return { data: null, error: asError("Failed to upsert outlook calendar event", error) };
    return { data: result as unknown as CalendarEvent, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to upsert outlook calendar event", cause) };
  }
}

/**
 * Deletes all outlook-sourced calendar events for a specific feed.
 */
export async function deleteOutlookEventsForFeed(
  userId: string,
  feedId: string
): Promise<SupabaseQueryResult<{ deleted: true }>> {
  try {
    const client = await createServerSupabaseClient();

    const { error } = await client
      .schema<PublicSchema>("public")
      .from("calendar_events")
      .delete()
      .eq("user_id", userId)
      .eq("outlook_calendar_id", feedId);

    if (error) return { data: null, error: asError("Failed to delete outlook events for feed", error) };
    return { data: { deleted: true }, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to delete outlook events for feed", cause) };
  }
}

/**
 * Fetches all outlook-sourced calendar events for a specific feed.
 * Used by iCal sync to diff existing events.
 */
export async function getOutlookEventsForFeed(
  userId: string,
  feedId: string
): Promise<SupabaseQueryResult<CalendarEvent[]>> {
  try {
    const client = await createServerSupabaseClient();

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("calendar_events")
      .select("*")
      .eq("user_id", userId)
      .eq("outlook_calendar_id", feedId);

    if (error) return { data: null, error: asError("Failed to fetch outlook events for feed", error) };
    return { data: data as unknown as CalendarEvent[], error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch outlook events for feed", cause) };
  }
}

/**
 * Batch upserts multiple outlook calendar events in a single Supabase call.
 * Used by iCal sync to efficiently handle large feeds.
 * Caller is responsible for chunking into batches of ≤500 rows.
 */
export async function batchUpsertOutlookCalendarEvents(
  userId: string,
  rows: {
    outlook_event_id: string;
    outlook_calendar_id: string;
    title: string;
    description: string | null;
    start_time: string;
    end_time: string;
    is_all_day: boolean;
    calendar_type: string;
  }[]
): Promise<SupabaseQueryResult<number>> {
  try {
    const client = await createServerSupabaseClient();

    const fullRows = rows.map((r) => ({
      user_id: userId,
      source: "outlook" as const,
      ...r,
    }));

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("calendar_events")
      .upsert(fullRows, { onConflict: "outlook_event_id" })
      .select("id");

    if (error) return { data: null, error: asError("Batch upsert failed", error) };
    return { data: data?.length ?? 0, error: null };
  } catch (cause) {
    return { data: null, error: asError("Batch upsert failed", cause) };
  }
}

/**
 * Deletes a single calendar event by ID without source check. Used by sync.
 */
export async function deleteCalendarEventById(
  userId: string,
  eventId: string
): Promise<void> {
  const client = await createServerSupabaseClient();
  await client
    .schema<PublicSchema>("public")
    .from("calendar_events")
    .delete()
    .eq("id", eventId)
    .eq("user_id", userId);
}

// =========================
// iCal feed helpers
// =========================

/**
 * Fetches all iCal feeds for a user.
 */
export async function getIcalFeeds(): Promise<SupabaseQueryResult<IcalFeed[]>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("ical_feeds")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) return { data: null, error: asError("Failed to fetch ical feeds", error) };
    return { data: data as unknown as IcalFeed[], error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch ical feeds", cause) };
  }
}

/**
 * Fetches a single iCal feed by ID.
 */
export async function getIcalFeedById(feedId: string): Promise<SupabaseQueryResult<IcalFeed>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("ical_feeds")
      .select("*")
      .eq("id", feedId)
      .single();

    if (error) return { data: null, error: asError("Failed to fetch ical feed", error) };
    return { data: data as unknown as IcalFeed, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch ical feed", cause) };
  }
}

/**
 * Creates a new iCal feed.
 */
export async function createIcalFeed(
  feedData: IcalFeedInput & { name: string; ical_url: string; calendar_type: string }
): Promise<SupabaseQueryResult<IcalFeed>> {
  try {
    const client = await createServerSupabaseClient();
    const userId = await requireUserId(client);

    const row = {
      user_id: userId,
      name: feedData.name,
      ical_url: feedData.ical_url,
      calendar_type: feedData.calendar_type,
      color: feedData.color ?? null,
      is_active: feedData.is_active ?? true,
    };

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("ical_feeds")
      .insert(row)
      .select("*")
      .single();

    if (error) return { data: null, error: asError("Failed to create ical feed", error) };
    return { data: data as unknown as IcalFeed, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to create ical feed", cause) };
  }
}

/**
 * Updates an existing iCal feed.
 */
export async function updateIcalFeed(
  feedId: string,
  updates: IcalFeedInput
): Promise<SupabaseQueryResult<IcalFeed>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("ical_feeds")
      .update(updates)
      .eq("id", feedId)
      .select("*")
      .single();

    if (error) return { data: null, error: asError("Failed to update ical feed", error) };
    return { data: data as unknown as IcalFeed, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to update ical feed", cause) };
  }
}

/**
 * Deletes an iCal feed (caller should delete associated events first).
 */
export async function deleteIcalFeed(feedId: string): Promise<SupabaseQueryResult<{ deleted: true }>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    const { error } = await client
      .schema<PublicSchema>("public")
      .from("ical_feeds")
      .delete()
      .eq("id", feedId);

    if (error) return { data: null, error: asError("Failed to delete ical feed", error) };
    return { data: { deleted: true }, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to delete ical feed", cause) };
  }
}

/**
 * Updates the last_synced_at timestamp for an iCal feed.
 */
export async function updateIcalFeedLastSynced(feedId: string): Promise<void> {
  const client = await createServerSupabaseClient();
  await client
    .schema<PublicSchema>("public")
    .from("ical_feeds")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", feedId);
}

// =========================
// User preferences helpers
// =========================

/**
 * Fetches user preferences, returning null if none exist yet.
 */
export async function getUserPreferences(): Promise<SupabaseQueryResult<UserPreferences | null>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("user_preferences")
      .select("*")
      .maybeSingle();

    if (error) return { data: null, error: asError("Failed to fetch user preferences", error) };
    return { data: (data as unknown as UserPreferences) ?? null, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch user preferences", cause) };
  }
}

/**
 * Upserts user preferences (creates if not exists, updates if exists).
 */
export async function upsertUserPreferences(
  preferences: Partial<Pick<UserPreferences, "calendar_default_view" | "calendar_week_starts_on" | "distance_unit" | "bmr_calories" | "daily_calorie_goal" | "height_cm" | "weight_kg" | "age" | "biological_sex" | "last_exercise_date">>
): Promise<SupabaseQueryResult<UserPreferences>> {
  try {
    const client = await createServerSupabaseClient();
    const userId = await requireUserId(client);

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("user_preferences")
      .upsert(
        { user_id: userId, ...preferences },
        { onConflict: "user_id" }
      )
      .select("*")
      .single();

    if (error) return { data: null, error: asError("Failed to upsert user preferences", error) };
    return { data: data as unknown as UserPreferences, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to upsert user preferences", cause) };
  }
}

// =========================
// Analytics helpers
// =========================

/**
 * Fetches all tasks (including done) optimised for analytics calculations.
 * No pagination — returns everything from startDate onwards.
 */
export async function getTasksForAnalytics(
  startDate?: Date
): Promise<SupabaseQueryResult<Task[]>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    let query = client
      .schema<PublicSchema>("public")
      .from("tasks")
      .select("id,title,status,tags,deadline,completed_at,created_at,estimated_minutes,priority,description,is_recurring,recurrence_rule,parent_task_id,outlook_event_id,user_id,updated_at")
      .is("parent_task_id", null);

    if (startDate) {
      query = query.gte("created_at", startDate.toISOString());
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) return { data: null, error: asError("Failed to fetch tasks for analytics", error) };
    return { data: data as unknown as Task[], error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch tasks for analytics", cause) };
  }
}

// =========================
// Diary helpers
// =========================

/**
 * Fetches diary entries with optional tag filter, full-text search, and pagination.
 */
export async function getDiaryEntries(
  filters?: {
    tag?: string[];
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<SupabaseQueryResult<DiaryEntry[]>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    let query = client
      .schema<PublicSchema>("public")
      .from("diary_entries")
      .select("id,title,content,content_text,tags,folder_id,created_at,updated_at,user_id")
      .order("updated_at", { ascending: false });

    if (filters?.tag && filters.tag.length > 0) {
      for (const t of filters.tag) {
        query = query.contains("tags", [t]);
      }
    }

    if (filters?.search) {
      query = query.textSearch("content_text", filters.search, {
        type: "plain",
        config: "english",
      });
    }

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) return { data: null, error: asError("Failed to fetch diary entries", error) };
    return { data: data as unknown as DiaryEntry[], error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch diary entries", cause) };
  }
}

/**
 * Fetches a single diary entry by ID.
 */
export async function getDiaryEntryById(entryId: string): Promise<SupabaseQueryResult<DiaryEntry>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("diary_entries")
      .select("*")
      .eq("id", entryId)
      .single();

    if (error) return { data: null, error: asError("Failed to fetch diary entry", error) };
    return { data: data as unknown as DiaryEntry, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch diary entry", cause) };
  }
}

/**
 * Creates a new diary entry. Can be called with no data for an empty entry.
 */
export async function createDiaryEntry(
  entryData?: {
    title?: string | null;
    content?: Record<string, unknown> | null;
    content_text?: string | null;
    tags?: string[] | null;
    folder_id?: string | null;
  }
): Promise<SupabaseQueryResult<DiaryEntry>> {
  try {
    const client = await createServerSupabaseClient();
    const userId = await requireUserId(client);

    const row = {
      user_id: userId,
      title: entryData?.title ?? null,
      content: entryData?.content ?? null,
      content_text: entryData?.content_text ?? null,
      tags: entryData?.tags ?? null,
      folder_id: entryData?.folder_id ?? null,
    };

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("diary_entries")
      .insert(row)
      .select("*")
      .single();

    if (error) return { data: null, error: asError("Failed to create diary entry", error) };
    return { data: data as unknown as DiaryEntry, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to create diary entry", cause) };
  }
}

/**
 * Updates an existing diary entry.
 */
export async function updateDiaryEntry(
  entryId: string,
  updates: {
    title?: string | null;
    content?: Record<string, unknown> | null;
    content_text?: string | null;
    tags?: string[] | null;
    folder_id?: string | null;
  }
): Promise<SupabaseQueryResult<DiaryEntry>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("diary_entries")
      .update(updates)
      .eq("id", entryId)
      .select("*")
      .single();

    if (error) return { data: null, error: asError("Failed to update diary entry", error) };
    return { data: data as unknown as DiaryEntry, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to update diary entry", cause) };
  }
}

/**
 * Fetches all diary folders for the current user as a flat list.
 */
export async function getDiaryFolders(): Promise<SupabaseQueryResult<DiaryFolder[]>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("diary_folders")
      .select("id,user_id,name,parent_folder_id,created_at,updated_at")
      .order("name", { ascending: true });

    if (error) return { data: null, error: asError("Failed to fetch diary folders", error) };
    return { data: data as unknown as DiaryFolder[], error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch diary folders", cause) };
  }
}

/**
 * Creates a new diary folder for the current user.
 */
export async function createDiaryFolder(
  name: string,
  parentFolderId?: string | null
): Promise<SupabaseQueryResult<DiaryFolder>> {
  try {
    const trimmed = name.trim();
    if (!trimmed) return { data: null, error: new Error("Folder name cannot be empty") };

    const client = await createServerSupabaseClient();
    const userId = await requireUserId(client);

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("diary_folders")
      .insert({
        user_id: userId,
        name: trimmed,
        parent_folder_id: parentFolderId ?? null,
      })
      .select("id,user_id,name,parent_folder_id,created_at,updated_at")
      .single();

    if (error) return { data: null, error: asError("Failed to create diary folder", error) };
    return { data: data as unknown as DiaryFolder, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to create diary folder", cause) };
  }
}

/**
 * Renames a diary folder.
 */
export async function renameDiaryFolder(
  folderId: string,
  newName: string
): Promise<SupabaseQueryResult<DiaryFolder>> {
  try {
    const trimmed = newName.trim();
    if (!trimmed) return { data: null, error: new Error("Folder name cannot be empty") };

    const client = await createServerSupabaseClient();
    await requireUserId(client);

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("diary_folders")
      .update({ name: trimmed })
      .eq("id", folderId)
      .select("id,user_id,name,parent_folder_id,created_at,updated_at")
      .single();

    if (error) return { data: null, error: asError("Failed to rename diary folder", error) };
    return { data: data as unknown as DiaryFolder, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to rename diary folder", cause) };
  }
}

/**
 * Deletes an empty diary folder.
 */
export async function deleteDiaryFolder(folderId: string): Promise<SupabaseQueryResult<{ deleted: true }>> {
  try {
    const client = await createServerSupabaseClient();
    const userId = await requireUserId(client);

    const [{ count: childCount, error: childError }, { count: entryCount, error: entryError }] = await Promise.all([
      client
        .schema<PublicSchema>("public")
        .from("diary_folders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("parent_folder_id", folderId),
      client
        .schema<PublicSchema>("public")
        .from("diary_entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("folder_id", folderId),
    ]);

    if (childError) return { data: null, error: asError("Failed to inspect diary folder contents", childError) };
    if (entryError) return { data: null, error: asError("Failed to inspect diary folder contents", entryError) };

    if ((childCount ?? 0) > 0 || (entryCount ?? 0) > 0) {
      return {
        data: null,
        error: new Error("Cannot delete a folder that contains entries or subfolders. Move or delete the contents first."),
      };
    }

    const { error } = await client
      .schema<PublicSchema>("public")
      .from("diary_folders")
      .delete()
      .eq("id", folderId)
      .eq("user_id", userId);

    if (error) return { data: null, error: asError("Failed to delete diary folder", error) };
    return { data: { deleted: true }, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to delete diary folder", cause) };
  }
}

/**
 * Moves a diary entry into a folder, or to the ungrouped area when folderId is null.
 */
export async function moveEntryToFolder(
  entryId: string,
  folderId: string | null
): Promise<SupabaseQueryResult<DiaryEntry>> {
  return updateDiaryEntry(entryId, { folder_id: folderId });
}

/**
 * Moves a folder under another folder or to the top level when newParentId is null.
 */
export async function moveFolderToFolder(
  folderId: string,
  newParentId: string | null
): Promise<SupabaseQueryResult<DiaryFolder>> {
  try {
    if (folderId === newParentId) {
      return { data: null, error: new Error("A folder cannot be its own parent") };
    }

    const client = await createServerSupabaseClient();
    const userId = await requireUserId(client);

    const { data: folders, error: foldersError } = await client
      .schema<PublicSchema>("public")
      .from("diary_folders")
      .select("id,parent_folder_id")
      .eq("user_id", userId);

    if (foldersError) return { data: null, error: asError("Failed to validate diary folder move", foldersError) };

    const parentById = new Map<string, string | null>(
      (folders ?? []).map((folder) => [folder.id as string, (folder.parent_folder_id as string | null) ?? null])
    );

    let currentParent = newParentId;
    while (currentParent) {
      if (currentParent === folderId) {
        return { data: null, error: new Error("Cannot move a folder into its own descendant") };
      }
      currentParent = parentById.get(currentParent) ?? null;
    }

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("diary_folders")
      .update({ parent_folder_id: newParentId })
      .eq("id", folderId)
      .eq("user_id", userId)
      .select("id,user_id,name,parent_folder_id,created_at,updated_at")
      .single();

    if (error) return { data: null, error: asError("Failed to move diary folder", error) };
    return { data: data as unknown as DiaryFolder, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to move diary folder", cause) };
  }
}

/**
 * Deletes a diary entry by ID.
 */
export async function deleteDiaryEntry(entryId: string): Promise<SupabaseQueryResult<{ deleted: true }>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    const { error } = await client
      .schema<PublicSchema>("public")
      .from("diary_entries")
      .delete()
      .eq("id", entryId);

    if (error) return { data: null, error: asError("Failed to delete diary entry", error) };
    return { data: { deleted: true }, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to delete diary entry", cause) };
  }
}

/**
 * Duplicates a diary entry with "Copy of" prefix on the title.
 */
export async function duplicateDiaryEntry(entryId: string): Promise<SupabaseQueryResult<DiaryEntry>> {
  try {
    const client = await createServerSupabaseClient();
    const userId = await requireUserId(client);

    const { data: original, error: fetchErr } = await client
      .schema<PublicSchema>("public")
      .from("diary_entries")
      .select("*")
      .eq("id", entryId)
      .single();

    if (fetchErr || !original) {
      return { data: null, error: asError("Failed to find diary entry to duplicate", fetchErr ?? new Error("Not found")) };
    }

    const orig = original as unknown as DiaryEntry;

    const row = {
      user_id: userId,
      title: orig.title ? `Copy of ${orig.title}` : "Copy of Untitled",
      content: orig.content,
      content_text: orig.content_text,
      tags: orig.tags,
    };

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("diary_entries")
      .insert(row)
      .select("*")
      .single();

    if (error) return { data: null, error: asError("Failed to duplicate diary entry", error) };
    return { data: data as unknown as DiaryEntry, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to duplicate diary entry", cause) };
  }
}

/**
 * Fetches all unique tags from both tasks and diary_entries tables.
 * Returns { allTags, taskTags, diaryTags } for flexible usage.
 */
export async function getAllTagsCombined(): Promise<
  SupabaseQueryResult<{ allTags: string[]; taskTags: string[]; diaryTags: string[] }>
> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    const [taskRes, diaryRes] = await Promise.all([
      client.schema<PublicSchema>("public").from("tasks").select("tags"),
      client.schema<PublicSchema>("public").from("diary_entries").select("tags"),
    ]);

    const taskTags = new Set<string>();
    for (const row of taskRes.data ?? []) {
      const tags = (row as { tags: string[] | null }).tags;
      if (tags) for (const t of tags) taskTags.add(t);
    }

    const diaryTags = new Set<string>();
    for (const row of diaryRes.data ?? []) {
      const tags = (row as { tags: string[] | null }).tags;
      if (tags) for (const t of tags) diaryTags.add(t);
    }

    const allTags = new Set([...taskTags, ...diaryTags]);

    return {
      data: {
        allTags: Array.from(allTags).sort(),
        taskTags: Array.from(taskTags).sort(),
        diaryTags: Array.from(diaryTags).sort(),
      },
      error: null,
    };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch combined tags", cause) };
  }
}

/**
 * Ensures the diary-images storage bucket exists.
 * Idempotent — safe to call multiple times.
 */
export async function ensureDiaryImagesBucket(): Promise<void> {
  const client = createServiceRoleClient();
  const { data: buckets } = await client.storage.listBuckets();
  const exists = (buckets ?? []).some((b: { name: string }) => b.name === "diary-images");
  if (!exists) {
    await client.storage.createBucket("diary-images", { public: true });
  }
}

/**
 * Uploads an image to the diary-images bucket.
 * Returns the public URL.
 */
export async function uploadDiaryImage(
  userId: string,
  fileName: string,
  fileBody: Blob | Buffer,
  contentType: string
): Promise<SupabaseQueryResult<string>> {
  try {
    const client = await createServerSupabaseClient();
    const path = `${userId}/${Date.now()}-${fileName}`;

    const { error } = await client.storage
      .from("diary-images")
      .upload(path, fileBody, { contentType, upsert: false });

    if (error) return { data: null, error: asError("Failed to upload image", error) };

    const { data: urlData } = client.storage.from("diary-images").getPublicUrl(path);
    return { data: urlData.publicUrl, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to upload image", cause) };
  }
}

// Placeholders for upcoming domains.

export async function getOutlookSyncState(): Promise<SupabaseQueryResult<OutlookSyncState[]>> {
  return { data: [], error: null };
}

export async function getOAuthTokens(): Promise<SupabaseQueryResult<OAuthToken[]>> {
  return { data: [], error: null };
}

// =========================
// Exercise session helpers
// =========================

const EXERCISE_SESSION_COLUMNS =
  "id,user_id,type,date,started_at,duration_seconds,distance_metres,calories_burned,route_name,effort_level,is_pr,pr_distance_bucket,notes,pool_length_metres,total_laps,stroke_type,swolf_score,calendar_event_id,created_at,updated_at";

/**
 * Fetches exercise sessions with optional filters.
 */
export async function getExerciseSessions(
  filters?: {
    type?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }
): Promise<SupabaseQueryResult<ExerciseSession[]>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    let query = client
      .schema<PublicSchema>("public")
      .from("exercise_sessions")
      .select(EXERCISE_SESSION_COLUMNS)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (filters?.type) {
      query = query.eq("type", filters.type);
    }
    if (filters?.from) {
      query = query.gte("date", filters.from);
    }
    if (filters?.to) {
      query = query.lte("date", filters.to);
    }

    const limit = filters?.limit ?? 20;
    const offset = filters?.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) return { data: null, error: asError("Failed to fetch exercise sessions", error) };
    return { data: data as unknown as ExerciseSession[], error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch exercise sessions", cause) };
  }
}

/**
 * Fetches a single exercise session by ID with its run laps.
 */
export async function getExerciseSessionById(
  sessionId: string
): Promise<SupabaseQueryResult<ExerciseSession & { laps: RunLap[] }>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    const { data: session, error: sessionError } = await client
      .schema<PublicSchema>("public")
      .from("exercise_sessions")
      .select(EXERCISE_SESSION_COLUMNS)
      .eq("id", sessionId)
      .single();

    if (sessionError) return { data: null, error: asError("Failed to fetch exercise session", sessionError) };

    const { data: laps, error: lapsError } = await client
      .schema<PublicSchema>("public")
      .from("run_laps")
      .select("id,session_id,user_id,lap_number,distance_metres,duration_seconds,pace_seconds_per_km,created_at")
      .eq("session_id", sessionId)
      .order("lap_number", { ascending: true });

    if (lapsError) return { data: null, error: asError("Failed to fetch run laps", lapsError) };

    return {
      data: {
        ...(session as unknown as ExerciseSession),
        laps: (laps as unknown as RunLap[]) ?? [],
      },
      error: null,
    };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch exercise session", cause) };
  }
}

/**
 * Detects and updates personal records for a run session.
 * Idempotent — safe to call multiple times for the same session.
 * Returns { isPR, bucket } indicating whether this session set a new PR.
 */
async function detectAndUpdatePR(
  client: SupabaseClient,
  userId: string,
  sessionId: string,
  distanceMetres: number,
  durationSeconds: number,
  date: string
): Promise<{ isPR: boolean; bucket: PRDistanceBucket | null }> {
  const bucket = getDistanceBucket(distanceMetres);
  if (!bucket) return { isPR: false, bucket: null };

  const newPace = calculatePace(distanceMetres, durationSeconds);

  const { data: existing } = await client
    .schema<PublicSchema>("public")
    .from("personal_records")
    .select("id,best_pace_seconds_per_km,best_session_id")
    .eq("user_id", userId)
    .eq("distance_bucket", bucket)
    .maybeSingle();

  const existingPR = existing as { id: string; best_pace_seconds_per_km: number; best_session_id: string | null } | null;

  if (!existingPR) {
    // First PR for this bucket
    await client
      .schema<PublicSchema>("public")
      .from("personal_records")
      .insert({
        user_id: userId,
        distance_bucket: bucket,
        best_pace_seconds_per_km: newPace,
        best_session_id: sessionId,
        achieved_at: date,
      });
    return { isPR: true, bucket };
  }

  // Idempotency: if this session is already the PR, return true
  if (existingPR.best_session_id === sessionId) {
    return { isPR: true, bucket };
  }

  if (newPace < existingPR.best_pace_seconds_per_km) {
    // New PR — faster pace (lower is better)
    await client
      .schema<PublicSchema>("public")
      .from("personal_records")
      .update({
        best_pace_seconds_per_km: newPace,
        best_session_id: sessionId,
        achieved_at: date,
      })
      .eq("id", existingPR.id);
    return { isPR: true, bucket };
  }

  return { isPR: false, bucket: null };
}

/**
 * Recalculates the PR for a given bucket from all remaining sessions.
 * Called after deleting or editing a PR session.
 */
async function recalculatePRForBucket(
  client: SupabaseClient,
  userId: string,
  bucket: PRDistanceBucket
): Promise<void> {
  const { min, max } = {
    "1km": { min: 750, max: 1250 },
    "5km": { min: 4750, max: 5250 },
    "10km": { min: 9750, max: 10250 },
    "half_marathon": { min: 20900, max: 21300 },
  }[bucket];

  // Find all runs in this bucket
  const { data: candidates } = await client
    .schema<PublicSchema>("public")
    .from("exercise_sessions")
    .select("id,distance_metres,duration_seconds,date")
    .eq("user_id", userId)
    .eq("type", "run")
    .gte("distance_metres", min)
    .lte("distance_metres", max)
    .order("date", { ascending: false });

  const runs = (candidates ?? []) as { id: string; distance_metres: number; duration_seconds: number; date: string }[];

  if (runs.length === 0) {
    // No runs in this bucket — delete the PR row
    await client
      .schema<PublicSchema>("public")
      .from("personal_records")
      .delete()
      .eq("user_id", userId)
      .eq("distance_bucket", bucket);

    // Clear is_pr flag from any sessions that had it
    await client
      .schema<PublicSchema>("public")
      .from("exercise_sessions")
      .update({ is_pr: false, pr_distance_bucket: null })
      .eq("user_id", userId)
      .eq("pr_distance_bucket", bucket);
    return;
  }

  // Find the fastest (lowest pace)
  let best = runs[0];
  let bestPace = calculatePace(best.distance_metres, best.duration_seconds);
  for (const run of runs.slice(1)) {
    const pace = calculatePace(run.distance_metres, run.duration_seconds);
    if (pace < bestPace) {
      best = run;
      bestPace = pace;
    }
  }

  // Upsert the PR
  await client
    .schema<PublicSchema>("public")
    .from("personal_records")
    .upsert(
      {
        user_id: userId,
        distance_bucket: bucket,
        best_pace_seconds_per_km: bestPace,
        best_session_id: best.id,
        achieved_at: best.date,
      },
      { onConflict: "user_id,distance_bucket" }
    );

  // Clear is_pr from all sessions in this bucket, then set the new best
  await client
    .schema<PublicSchema>("public")
    .from("exercise_sessions")
    .update({ is_pr: false, pr_distance_bucket: null })
    .eq("user_id", userId)
    .eq("pr_distance_bucket", bucket);

  await client
    .schema<PublicSchema>("public")
    .from("exercise_sessions")
    .update({ is_pr: true, pr_distance_bucket: bucket })
    .eq("id", best.id);
}

/**
 * Creates a calendar event from an exercise session.
 * Non-blocking — failure returns null, never throws.
 */
async function createCalendarEventFromExercise(
  client: SupabaseClient,
  userId: string,
  session: { type: string; date: string; distance_metres?: number | null; duration_seconds: number }
): Promise<string | null> {
  try {
    const distLabel = session.distance_metres
      ? `${(session.distance_metres / 1000).toFixed(2)}km`
      : "";
    const durMin = Math.round(session.duration_seconds / 60);
    const typeLabel = session.type === "run" ? "Run" : session.type === "swim" ? "Swim" : "Exercise";
    const title = distLabel
      ? `[${typeLabel}] ${distLabel} - ${durMin}min`
      : `[${typeLabel}] ${durMin}min`;

    // Interpret date as local midnight
    const startTime = new Date(session.date + "T00:00:00");

    const row = {
      user_id: userId,
      title,
      is_all_day: true,
      start_time: startTime.toISOString(),
      end_time: startTime.toISOString(),
      source: "local" as const,
      calendar_type: "EXERCISE",
    };

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("calendar_events")
      .insert(row)
      .select("id")
      .single();

    if (error) {
      console.error("Calendar event creation failed (non-blocking):", error);
      return null;
    }
    return (data as { id: string }).id;
  } catch (error) {
    console.error("Calendar event creation failed (non-blocking):", error);
    return null;
  }
}

interface CreateExerciseSessionInput {
  type: "run" | "swim" | "other";
  date: string;
  started_at?: string | null;
  duration_seconds: number;
  distance_metres?: number | null;
  calories_burned?: number | null;
  notes?: string | null;
  route_name?: string | null;
  effort_level?: number | null;
  pool_length_metres?: 25 | 50 | null;
  total_laps?: number | null;
  stroke_type?: string | null;
  swolf_score?: number | null;
  laps?: { lap_number: number; distance_metres: number; duration_seconds: number }[] | null;
}

/**
 * Creates a new exercise session with optional laps and PR detection.
 * Calendar event creation and habit flag are non-blocking.
 */
export async function createExerciseSession(
  data: CreateExerciseSessionInput
): Promise<SupabaseQueryResult<ExerciseSession>> {
  try {
    const client = await createServerSupabaseClient();
    const userId = await requireUserId(client);

    // 1. INSERT exercise session
    const row = {
      user_id: userId,
      type: data.type,
      date: data.date,
      started_at: data.started_at ?? null,
      duration_seconds: data.duration_seconds,
      distance_metres: data.distance_metres ?? null,
      calories_burned: data.calories_burned ?? null,
      notes: data.notes ?? null,
      route_name: data.route_name ?? null,
      effort_level: data.effort_level ?? null,
      pool_length_metres: data.pool_length_metres ?? null,
      total_laps: data.total_laps ?? null,
      stroke_type: data.stroke_type ?? null,
      swolf_score: data.swolf_score ?? null,
    };

    const { data: sessionData, error: sessionError } = await client
      .schema<PublicSchema>("public")
      .from("exercise_sessions")
      .insert(row)
      .select(EXERCISE_SESSION_COLUMNS)
      .single();

    if (sessionError) return { data: null, error: asError("Failed to create exercise session", sessionError) };

    const session = sessionData as unknown as ExerciseSession;

    // 2. Insert laps if provided
    if (data.laps && data.laps.length > 0) {
      const lapRows = data.laps.map((lap) => ({
        session_id: session.id,
        user_id: userId,
        lap_number: lap.lap_number,
        distance_metres: lap.distance_metres,
        duration_seconds: lap.duration_seconds,
        pace_seconds_per_km: lap.distance_metres > 0
          ? calculatePace(lap.distance_metres, lap.duration_seconds)
          : null,
      }));

      await client
        .schema<PublicSchema>("public")
        .from("run_laps")
        .insert(lapRows);
    }

    // 3. PR detection for runs with distance
    let isPR = false;
    let prBucket: PRDistanceBucket | null = null;
    if (data.type === "run" && data.distance_metres) {
      try {
        const result = await detectAndUpdatePR(
          client, userId, session.id,
          data.distance_metres, data.duration_seconds, data.date
        );
        isPR = result.isPR;
        prBucket = result.bucket;

        if (isPR && prBucket) {
          await client
            .schema<PublicSchema>("public")
            .from("exercise_sessions")
            .update({ is_pr: true, pr_distance_bucket: prBucket })
            .eq("id", session.id);
          session.is_pr = true;
          session.pr_distance_bucket = prBucket;
        }
      } catch (prError) {
        console.error("PR detection failed (non-blocking):", prError);
      }
    }

    // 4. Calendar event (non-blocking)
    try {
      const calendarEventId = await createCalendarEventFromExercise(client, userId, {
        type: data.type,
        date: data.date,
        distance_metres: data.distance_metres,
        duration_seconds: data.duration_seconds,
      });
      if (calendarEventId) {
        await client
          .schema<PublicSchema>("public")
          .from("exercise_sessions")
          .update({ calendar_event_id: calendarEventId })
          .eq("id", session.id);
        session.calendar_event_id = calendarEventId;
      }
    } catch (calError) {
      console.error("Calendar event creation failed (non-blocking):", calError);
    }

    // 5. Habit flag: update last_exercise_date (non-blocking)
    try {
      await client
        .schema<PublicSchema>("public")
        .from("user_preferences")
        .upsert(
          { user_id: userId, last_exercise_date: data.date },
          { onConflict: "user_id" }
        );
    } catch (habError) {
      console.error("Habit flag update failed (non-blocking):", habError);
    }

    return { data: session, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to create exercise session", cause) };
  }
}

/**
 * Updates an existing exercise session.
 * Handles PR recalculation when distance changes.
 */
export async function updateExerciseSession(
  sessionId: string,
  updates: Partial<CreateExerciseSessionInput>
): Promise<SupabaseQueryResult<ExerciseSession>> {
  try {
    const client = await createServerSupabaseClient();
    const userId = await requireUserId(client);

    // Fetch current session for PR recalculation
    const { data: currentData } = await client
      .schema<PublicSchema>("public")
      .from("exercise_sessions")
      .select(EXERCISE_SESSION_COLUMNS)
      .eq("id", sessionId)
      .single();

    if (!currentData) return { data: null, error: new Error("Session not found") };
    const current = currentData as unknown as ExerciseSession;

    // Build update payload (exclude laps from DB update)
    const { laps, ...dbUpdates } = updates;
    const updateRow: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(dbUpdates)) {
      if (value !== undefined) {
        updateRow[key] = value;
      }
    }

    const { data: updatedData, error: updateError } = await client
      .schema<PublicSchema>("public")
      .from("exercise_sessions")
      .update(updateRow)
      .eq("id", sessionId)
      .select(EXERCISE_SESSION_COLUMNS)
      .single();

    if (updateError) return { data: null, error: asError("Failed to update exercise session", updateError) };
    const updated = updatedData as unknown as ExerciseSession;

    // Handle lap updates if provided
    if (laps !== undefined) {
      // Delete existing laps and re-insert
      await client
        .schema<PublicSchema>("public")
        .from("run_laps")
        .delete()
        .eq("session_id", sessionId);

      if (laps && laps.length > 0) {
        const lapRows = laps.map((lap) => ({
          session_id: sessionId,
          user_id: userId,
          lap_number: lap.lap_number,
          distance_metres: lap.distance_metres,
          duration_seconds: lap.duration_seconds,
          pace_seconds_per_km: lap.distance_metres > 0
            ? calculatePace(lap.distance_metres, lap.duration_seconds)
            : null,
        }));

        await client
          .schema<PublicSchema>("public")
          .from("run_laps")
          .insert(lapRows);
      }
    }

    // PR recalculation if distance or duration changed for runs
    const distanceChanged = updates.distance_metres !== undefined &&
      updates.distance_metres !== (current.distance_metres ?? undefined);
    const durationChanged = updates.duration_seconds !== undefined &&
      updates.duration_seconds !== current.duration_seconds;

    if (updated.type === "run" && (distanceChanged || durationChanged)) {
      try {
        // If the session was previously a PR, we need to recalculate for that bucket
        if (current.is_pr && current.pr_distance_bucket) {
          // Un-flag current session first
          await client
            .schema<PublicSchema>("public")
            .from("exercise_sessions")
            .update({ is_pr: false, pr_distance_bucket: null })
            .eq("id", sessionId);
          updated.is_pr = false;
          updated.pr_distance_bucket = null;

          // Recalculate the old bucket
          await recalculatePRForBucket(client, userId, current.pr_distance_bucket);
        }

        // Now check if the updated session qualifies for a PR
        const newDistance = updated.distance_metres;
        const newDuration = updated.duration_seconds;
        if (newDistance) {
          const result = await detectAndUpdatePR(
            client, userId, sessionId, newDistance, newDuration, updated.date
          );
          if (result.isPR && result.bucket) {
            await client
              .schema<PublicSchema>("public")
              .from("exercise_sessions")
              .update({ is_pr: true, pr_distance_bucket: result.bucket })
              .eq("id", sessionId);
            updated.is_pr = true;
            updated.pr_distance_bucket = result.bucket;
          }
        }
      } catch (prError) {
        console.error("PR recalculation failed (non-blocking):", prError);
      }
    }

    // Update calendar event if exists (non-blocking)
    if (updated.calendar_event_id) {
      try {
        const distLabel = updated.distance_metres
          ? `${(updated.distance_metres / 1000).toFixed(2)}km`
          : "";
        const durMin = Math.round(updated.duration_seconds / 60);
        const typeLabel = updated.type === "run" ? "Run" : updated.type === "swim" ? "Swim" : "Exercise";
        const title = distLabel
          ? `[${typeLabel}] ${distLabel} - ${durMin}min`
          : `[${typeLabel}] ${durMin}min`;

        await client
          .schema<PublicSchema>("public")
          .from("calendar_events")
          .update({
            title,
            start_time: new Date(updated.date + "T00:00:00").toISOString(),
            end_time: new Date(updated.date + "T00:00:00").toISOString(),
          })
          .eq("id", updated.calendar_event_id);
      } catch (calError) {
        console.error("Calendar event update failed (non-blocking):", calError);
      }
    }

    return { data: updated, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to update exercise session", cause) };
  }
}

/**
 * Deletes an exercise session. Recalculates PRs if needed.
 * run_laps cascade-deleted by FK.
 */
export async function deleteExerciseSession(
  sessionId: string
): Promise<SupabaseQueryResult<{ deleted: true }>> {
  try {
    const client = await createServerSupabaseClient();
    const userId = await requireUserId(client);

    // Fetch session to check PR status and calendar link
    const { data: sessionData } = await client
      .schema<PublicSchema>("public")
      .from("exercise_sessions")
      .select("is_pr,pr_distance_bucket,calendar_event_id")
      .eq("id", sessionId)
      .single();

    const session = sessionData as { is_pr: boolean; pr_distance_bucket: string | null; calendar_event_id: string | null } | null;

    // Delete the session (cascades run_laps)
    const { error } = await client
      .schema<PublicSchema>("public")
      .from("exercise_sessions")
      .delete()
      .eq("id", sessionId);

    if (error) return { data: null, error: asError("Failed to delete exercise session", error) };

    // Recalculate PR if this was a PR session
    if (session?.is_pr && session.pr_distance_bucket) {
      try {
        await recalculatePRForBucket(client, userId, session.pr_distance_bucket as PRDistanceBucket);
      } catch (prError) {
        console.error("PR recalculation after delete failed (non-blocking):", prError);
      }
    }

    // Delete calendar event if linked (non-blocking)
    if (session?.calendar_event_id) {
      try {
        await client
          .schema<PublicSchema>("public")
          .from("calendar_events")
          .delete()
          .eq("id", session.calendar_event_id)
          .eq("user_id", userId);
      } catch (calError) {
        console.error("Calendar event deletion failed (non-blocking):", calError);
      }
    }

    return { data: { deleted: true }, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to delete exercise session", cause) };
  }
}

/**
 * Fetches personal records with session context (date, route_name).
 */
export async function getPersonalRecords(): Promise<SupabaseQueryResult<(PersonalRecord & { session_date: string | null; session_route: string | null })[]>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("personal_records")
      .select("id,user_id,distance_bucket,best_pace_seconds_per_km,best_session_id,achieved_at,created_at,updated_at,exercise_sessions(date,route_name)")
      .order("distance_bucket", { ascending: true });

    if (error) return { data: null, error: asError("Failed to fetch personal records", error) };

    const records = (data ?? []).map((row: Record<string, unknown>) => {
      const sessionInfo = row.exercise_sessions as { date: string; route_name: string | null } | null;
      return {
        id: row.id as string,
        user_id: row.user_id as string,
        distance_bucket: row.distance_bucket as PRDistanceBucket,
        best_pace_seconds_per_km: row.best_pace_seconds_per_km as number,
        best_session_id: row.best_session_id as string | null,
        achieved_at: row.achieved_at as string,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
        session_date: sessionInfo?.date ?? null,
        session_route: sessionInfo?.route_name ?? null,
      };
    });

    return { data: records, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch personal records", cause) };
  }
}

// =========================
// Food log helpers
// =========================

/**
 * Fetches food logs for a specific date, ordered by created_at ASC.
 */
export async function getFoodLogsForDate(
  date: string
): Promise<SupabaseQueryResult<FoodLog[]>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("food_logs")
      .select("id,user_id,date,meal_slot,food_name,calories,carbs_g,fat_g,protein_g,water_ml,saved_food_id,created_at")
      .eq("date", date)
      .order("created_at", { ascending: true });

    if (error) return { data: null, error: asError("Failed to fetch food logs", error) };
    return { data: data as unknown as FoodLog[], error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch food logs", cause) };
  }
}

/**
 * Creates a food log entry. Increments use_count on saved food if linked.
 */
export async function createFoodLog(
  logData: {
    date: string;
    meal_slot: string;
    food_name: string;
    calories: number;
    carbs_g?: number | null;
    fat_g?: number | null;
    protein_g?: number | null;
    water_ml?: number;
    saved_food_id?: string | null;
  }
): Promise<SupabaseQueryResult<FoodLog>> {
  try {
    const client = await createServerSupabaseClient();
    const userId = await requireUserId(client);

    const row = {
      user_id: userId,
      date: logData.date,
      meal_slot: logData.meal_slot,
      food_name: logData.food_name,
      calories: logData.calories,
      carbs_g: logData.carbs_g ?? null,
      fat_g: logData.fat_g ?? null,
      protein_g: logData.protein_g ?? null,
      water_ml: logData.water_ml ?? 0,
      saved_food_id: logData.saved_food_id ?? null,
    };

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("food_logs")
      .insert(row)
      .select("*")
      .single();

    if (error) return { data: null, error: asError("Failed to create food log", error) };

    // Increment use_count on saved food (non-blocking)
    if (logData.saved_food_id) {
      try {
        const { data: sf } = await client
          .schema<PublicSchema>("public")
          .from("saved_foods")
          .select("use_count")
          .eq("id", logData.saved_food_id)
          .single();
        if (sf) {
          await client
            .schema<PublicSchema>("public")
            .from("saved_foods")
            .update({ use_count: ((sf as { use_count: number }).use_count ?? 0) + 1 })
            .eq("id", logData.saved_food_id);
        }
      } catch {
        // Non-blocking — use_count miss is acceptable
      }
    }

    return { data: data as unknown as FoodLog, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to create food log", cause) };
  }
}

/**
 * Deletes a food log entry by ID.
 */
export async function deleteFoodLog(
  logId: string
): Promise<SupabaseQueryResult<{ deleted: true }>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    const { error } = await client
      .schema<PublicSchema>("public")
      .from("food_logs")
      .delete()
      .eq("id", logId);

    if (error) return { data: null, error: asError("Failed to delete food log", error) };
    return { data: { deleted: true }, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to delete food log", cause) };
  }
}

// =========================
// Saved food helpers
// =========================

/**
 * Fetches saved foods, ordered by use_count DESC then food_name ASC.
 */
export async function getSavedFoods(): Promise<SupabaseQueryResult<SavedFood[]>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("saved_foods")
      .select("*")
      .order("use_count", { ascending: false })
      .order("food_name", { ascending: true });

    if (error) return { data: null, error: asError("Failed to fetch saved foods", error) };
    return { data: data as unknown as SavedFood[], error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch saved foods", cause) };
  }
}

/**
 * Creates a saved food entry.
 */
export async function createSavedFood(
  foodData: {
    food_name: string;
    calories: number;
    carbs_g?: number | null;
    fat_g?: number | null;
    protein_g?: number | null;
  }
): Promise<SupabaseQueryResult<SavedFood>> {
  try {
    const client = await createServerSupabaseClient();
    const userId = await requireUserId(client);

    const row = {
      user_id: userId,
      food_name: foodData.food_name,
      calories: foodData.calories,
      carbs_g: foodData.carbs_g ?? null,
      fat_g: foodData.fat_g ?? null,
      protein_g: foodData.protein_g ?? null,
    };

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("saved_foods")
      .insert(row)
      .select("*")
      .single();

    if (error) return { data: null, error: asError("Failed to create saved food", error) };
    return { data: data as unknown as SavedFood, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to create saved food", cause) };
  }
}

/**
 * Updates a saved food entry.
 */
export async function updateSavedFood(
  foodId: string,
  updates: Partial<{ food_name: string; calories: number; carbs_g: number | null; fat_g: number | null; protein_g: number | null }>
): Promise<SupabaseQueryResult<SavedFood>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("saved_foods")
      .update(updates)
      .eq("id", foodId)
      .select("*")
      .single();

    if (error) return { data: null, error: asError("Failed to update saved food", error) };
    return { data: data as unknown as SavedFood, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to update saved food", cause) };
  }
}

/**
 * Deletes a saved food entry.
 */
export async function deleteSavedFood(
  foodId: string
): Promise<SupabaseQueryResult<{ deleted: true }>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    const { error } = await client
      .schema<PublicSchema>("public")
      .from("saved_foods")
      .delete()
      .eq("id", foodId);

    if (error) return { data: null, error: asError("Failed to delete saved food", error) };
    return { data: { deleted: true }, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to delete saved food", cause) };
  }
}

// =========================
// Body metrics helpers
// =========================

/**
 * Upserts a body metric entry (one per user+date).
 */
export async function upsertBodyMetric(
  data: { date: string; weight_kg?: number | null; notes?: string | null }
): Promise<SupabaseQueryResult<BodyMetric>> {
  try {
    const client = await createServerSupabaseClient();
    const userId = await requireUserId(client);

    const { data: result, error } = await client
      .schema<PublicSchema>("public")
      .from("body_metrics")
      .upsert(
        { user_id: userId, date: data.date, weight_kg: data.weight_kg ?? null, notes: data.notes ?? null },
        { onConflict: "user_id,date" }
      )
      .select("*")
      .single();

    if (error) return { data: null, error: asError("Failed to upsert body metric", error) };
    return { data: result as unknown as BodyMetric, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to upsert body metric", cause) };
  }
}

/**
 * Fetches body metrics for a date range (for weight trend chart).
 */
export async function getBodyMetrics(
  filters?: { from?: string; to?: string; limit?: number }
): Promise<SupabaseQueryResult<BodyMetric[]>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    let query = client
      .schema<PublicSchema>("public")
      .from("body_metrics")
      .select("*")
      .order("date", { ascending: false });

    if (filters?.from) query = query.gte("date", filters.from);
    if (filters?.to) query = query.lte("date", filters.to);
    if (filters?.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    if (error) return { data: null, error: asError("Failed to fetch body metrics", error) };
    return { data: data as unknown as BodyMetric[], error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch body metrics", cause) };
  }
}

// =========================
// Daily nutrition aggregation
// =========================

/**
 * Calculates daily nutrition summary for a given date.
 * Dynamic aggregation — no materialized view.
 */
export async function calculateDailyNutrition(
  date: string
): Promise<SupabaseQueryResult<DailyNutritionSummary>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    // 1. Get food logs for the date
    const { data: logs, error: logsError } = await client
      .schema<PublicSchema>("public")
      .from("food_logs")
      .select("calories,carbs_g,fat_g,protein_g,water_ml")
      .eq("date", date);

    if (logsError) return { data: null, error: asError("Failed to fetch food logs for nutrition", logsError) };

    const foodLogs = (logs ?? []) as { calories: number; carbs_g: number | null; fat_g: number | null; protein_g: number | null; water_ml: number }[];
    const total_calories = foodLogs.reduce((s, l) => s + l.calories, 0);
    const total_carbs_g = foodLogs.reduce((s, l) => s + (l.carbs_g ?? 0), 0);
    const total_fat_g = foodLogs.reduce((s, l) => s + (l.fat_g ?? 0), 0);
    const total_protein_g = foodLogs.reduce((s, l) => s + (l.protein_g ?? 0), 0);
    const total_water_ml = foodLogs.reduce((s, l) => s + (l.water_ml ?? 0), 0);

    // 2. Get calorie goal from user preferences
    const { data: prefs } = await client
      .schema<PublicSchema>("public")
      .from("user_preferences")
      .select("daily_calorie_goal")
      .maybeSingle();

    const calorie_goal = (prefs as { daily_calorie_goal: number | null } | null)?.daily_calorie_goal ?? 2000;

    // 3. Get exercise calories burned for the date
    const { data: exerciseLogs, error: exError } = await client
      .schema<PublicSchema>("public")
      .from("exercise_sessions")
      .select("calories_burned")
      .eq("date", date);

    if (exError) return { data: null, error: asError("Failed to fetch exercise sessions for nutrition", exError) };

    const calories_burned = (exerciseLogs ?? []).reduce(
      (s, e) => s + ((e as { calories_burned: number | null }).calories_burned ?? 0),
      0
    );

    const summary: DailyNutritionSummary = {
      date,
      total_calories,
      total_carbs_g,
      total_fat_g,
      total_protein_g,
      total_water_ml,
      calorie_goal,
      calories_burned,
      net_calories: total_calories - calories_burned,
    };

    return { data: summary, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to calculate daily nutrition", cause) };
  }
}

// ================================================================
// Portfolio Module — Public Reads (service role, no auth required)
// ================================================================

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200) || "untitled";
}

export async function getPublishedProjects(): Promise<SupabaseQueryResult<PortfolioProject[]>> {
  try {
    const client = createServiceRoleClient();
    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("portfolio_projects")
      .select("*")
      .eq("is_published", true)
      .order("display_order", { ascending: true });

    if (error) return { data: null, error: asError("Failed to fetch published projects", error) };
    return { data: (data ?? []) as unknown as PortfolioProject[], error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch published projects", cause) };
  }
}

export async function getPublishedProjectBySlug(slug: string): Promise<SupabaseQueryResult<PortfolioProject>> {
  try {
    const client = createServiceRoleClient();
    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("portfolio_projects")
      .select("*")
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();

    if (error) return { data: null, error: asError("Failed to fetch project", error) };
    if (!data) return { data: null, error: new Error("Project not found") };
    return { data: data as unknown as PortfolioProject, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch project", cause) };
  }
}

export async function getPublishedBlogPosts(): Promise<SupabaseQueryResult<BlogPost[]>> {
  try {
    const client = createServiceRoleClient();
    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("blog_posts")
      .select("*")
      .eq("is_published", true)
      .order("published_at", { ascending: false });

    if (error) return { data: null, error: asError("Failed to fetch published blog posts", error) };
    return { data: (data ?? []) as unknown as BlogPost[], error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch published blog posts", cause) };
  }
}

export async function getPublishedBlogPostBySlug(slug: string): Promise<SupabaseQueryResult<BlogPost>> {
  try {
    const client = createServiceRoleClient();
    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();

    if (error) return { data: null, error: asError("Failed to fetch blog post", error) };
    if (!data) return { data: null, error: new Error("Blog post not found") };
    return { data: data as unknown as BlogPost, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch blog post", cause) };
  }
}

export async function getAdjacentBlogPosts(
  publishedAt: string
): Promise<SupabaseQueryResult<{ prev: BlogPost | null; next: BlogPost | null }>> {
  try {
    const client = createServiceRoleClient();

    const { data: prevData } = await client
      .schema<PublicSchema>("public")
      .from("blog_posts")
      .select("*")
      .eq("is_published", true)
      .lt("published_at", publishedAt)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: nextData } = await client
      .schema<PublicSchema>("public")
      .from("blog_posts")
      .select("*")
      .eq("is_published", true)
      .gt("published_at", publishedAt)
      .order("published_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    return {
      data: {
        prev: (prevData as unknown as BlogPost) ?? null,
        next: (nextData as unknown as BlogPost) ?? null,
      },
      error: null,
    };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch adjacent blog posts", cause) };
  }
}

export async function getPublicSiteConfig(): Promise<SupabaseQueryResult<SiteConfig>> {
  try {
    const client = createServiceRoleClient();
    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("site_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) return { data: null, error: asError("Failed to fetch site config", error) };
    // Return defaults if no config row exists yet
    if (!data) {
      return {
        data: {
          id: "",
          user_id: "",
          name: "Ze Wei",
          tagline: "Building What's Next",
          bio: null,
          avatar_url: null,
          social_github: null,
          social_linkedin: null,
          social_email: null,
          seo_title: null,
          seo_description: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      };
    }
    return { data: data as unknown as SiteConfig, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch site config", cause) };
  }
}

// ================================================================
// Portfolio Module — Admin (authenticated)
// ================================================================

export async function getAdminProjects(): Promise<SupabaseQueryResult<PortfolioProject[]>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);
    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("portfolio_projects")
      .select("*")
      .order("display_order", { ascending: true });

    if (error) return { data: null, error: asError("Failed to fetch projects", error) };
    return { data: (data ?? []) as unknown as PortfolioProject[], error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch projects", cause) };
  }
}

export async function getAdminProjectById(id: string): Promise<SupabaseQueryResult<PortfolioProject>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);
    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("portfolio_projects")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) return { data: null, error: asError("Failed to fetch project", error) };
    if (!data) return { data: null, error: new Error("Project not found") };
    return { data: data as unknown as PortfolioProject, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch project", cause) };
  }
}

export async function createProject(input: PortfolioProjectInput): Promise<SupabaseQueryResult<PortfolioProject>> {
  try {
    const client = await createServerSupabaseClient();
    const userId = await requireUserId(client);

    const title = input.title ?? "Untitled Project";
    let slug = input.slug ?? slugify(title);

    // Ensure unique slug
    const { data: existing } = await client
      .schema<PublicSchema>("public")
      .from("portfolio_projects")
      .select("id")
      .eq("user_id", userId)
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    // Get next display_order
    const { data: last } = await client
      .schema<PublicSchema>("public")
      .from("portfolio_projects")
      .select("display_order")
      .eq("user_id", userId)
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = ((last as { display_order: number } | null)?.display_order ?? -1) + 1;

    const row = {
      user_id: userId,
      title,
      slug,
      tagline: input.tagline ?? null,
      description: input.description ?? null,
      content: input.content ?? null,
      content_text: input.content_text ?? null,
      cover_image_url: input.cover_image_url ?? null,
      tags: input.tags ?? null,
      links: input.links ?? [],
      display_order: input.display_order ?? nextOrder,
      is_published: input.is_published ?? false,
    };

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("portfolio_projects")
      .insert(row)
      .select()
      .single();

    if (error) return { data: null, error: asError("Failed to create project", error) };
    return { data: data as unknown as PortfolioProject, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to create project", cause) };
  }
}

export async function updateProject(id: string, input: PortfolioProjectInput): Promise<SupabaseQueryResult<PortfolioProject>> {
  try {
    const client = await createServerSupabaseClient();
    const userId = await requireUserId(client);

    // If slug is being changed, ensure uniqueness
    if (input.slug) {
      const { data: existing } = await client
        .schema<PublicSchema>("public")
        .from("portfolio_projects")
        .select("id")
        .eq("user_id", userId)
        .eq("slug", input.slug)
        .neq("id", id)
        .maybeSingle();

      if (existing) {
        return { data: null, error: new Error("A project with this slug already exists") };
      }
    }

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("portfolio_projects")
      .update(input)
      .eq("id", id)
      .select()
      .single();

    if (error) return { data: null, error: asError("Failed to update project", error) };
    return { data: data as unknown as PortfolioProject, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to update project", cause) };
  }
}

export async function deleteProject(id: string): Promise<SupabaseQueryResult<null>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    const { error } = await client
      .schema<PublicSchema>("public")
      .from("portfolio_projects")
      .delete()
      .eq("id", id);

    if (error) return { data: null, error: asError("Failed to delete project", error) };
    return { data: null, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to delete project", cause) };
  }
}

export async function reorderProjects(orderedIds: string[]): Promise<SupabaseQueryResult<null>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    for (let i = 0; i < orderedIds.length; i++) {
      const { error } = await client
        .schema<PublicSchema>("public")
        .from("portfolio_projects")
        .update({ display_order: i })
        .eq("id", orderedIds[i]);

      if (error) return { data: null, error: asError("Failed to reorder projects", error) };
    }

    return { data: null, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to reorder projects", cause) };
  }
}

// ── Blog Posts (Admin) ───────────────────────────────────────────────────────

export async function getAdminBlogPosts(): Promise<SupabaseQueryResult<BlogPost[]>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);
    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("blog_posts")
      .select("*")
      .order("display_order", { ascending: true });

    if (error) return { data: null, error: asError("Failed to fetch blog posts", error) };
    return { data: (data ?? []) as unknown as BlogPost[], error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch blog posts", cause) };
  }
}

export async function getAdminBlogPostById(id: string): Promise<SupabaseQueryResult<BlogPost>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);
    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("blog_posts")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) return { data: null, error: asError("Failed to fetch blog post", error) };
    if (!data) return { data: null, error: new Error("Blog post not found") };
    return { data: data as unknown as BlogPost, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch blog post", cause) };
  }
}

export async function createBlogPost(input: BlogPostInput): Promise<SupabaseQueryResult<BlogPost>> {
  try {
    const client = await createServerSupabaseClient();
    const userId = await requireUserId(client);

    const title = input.title ?? "Untitled Post";
    let slug = input.slug ?? slugify(title);

    // Ensure unique slug
    const { data: existing } = await client
      .schema<PublicSchema>("public")
      .from("blog_posts")
      .select("id")
      .eq("user_id", userId)
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    // Get next display_order
    const { data: last } = await client
      .schema<PublicSchema>("public")
      .from("blog_posts")
      .select("display_order")
      .eq("user_id", userId)
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = ((last as { display_order: number } | null)?.display_order ?? -1) + 1;

    const row = {
      user_id: userId,
      title,
      subtitle: input.subtitle ?? null,
      slug,
      content: input.content ?? null,
      content_text: input.content_text ?? null,
      cover_image_url: input.cover_image_url ?? null,
      tags: input.tags ?? null,
      reading_time_minutes: input.reading_time_minutes ?? null,
      display_order: input.display_order ?? nextOrder,
      is_published: input.is_published ?? false,
      published_at: input.published_at ?? null,
    };

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("blog_posts")
      .insert(row)
      .select()
      .single();

    if (error) return { data: null, error: asError("Failed to create blog post", error) };
    return { data: data as unknown as BlogPost, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to create blog post", cause) };
  }
}

export async function updateBlogPost(id: string, input: BlogPostInput): Promise<SupabaseQueryResult<BlogPost>> {
  try {
    const client = await createServerSupabaseClient();
    const userId = await requireUserId(client);

    // If slug is being changed, ensure uniqueness
    if (input.slug) {
      const { data: existing } = await client
        .schema<PublicSchema>("public")
        .from("blog_posts")
        .select("id")
        .eq("user_id", userId)
        .eq("slug", input.slug)
        .neq("id", id)
        .maybeSingle();

      if (existing) {
        return { data: null, error: new Error("A blog post with this slug already exists") };
      }
    }

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("blog_posts")
      .update(input)
      .eq("id", id)
      .select()
      .single();

    if (error) return { data: null, error: asError("Failed to update blog post", error) };
    return { data: data as unknown as BlogPost, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to update blog post", cause) };
  }
}

export async function deleteBlogPost(id: string): Promise<SupabaseQueryResult<null>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    const { error } = await client
      .schema<PublicSchema>("public")
      .from("blog_posts")
      .delete()
      .eq("id", id);

    if (error) return { data: null, error: asError("Failed to delete blog post", error) };
    return { data: null, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to delete blog post", cause) };
  }
}

export async function reorderBlogPosts(orderedIds: string[]): Promise<SupabaseQueryResult<null>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    for (let i = 0; i < orderedIds.length; i++) {
      const { error } = await client
        .schema<PublicSchema>("public")
        .from("blog_posts")
        .update({ display_order: i })
        .eq("id", orderedIds[i]);

      if (error) return { data: null, error: asError("Failed to reorder blog posts", error) };
    }

    return { data: null, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to reorder blog posts", cause) };
  }
}

// ── Site Config (Admin) ──────────────────────────────────────────────────────

export async function getAdminSiteConfig(): Promise<SupabaseQueryResult<SiteConfig>> {
  try {
    const client = await createServerSupabaseClient();
    const userId = await requireUserId(client);

    const { data, error } = await client
      .schema<PublicSchema>("public")
      .from("site_config")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) return { data: null, error: asError("Failed to fetch site config", error) };

    // Auto-create default config if none exists
    if (!data) {
      const { data: created, error: createError } = await client
        .schema<PublicSchema>("public")
        .from("site_config")
        .insert({ user_id: userId })
        .select()
        .single();

      if (createError) return { data: null, error: asError("Failed to create default site config", createError) };
      return { data: created as unknown as SiteConfig, error: null };
    }

    return { data: data as unknown as SiteConfig, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to fetch site config", cause) };
  }
}

export async function updateSiteConfig(input: SiteConfigInput): Promise<SupabaseQueryResult<SiteConfig>> {
  try {
    const client = await createServerSupabaseClient();
    const userId = await requireUserId(client);

    // Upsert: update if exists, insert if not
    const { data: existing } = await client
      .schema<PublicSchema>("public")
      .from("site_config")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      const { data, error } = await client
        .schema<PublicSchema>("public")
        .from("site_config")
        .update(input)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) return { data: null, error: asError("Failed to update site config", error) };
      return { data: data as unknown as SiteConfig, error: null };
    } else {
      const { data, error } = await client
        .schema<PublicSchema>("public")
        .from("site_config")
        .insert({ user_id: userId, ...input })
        .select()
        .single();

      if (error) return { data: null, error: asError("Failed to create site config", error) };
      return { data: data as unknown as SiteConfig, error: null };
    }
  } catch (cause) {
    return { data: null, error: asError("Failed to update site config", cause) };
  }
}

// ── Portfolio Image Upload ───────────────────────────────────────────────────

export async function ensurePortfolioImagesBucket(): Promise<void> {
  try {
    const admin = createServiceRoleClient();
    const { data: buckets } = await admin.storage.listBuckets();
    const exists = (buckets ?? []).some((b: { name: string }) => b.name === "portfolio-images");
    if (!exists) {
      await admin.storage.createBucket("portfolio-images", {
        public: true,
        fileSizeLimit: 10 * 1024 * 1024,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
      });
    }
  } catch {
    // Bucket may already exist — swallow
  }
}

export async function uploadPortfolioImage(
  userId: string,
  fileName: string,
  body: Buffer,
  contentType: string
): Promise<SupabaseQueryResult<string>> {
  try {
    const admin = createServiceRoleClient();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${userId}/${Date.now()}-${safeName}`;

    const { error } = await admin.storage
      .from("portfolio-images")
      .upload(path, body, { contentType, upsert: false });

    if (error) return { data: null, error: asError("Failed to upload portfolio image", error) };

    const { data: urlData } = admin.storage
      .from("portfolio-images")
      .getPublicUrl(path);

    return { data: urlData.publicUrl, error: null };
  } catch (cause) {
    return { data: null, error: asError("Failed to upload portfolio image", cause) };
  }
}
