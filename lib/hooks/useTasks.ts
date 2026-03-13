/**
 * Client-side hook for fetching and managing tasks.
 *
 * Fetches tasks from GET /api/tasks with optional filter params.
 * Returns { tasks, loading, error, refetch } for use in task UI components.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import type { Task, TaskFilters } from "@/types";

interface UseTasksReturn {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useTasks(filters?: TaskFilters): UseTasksReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const serializedFilters = JSON.stringify(filters ?? {});

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    const parsed: TaskFilters = JSON.parse(serializedFilters) as TaskFilters;
    if (parsed.tag) params.set("tag", parsed.tag);
    if (parsed.status) params.set("status", parsed.status);
    if (parsed.search) params.set("search", parsed.search);
    if (parsed.sortBy) params.set("sortBy", parsed.sortBy);

    const qs = params.toString();
    const url = `/api/tasks${qs ? `?${qs}` : ""}`;

    fetch(url)
      .then(async (res) => {
        const body = (await res.json()) as { data: Task[] | null; error: string | null };
        if (!res.ok || body.error) {
          setError(body.error ?? "Failed to fetch tasks");
          setTasks([]);
        } else {
          setTasks(body.data ?? []);
        }
      })
      .catch(() => {
        setError("Failed to fetch tasks");
        setTasks([]);
      })
      .finally(() => setLoading(false));
  }, [serializedFilters]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { tasks, loading, error, refetch };
}
