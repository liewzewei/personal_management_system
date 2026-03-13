/**
 * Client-side hook for fetching unique tags.
 *
 * Fetches from GET /api/tags with an optional source param.
 * - source='tasks': only task tags
 * - source='diary': only diary tags
 * - source='all' (default): merged tags from both sources
 */

"use client";

import { useCallback, useEffect, useState } from "react";

interface UseTagsReturn {
  tags: string[];
  loading: boolean;
  refetch: () => void;
}

export function useTags(source: "tasks" | "diary" | "all" = "all"): UseTagsReturn {
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    setLoading(true);
    fetch(`/api/tags?source=${source}`)
      .then(async (res) => {
        const body = (await res.json()) as { data: string[] | null; error: string | null };
        if (res.ok && body.data) {
          setTags(body.data);
        }
      })
      .catch(() => {
        // silently fail — tags are non-critical
      })
      .finally(() => setLoading(false));
  }, [source]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { tags, loading, refetch };
}
