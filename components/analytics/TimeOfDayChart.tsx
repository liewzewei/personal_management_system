/**
 * Time-of-Day Productivity chart for analytics dashboard.
 *
 * Recharts BarChart showing tasks completed by hour (0-23).
 * Top 3 bars highlighted in amber, rest in primary colour.
 * Subtle background band for 9am-5pm "typical work hours".
 */

"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceArea,
} from "recharts";

interface TimeOfDayChartProps {
  data: { hour: number; count: number }[];
}

function formatHour(hour: number): string {
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

export function TimeOfDayChart({ data }: TimeOfDayChartProps) {
  const hasData = data.some((d) => d.count > 0);

  // Find top 3 hours
  const sorted = [...data].sort((a, b) => b.count - a.count);
  const top3Hours = new Set(sorted.slice(0, 3).filter((d) => d.count > 0).map((d) => d.hour));

  const peakHours = sorted
    .filter((d) => d.count > 0)
    .slice(0, 3)
    .map((d) => formatHour(d.hour));

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">Time-of-Day Productivity</h3>

      {hasData ? (
        <>
          <div className="mt-3 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <ReferenceArea
                  x1={9}
                  x2={17}
                  fill="hsl(var(--muted))"
                  fillOpacity={0.3}
                  label={{ value: "", position: "center" }}
                />
                <XAxis
                  dataKey="hour"
                  tickFormatter={formatHour}
                  tick={{ fontSize: 10 }}
                  interval={2}
                  className="text-muted-foreground"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                  width={30}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const item = payload[0].payload as { hour: number; count: number };
                    return (
                      <div className="rounded-md border bg-popover px-3 py-1.5 text-xs shadow-md">
                        <div className="font-medium">{formatHour(item.hour)}</div>
                        <div className="text-muted-foreground">
                          {item.count} task{item.count !== 1 ? "s" : ""} completed
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.map((entry) => (
                    <Cell
                      key={entry.hour}
                      fill={top3Hours.has(entry.hour) ? "#F59E0B" : "hsl(var(--primary))"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Your peak hours are <span className="font-medium">{peakHours.join(", ")}</span>
          </p>
        </>
      ) : (
        <div className="mt-6 text-center text-sm text-muted-foreground py-12">
          Complete more tasks to discover your peak productivity hours.
        </div>
      )}
    </div>
  );
}
