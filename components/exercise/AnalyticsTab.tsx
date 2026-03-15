/**
 * AnalyticsTab — Exercise analytics view within the Exercise page.
 *
 * Date range selector: 7d | 30d | 90d | 1y | All
 * Sections: Running, Swimming, Nutrition, Combined (streak + heatmap)
 * Uses Recharts for charts.
 */

"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Trophy, Flame, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { formatPace, formatSwimPace, formatDuration, PR_BUCKETS } from "@/lib/exercise-utils";
import { cn } from "@/lib/utils";
import type { ExerciseAnalytics } from "@/types";

const RANGES = [
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "1y", label: "1y" },
  { key: "all", label: "All" },
] as const;

function useExerciseAnalytics(range: string) {
  return useQuery({
    queryKey: ["exercise-analytics", range],
    queryFn: async () => {
      const res = await fetch(`/api/exercise/analytics?range=${range}`);
      const body = (await res.json()) as { data: ExerciseAnalytics | null; error: string | null };
      if (!res.ok || body.error) throw new Error(body.error ?? "Failed to fetch analytics");
      return body.data;
    },
    staleTime: 2 * 60 * 1000,
  });
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function AnalyticsTab() {
  const [range, setRange] = useState("30d");
  const { data: analytics, isLoading } = useExerciseAnalytics(range);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        No analytics data available. Log some sessions first.
      </div>
    );
  }

  const { running, swimming, nutrition, combined } = analytics;

  return (
    <div className="space-y-8">
      {/* Range Selector */}
      <div className="flex gap-1">
        {RANGES.map((r) => (
          <Button
            key={r.key}
            variant={range === r.key ? "default" : "outline"}
            size="sm"
            onClick={() => setRange(r.key)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      {/* Combined Section */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Active Days" value={String(combined.activeDays)} />
          <StatCard label="Calories Burned" value={combined.totalCaloriesBurned.toLocaleString()} sub="kcal" />
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Current Streak</p>
            <p className="text-xl font-bold flex items-center gap-1">
              <Flame className="h-5 w-5 text-orange-500" />
              {combined.currentExerciseStreak} days
            </p>
          </div>
          <StatCard label="Longest Streak" value={`${combined.longestExerciseStreak} days`} />
        </div>

        {/* Exercise Heatmap */}
        {combined.exerciseHeatmap.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Activity (52 weeks)</p>
            <div className="flex flex-wrap gap-[2px]">
              {combined.exerciseHeatmap.map((d) => (
                <div
                  key={d.date}
                  className={cn(
                    "w-3 h-3 rounded-sm",
                    d.count === 0 ? "bg-muted" :
                    d.count === 1 ? "bg-green-200" :
                    d.count === 2 ? "bg-green-400" : "bg-green-600"
                  )}
                  title={`${d.date}: ${d.count} session(s)`}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Running Section */}
      {running.totalRuns > 0 && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Running
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Runs" value={String(running.totalRuns)} />
            <StatCard label="Total Distance" value={`${running.totalDistanceKm} km`} />
            <StatCard label="Total Time" value={formatDuration(running.totalDurationSeconds)} />
            <StatCard
              label="Avg Pace"
              value={running.averagePaceSecondsPerKm > 0 ? formatPace(running.averagePaceSecondsPerKm) : "—"}
            />
          </div>

          {/* PR Cards */}
          {running.personalRecords.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {running.personalRecords.map((pr) => (
                <div key={pr.id} className="rounded-lg border bg-card p-3 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-medium">
                      {PR_BUCKETS[pr.distance_bucket as keyof typeof PR_BUCKETS]?.label ?? pr.distance_bucket}
                    </span>
                  </div>
                  <p className="text-sm font-bold">{formatPace(pr.best_pace_seconds_per_km)}</p>
                  <p className="text-[10px] text-muted-foreground">{pr.achieved_at}</p>
                </div>
              ))}
            </div>
          )}

          {/* Weekly Mileage Chart */}
          {running.weeklyDistanceKm.length > 1 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Weekly Mileage</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={running.weeklyDistanceKm}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="km" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Pace Trend */}
          {running.paceOverTime.length > 1 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pace Trend (lower is faster)</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={running.paceOverTime}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis reversed tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => formatPace(Number(v))} />
                    <Line type="monotone" dataKey="paceSecondsPerKm" stroke="hsl(var(--primary))" dot={{ r: 2 }} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Effort Distribution */}
          {running.effortDistribution.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Effort Distribution</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((level) => {
                  const item = running.effortDistribution.find((e) => e.level === level);
                  const count = item?.count ?? 0;
                  const total = running.totalRuns;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={level} className="flex-1 text-center">
                      <div className="rounded-md bg-muted p-2">
                        <p className="text-lg font-bold">{count}</p>
                        <p className="text-[10px] text-muted-foreground">{pct}%</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">Level {level}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Swimming Section */}
      {swimming.totalSwims > 0 && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Swimming</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Swims" value={String(swimming.totalSwims)} />
            <StatCard label="Total Distance" value={`${swimming.totalDistanceMetres.toLocaleString()}m`} />
            <StatCard label="Total Time" value={formatDuration(swimming.totalDurationSeconds)} />
            <StatCard
              label="Avg Pace"
              value={swimming.averagePacePer100m > 0 ? formatSwimPace(swimming.averagePacePer100m) : "—"}
            />
          </div>

          {swimming.strokeBreakdown.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Stroke Breakdown</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {swimming.strokeBreakdown.map(({ stroke, count }) => (
                  <div key={stroke} className="rounded-lg border bg-card p-3 flex items-center justify-between">
                    <span className="text-sm capitalize">{stroke}</span>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Nutrition Section */}
      {nutrition.caloriesOverTime.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Nutrition</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Avg Daily Calories" value={String(nutrition.averageDailyCalories)} sub="kcal/day" />
            <StatCard label="Avg Daily Net" value={String(nutrition.averageDailyNet)} sub="kcal/day" />
            <StatCard label="Deficit Days" value={String(nutrition.calorieDeficitDays)} />
            <StatCard label="Surplus Days" value={String(nutrition.calorieSurplusDays)} />
          </div>

          {/* Macro Averages */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border bg-card p-3 text-center">
              <p className="text-xs text-muted-foreground">Avg Carbs</p>
              <p className="text-lg font-semibold">{nutrition.macroAverages.carbs_g}g</p>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <p className="text-xs text-muted-foreground">Avg Fat</p>
              <p className="text-lg font-semibold">{nutrition.macroAverages.fat_g}g</p>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <p className="text-xs text-muted-foreground">Avg Protein</p>
              <p className="text-lg font-semibold">{nutrition.macroAverages.protein_g}g</p>
            </div>
          </div>

          {/* Calorie Balance Chart */}
          {nutrition.caloriesOverTime.length > 1 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Calorie Balance</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={nutrition.caloriesOverTime}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="consumed" stroke="#3b82f6" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="burned" stroke="#ef4444" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="net" stroke="#22c55e" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Weight Trend */}
          {nutrition.weightTrend.length > 1 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Weight Trend</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={nutrition.weightTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="weight_kg" stroke="hsl(var(--primary))" dot={{ r: 3 }} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Empty state */}
      {running.totalRuns === 0 && swimming.totalSwims === 0 && nutrition.caloriesOverTime.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No data for the selected period. Log some sessions or food to see analytics.
        </div>
      )}
    </div>
  );
}
