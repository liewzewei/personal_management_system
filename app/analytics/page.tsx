/**
 * Analytics Dashboard page.
 *
 * Full-width scrollable page with sticky header containing date range selector.
 * Sections: Weekly Review, Streaks/Heatmap, Completion Over Time,
 * Time-of-Day, Tag Breakdown, Overdue Patterns.
 *
 * All analytics computed server-side via GET /api/analytics.
 */

"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileHeader } from "@/components/MobileHeader";
import { useAnalytics } from "@/lib/hooks/useAnalytics";

const ChartSkeleton = () => (
  <div className="h-64 w-full animate-pulse rounded-lg bg-muted" />
);

const WeeklyReview = dynamic(
  () => import("@/components/analytics/WeeklyReview").then((m) => m.WeeklyReview),
  { loading: ChartSkeleton, ssr: false }
);
const StreakSection = dynamic(
  () => import("@/components/analytics/StreakSection").then((m) => m.StreakSection),
  { loading: ChartSkeleton, ssr: false }
);
const CompletionChart = dynamic(
  () => import("@/components/analytics/CompletionChart").then((m) => m.CompletionChart),
  { loading: ChartSkeleton, ssr: false }
);
const TimeOfDayChart = dynamic(
  () => import("@/components/analytics/TimeOfDayChart").then((m) => m.TimeOfDayChart),
  { loading: ChartSkeleton, ssr: false }
);
const TagBreakdownChart = dynamic(
  () => import("@/components/analytics/TagBreakdownChart").then((m) => m.TagBreakdownChart),
  { loading: ChartSkeleton, ssr: false }
);
const OverdueSection = dynamic(
  () => import("@/components/analytics/OverdueSection").then((m) => m.OverdueSection),
  { loading: ChartSkeleton, ssr: false }
);

type Range = "30d" | "90d" | "1y" | "all";

const RANGE_OPTIONS: { label: string; value: Range }[] = [
  { label: "30 Days", value: "30d" },
  { label: "90 Days", value: "90d" },
  { label: "1 Year", value: "1y" },
  { label: "All Time", value: "all" },
];

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>("30d");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const { data, loading } = useAnalytics(range, selectedTag);

  const tags = useMemo(() => {
    if (!data) return [];
    return data.completionByTag
      .map((e) => e.tag)
      .filter((t) => t !== "Untagged");
  }, [data]);

  function handleRangeChange(r: Range) {
    setRange(r);
    setSelectedTag(null); // Reset tag filter on range change
  }

  function handleTagSelect(tag: string | null) {
    setSelectedTag(tag);
  }

  return (
    <div className="flex flex-col h-full">
      <MobileHeader title="Analytics" />

      {/* Date range selector — horizontal scroll on mobile */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60 shrink-0 overflow-x-auto scrollbar-none">
        <div className="flex gap-1 p-3 px-4 md:px-6 min-w-max">
          {RANGE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={range === opt.value ? "default" : "outline"}
              size="sm"
              onClick={() => handleRangeChange(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-4 md:py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading analytics...</p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Section 1: Weekly Review */}
            <WeeklyReview data={data.weeklyReview} />

            {/* Section 2: Streaks & Heatmap */}
            <section>
              <h2 className="mb-3 text-base font-semibold">Streaks & Activity</h2>
              <StreakSection data={data.streaks} />
            </section>

            {/* Section 3: Completion Over Time */}
            <section>
              <CompletionChart
                data={data.completionOverTime}
                tags={tags}
                selectedTag={selectedTag}
                onTagSelect={handleTagSelect}
                range={range}
              />
            </section>

            {/* Section 4: Time-of-Day */}
            <section>
              <TimeOfDayChart data={data.timeOfDay} />
            </section>

            {/* Section 5: Tag Breakdown */}
            <section>
              <h2 className="mb-3 text-base font-semibold">Tag Analysis</h2>
              <TagBreakdownChart
                completionByTag={data.completionByTag}
                successRateByTag={data.successRateByTag}
              />
            </section>

            {/* Section 6: Overdue Patterns */}
            <section>
              <h2 className="mb-3 text-base font-semibold">Overdue Patterns</h2>
              <OverdueSection data={data.overduePatterns} />
            </section>
          </div>
        ) : (
          <div className="text-center py-24 text-sm text-muted-foreground">
            Complete your first task to see analytics.
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

