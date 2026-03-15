/**
 * PRCard — Displays a personal record for a distance bucket.
 * Shows best pace, date achieved, and route name.
 * If no PR exists, shows placeholder text.
 */

"use client";

import { Trophy } from "lucide-react";
import { formatPace, PR_BUCKETS } from "@/lib/exercise-utils";
import type { PRDistanceBucket, PersonalRecord } from "@/types";

interface PRCardProps {
  bucket: PRDistanceBucket;
  record: (PersonalRecord & { session_date: string | null; session_route: string | null }) | null;
}

export function PRCard({ bucket, record }: PRCardProps) {
  const bucketInfo = PR_BUCKETS[bucket];

  return (
    <div className="rounded-lg border bg-card p-4 space-y-1.5">
      <div className="flex items-center gap-2">
        <Trophy className={`h-4 w-4 ${record ? "text-amber-500" : "text-muted-foreground/40"}`} />
        <span className="text-sm font-medium">{bucketInfo.label}</span>
      </div>
      {record ? (
        <>
          <p className="text-xl font-bold tracking-tight">
            {formatPace(record.best_pace_seconds_per_km)}
          </p>
          <p className="text-xs text-muted-foreground">
            {record.achieved_at}
            {record.session_route && ` · ${record.session_route}`}
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground pt-1">
          No PR yet — log a run to set your first
        </p>
      )}
    </div>
  );
}
