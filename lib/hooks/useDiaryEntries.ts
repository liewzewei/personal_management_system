/**
 * Client-side hook for fetching diary entries with React Query infinite scroll.
 *
 * 20 entries per page. Supports tag/search filtering.
 */

"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { DiaryEntry } from "@/types";

const PAGE_SIZE = 20;

interface DiaryFilters {
  tags?: string[];
  search?: string;
}

async function fetchDiaryPage(filters: DiaryFilters, offset: number): Promise<DiaryEntry[]> {
  const params = new URLSearchParams();
  if (filters.tags && filters.tags.length > 0) params.set("tag", filters.tags.join(","));
  if (filters.search) params.set("search", filters.search);
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String(offset));

  const res = await fetch(`/api/diary?${params}`);
  const body = (await res.json()) as { data: DiaryEntry[] | null; error: string | null };
  if (!res.ok || body.error) throw new Error(body.error ?? "Failed to fetch diary entries");
  return body.data ?? [];
}

export function useDiaryEntries(filters?: DiaryFilters) {
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
    queryKey: ["diary-entries", safeFilters],
    queryFn: ({ pageParam = 0 }) => fetchDiaryPage(safeFilters, pageParam as number),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.flat().length;
    },
    initialPageParam: 0,
  });

  const entries = data?.pages.flat() ?? [];

  return {
    entries,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    fetchNextPage,
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    queryClient,
  };
}

export function useDiaryMutation() {
  const queryClient = useQueryClient();

  const createEntry = useMutation({
    mutationFn: async (data?: { title?: string; content?: Record<string, unknown>; content_text?: string; tags?: string[]; folder_id?: string | null }) => {
      const res = await fetch("/api/diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data ?? {}),
      });
      if (!res.ok) throw new Error("Failed to create diary entry");
      const body = (await res.json()) as { data: DiaryEntry | null };
      return body.data;
    },
    onSuccess: (newEntry) => {
      // Optimistic: prepend to the first page of all diary-entries queries
      if (newEntry) {
        queryClient.setQueriesData<{ pages: DiaryEntry[][]; pageParams: number[] }>(
          { queryKey: ["diary-entries"] },
          (old) => {
            if (!old) return old;
            const newPages = [...old.pages];
            newPages[0] = [newEntry, ...newPages[0]];
            return { ...old, pages: newPages };
          }
        );
      }
      queryClient.invalidateQueries({ queryKey: ["diary-entries"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });

  const updateEntry = useMutation({
    mutationFn: async ({
      entryId,
      updates,
    }: {
      entryId: string;
      updates: {
        title?: string | null;
        content?: Record<string, unknown> | null;
        content_text?: string | null;
        tags?: string[] | null;
        folder_id?: string | null;
      };
    }) => {
      const res = await fetch(`/api/diary/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const body = (await res.json()) as { data: DiaryEntry | null; error: string | null };
      if (!res.ok || body.error) throw new Error(body.error ?? "Failed to update diary entry");
      return body.data;
    },
    onMutate: async ({ entryId, updates }) => {
      await queryClient.cancelQueries({ queryKey: ["diary-entries"] });
      const previousData = queryClient.getQueriesData({ queryKey: ["diary-entries"] });

      queryClient.setQueriesData<{ pages: DiaryEntry[][]; pageParams: number[] }>(
        { queryKey: ["diary-entries"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) =>
              page.map((entry) =>
                entry.id === entryId
                  ? {
                      ...entry,
                      ...updates,
                      updated_at: new Date().toISOString(),
                    }
                  : entry
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
      queryClient.invalidateQueries({ queryKey: ["diary-entries"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async (entryId: string) => {
      const res = await fetch(`/api/diary/${entryId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete diary entry");
    },
    onMutate: async (entryId: string) => {
      await queryClient.cancelQueries({ queryKey: ["diary-entries"] });
      const previousData = queryClient.getQueriesData({ queryKey: ["diary-entries"] });

      queryClient.setQueriesData<{ pages: DiaryEntry[][]; pageParams: number[] }>(
        { queryKey: ["diary-entries"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => page.filter((entry) => entry.id !== entryId)),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diary-entries"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });

  return { createEntry, updateEntry, deleteEntry };
}
