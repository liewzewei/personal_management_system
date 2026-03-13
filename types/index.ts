/**
 * Shared TypeScript types for PMS.
 *
 * These interfaces mirror the database schema (Supabase/Postgres) exactly and
 * are used across server routes, UI, and `lib/` data helpers.
 *
 * Notes:
 * - UUIDs are represented as strings in TypeScript.
 * - `timestamptz` values are represented as ISO strings at the app boundary.
 */

export type UUID = string;
export type ISODateTime = string;

export interface Task {
  id: UUID;
  user_id: UUID;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  tags: string[] | null;
  deadline: ISODateTime | null;
  estimated_minutes: number | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  parent_task_id: UUID | null;
  outlook_event_id: string | null;
  completed_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface CalendarEvent {
  id: UUID;
  user_id: UUID;
  title: string;
  description: string | null;
  start_time: ISODateTime;
  end_time: ISODateTime;
  is_all_day: boolean;
  calendar_type: string | null;
  outlook_event_id: string | null;
  outlook_calendar_id: string | null;
  source: "local" | "outlook";
  task_id: UUID | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface DiaryEntry {
  id: UUID;
  user_id: UUID;
  title: string | null;
  content: Record<string, unknown> | null;
  content_text: string | null;
  tags: string[] | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface OutlookSyncState {
  id: UUID;
  user_id: UUID;
  calendar_id: string | null;
  delta_link: string | null;
  last_synced_at: ISODateTime | null;
}

export interface OAuthToken {
  id: UUID;
  user_id: UUID;
  provider: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: ISODateTime | null;
}

