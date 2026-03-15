/**
 * RunningTab — Main running view within the Exercise page.
 *
 * Layout:
 * - 4 weekly summary stat cards (distance, runs, avg pace, longest run)
 * - PR banner row: 4 PRCard components
 * - "Log Run" button -> opens RunLogModal
 * - Infinite-scroll session history (20 per page)
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import {
  useExerciseSessions,
  usePersonalRecords,
  useCreateExerciseSession,
  useUpdateExerciseSession,
  useDeleteExerciseSession,
  useExerciseSession,
} from "@/lib/hooks/useExercise";
import { PRCard } from "@/components/exercise/PRCard";
import { SessionCard } from "@/components/exercise/SessionCard";
import { RunLogModal, type RunFormData } from "@/components/exercise/RunLogModal";
import { SessionDetailPanel } from "@/components/exercise/SessionDetailPanel";
import {
  calculatePace,
  formatPace,
  formatDuration,
  metresToDisplay,
} from "@/lib/exercise-utils";
import type { DistanceUnit, ExerciseSession, PRDistanceBucket, RunLap } from "@/types";

interface RunningTabProps {
  distanceUnit?: DistanceUnit;
  weightKg?: number | null;
}

const PR_BUCKETS_LIST: PRDistanceBucket[] = ["1km", "5km", "10km", "half_marathon"];

export function RunningTab({ distanceUnit = "km", weightKg }: RunningTabProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { sessions, loading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useExerciseSessions({ type: "run" });
  const { data: prs } = usePersonalRecords();

  const createSession = useCreateExerciseSession();
  const updateSession = useUpdateExerciseSession();
  const deleteSession = useDeleteExerciseSession();

  // Modal state
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [detailSessionId, setDetailSessionId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Fetch full session for editing
  const { data: editingSession } = useExerciseSession(editingSessionId);

  // When editing session data loads, open the modal
  useEffect(() => {
    if (editingSession && editingSessionId) {
      setLogModalOpen(true);
    }
  }, [editingSession, editingSessionId]);

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Weekly stats (last 7 days)
  const weeklyStats = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekStr = weekAgo.toISOString().split("T")[0];

    const weekSessions = sessions.filter((s) => s.date >= weekStr!);
    const totalDistance = weekSessions.reduce((sum, s) => sum + (s.distance_metres ?? 0), 0);
    const totalDuration = weekSessions.reduce((sum, s) => sum + s.duration_seconds, 0);
    const totalRuns = weekSessions.length;
    const avgPace = totalDistance > 0 ? calculatePace(totalDistance, totalDuration) : 0;
    const longestRun = weekSessions.reduce(
      (max, s) => Math.max(max, s.distance_metres ?? 0),
      0
    );

    return { totalDistance, totalRuns, avgPace, longestRun };
  }, [sessions]);

  // Handlers
  const handleSaveRun = useCallback(
    (data: RunFormData) => {
      if (editingSessionId) {
        updateSession.mutate(
          { sessionId: editingSessionId, updates: data },
          {
            onSuccess: (result) => {
              setLogModalOpen(false);
              setEditingSessionId(null);
              toast({ title: "Run updated" });
            },
            onError: () => {
              toast({ title: "Failed to update run", variant: "destructive" });
            },
          }
        );
      } else {
        createSession.mutate(data, {
          onSuccess: (result) => {
            setLogModalOpen(false);
            if (result?.is_pr && result.pr_distance_bucket) {
              const bucketLabel =
                result.pr_distance_bucket === "1km" ? "1km" :
                result.pr_distance_bucket === "5km" ? "5km" :
                result.pr_distance_bucket === "10km" ? "10km" : "Half Marathon";
              const pace = result.distance_metres
                ? formatPace(calculatePace(result.distance_metres, result.duration_seconds))
                : "";
              toast({
                title: `New ${bucketLabel} PR!`,
                description: pace ? `Your best pace: ${pace}` : undefined,
              });
            } else {
              toast({ title: "Run logged!" });
            }
            // Diary pre-population prompt
            if (result) {
              const dist = result.distance_metres ? metresToDisplay(result.distance_metres, distanceUnit) : "";
              const dur = formatDuration(result.duration_seconds);
              const pace = result.distance_metres ? formatPace(calculatePace(result.distance_metres, result.duration_seconds)) : "";
              setTimeout(() => {
                toast({
                  title: "Want to write a note about this run?",
                  action: (
                    <Button size="sm" variant="outline" onClick={() => {
                      const prefillData = {
                        title: `Run — ${result.date}`,
                        tags: ["exercise", "run"],
                        contentTemplate: `**Session:** ${dist} in ${dur}${pace ? ` (${pace})` : ""}\n**Route:** ${result.route_name ?? "—"}\n**Effort:** ${result.effort_level ?? "—"}/5\n\n`,
                      };
                      sessionStorage.setItem("diary-prefill", JSON.stringify(prefillData));
                      router.push("/diary?prefill=1");
                    }}>
                      Write note
                    </Button>
                  ),
                });
              }, 1500);
            }
          },
          onError: () => {
            toast({ title: "Failed to log run", variant: "destructive" });
          },
        });
      }
    },
    [editingSessionId, createSession, updateSession, toast]
  );

  const handleEdit = useCallback((sessionId: string) => {
    setDetailOpen(false);
    setEditingSessionId(sessionId);
  }, []);

  const handleDelete = useCallback(
    (sessionId: string) => {
      const session = sessions.find((s) => s.id === sessionId);
      deleteSession.mutate(
        { sessionId, date: session?.date ?? "" },
        {
          onSuccess: () => {
            setDetailOpen(false);
            toast({ title: "Run deleted" });
          },
          onError: () => {
            toast({ title: "Failed to delete run", variant: "destructive" });
          },
        }
      );
    },
    [sessions, deleteSession, toast]
  );

  const handleOpenDetail = useCallback((sessionId: string) => {
    setDetailSessionId(sessionId);
    setDetailOpen(true);
  }, []);

  const handleOpenNewRun = useCallback(() => {
    setEditingSessionId(null);
    setLogModalOpen(true);
  }, []);

  return (
    <div className="space-y-6">
      {/* Weekly Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Weekly Distance</p>
          <p className="text-xl font-bold">{metresToDisplay(weeklyStats.totalDistance, distanceUnit)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Runs This Week</p>
          <p className="text-xl font-bold">{weeklyStats.totalRuns}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Avg Pace</p>
          <p className="text-xl font-bold">
            {weeklyStats.avgPace > 0 ? formatPace(weeklyStats.avgPace) : "—"}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Longest Run</p>
          <p className="text-xl font-bold">
            {weeklyStats.longestRun > 0 ? metresToDisplay(weeklyStats.longestRun, distanceUnit) : "—"}
          </p>
        </div>
      </div>

      {/* PR Cards */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Personal Records</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {PR_BUCKETS_LIST.map((bucket) => (
            <PRCard
              key={bucket}
              bucket={bucket}
              record={prs?.find((p) => p.distance_bucket === bucket) ?? null}
            />
          ))}
        </div>
      </div>

      {/* Log Run Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Run History</h3>
        <Button size="sm" onClick={handleOpenNewRun}>
          <Plus className="mr-1.5 h-4 w-4" />
          Log Run
        </Button>
      </div>

      {/* Session History */}
      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-sm">
            No runs logged yet. Click &quot;Log Run&quot; to get started.
          </p>
        </div>
      )}

      {!loading && sessions.length > 0 && (
        <div className="space-y-2">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              distanceUnit={distanceUnit}
              onClick={handleOpenDetail}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-1" />
      {isFetchingNextPage && (
        <div className="flex justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Run Log Modal */}
      <RunLogModal
        open={logModalOpen}
        onOpenChange={(open) => {
          setLogModalOpen(open);
          if (!open) setEditingSessionId(null);
        }}
        session={editingSessionId ? (editingSession as (ExerciseSession & { laps: RunLap[] }) | null) : null}
        distanceUnit={distanceUnit}
        weightKg={weightKg}
        onSave={handleSaveRun}
      />

      {/* Session Detail Panel */}
      <SessionDetailPanel
        open={detailOpen}
        onOpenChange={setDetailOpen}
        sessionId={detailSessionId}
        distanceUnit={distanceUnit}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
}
