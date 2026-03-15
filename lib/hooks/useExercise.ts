/**
 * React Query hooks for exercise CRUD and PR management.
 * Follows same patterns as useTasks.ts in this codebase.
 */

"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExerciseSession, PersonalRecord, RunLap } from "@/types";

const PAGE_SIZE = 20;

interface SessionFilters {
  type?: string;
  from?: string;
  to?: string;
}

async function fetchSessionsPage(filters: SessionFilters, offset: number): Promise<ExerciseSession[]> {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String(offset));

  const qs = params.toString();
  const res = await fetch(`/api/exercise/sessions${qs ? `?${qs}` : ""}`);
  const body = (await res.json()) as { data: ExerciseSession[] | null; error: string | null };
  if (!res.ok || body.error) throw new Error(body.error ?? "Failed to fetch sessions");
  return body.data ?? [];
}

export function useExerciseSessions(filters?: SessionFilters) {
  const safeFilters = filters ?? {};

  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["exercise-sessions", safeFilters],
    queryFn: ({ pageParam = 0 }) => fetchSessionsPage(safeFilters, pageParam as number),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.flat().length;
    },
    initialPageParam: 0,
    staleTime: 2 * 60 * 1000, // 2 min
  });

  const sessions = data?.pages.flat() ?? [];

  return {
    sessions,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    fetchNextPage,
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
  };
}

export function useExerciseSession(sessionId: string | null) {
  return useQuery({
    queryKey: ["exercise-session", sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const res = await fetch(`/api/exercise/sessions/${sessionId}`);
      const body = (await res.json()) as { data: (ExerciseSession & { laps: RunLap[] }) | null; error: string | null };
      if (!res.ok || body.error) throw new Error(body.error ?? "Failed to fetch session");
      return body.data;
    },
    enabled: !!sessionId,
    staleTime: 2 * 60 * 1000,
  });
}

type PRWithContext = PersonalRecord & { session_date: string | null; session_route: string | null };

export function usePersonalRecords() {
  return useQuery({
    queryKey: ["personal-records"],
    queryFn: async () => {
      const res = await fetch("/api/exercise/personal-records");
      const body = (await res.json()) as { data: PRWithContext[] | null; error: string | null };
      if (!res.ok || body.error) throw new Error(body.error ?? "Failed to fetch personal records");
      return body.data ?? [];
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

interface CreateSessionData {
  type: "run" | "swim" | "other";
  date: string;
  duration_seconds: number;
  distance_metres?: number;
  calories_burned?: number;
  notes?: string;
  route_name?: string;
  effort_level?: number;
  pool_length_metres?: 25 | 50;
  total_laps?: number;
  stroke_type?: string;
  swolf_score?: number;
  laps?: { lap_number: number; distance_metres: number; duration_seconds: number }[];
}

export function useCreateExerciseSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateSessionData) => {
      const res = await fetch("/api/exercise/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = (await res.json()) as { data: ExerciseSession | null; error: string | null };
      if (!res.ok || body.error) throw new Error(body.error ?? "Failed to create session");
      return body.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["exercise-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["personal-records"] });
      queryClient.invalidateQueries({ queryKey: ["exercise-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["daily-nutrition", variables.date] });
    },
  });
}

export function useUpdateExerciseSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, updates }: { sessionId: string; updates: Partial<CreateSessionData> }) => {
      const res = await fetch(`/api/exercise/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const body = (await res.json()) as { data: ExerciseSession | null; error: string | null };
      if (!res.ok || body.error) throw new Error(body.error ?? "Failed to update session");
      return body.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["exercise-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["exercise-session", data?.id] });
      queryClient.invalidateQueries({ queryKey: ["personal-records"] });
      queryClient.invalidateQueries({ queryKey: ["exercise-analytics"] });
      if (data?.date) {
        queryClient.invalidateQueries({ queryKey: ["daily-nutrition", data.date] });
      }
    },
  });
}

export function useDeleteExerciseSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, date }: { sessionId: string; date: string }) => {
      const res = await fetch(`/api/exercise/sessions/${sessionId}`, { method: "DELETE" });
      const body = (await res.json()) as { data: { deleted: true } | null; error: string | null };
      if (!res.ok || body.error) throw new Error(body.error ?? "Failed to delete session");
      return { deleted: true, date };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["exercise-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["personal-records"] });
      queryClient.invalidateQueries({ queryKey: ["exercise-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["daily-nutrition", variables.date] });
    },
  });
}
