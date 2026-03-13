/**
 * Client-side hook for fetching analytics data with React Query caching.
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import type { AnalyticsPayload } from "@/lib/analytics";

async function fetchAnalytics(range: string, tag: string | null): Promise<AnalyticsPayload> {
  const params = new URLSearchParams({ range });
  if (tag) params.set("tag", tag);
  const res = await fetch(`/api/analytics?${params}`);
  const body = (await res.json()) as { data: AnalyticsPayload | null; error: string | null };
  if (!res.ok || body.error) throw new Error(body.error ?? "Failed to load analytics");
  if (!body.data) throw new Error("No analytics data");
  return body.data;
}

export function useAnalytics(range: string, tag: string | null) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["analytics", range, tag],
    queryFn: () => fetchAnalytics(range, tag),
  });

  return {
    data: data ?? null,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
}
