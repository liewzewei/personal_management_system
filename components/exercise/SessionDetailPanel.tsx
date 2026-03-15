/**
 * SessionDetailPanel — Slide-in panel showing full session details.
 * Shows all logged fields, lap table if laps exist, pace comparison vs PR.
 * Edit button, Delete with confirmation.
 */

"use client";

import { Pencil, Trash2, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  formatDuration,
  formatPace,
  formatSwimPace,
  calculatePace,
  calculateSwimPace,
  metresToDisplay,
  PR_BUCKETS,
} from "@/lib/exercise-utils";
import { useExerciseSession, usePersonalRecords } from "@/lib/hooks/useExercise";
import type { DistanceUnit } from "@/types";

interface SessionDetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string | null;
  distanceUnit?: DistanceUnit;
  onEdit?: (sessionId: string) => void;
  onDelete?: (sessionId: string) => void;
}

const EFFORT_LABELS: Record<number, string> = {
  1: "Very Easy",
  2: "Easy",
  3: "Moderate",
  4: "Hard",
  5: "Max",
};

const SWOLF_LABELS = (score: number) => {
  if (score < 40) return "Good";
  if (score <= 55) return "Average";
  return "Work on technique";
};

export function SessionDetailPanel({
  open,
  onOpenChange,
  sessionId,
  distanceUnit = "km",
  onEdit,
  onDelete,
}: SessionDetailPanelProps) {
  const { data: session, isLoading } = useExerciseSession(open ? sessionId : null);
  const { data: prs } = usePersonalRecords();

  if (!sessionId) return null;

  const isRun = session?.type === "run";
  const isSwim = session?.type === "swim";

  // Pace comparison for runs
  let paceComparison: string | null = null;
  if (isRun && session?.distance_metres && prs) {
    const sessionPace = calculatePace(session.distance_metres, session.duration_seconds);
    const bucket = (() => {
      for (const [key, range] of Object.entries(PR_BUCKETS)) {
        if (session.distance_metres! >= range.min && session.distance_metres! <= range.max) {
          return key;
        }
      }
      return null;
    })();
    if (bucket) {
      const pr = prs.find((p) => p.distance_bucket === bucket);
      if (pr && !session.is_pr) {
        const diff = sessionPace - pr.best_pace_seconds_per_km;
        if (diff > 0) {
          paceComparison = `${Math.round(diff)}s/km slower than your ${PR_BUCKETS[bucket as keyof typeof PR_BUCKETS].label} PR`;
        }
      }
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isLoading
              ? "Loading..."
              : session
                ? `${session.type === "run" ? "Run" : session.type === "swim" ? "Swim" : "Exercise"} — ${session.date}`
                : "Session Details"}
          </SheetTitle>
          <SheetDescription>
            {session && (
              <span className="flex items-center gap-2">
                {session.distance_metres && metresToDisplay(session.distance_metres, distanceUnit)}
                {" · "}
                {formatDuration(session.duration_seconds)}
                {session.is_pr && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
                    <Trophy className="h-3 w-3 mr-0.5" />
                    PR
                  </Badge>
                )}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        {session && (
          <div className="mt-6 space-y-6">
            {/* Core stats */}
            <div className="grid grid-cols-2 gap-4">
              {session.distance_metres && (
                <div>
                  <p className="text-xs text-muted-foreground">Distance</p>
                  <p className="text-sm font-medium">{metresToDisplay(session.distance_metres, distanceUnit)}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="text-sm font-medium">{formatDuration(session.duration_seconds)}</p>
              </div>
              {isRun && session.distance_metres && (
                <div>
                  <p className="text-xs text-muted-foreground">Pace</p>
                  <p className="text-sm font-medium">
                    {formatPace(calculatePace(session.distance_metres, session.duration_seconds))}
                  </p>
                </div>
              )}
              {isSwim && session.distance_metres && (
                <div>
                  <p className="text-xs text-muted-foreground">Pace</p>
                  <p className="text-sm font-medium">
                    {formatSwimPace(calculateSwimPace(session.distance_metres, session.duration_seconds))}
                  </p>
                </div>
              )}
              {session.calories_burned && (
                <div>
                  <p className="text-xs text-muted-foreground">Calories</p>
                  <p className="text-sm font-medium">{session.calories_burned} kcal</p>
                </div>
              )}
            </div>

            {/* Pace comparison */}
            {paceComparison && (
              <p className="text-xs text-muted-foreground italic">{paceComparison}</p>
            )}

            {/* Running details */}
            {isRun && (
              <div className="space-y-3">
                {session.route_name && (
                  <div>
                    <p className="text-xs text-muted-foreground">Route</p>
                    <p className="text-sm">{session.route_name}</p>
                  </div>
                )}
                {session.effort_level && (
                  <div>
                    <p className="text-xs text-muted-foreground">Effort</p>
                    <p className="text-sm">
                      {"●".repeat(session.effort_level)}{"○".repeat(5 - session.effort_level)}
                      {" "}
                      <span className="text-muted-foreground">{EFFORT_LABELS[session.effort_level]}</span>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Swimming details */}
            {isSwim && (
              <div className="space-y-3">
                {session.pool_length_metres && (
                  <div>
                    <p className="text-xs text-muted-foreground">Pool</p>
                    <p className="text-sm">{session.pool_length_metres}m pool</p>
                  </div>
                )}
                {session.total_laps && (
                  <div>
                    <p className="text-xs text-muted-foreground">Laps</p>
                    <p className="text-sm">{session.total_laps} laps</p>
                  </div>
                )}
                {session.stroke_type && (
                  <div>
                    <p className="text-xs text-muted-foreground">Stroke</p>
                    <p className="text-sm capitalize">{session.stroke_type}</p>
                  </div>
                )}
                {session.swolf_score != null && (
                  <div>
                    <p className="text-xs text-muted-foreground">SWOLF</p>
                    <p className="text-sm">
                      {session.swolf_score}{" "}
                      <span className="text-muted-foreground">({SWOLF_LABELS(session.swolf_score)})</span>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Lap table */}
            {session.laps && session.laps.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Lap Splits</p>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-1.5 font-medium">#</th>
                        <th className="text-left px-3 py-1.5 font-medium">Distance</th>
                        <th className="text-left px-3 py-1.5 font-medium">Time</th>
                        <th className="text-left px-3 py-1.5 font-medium">Pace</th>
                      </tr>
                    </thead>
                    <tbody>
                      {session.laps.map((lap) => (
                        <tr key={lap.id} className="border-t">
                          <td className="px-3 py-1.5">{lap.lap_number}</td>
                          <td className="px-3 py-1.5">{metresToDisplay(lap.distance_metres, distanceUnit)}</td>
                          <td className="px-3 py-1.5">{formatDuration(lap.duration_seconds)}</td>
                          <td className="px-3 py-1.5">
                            {lap.pace_seconds_per_km
                              ? formatPace(lap.pace_seconds_per_km)
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Notes */}
            {session.notes && (
              <div>
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{session.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    onEdit(sessionId);
                  }}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
              {onDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive">
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete session?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete this session and its lap data.
                        {session.is_pr && " Personal records will be recalculated."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => {
                          onOpenChange(false);
                          onDelete(sessionId);
                        }}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
