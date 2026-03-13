/**
 * Tag Breakdown section for analytics dashboard.
 *
 * Left: Recharts PieChart (donut) showing completed tasks by tag.
 * Right: Horizontal bar chart showing success rate per tag.
 */

"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from "recharts";

interface TagBreakdownChartProps {
  completionByTag: { tag: string; count: number }[];
  successRateByTag: { tag: string; rate: number; total: number }[];
}

const COLORS = [
  "#3B82F6", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981",
  "#EF4444", "#06B6D4", "#6B7280", "#D946EF", "#14B8A6",
  "#F97316", "#64748B",
];

function getRateColor(rate: number): string {
  if (rate < 50) return "#EF4444";
  if (rate < 75) return "#F59E0B";
  if (rate < 90) return "#3B82F6";
  return "#10B981";
}

export function TagBreakdownChart({ completionByTag, successRateByTag }: TagBreakdownChartProps) {
  const total = completionByTag.reduce((sum, d) => sum + d.count, 0);
  const hasCompletionData = completionByTag.length > 0;
  const hasSuccessData = successRateByTag.length > 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Donut chart — completion by tag */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold">Completion by Tag</h3>
        {hasCompletionData ? (
          <>
            <div className="mt-3 h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={completionByTag}
                    dataKey="count"
                    nameKey="tag"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {completionByTag.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const item = payload[0].payload as { tag: string; count: number };
                      const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                      return (
                        <div className="rounded-md border bg-popover px-3 py-1.5 text-xs shadow-md">
                          <div className="font-medium">{item.tag}</div>
                          <div className="text-muted-foreground">
                            {item.count} tasks ({pct}%)
                          </div>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {completionByTag.map((entry, i) => (
                <div key={entry.tag} className="flex items-center gap-1.5 text-xs">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span>{entry.tag}</span>
                  <span className="text-muted-foreground">({entry.count})</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-6 text-center text-sm text-muted-foreground py-12">
            No completed tasks with tags yet.
          </div>
        )}
      </div>

      {/* Success rate chart */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold">Success Rate by Tag</h3>
        {hasSuccessData ? (
          <>
            <div className="mt-3 h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={successRateByTag}
                  layout="vertical"
                  margin={{ top: 5, right: 40, bottom: 5, left: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <YAxis
                    type="category"
                    dataKey="tag"
                    tick={{ fontSize: 11 }}
                    width={80}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const item = payload[0].payload as { tag: string; rate: number; total: number };
                      return (
                        <div className="rounded-md border bg-popover px-3 py-1.5 text-xs shadow-md">
                          <div className="font-medium">{item.tag}</div>
                          <div className="text-muted-foreground">
                            {item.rate}% on time ({item.total} tasks with deadlines)
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                    {successRateByTag.map((entry) => (
                      <Cell key={entry.tag} fill={getRateColor(entry.rate)} />
                    ))}
                    <LabelList
                      dataKey="rate"
                      position="right"
                      formatter={(val: unknown) => `${val ?? 0}%`}
                      className="text-xs fill-foreground"
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Based on tasks with deadlines (min. 3 tasks per tag)
            </p>
          </>
        ) : (
          <div className="mt-6 text-center text-sm text-muted-foreground py-12">
            Need at least 3 tasks with deadlines per tag to show rates.
          </div>
        )}
      </div>
    </div>
  );
}
