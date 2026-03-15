/**
 * React Query hooks for nutrition, food logs, saved foods, and body metrics.
 * Follows same patterns as useExercise.ts in this codebase.
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BodyMetric, DailyNutritionSummary, FoodLog, SavedFood } from "@/types";

export function useDailyNutrition(date: string) {
  return useQuery({
    queryKey: ["daily-nutrition", date],
    queryFn: async () => {
      const res = await fetch(`/api/exercise/nutrition?date=${date}`);
      const body = (await res.json()) as { data: DailyNutritionSummary | null; error: string | null };
      if (!res.ok || body.error) throw new Error(body.error ?? "Failed to fetch nutrition");
      return body.data;
    },
    enabled: !!date,
    staleTime: 30 * 1000, // 30s
  });
}

export function useFoodLogs(date: string) {
  return useQuery({
    queryKey: ["food-logs", date],
    queryFn: async () => {
      const res = await fetch(`/api/exercise/food-logs?date=${date}`);
      const body = (await res.json()) as { data: FoodLog[] | null; error: string | null };
      if (!res.ok || body.error) throw new Error(body.error ?? "Failed to fetch food logs");
      return body.data ?? [];
    },
    enabled: !!date,
    staleTime: 30 * 1000,
  });
}

export function useCreateFoodLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      date: string;
      meal_slot: string;
      food_name: string;
      calories: number;
      carbs_g?: number;
      fat_g?: number;
      protein_g?: number;
      water_ml?: number;
      saved_food_id?: string;
    }) => {
      const res = await fetch("/api/exercise/food-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = (await res.json()) as { data: FoodLog | null; error: string | null };
      if (!res.ok || body.error) throw new Error(body.error ?? "Failed to create food log");
      return body.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["food-logs", variables.date] });
      queryClient.invalidateQueries({ queryKey: ["daily-nutrition", variables.date] });
    },
  });
}

export function useDeleteFoodLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ logId, date }: { logId: string; date: string }) => {
      const res = await fetch(`/api/exercise/food-logs/${logId}`, { method: "DELETE" });
      const body = (await res.json()) as { data: { deleted: true } | null; error: string | null };
      if (!res.ok || body.error) throw new Error(body.error ?? "Failed to delete food log");
      return { deleted: true, date };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["food-logs", variables.date] });
      queryClient.invalidateQueries({ queryKey: ["daily-nutrition", variables.date] });
    },
  });
}

export function useSavedFoods() {
  return useQuery({
    queryKey: ["saved-foods"],
    queryFn: async () => {
      const res = await fetch("/api/exercise/saved-foods");
      const body = (await res.json()) as { data: SavedFood[] | null; error: string | null };
      if (!res.ok || body.error) throw new Error(body.error ?? "Failed to fetch saved foods");
      return body.data ?? [];
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

export function useCreateSavedFood() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      food_name: string;
      calories: number;
      carbs_g?: number;
      fat_g?: number;
      protein_g?: number;
    }) => {
      const res = await fetch("/api/exercise/saved-foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = (await res.json()) as { data: SavedFood | null; error: string | null };
      if (!res.ok || body.error) throw new Error(body.error ?? "Failed to create saved food");
      return body.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-foods"] });
    },
  });
}

export function useBodyMetrics(filters?: { from?: string; to?: string; limit?: number }) {
  return useQuery({
    queryKey: ["body-metrics", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.from) params.set("from", filters.from);
      if (filters?.to) params.set("to", filters.to);
      if (filters?.limit) params.set("limit", String(filters.limit));
      const qs = params.toString();
      const res = await fetch(`/api/exercise/body-metrics${qs ? `?${qs}` : ""}`);
      const body = (await res.json()) as { data: BodyMetric[] | null; error: string | null };
      if (!res.ok || body.error) throw new Error(body.error ?? "Failed to fetch body metrics");
      return body.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpsertBodyMetric() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { date: string; weight_kg?: number | null; notes?: string | null }) => {
      const res = await fetch("/api/exercise/body-metrics", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = (await res.json()) as { data: BodyMetric | null; error: string | null };
      if (!res.ok || body.error) throw new Error(body.error ?? "Failed to upsert body metric");
      return body.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["body-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["exercise-analytics"] });
    },
  });
}
