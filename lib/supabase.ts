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

import type { CalendarEvent, CalendarEventInput, DiaryEntry, IcalFeed, IcalFeedInput, OAuthToken, OutlookSyncState, Task, TaskFilters, TaskInput, TaskWithSubtasks, UserPreferences } from "@/types";

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
export async function getTasks(filters?: TaskFilters): Promise<SupabaseQueryResult<Task[]>> {
  try {
    const client = await createServerSupabaseClient();
    await requireUserId(client);

    let query = client
      .schema<PublicSchema>("public")
      .from("tasks")
      .select("*")
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

    const { data, error } = await query;
    if (error) return { data: null, error: asError("Failed to fetch tasks", error) };

    let tasks = data as unknown as Task[];

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
    await requireUserId(client);

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
    const userId = await requireUserId(client);

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
      .select("*")
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
  preferences: Partial<Pick<UserPreferences, "calendar_default_view" | "calendar_week_starts_on">>
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
      .select("*")
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
  entryData?: { title?: string; content?: Record<string, unknown>; content_text?: string; tags?: string[] }
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
    title?: string;
    content?: Record<string, unknown>;
    content_text?: string;
    tags?: string[];
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

