/**
 * useSidebarState.ts
 *
 * Shared hook for feature-level secondary sidebars (tag filters,
 * calendar filters, diary entry list). Persists state to localStorage
 * so sidebars remember their open/closed state across page navigations.
 *
 * Usage:
 *   const { isOpen, toggle, close } = useSidebarState('tasks-tags')
 */

"use client";

import { useState, useEffect } from "react";

export function useSidebarState(key: string, defaultOpen = true) {
  const storageKey = `pms-sidebar-${key}`;

  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === "undefined") return defaultOpen;
    const stored = localStorage.getItem(storageKey);
    return stored !== null ? stored === "true" : defaultOpen;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, String(isOpen));
  }, [isOpen, storageKey]);

  return {
    isOpen,
    toggle: () => setIsOpen((prev) => !prev),
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}
