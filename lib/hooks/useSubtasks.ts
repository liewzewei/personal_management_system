/**
 * useSubtasks hook.
 *
 * Fetches and caches subtasks for a single parent task.
 * Has its own React Query key ["subtasks", parentTaskId] so it can
 * be updated independently from the main task list.
 * Only enabled when parentTaskId is provided.
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import type { Task } from "@/types";

export function useSubtasks(parentTaskId: string | null, enabled = true) {
  return useQuery<Task[]>({
    queryKey: ["subtasks", parentTaskId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${parentTaskId}/subtasks`);
      const body = (await res.json()) as { data: Task[] | null; error: string | null };
      return body.data ?? [];
    },
    enabled: !!parentTaskId && enabled,
    staleTime: 1000 * 30, // 30 seconds
  });
}
