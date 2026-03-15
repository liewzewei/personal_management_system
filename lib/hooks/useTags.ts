/**
 * Client-side hook for fetching unique tags.
 *
 * Fetches from GET /api/tags with an optional source param.
 * Uses React Query for caching across page navigations.
 */

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

async function fetchTags(source: string): Promise<string[]> {
  const res = await fetch(`/api/tags?source=${source}`);
  const body = (await res.json()) as { data: string[] | null; error: string | null };
  if (res.ok && body.data) return body.data;
  return [];
}

export function useTags(source: "tasks" | "diary" | "all" = "all") {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["tags", source],
    queryFn: () => fetchTags(source),
    staleTime: 1000 * 60 * 5, // 5 min — tags change only on explicit user action
  });

  return {
    tags: data ?? [],
    loading: isLoading,
    refetch,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ["tags"] }),
  };
}
