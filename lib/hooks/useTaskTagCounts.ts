/**
 * Client-side hook for fetching unfiltered task tag counts.
 *
 * Fetches from GET /api/tasks/tag-counts to get counts of incomplete tasks
 * per tag, completely independent from the filtered task list query.
 * Used exclusively for sidebar badge display.
 */

"use client";

import { useQuery } from "@tanstack/react-query";

async function fetchTagCounts(): Promise<Record<string, number>> {
  const res = await fetch("/api/tasks/tag-counts");
  const body = (await res.json()) as { data: Record<string, number> | null; error: string | null };
  if (!res.ok || body.error) return {};
  return body.data ?? {};
}

export function useTaskTagCounts() {
  return useQuery({
    queryKey: ["task-tag-counts"],
    queryFn: fetchTagCounts,
    staleTime: 1000 * 60 * 2,
  });
}
