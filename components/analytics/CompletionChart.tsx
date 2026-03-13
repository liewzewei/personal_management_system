/**
 * Task Completion Over Time chart for analytics dashboard.
 *
 * Recharts LineChart with tag filter chips above.
 * Shows empty state when no data exists.
 */

"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";

interface CompletionChartProps {
  data: { date: string; count: number }[];
  tags: string[];
  selectedTag: string | null;
  onTagSelect: (tag: string | null) => void;
  range: string;
}

export function CompletionChart({
  data,
  tags,
  selectedTag,
  onTagSelect,
  range,
}: CompletionChartProps) {
  const hasData = data.some((d) => d.count > 0);
  const showDots = range === "30d" || range === "90d";

  const formatXAxis = (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      if (range === "1y" || range === "all") return format(d, "MMM ''yy");
      return format(d, "MMM d");
    } catch {
      return dateStr;
    }
  };

  // For 1y/all, sample every Nth tick to avoid clutter
  const tickInterval = range === "30d" ? 6 : range === "90d" ? 13 : 29;

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">Task Completion Over Time</h3>

      {/* Tag filter chips */}
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge
            variant={selectedTag === null ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => onTagSelect(null)}
          >
            All Tags
          </Badge>
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant={selectedTag === tag ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => onTagSelect(tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {hasData ? (
        <div className="mt-3 h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tickFormatter={formatXAxis}
                interval={tickInterval}
                tick={{ fontSize: 11 }}
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
                  const item = payload[0].payload as { date: string; count: number };
                  return (
                    <div className="rounded-md border bg-popover px-3 py-1.5 text-xs shadow-md">
                      <div className="font-medium">{format(parseISO(item.date), "MMM d, yyyy")}</div>
                      <div className="text-muted-foreground">{item.count} task{item.count !== 1 ? "s" : ""} completed</div>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={showDots ? { r: 2, fill: "hsl(var(--primary))" } : false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-6 text-center text-sm text-muted-foreground py-12">
          No completed tasks in this period. Complete some tasks to see your progress.
        </div>
      )}
    </div>
  );
}
