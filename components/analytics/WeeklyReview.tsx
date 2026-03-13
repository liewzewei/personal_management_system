/**
 * Weekly Review panel for analytics dashboard.
 *
 * Shows stat cards for the previous week: completed, created, missed,
 * current streak, most productive day, and focus tags.
 * Collapsible — auto-expanded on Mondays.
 */

"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, endOfWeek, subWeeks, getDay } from "date-fns";
import Link from "next/link";

interface WeeklyReviewProps {
  data: {
    completedLastWeek: number;
    createdLastWeek: number;
    missedLastWeek: number;
    mostProductiveDay: string;
    currentStreak: number;
    focusTags: string[];
  };
}

export function WeeklyReview({ data }: WeeklyReviewProps) {
  const isMonday = getDay(new Date()) === 1;
  const [open, setOpen] = useState(isMonday);

  const lastWeekStart = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
  const weekLabel = `Week of ${format(lastWeekStart, "MMM d")} – ${format(lastWeekEnd, "MMM d")}`;

  const stats = [
    { label: "Completed last week", value: data.completedLastWeek, icon: "✅", suffix: "tasks" },
    { label: "Created last week", value: data.createdLastWeek, icon: "📋", suffix: "tasks" },
    { label: "Missed last week", value: data.missedLastWeek, icon: "❌", suffix: "tasks" },
    { label: "Current streak", value: data.currentStreak, icon: "🔥", suffix: "days" },
    { label: "Most productive day", value: data.mostProductiveDay, icon: "⭐", suffix: "" },
  ];

  return (
    <div className="rounded-lg border bg-card">
      <button
        className="flex w-full items-center justify-between p-4 text-left"
        onClick={() => setOpen(!open)}
      >
        <div>
          <h2 className="text-base font-semibold">Weekly Review</h2>
          <p className="text-sm text-muted-foreground">{weekLabel}</p>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border bg-background p-3">
                <div className="text-xs text-muted-foreground">{s.icon} {s.label}</div>
                <div className="mt-1 text-xl font-bold">
                  {s.value}
                  {s.suffix && <span className="ml-1 text-sm font-normal text-muted-foreground">{s.suffix}</span>}
                </div>
              </div>
            ))}
          </div>

          {data.focusTags.length > 0 && (
            <div className="mt-3 rounded-lg border bg-background p-3">
              <div className="text-xs text-muted-foreground">🎯 Focus this week</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {data.focusTags.map((tag) => (
                  <Link key={tag} href={`/tasks?tag=${encodeURIComponent(tag)}`}>
                    <Badge variant="secondary" className="cursor-pointer hover:bg-accent">
                      {tag}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
