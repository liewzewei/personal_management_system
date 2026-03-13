/**
 * Overdue Patterns section for analytics dashboard.
 *
 * Shows on-time vs late stat cards, average days overdue by tag bar chart,
 * and a currently overdue tasks table.
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
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { differenceInDays, format, parseISO } from "date-fns";
import Link from "next/link";
import type { Task } from "@/types";

interface OverdueSectionProps {
  data: {
    onTimeCount: number;
    overdueCount: number;
    averageDaysOverdueByTag: { tag: string; avgDays: number }[];
    currentlyOverdue: Task[];
  };
}

export function OverdueSection({ data }: OverdueSectionProps) {
  const total = data.onTimeCount + data.overdueCount;
  const onTimePct = total > 0 ? Math.round((data.onTimeCount / total) * 100) : 0;
  const overduePct = total > 0 ? Math.round((data.overdueCount / total) * 100) : 0;
  const hasAvgData = data.averageDaysOverdueByTag.length > 0;
  const now = new Date();

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">On Time</div>
          <div className="mt-1 text-2xl font-bold text-green-600">
            {data.onTimeCount}
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">
              tasks ({onTimePct}%)
            </span>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Late</div>
          <div className="mt-1 text-2xl font-bold text-red-600">
            {data.overdueCount}
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">
              tasks ({overduePct}%)
            </span>
          </div>
        </div>
      </div>

      {/* Average days overdue by tag */}
      {hasAvgData && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold">Average Days Overdue by Tag</h3>
          <div className="mt-3 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.averageDaysOverdueByTag}
                layout="vertical"
                margin={{ top: 5, right: 30, bottom: 5, left: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} unit=" days" />
                <YAxis type="category" dataKey="tag" tick={{ fontSize: 11 }} width={80} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const item = payload[0].payload as { tag: string; avgDays: number };
                    return (
                      <div className="rounded-md border bg-popover px-3 py-1.5 text-xs shadow-md">
                        <div className="font-medium">{item.tag}</div>
                        <div className="text-muted-foreground">
                          {item.avgDays} days late on average
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="avgDays" fill="#EF4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Currently overdue table */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold">Currently Overdue</h3>
        {data.currentlyOverdue.length === 0 ? (
          <div className="mt-3 rounded-md border border-green-200 bg-green-50 p-3 text-center text-sm text-green-800">
            You&apos;re all caught up! No overdue tasks. 🎉
          </div>
        ) : (
          <>
            <div className="mt-3 overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-2.5 font-medium">Task</th>
                    <th className="text-left p-2.5 font-medium">Tags</th>
                    <th className="text-left p-2.5 font-medium">Deadline</th>
                    <th className="text-right p-2.5 font-medium">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.currentlyOverdue.slice(0, 10).map((task) => {
                    const daysOverdue = differenceInDays(now, new Date(task.deadline!));
                    return (
                      <tr key={task.id} className="border-b last:border-b-0 hover:bg-accent/30">
                        <td className="p-2.5">
                          <Link
                            href={`/tasks?search=${encodeURIComponent(task.title)}`}
                            className="font-medium hover:underline"
                          >
                            {task.title}
                          </Link>
                        </td>
                        <td className="p-2.5">
                          <div className="flex flex-wrap gap-1">
                            {(task.tags ?? []).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-[10px]">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="p-2.5 text-muted-foreground">
                          {format(parseISO(task.deadline!), "MMM d")}
                        </td>
                        <td className="p-2.5 text-right text-red-600 font-medium">
                          {daysOverdue} day{daysOverdue !== 1 ? "s" : ""} overdue
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {data.currentlyOverdue.length > 10 && (
              <div className="mt-2 text-center">
                <Link
                  href="/tasks?status=todo"
                  className="text-xs text-primary hover:underline"
                >
                  View all overdue tasks →
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
