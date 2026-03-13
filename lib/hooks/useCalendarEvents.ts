/**
 * Client-side hook for fetching calendar events with React Query caching.
 */

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { CalendarEvent } from "@/types";

async function fetchCalendarEvents(start: string, end: string): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({ start, end });
  const res = await fetch(`/api/calendar/events?${params}`);
  const body = (await res.json()) as { data: CalendarEvent[] | null; error: string | null };
  if (!res.ok || body.error) throw new Error(body.error ?? "Failed to fetch calendar events");
  return body.data ?? [];
}

export function useCalendarEvents(dateRange: { start: string; end: string } | null) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["calendar-events", dateRange],
    queryFn: () => fetchCalendarEvents(dateRange!.start, dateRange!.end),
    enabled: !!dateRange,
  });

  return {
    events: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
  };
}
