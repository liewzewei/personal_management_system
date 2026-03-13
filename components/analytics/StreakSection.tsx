/**
 * Streak & Heatmap section for analytics dashboard.
 *
 * Shows current/longest streak stat cards and a GitHub-style
 * contribution heatmap (custom div grid, no third-party library).
 */

"use client";

import { useMemo } from "react";
import { format, getDay, startOfWeek, addDays, subWeeks } from "date-fns";

interface StreakSectionProps {
  data: {
    current: number;
    longest: number;
    heatmap: { date: string; count: number }[];
  };
}

const CELL_SIZE = 12;
const CELL_GAP = 2;
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

function getColor(count: number): string {
  if (count === 0) return "#ebedf0";
  if (count <= 2) return "#9be9a8";
  if (count <= 5) return "#40c463";
  if (count <= 9) return "#30a14e";
  return "#216e39";
}

export function StreakSection({ data }: StreakSectionProps) {
  // Build week columns from heatmap data
  const { weeks, monthLabels } = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of data.heatmap) {
      map.set(entry.date, entry.count);
    }

    // Start from 52 weeks ago, aligned to start of week (Monday)
    const today = new Date();
    const gridStart = startOfWeek(subWeeks(today, 51), { weekStartsOn: 1 });

    const weeks: { date: Date; count: number; dateStr: string }[][] = [];
    const monthLabels: { label: string; col: number }[] = [];
    let lastMonth = -1;

    let current = gridStart;
    let weekIndex = 0;

    while (current <= today) {
      const week: { date: Date; count: number; dateStr: string }[] = [];
      for (let d = 0; d < 7; d++) {
        const day = addDays(current, d);
        if (day > today) break;
        const dateStr = format(day, "yyyy-MM-dd");
        week.push({
          date: day,
          count: map.get(dateStr) ?? 0,
          dateStr,
        });

        // Track month labels
        const month = day.getMonth();
        if (month !== lastMonth && d === 0) {
          monthLabels.push({ label: format(day, "MMM"), col: weekIndex });
          lastMonth = month;
        }
      }
      weeks.push(week);
      current = addDays(current, 7);
      weekIndex++;
    }

    return { weeks, monthLabels };
  }, [data.heatmap]);

  const gridWidth = weeks.length * (CELL_SIZE + CELL_GAP) + 30;

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4 text-center">
          <div className="text-3xl font-bold">
            {data.current > 0 ? `${data.current} 🔥` : "0"}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {data.current > 0 ? "Current Streak (days)" : "Start your streak today!"}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <div className="text-3xl font-bold">
            {data.longest} 🏆
          </div>
          <div className="mt-1 text-sm text-muted-foreground">Longest Streak (days)</div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Activity</h3>
        <div className="overflow-x-auto">
          <div style={{ minWidth: gridWidth }}>
            {/* Month labels */}
            <div className="flex" style={{ marginLeft: 30 }}>
              {monthLabels.map((m, i) => (
                <div
                  key={`${m.label}-${i}`}
                  className="text-xs text-muted-foreground"
                  style={{
                    position: "relative",
                    left: m.col * (CELL_SIZE + CELL_GAP),
                    width: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.label}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="mt-1 flex">
              {/* Day labels */}
              <div className="flex flex-col" style={{ width: 28, gap: CELL_GAP }}>
                {DAY_LABELS.map((label, i) => (
                  <div
                    key={i}
                    className="text-[10px] text-muted-foreground"
                    style={{ height: CELL_SIZE, lineHeight: `${CELL_SIZE}px` }}
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Week columns */}
              <div className="flex" style={{ gap: CELL_GAP }}>
                {weeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col" style={{ gap: CELL_GAP }}>
                    {week.map((day) => (
                      <div
                        key={day.dateStr}
                        title={`${format(day.date, "MMM d")} — ${day.count} task${day.count !== 1 ? "s" : ""} completed`}
                        style={{
                          width: CELL_SIZE,
                          height: CELL_SIZE,
                          borderRadius: 2,
                          backgroundColor: getColor(day.count),
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="mt-2 flex items-center justify-end gap-1 text-xs text-muted-foreground">
              <span>Less</span>
              {[0, 1, 3, 6, 10].map((n) => (
                <div
                  key={n}
                  style={{
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    borderRadius: 2,
                    backgroundColor: getColor(n),
                  }}
                />
              ))}
              <span>More</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
