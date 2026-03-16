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
  // Computed fields for performance (populated by getTasks())
  subtask_count?: number;
  subtask_done_count?: number;
}

/** A top-level task with its subtasks pre-loaded. */
export interface TaskWithSubtasks extends Task {
  subtasks: Task[];
}

/** Filter parameters accepted by the task listing API. */
export interface TaskFilters {
  tag?: string;
  status?: "todo" | "in_progress" | "done";
  search?: string;
  sortBy?: "deadline" | "priority" | "created_at" | "title";
}

/** Shape of the body accepted by POST /api/tasks and PATCH /api/tasks/[id]. */
export interface TaskInput {
  title?: string;
  description?: string | null;
  status?: "todo" | "in_progress" | "done";
  priority?: "low" | "medium" | "high";
  tags?: string[] | null;
  deadline?: string | null;
  estimated_minutes?: number | null;
  is_recurring?: boolean;
  recurrence_rule?: string | null;
  parent_task_id?: string | null;
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

/** Input shape for creating/updating calendar events via API. */
export interface CalendarEventInput {
  title?: string;
  description?: string | null;
  start_time?: string;
  end_time?: string;
  is_all_day?: boolean;
  calendar_type?: string | null;
}

/** An iCal feed row from the ical_feeds table. */
export interface IcalFeed {
  id: UUID;
  user_id: UUID;
  name: string;
  ical_url: string;
  calendar_type: string;
  color: string | null;
  is_active: boolean;
  last_synced_at: ISODateTime | null;
  created_at: ISODateTime;
}

/** Input shape for creating/updating iCal feeds via API. */
export interface IcalFeedInput {
  name?: string;
  ical_url?: string;
  calendar_type?: string;
  color?: string | null;
  is_active?: boolean;
}

export type DistanceUnit = 'km' | 'miles';

/** User preferences row from user_preferences table. */
export interface UserPreferences {
  id: UUID;
  user_id: UUID;
  calendar_default_view: string;
  calendar_week_starts_on: string;
  // Exercise & Health preferences
  distance_unit: DistanceUnit;
  bmr_calories: number | null;
  daily_calorie_goal: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  age: number | null;
  biological_sex: 'male' | 'female' | null;
  last_exercise_date: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

/** Result of a single iCal feed sync operation. */
export interface SyncResult {
  added: number;
  updated: number;
  deleted: number;
  errors: string[];
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

// ----------------------------------------------------------------
// Exercise Module Types
// ----------------------------------------------------------------

export type ExerciseType = 'run' | 'swim' | 'other';
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type StrokeType =
  | 'freestyle' | 'backstroke' | 'breaststroke'
  | 'butterfly' | 'mixed';
export type PRDistanceBucket = '1km' | '5km' | '10km' | 'half_marathon';

export interface ExerciseSession {
  id: UUID;
  user_id: UUID;
  type: ExerciseType;
  date: string;
  started_at: ISODateTime | null;
  duration_seconds: number;
  distance_metres: number | null;
  calories_burned: number | null;
  notes: string | null;
  route_name: string | null;
  effort_level: number | null;
  is_pr: boolean;
  pr_distance_bucket: PRDistanceBucket | null;
  pool_length_metres: 25 | 50 | null;
  total_laps: number | null;
  stroke_type: StrokeType | null;
  swolf_score: number | null;
  calendar_event_id: UUID | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface RunLap {
  id: UUID;
  session_id: UUID;
  user_id: UUID;
  lap_number: number;
  distance_metres: number;
  duration_seconds: number;
  pace_seconds_per_km: number | null;
  created_at: ISODateTime;
}

export interface PersonalRecord {
  id: UUID;
  user_id: UUID;
  distance_bucket: PRDistanceBucket;
  best_pace_seconds_per_km: number;
  best_session_id: UUID | null;
  achieved_at: string;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface FoodLog {
  id: UUID;
  user_id: UUID;
  date: string;
  meal_slot: MealSlot;
  food_name: string;
  calories: number;
  carbs_g: number | null;
  fat_g: number | null;
  protein_g: number | null;
  water_ml: number;
  saved_food_id: UUID | null;
  created_at: ISODateTime;
}

export interface SavedFood {
  id: UUID;
  user_id: UUID;
  food_name: string;
  calories: number;
  carbs_g: number | null;
  fat_g: number | null;
  protein_g: number | null;
  use_count: number;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface BodyMetric {
  id: UUID;
  user_id: UUID;
  date: string;
  weight_kg: number | null;
  notes: string | null;
  created_at: ISODateTime;
}

export interface DailyNutritionSummary {
  date: string;
  total_calories: number;
  total_carbs_g: number;
  total_fat_g: number;
  total_protein_g: number;
  total_water_ml: number;
  calorie_goal: number;
  calories_burned: number;
  net_calories: number;
}

export interface ExerciseAnalytics {
  running: {
    totalRuns: number;
    totalDistanceKm: number;
    totalDurationSeconds: number;
    averagePaceSecondsPerKm: number;
    weeklyDistanceKm: { week: string; km: number }[];
    paceOverTime: { date: string; paceSecondsPerKm: number }[];
    effortDistribution: { level: number; count: number }[];
    personalRecords: PersonalRecord[];
  };
  swimming: {
    totalSwims: number;
    totalDistanceMetres: number;
    totalDurationSeconds: number;
    averagePacePer100m: number;
    weeklyDistanceMetres: { week: string; metres: number }[];
    strokeBreakdown: { stroke: string; count: number }[];
  };
  nutrition: {
    averageDailyCalories: number;
    averageDailyNet: number;
    calorieDeficitDays: number;
    calorieSurplusDays: number;
    macroAverages: { carbs_g: number; fat_g: number; protein_g: number };
    weightTrend: { date: string; weight_kg: number }[];
    caloriesOverTime: {
      date: string; consumed: number; burned: number; net: number;
    }[];
  };
  combined: {
    totalCaloriesBurned: number;
    activeDays: number;
    currentExerciseStreak: number;
    longestExerciseStreak: number;
    exerciseHeatmap: { date: string; count: number }[];
  };
}
