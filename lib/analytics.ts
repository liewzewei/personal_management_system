/**
 * Analytics calculation engine for PMS.
 *
 * All functions are pure — they accept task arrays and return computed analytics.
 * These run server-side in the API route to keep the client fast.
 */

import {
  startOfDay,
  endOfDay,
  subDays,
  subWeeks,
  addDays,
  differenceInDays,
  differenceInCalendarDays,
  format,
  getDay,
  getHours,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  eachDayOfInterval,
  isBefore,
  isAfter,
  isEqual,
} from "date-fns";

import type { Task } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CompletionOverTimeEntry {
  date: string;
  count: number;
}

export interface CompletionByTagEntry {
  tag: string;
  count: number;
}

export interface StreakData {
  current: number;
  longest: number;
  heatmap: { date: string; count: number }[];
}

export interface TimeOfDayEntry {
  hour: number;
  count: number;
}

export interface OverduePatterns {
  onTimeCount: number;
  overdueCount: number;
  averageDaysOverdueByTag: { tag: string; avgDays: number }[];
  currentlyOverdue: Task[];
}

export interface WeeklyReviewData {
  completedLastWeek: number;
  createdLastWeek: number;
  missedLastWeek: number;
  mostProductiveDay: string;
  currentStreak: number;
  focusTags: string[];
}

export interface SuccessRateByTagEntry {
  tag: string;
  rate: number;
  total: number;
}

export interface AnalyticsPayload {
  completionOverTime: CompletionOverTimeEntry[];
  completionByTag: CompletionByTagEntry[];
  streaks: StreakData;
  timeOfDay: TimeOfDayEntry[];
  overduePatterns: OverduePatterns;
  weeklyReview: WeeklyReviewData;
  successRateByTag: SuccessRateByTagEntry[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function toDateString(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function getCompletedTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.status === "done" && t.completed_at);
}

function getTagsForTask(task: Task): string[] {
  return task.tags && task.tags.length > 0 ? task.tags : ["Untagged"];
}

// ─── Calculation Functions ───────────────────────────────────────────────────

/**
 * Groups tasks by completed_at date and returns an entry for every day
 * in the range, including days with 0 completions.
 */
export function calculateCompletionOverTime(
  tasks: Task[],
  startDate: Date,
  endDate: Date
): CompletionOverTimeEntry[] {
  const completed = getCompletedTasks(tasks);

  // Count completions per date
  const counts = new Map<string, number>();
  for (const t of completed) {
    const d = toDateString(new Date(t.completed_at!));
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }

  // Fill every day in range
  const days = eachDayOfInterval({ start: startOfDay(startDate), end: startOfDay(endDate) });
  return days.map((day) => {
    const key = toDateString(day);
    return { date: key, count: counts.get(key) ?? 0 };
  });
}

/**
 * Flattens all tags from completed tasks, counts occurrences,
 * sorted descending by count.
 */
export function calculateCompletionByTag(tasks: Task[]): CompletionByTagEntry[] {
  const completed = getCompletedTasks(tasks);
  const counts = new Map<string, number>();

  for (const t of completed) {
    for (const tag of getTagsForTask(t)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Calculates current streak, longest streak, and heatmap data.
 */
export function calculateStreaks(tasks: Task[]): StreakData {
  const completed = getCompletedTasks(tasks);

  // Get unique completion dates
  const dateSet = new Set<string>();
  for (const t of completed) {
    dateSet.add(toDateString(new Date(t.completed_at!)));
  }

  const sortedDates = Array.from(dateSet).sort();

  // Current streak: count consecutive days from today backwards
  const today = toDateString(new Date());
  const yesterday = toDateString(subDays(new Date(), 1));

  let currentStreak = 0;
  let checkDate: Date;

  if (dateSet.has(today)) {
    checkDate = new Date();
  } else if (dateSet.has(yesterday)) {
    // Don't break streak just because today isn't over
    checkDate = subDays(new Date(), 1);
  } else {
    checkDate = new Date(); // streak is 0
  }

  if (dateSet.has(toDateString(checkDate))) {
    let d = checkDate;
    while (dateSet.has(toDateString(d))) {
      currentStreak++;
      d = subDays(d, 1);
    }
  }

  // Longest streak: find the longest consecutive sequence ever
  let longestStreak = 0;
  if (sortedDates.length > 0) {
    let streak = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i - 1]);
      const curr = new Date(sortedDates[i]);
      if (differenceInCalendarDays(curr, prev) === 1) {
        streak++;
      } else {
        longestStreak = Math.max(longestStreak, streak);
        streak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, streak);
  }

  // Heatmap: last 52 weeks
  const heatmapEnd = new Date();
  const heatmapStart = subWeeks(heatmapEnd, 52);

  // Count completions per date for the heatmap period
  const heatmapCounts = new Map<string, number>();
  for (const t of completed) {
    const d = new Date(t.completed_at!);
    if (d >= startOfDay(heatmapStart) && d <= endOfDay(heatmapEnd)) {
      const key = toDateString(d);
      heatmapCounts.set(key, (heatmapCounts.get(key) ?? 0) + 1);
    }
  }

  const heatmapDays = eachDayOfInterval({ start: startOfDay(heatmapStart), end: startOfDay(heatmapEnd) });
  const heatmap = heatmapDays.map((day) => {
    const key = toDateString(day);
    return { date: key, count: heatmapCounts.get(key) ?? 0 };
  });

  return { current: currentStreak, longest: longestStreak, heatmap };
}

/**
 * Groups completed tasks by hour (0-23) of completion.
 */
export function calculateTimeOfDay(tasks: Task[]): TimeOfDayEntry[] {
  const completed = getCompletedTasks(tasks);
  const counts = new Array<number>(24).fill(0);

  for (const t of completed) {
    const hour = getHours(new Date(t.completed_at!));
    counts[hour]++;
  }

  return counts.map((count, hour) => ({ hour, count }));
}

/**
 * Calculates on-time vs overdue stats, average days overdue by tag,
 * and currently overdue tasks.
 */
export function calculateOverduePatterns(tasks: Task[]): OverduePatterns {
  const now = new Date();
  let onTimeCount = 0;
  let overdueCount = 0;

  // For average days overdue by tag
  const overdueByTag = new Map<string, number[]>();

  for (const t of tasks) {
    if (!t.deadline) continue;
    const deadline = new Date(t.deadline);

    if (t.status === "done" && t.completed_at) {
      const completedAt = new Date(t.completed_at);
      if (completedAt <= endOfDay(deadline)) {
        onTimeCount++;
      } else {
        overdueCount++;
        const daysLate = differenceInDays(completedAt, deadline);
        for (const tag of getTagsForTask(t)) {
          if (!overdueByTag.has(tag)) overdueByTag.set(tag, []);
          overdueByTag.get(tag)!.push(daysLate);
        }
      }
    }
  }

  const averageDaysOverdueByTag = Array.from(overdueByTag.entries())
    .map(([tag, daysArr]) => ({
      tag,
      avgDays: Math.round((daysArr.reduce((a, b) => a + b, 0) / daysArr.length) * 10) / 10,
    }))
    .sort((a, b) => b.avgDays - a.avgDays);

  // Currently overdue: status != 'done' AND deadline < now
  const currentlyOverdue = tasks
    .filter((t) => t.status !== "done" && t.deadline && isBefore(new Date(t.deadline), now))
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());

  return { onTimeCount, overdueCount, averageDaysOverdueByTag, currentlyOverdue };
}

/**
 * Calculates the weekly review metrics for the previous week.
 */
export function calculateWeeklyReview(tasks: Task[]): WeeklyReviewData {
  const now = new Date();
  // Previous week: Monday 00:00 to Sunday 23:59
  const lastWeekEnd = endOfDay(endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }));
  const lastWeekStart = startOfDay(startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }));
  const lastWeekInterval = { start: lastWeekStart, end: lastWeekEnd };

  const completedLastWeek = tasks.filter(
    (t) => t.completed_at && isWithinInterval(new Date(t.completed_at), lastWeekInterval)
  ).length;

  const createdLastWeek = tasks.filter(
    (t) => isWithinInterval(new Date(t.created_at), lastWeekInterval)
  ).length;

  const missedLastWeek = tasks.filter((t) => {
    if (!t.deadline) return false;
    const deadline = new Date(t.deadline);
    return (
      isWithinInterval(deadline, lastWeekInterval) &&
      t.status !== "done"
    );
  }).length;

  // Most productive day of last week
  const dayCounts = new Map<number, number>();
  for (const t of tasks) {
    if (t.completed_at && isWithinInterval(new Date(t.completed_at), lastWeekInterval)) {
      const day = getDay(new Date(t.completed_at));
      dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    }
  }

  let mostProductiveDay = "N/A";
  let maxCount = 0;
  for (const [day, count] of dayCounts) {
    if (count > maxCount) {
      maxCount = count;
      mostProductiveDay = DAY_NAMES[day];
    }
  }

  // Current streak (reuse logic from streaks)
  const streaks = calculateStreaks(tasks);

  // Focus tags: tags with most currently overdue tasks (top 3)
  const overdueTasks = tasks.filter(
    (t) => t.status !== "done" && t.deadline && isBefore(new Date(t.deadline), now)
  );
  const tagOverdueCount = new Map<string, number>();
  for (const t of overdueTasks) {
    for (const tag of getTagsForTask(t)) {
      if (tag === "Untagged") continue;
      tagOverdueCount.set(tag, (tagOverdueCount.get(tag) ?? 0) + 1);
    }
  }
  const focusTags = Array.from(tagOverdueCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag);

  return {
    completedLastWeek,
    createdLastWeek,
    missedLastWeek,
    mostProductiveDay,
    currentStreak: streaks.current,
    focusTags,
  };
}

/**
 * For each tag, calculates the success rate (completed on time / total with deadline).
 * Only includes tags with at least 3 tasks.
 */
export function calculateSuccessRateByTag(tasks: Task[]): SuccessRateByTagEntry[] {
  // Group tasks that have deadlines by tag
  const tagStats = new Map<string, { onTime: number; total: number }>();

  for (const t of tasks) {
    if (!t.deadline) continue;
    const deadline = new Date(t.deadline);

    for (const tag of getTagsForTask(t)) {
      if (!tagStats.has(tag)) tagStats.set(tag, { onTime: 0, total: 0 });
      const stats = tagStats.get(tag)!;
      stats.total++;

      if (t.status === "done" && t.completed_at) {
        const completedAt = new Date(t.completed_at);
        if (completedAt <= endOfDay(deadline)) {
          stats.onTime++;
        }
      }
    }
  }

  return Array.from(tagStats.entries())
    .filter(([, stats]) => stats.total >= 3)
    .map(([tag, stats]) => ({
      tag,
      rate: Math.round((stats.onTime / stats.total) * 100),
      total: stats.total,
    }))
    .sort((a, b) => a.rate - b.rate); // worst first
}

/**
 * Master function: runs all calculations and returns the full analytics payload.
 */
export function calculateAnalytics(
  tasks: Task[],
  startDate: Date,
  endDate: Date
): AnalyticsPayload {
  return {
    completionOverTime: calculateCompletionOverTime(tasks, startDate, endDate),
    completionByTag: calculateCompletionByTag(tasks),
    streaks: calculateStreaks(tasks),
    timeOfDay: calculateTimeOfDay(tasks),
    overduePatterns: calculateOverduePatterns(tasks),
    weeklyReview: calculateWeeklyReview(tasks),
    successRateByTag: calculateSuccessRateByTag(tasks),
  };
}
