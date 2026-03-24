/**
 * SwimmingTab — Main swimming view within the Exercise page.
 *
 * Layout:
 * - 4 weekly summary cards (distance, sessions, avg pace/100m, longest)
 * - "Log Swim" button -> opens SwimLogModal
 * - Session history (infinite scroll, reuses SessionCard)
 * - Stroke breakdown donut chart
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import {
  useExerciseSessions,
  useCreateExerciseSession,
  useUpdateExerciseSession,
  useDeleteExerciseSession,
  useExerciseSession,
} from "@/lib/hooks/useExercise";
import { SessionCard } from "@/components/exercise/SessionCard";
import { SwimLogModal, type SwimFormData } from "@/components/exercise/SwimLogModal";
import { SessionDetailPanel } from "@/components/exercise/SessionDetailPanel";
import { calculateSwimPace, formatSwimPace, formatDuration } from "@/lib/exercise-utils";
import type { DistanceUnit, ExerciseSession } from "@/types";

interface SwimmingTabProps {
  distanceUnit?: DistanceUnit;
  weightKg?: number | null;
}

export function SwimmingTab({ distanceUnit = "km", weightKg }: SwimmingTabProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { sessions, loading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useExerciseSessions({ type: "swim" });

  const createSession = useCreateExerciseSession();
  const updateSession = useUpdateExerciseSession();
  const deleteSession = useDeleteExerciseSession();

  const [logModalOpen, setLogModalOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [detailSessionId, setDetailSessionId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: editingSession } = useExerciseSession(editingSessionId);

  useEffect(() => {
    if (editingSession && editingSessionId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLogModalOpen(true);
    }
  }, [editingSession, editingSessionId]);

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

  // Weekly stats
  const weeklyStats = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekStr = weekAgo.toISOString().split("T")[0];

    const weekSessions = sessions.filter((s) => s.date >= weekStr!);
    const totalDistance = weekSessions.reduce((sum, s) => sum + (s.distance_metres ?? 0), 0);
    const totalDuration = weekSessions.reduce((sum, s) => sum + s.duration_seconds, 0);
    const totalSwims = weekSessions.length;
    const avgPace = totalDistance > 0 ? calculateSwimPace(totalDistance, totalDuration) : 0;
    const longestSwim = weekSessions.reduce((max, s) => Math.max(max, s.distance_metres ?? 0), 0);

    return { totalDistance, totalSwims, avgPace, longestSwim };
  }, [sessions]);

  // Stroke breakdown from all sessions
  const strokeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of sessions) {
      const stroke = s.stroke_type ?? "unknown";
      counts[stroke] = (counts[stroke] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([stroke, count]) => ({ stroke, count }))
      .sort((a, b) => b.count - a.count);
  }, [sessions]);

  const handleSaveSwim = useCallback(
    (data: SwimFormData) => {
      if (editingSessionId) {
        updateSession.mutate(
          { sessionId: editingSessionId, updates: data },
          {
            onSuccess: () => {
              setLogModalOpen(false);
              setEditingSessionId(null);
              toast({ title: "Swim updated" });
            },
            onError: () => toast({ title: "Failed to update swim", variant: "destructive" }),
          }
        );
      } else {
        createSession.mutate(data, {
          onSuccess: (result) => {
            setLogModalOpen(false);
            const dist = result?.distance_metres ? `${result.distance_metres.toLocaleString()}m` : "";
            const dur = result ? formatDuration(result.duration_seconds) : "";
            const pace = result?.distance_metres ? formatSwimPace(calculateSwimPace(result.distance_metres, result.duration_seconds)) : "";
            toast({ title: `Swim logged!${dist ? ` ${dist} in ${dur}` : ""}` });
            // Diary pre-population prompt
            if (result) {
              setTimeout(() => {
                toast({
                  title: "Want to write a note about this swim?",
                  action: (
                    <Button size="sm" variant="outline" onClick={() => {
                      const prefillData = {
                        title: `Swim \u2014 ${result.date}`,
                        tags: ["exercise", "swim"],
                        contentTemplate: `**Session:** ${dist} in ${dur}${pace ? ` (${pace})` : ""}\n**Stroke:** ${result.stroke_type ?? "\u2014"}\n\n`,
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
          onError: () => toast({ title: "Failed to log swim", variant: "destructive" }),
        });
      }
    },
    [editingSessionId, createSession, updateSession, toast, router]
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
            toast({ title: "Swim deleted" });
          },
          onError: () => toast({ title: "Failed to delete swim", variant: "destructive" }),
        }
      );
    },
    [sessions, deleteSession, toast]
  );

  return (
    <div className="space-y-6">
      {/* Weekly Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Weekly Distance</p>
          <p className="text-xl font-bold">{weeklyStats.totalDistance.toLocaleString()}m</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Swims This Week</p>
          <p className="text-xl font-bold">{weeklyStats.totalSwims}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Avg Pace</p>
          <p className="text-xl font-bold">
            {weeklyStats.avgPace > 0 ? formatSwimPace(weeklyStats.avgPace) : "—"}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Longest Swim</p>
          <p className="text-xl font-bold">
            {weeklyStats.longestSwim > 0 ? `${weeklyStats.longestSwim.toLocaleString()}m` : "—"}
          </p>
        </div>
      </div>

      {/* Log Swim Button + History Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Swim History</h3>
        <Button size="sm" onClick={() => { setEditingSessionId(null); setLogModalOpen(true); }}>
          <Plus className="mr-1.5 h-4 w-4" />
          Log Swim
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
            No swims logged yet. Click &quot;Log Swim&quot; to get started.
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
              onClick={(id) => { setDetailSessionId(id); setDetailOpen(true); }}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Stroke Breakdown */}
      {strokeBreakdown.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Stroke Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {strokeBreakdown.map(({ stroke, count }) => (
              <div key={stroke} className="rounded-lg border bg-card p-3 flex items-center justify-between">
                <span className="text-sm capitalize">{stroke}</span>
                <span className="text-sm font-medium text-muted-foreground">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div ref={sentinelRef} className="h-1" />
      {isFetchingNextPage && (
        <div className="flex justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Swim Log Modal */}
      <SwimLogModal
        open={logModalOpen}
        onOpenChange={(open) => { setLogModalOpen(open); if (!open) setEditingSessionId(null); }}
        session={editingSessionId ? (editingSession as ExerciseSession | null) : null}
        weightKg={weightKg}
        onSave={handleSaveSwim}
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
