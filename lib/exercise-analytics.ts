/**
 * exercise-analytics.ts
 * Server-side analytics computation for exercise module.
 * Queries Supabase directly and returns ExerciseAnalytics shape.
 *
 * SQL for aggregations, JS for streaks/heatmap.
 */

import { createServerSupabaseClient } from "@/lib/supabase";
import type { ExerciseAnalytics, PersonalRecord, PRDistanceBucket } from "@/types";

type PublicSchema = "public";

async function requireUserId(client: Awaited<ReturnType<typeof createServerSupabaseClient>>): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Not authenticated");
  return data.user.id;
}

export async function calculateExerciseAnalytics(
  range: string
): Promise<ExerciseAnalytics> {
  const client = await createServerSupabaseClient();
  await requireUserId(client);

  // Determine start date from range
  const now = new Date();
  let startDate: string | null = null;
  if (range === "7d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    startDate = d.toISOString().split("T")[0]!;
  } else if (range === "30d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    startDate = d.toISOString().split("T")[0]!;
  } else if (range === "90d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 90);
    startDate = d.toISOString().split("T")[0]!;
  } else if (range === "1y") {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - 1);
    startDate = d.toISOString().split("T")[0]!;
  }
  // "all" -> startDate stays null

  // Fetch all sessions in range
  let sessionsQuery = client
    .schema<PublicSchema>("public")
    .from("exercise_sessions")
    .select("id,type,date,duration_seconds,distance_metres,calories_burned,effort_level,stroke_type,is_pr,pr_distance_bucket")
    .order("date", { ascending: true });

  if (startDate) {
    sessionsQuery = sessionsQuery.gte("date", startDate);
  }

  const { data: sessionsData } = await sessionsQuery;
  const sessions = (sessionsData ?? []) as {
    id: string;
    type: string;
    date: string;
    duration_seconds: number;
    distance_metres: number | null;
    calories_burned: number | null;
    effort_level: number | null;
    stroke_type: string | null;
    is_pr: boolean;
    pr_distance_bucket: string | null;
  }[];

  // Separate by type
  const runs = sessions.filter((s) => s.type === "run");
  const swims = sessions.filter((s) => s.type === "swim");

  // --- Running Analytics ---
  const totalRuns = runs.length;
  const totalRunDistanceM = runs.reduce((s, r) => s + (r.distance_metres ?? 0), 0);
  const totalRunDuration = runs.reduce((s, r) => s + r.duration_seconds, 0);
  const avgRunPace = totalRunDistanceM > 0 ? (totalRunDuration / (totalRunDistanceM / 1000)) : 0;

  // Weekly distance bins
  const weeklyRunMap = new Map<string, number>();
  for (const r of runs) {
    const d = new Date(r.date + "T00:00:00");
    const weekStart = new Date(d);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekKey = weekStart.toISOString().split("T")[0]!;
    weeklyRunMap.set(weekKey, (weeklyRunMap.get(weekKey) ?? 0) + (r.distance_metres ?? 0) / 1000);
  }
  const weeklyDistanceKm = Array.from(weeklyRunMap.entries())
    .map(([week, km]) => ({ week, km: Math.round(km * 100) / 100 }))
    .sort((a, b) => a.week.localeCompare(b.week));

  // Pace over time
  const paceOverTime = runs
    .filter((r) => r.distance_metres && r.distance_metres > 0)
    .map((r) => ({
      date: r.date,
      paceSecondsPerKm: r.duration_seconds / ((r.distance_metres ?? 1) / 1000),
    }));

  // Effort distribution
  const effortMap = new Map<number, number>();
  for (const r of runs) {
    if (r.effort_level) {
      effortMap.set(r.effort_level, (effortMap.get(r.effort_level) ?? 0) + 1);
    }
  }
  const effortDistribution = Array.from(effortMap.entries())
    .map(([level, count]) => ({ level, count }))
    .sort((a, b) => a.level - b.level);

  // Personal records
  const { data: prsData } = await client
    .schema<PublicSchema>("public")
    .from("personal_records")
    .select("*")
    .order("distance_bucket", { ascending: true });
  const personalRecords = (prsData ?? []) as PersonalRecord[];

  // --- Swimming Analytics ---
  const totalSwims = swims.length;
  const totalSwimDistanceM = swims.reduce((s, sw) => s + (sw.distance_metres ?? 0), 0);
  const totalSwimDuration = swims.reduce((s, sw) => s + sw.duration_seconds, 0);
  const avgSwimPace = totalSwimDistanceM > 0 ? (totalSwimDuration / totalSwimDistanceM) * 100 : 0;

  const weeklySwimMap = new Map<string, number>();
  for (const sw of swims) {
    const d = new Date(sw.date + "T00:00:00");
    const weekStart = new Date(d);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekKey = weekStart.toISOString().split("T")[0]!;
    weeklySwimMap.set(weekKey, (weeklySwimMap.get(weekKey) ?? 0) + (sw.distance_metres ?? 0));
  }
  const weeklyDistanceMetres = Array.from(weeklySwimMap.entries())
    .map(([week, metres]) => ({ week, metres: Math.round(metres) }))
    .sort((a, b) => a.week.localeCompare(b.week));

  const strokeMap = new Map<string, number>();
  for (const sw of swims) {
    const stroke = sw.stroke_type ?? "unknown";
    strokeMap.set(stroke, (strokeMap.get(stroke) ?? 0) + 1);
  }
  const strokeBreakdown = Array.from(strokeMap.entries())
    .map(([stroke, count]) => ({ stroke, count }))
    .sort((a, b) => b.count - a.count);

  // --- Nutrition Analytics ---
  // Fetch food logs and body metrics for the range
  let foodQuery = client
    .schema<PublicSchema>("public")
    .from("food_logs")
    .select("date,calories,carbs_g,fat_g,protein_g")
    .order("date", { ascending: true });
  if (startDate) foodQuery = foodQuery.gte("date", startDate);
  const { data: foodData } = await foodQuery;
  const foodLogs = (foodData ?? []) as { date: string; calories: number; carbs_g: number | null; fat_g: number | null; protein_g: number | null }[];

  // Group food by date
  const dailyFoodMap = new Map<string, { cal: number; carbs: number; fat: number; protein: number }>();
  for (const f of foodLogs) {
    const existing = dailyFoodMap.get(f.date) ?? { cal: 0, carbs: 0, fat: 0, protein: 0 };
    existing.cal += f.calories;
    existing.carbs += f.carbs_g ?? 0;
    existing.fat += f.fat_g ?? 0;
    existing.protein += f.protein_g ?? 0;
    dailyFoodMap.set(f.date, existing);
  }

  // Get calorie goal
  const { data: prefsData } = await client
    .schema<PublicSchema>("public")
    .from("user_preferences")
    .select("daily_calorie_goal")
    .maybeSingle();
  const calorieGoal = (prefsData as { daily_calorie_goal: number | null } | null)?.daily_calorie_goal ?? 2000;

  // Build calories burned by date from sessions
  const burnedByDate = new Map<string, number>();
  for (const s of sessions) {
    const existing = burnedByDate.get(s.date) ?? 0;
    burnedByDate.set(s.date, existing + (s.calories_burned ?? 0));
  }

  const allDates = new Set([...dailyFoodMap.keys(), ...burnedByDate.keys()]);
  const daysWithData = allDates.size;
  let totalConsumed = 0;
  let totalNet = 0;
  let deficitDays = 0;
  let surplusDays = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalProtein = 0;
  const caloriesOverTime: { date: string; consumed: number; burned: number; net: number }[] = [];

  for (const date of Array.from(allDates).sort()) {
    const consumed = dailyFoodMap.get(date)?.cal ?? 0;
    const burned = burnedByDate.get(date) ?? 0;
    const net = consumed - burned;
    totalConsumed += consumed;
    totalNet += net;
    totalCarbs += dailyFoodMap.get(date)?.carbs ?? 0;
    totalFat += dailyFoodMap.get(date)?.fat ?? 0;
    totalProtein += dailyFoodMap.get(date)?.protein ?? 0;
    if (net < calorieGoal) deficitDays++;
    else surplusDays++;
    caloriesOverTime.push({ date, consumed, burned, net });
  }

  // Weight trend
  let weightQuery = client
    .schema<PublicSchema>("public")
    .from("body_metrics")
    .select("date,weight_kg")
    .not("weight_kg", "is", null)
    .order("date", { ascending: true });
  if (startDate) weightQuery = weightQuery.gte("date", startDate);
  const { data: weightData } = await weightQuery;
  const weightTrend = (weightData ?? [])
    .filter((w: Record<string, unknown>) => w.weight_kg != null)
    .map((w: Record<string, unknown>) => ({ date: w.date as string, weight_kg: w.weight_kg as number }));

  // --- Combined Analytics ---
  const totalCaloriesBurned = sessions.reduce((s, sess) => s + (sess.calories_burned ?? 0), 0);
  const activeDateSet = new Set(sessions.map((s) => s.date));
  const activeDays = activeDateSet.size;

  // Exercise streak computation
  const sortedDates = Array.from(activeDateSet).sort();
  let currentStreak = 0;
  let longestStreak = 0;

  if (sortedDates.length > 0) {
    // Calculate from today backwards for current streak
    const todayStr = now.toISOString().split("T")[0]!;
    let checkDate = new Date(todayStr + "T00:00:00");
    let streak = 0;
    while (activeDateSet.has(checkDate.toISOString().split("T")[0]!)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
    // Also check if yesterday was the last day (in case user hasn't exercised today yet)
    if (streak === 0) {
      checkDate = new Date(todayStr + "T00:00:00");
      checkDate.setDate(checkDate.getDate() - 1);
      while (activeDateSet.has(checkDate.toISOString().split("T")[0]!)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }
    currentStreak = streak;

    // Longest streak
    let tempStreak = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i - 1] + "T00:00:00");
      const curr = new Date(sortedDates[i] + "T00:00:00");
      const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);
  }

  // Exercise heatmap (last 52 weeks)
  const heatmapStart = new Date(now);
  heatmapStart.setDate(heatmapStart.getDate() - 364);
  const heatmapStartStr = heatmapStart.toISOString().split("T")[0]!;
  const heatmapCounts = new Map<string, number>();
  for (const s of sessions) {
    if (s.date >= heatmapStartStr) {
      heatmapCounts.set(s.date, (heatmapCounts.get(s.date) ?? 0) + 1);
    }
  }
  const exerciseHeatmap = Array.from(heatmapCounts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    running: {
      totalRuns,
      totalDistanceKm: Math.round(totalRunDistanceM / 10) / 100,
      totalDurationSeconds: totalRunDuration,
      averagePaceSecondsPerKm: Math.round(avgRunPace * 10) / 10,
      weeklyDistanceKm,
      paceOverTime,
      effortDistribution,
      personalRecords,
    },
    swimming: {
      totalSwims,
      totalDistanceMetres: totalSwimDistanceM,
      totalDurationSeconds: totalSwimDuration,
      averagePacePer100m: Math.round(avgSwimPace * 10) / 10,
      weeklyDistanceMetres,
      strokeBreakdown,
    },
    nutrition: {
      averageDailyCalories: daysWithData > 0 ? Math.round(totalConsumed / daysWithData) : 0,
      averageDailyNet: daysWithData > 0 ? Math.round(totalNet / daysWithData) : 0,
      calorieDeficitDays: deficitDays,
      calorieSurplusDays: surplusDays,
      macroAverages: {
        carbs_g: daysWithData > 0 ? Math.round(totalCarbs / daysWithData) : 0,
        fat_g: daysWithData > 0 ? Math.round(totalFat / daysWithData) : 0,
        protein_g: daysWithData > 0 ? Math.round(totalProtein / daysWithData) : 0,
      },
      weightTrend,
      caloriesOverTime,
    },
    combined: {
      totalCaloriesBurned,
      activeDays,
      currentExerciseStreak: currentStreak,
      longestExerciseStreak: longestStreak,
      exerciseHeatmap,
    },
  };
}
