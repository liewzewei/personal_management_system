"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "pms-diary-folder-collapsed";

export function useDiaryFolderCollapseState() {
  const [collapsedIds, setCollapsedIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsedIds));
  }, [collapsedIds]);

  const collapsedSet = useMemo(() => new Set(collapsedIds), [collapsedIds]);

  return {
    isCollapsed: (folderId: string) => collapsedSet.has(folderId),
    collapse: (folderId: string) => {
      setCollapsedIds((prev) => (prev.includes(folderId) ? prev : [...prev, folderId]));
    },
    expand: (folderId: string) => {
      setCollapsedIds((prev) => prev.filter((id) => id !== folderId));
    },
    toggle: (folderId: string) => {
      setCollapsedIds((prev) => (prev.includes(folderId) ? prev.filter((id) => id !== folderId) : [...prev, folderId]));
    },
  };
}
