/**
 * Client-side hook for fetching and managing tasks.
 *
 * Uses React Query useInfiniteQuery for paginated fetching (30 tasks per page).
 * Returns { tasks, loading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage }.
 */

"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Task, TaskFilters, TaskInput } from "@/types";

const PAGE_SIZE = 30;

async function fetchTasksPage(filters: TaskFilters, offset: number): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String(offset));

  const qs = params.toString();
  const res = await fetch(`/api/tasks${qs ? `?${qs}` : ""}`);
  const body = (await res.json()) as { data: Task[] | null; error: string | null };
  if (!res.ok || body.error) throw new Error(body.error ?? "Failed to fetch tasks");
  return body.data ?? [];
}

export function useTasks(filters?: TaskFilters) {
  const queryClient = useQueryClient();
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
    queryKey: ["tasks", safeFilters],
    queryFn: ({ pageParam = 0 }) => fetchTasksPage(safeFilters, pageParam as number),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.flat().length;
    },
    initialPageParam: 0,
  });

  const tasks = data?.pages.flat() ?? [];

  return {
    tasks,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    fetchNextPage,
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    queryClient,
  };
}

export function useTaskMutation() {
  const queryClient = useQueryClient();

  const updateTask = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: TaskInput }) => {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update task");
      const body = (await res.json()) as { data: Task | null };
      return body.data;
    },
    onMutate: async ({ taskId, updates }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previousData = queryClient.getQueriesData({ queryKey: ["tasks"] });

      // Optimistic update across all task query caches
      queryClient.setQueriesData<{ pages: Task[][]; pageParams: number[] }>(
        { queryKey: ["tasks"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) =>
              page.map((task) =>
                task.id === taskId
                  ? {
                      ...task,
                      ...updates,
                      ...(updates.status === "done" ? { completed_at: new Date().toISOString() } : {}),
                      ...(updates.status && updates.status !== "done" ? { completed_at: null } : {}),
                    }
                  : task
              )
            ),
          };
        }
      );
      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        for (const [key, data] of context.previousData) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const createTask = useMutation({
    mutationFn: async (taskData: TaskInput & { title: string }) => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskData),
      });
      if (!res.ok) throw new Error("Failed to create task");
      const body = (await res.json()) as { data: Task | null };
      return body.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });

  const duplicateTask = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/tasks/${taskId}?action=duplicate`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to duplicate task");
      const body = (await res.json()) as { data: Task | null };
      return body.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });

  return { updateTask, createTask, deleteTask, duplicateTask };
}
