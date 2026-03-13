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

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WeeklyReview } from "@/components/analytics/WeeklyReview";
import { StreakSection } from "@/components/analytics/StreakSection";
import { CompletionChart } from "@/components/analytics/CompletionChart";
import { TimeOfDayChart } from "@/components/analytics/TimeOfDayChart";
import { TagBreakdownChart } from "@/components/analytics/TagBreakdownChart";
import { OverdueSection } from "@/components/analytics/OverdueSection";
import { useToast } from "@/lib/hooks/use-toast";
import type { AnalyticsPayload } from "@/lib/analytics";

type Range = "30d" | "90d" | "1y" | "all";

const RANGE_OPTIONS: { label: string; value: Range }[] = [
  { label: "30 Days", value: "30d" },
  { label: "90 Days", value: "90d" },
  { label: "1 Year", value: "1y" },
  { label: "All Time", value: "all" },
];

export default function AnalyticsPage() {
  const { toast } = useToast();
  const [range, setRange] = useState<Range>("30d");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<string[]>([]);

  const fetchAnalytics = useCallback(
    async (r: Range, tag: string | null) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ range: r });
        if (tag) params.set("tag", tag);
        const res = await fetch(`/api/analytics?${params}`);
        const body = (await res.json()) as { data: AnalyticsPayload | null; error: string | null };
        if (body.data) {
          setData(body.data);
          // Extract unique tags from completionByTag for the filter chips
          const t = body.data.completionByTag
            .map((e) => e.tag)
            .filter((t) => t !== "Untagged");
          setTags(t);
        }
      } catch {
        toast({ title: "Failed to load analytics", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    fetchAnalytics(range, selectedTag);
  }, [range, selectedTag, fetchAnalytics]);

  function handleRangeChange(r: Range) {
    setRange(r);
    setSelectedTag(null); // Reset tag filter on range change
  }

  function handleTagSelect(tag: string | null) {
    setSelectedTag(tag);
  }

  return (
    <div className="min-h-screen">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <h1 className="text-xl font-semibold">Analytics</h1>
          <div className="flex gap-1">
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
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-6 py-6">
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
  );
}

