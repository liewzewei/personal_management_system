/**
 * Diary page — two-panel layout.
 *
 * Desktop: fixed-width sidebar (entry list) + flex editor.
 * Mobile: single panel — list by default, editor when an entry is selected.
 * Opens to blank state; user selects or creates an entry.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { DiaryList } from "@/components/diary/DiaryList";
import { Button } from "@/components/ui/button";
import { MobileHeader } from "@/components/MobileHeader";
import { SidebarToggle } from "@/components/SidebarToggle";
import { useSidebarState } from "@/lib/hooks/useSidebarState";

const DiaryEditor = dynamic(
  () => import("@/components/diary/DiaryEditor").then((m) => m.DiaryEditor),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-muted" /> }
);
const DiaryGraphView = dynamic(
  () => import("@/components/diary/DiaryGraphView").then((m) => m.DiaryGraphView),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-muted" /> }
);
import { useToast } from "@/lib/hooks/use-toast";
import { PenLine, Network, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDiaryEntries, useDiaryMutation } from "@/lib/hooks/useDiaryEntries";
import { useDiaryFolders } from "@/lib/hooks/useDiaryFolders";
import { useTags } from "@/lib/hooks/useTags";
import { useQueryClient } from "@tanstack/react-query";
import type { DiaryEntry } from "@/types";

export default function DiaryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const entrySidebar = useSidebarState("diary-entries", true);
  const [activeEntry, setActiveEntry] = useState<DiaryEntry | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileShowEditor, setMobileShowEditor] = useState(false);
  const [view, setView] = useState<"normal" | "graph">("normal");
  const [graphLoading, setGraphLoading] = useState(false);
  const autoLoadRef = useRef(false);

  // React Query hooks
  const { entries, loading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useDiaryEntries({ tags: selectedTags.length > 0 ? selectedTags : undefined, search: searchQuery || undefined });
  useDiaryFolders();
  const { tags: allTags } = useTags("diary");
  const { createEntry, updateEntry, deleteEntry } = useDiaryMutation();

  // Auto-load all pages when entering graph view
  useEffect(() => {
    if (view !== "graph") {
      autoLoadRef.current = false;
      setGraphLoading(false);
      return;
    }
    if (!hasNextPage || isFetchingNextPage || autoLoadRef.current) {
      if (!isFetchingNextPage) setGraphLoading(false);
      return;
    }
    setGraphLoading(true);
    autoLoadRef.current = true;
    fetchNextPage();
  }, [view, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Keep loading pages after each page completes
  useEffect(() => {
    if (view === "graph" && autoLoadRef.current && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
    if (view === "graph" && !hasNextPage && !isFetchingNextPage) {
      setGraphLoading(false);
    }
  }, [view, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleGraphEntrySelect = useCallback(
    (id: string) => {
      setView("normal");
      loadEntry(id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const loadEntry = async (id: string) => {
    try {
      const res = await fetch(`/api/diary/${id}`);
      const body = (await res.json()) as { data: DiaryEntry | null; error: string | null };
      if (body.data) {
        setActiveEntry(body.data);
        setMobileShowEditor(true);
      }
    } catch {
      toast({ title: "Failed to load entry", variant: "destructive" });
    }
  };

  const handleNewEntry = useCallback((folderId: string | null = null) => {
    createEntry.mutate({ folder_id: folderId }, {
      onSuccess: (newEntry) => {
        if (newEntry) {
          setActiveEntry(newEntry);
          setMobileShowEditor(true);
        }
      },
      onError: () => {
        toast({ title: "Failed to create entry", variant: "destructive" });
      },
    });
  }, [createEntry, toast]);

  const handleDeleteEntry = useCallback((id: string) => {
    const deletedWasActive = activeEntry?.id === id;
    const previousActive = activeEntry;
    if (deletedWasActive) {
      setActiveEntry(null);
      setMobileShowEditor(true);
    }

    deleteEntry.mutate(id, {
      onSuccess: () => {
        toast({ title: "Entry deleted" });
      },
      onError: () => {
        if (deletedWasActive && previousActive) {
          setActiveEntry(previousActive);
          setMobileShowEditor(true);
        }
        toast({ title: "Failed to delete entry", variant: "destructive" });
      },
    });
  }, [deleteEntry, activeEntry, toast]);

  const handleRenameEntry = useCallback(
    (id: string, title: string | null) => {
      updateEntry.mutate(
        { entryId: id, updates: { title } },
        {
          onSuccess: (updated) => {
            if (updated && activeEntry?.id === updated.id) {
              setActiveEntry(updated);
            }
          },
          onError: () => {
            toast({ title: "Failed to rename entry", variant: "destructive" });
          },
        }
      );
    },
    [activeEntry?.id, toast, updateEntry]
  );

  const handleMoveEntry = useCallback(
    (id: string, folderId: string | null) => {
      updateEntry.mutate(
        { entryId: id, updates: { folder_id: folderId } },
        {
          onSuccess: (updated) => {
            if (updated && activeEntry?.id === updated.id) {
              setActiveEntry(updated);
            }
          },
          onError: () => {
            toast({ title: "Failed to move entry", variant: "destructive" });
          },
        }
      );
    },
    [activeEntry?.id, toast, updateEntry]
  );

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleEntrySaved = useCallback((updated: DiaryEntry) => {
    // Update entry in React Query cache
    queryClient.setQueriesData<{ pages: DiaryEntry[][]; pageParams: number[] }>(
      { queryKey: ["diary-entries"] },
      (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) =>
            page.map((e) => (e.id === updated.id ? updated : e))
          ),
        };
      }
    );
    // Only update activeEntry if the user hasn't navigated away to a different entry
    setActiveEntry((current) => (current?.id === updated.id ? updated : current));
    queryClient.invalidateQueries({ queryKey: ["tags"] });
  }, [queryClient]);

  return (
    <div className="flex flex-col h-full">
      <MobileHeader
        title="Diary"
        actions={
          <>
            {/* Desktop: sidebar toggle */}
            <div className="hidden md:flex">
              <SidebarToggle
                isOpen={entrySidebar.isOpen}
                onToggle={entrySidebar.toggle}
                label="Toggle entry list"
              />
            </div>
            {/* Mobile: back button when editor is shown */}
            {mobileShowEditor && (
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
                onClick={() => setMobileShowEditor(false)}
              >
                ← Entries
              </Button>
            )}
            {view === "normal" && (
              <Button size="sm" onClick={() => handleNewEntry()}>
                <PenLine className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">New Entry</span>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setView((v) => (v === "normal" ? "graph" : "normal"))}
            >
              {view === "normal" ? (
                <><Network className="h-4 w-4" /><span className="hidden sm:inline ml-1">Graph View</span></>
              ) : (
                <><BookOpen className="h-4 w-4" /><span className="hidden sm:inline ml-1">Diary View</span></>
              )}
            </Button>
          </>
        }
      />

      {view === "graph" ? (
        <div className="flex-1 overflow-hidden">
          <DiaryGraphView
            entries={entries}
            onSelectEntry={handleGraphEntrySelect}
            loading={graphLoading}
          />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Entry list sidebar */}
          <div
            className={cn(
              "flex flex-col border-r overflow-y-auto",
              "w-full md:w-[300px] md:shrink-0",
              mobileShowEditor ? "hidden md:flex" : "flex",
              !entrySidebar.isOpen && "md:hidden"
            )}
          >
            <DiaryList
              loading={loading}
              entries={entries}
              activeEntryId={activeEntry?.id ?? null}
              allTags={allTags}
              selectedTags={selectedTags}
              searchQuery={searchQuery}
              onSelectEntry={loadEntry}
              onNewEntry={handleNewEntry}
              onDeleteEntry={handleDeleteEntry}
              onRenameEntry={handleRenameEntry}
              onMoveEntry={handleMoveEntry}
              onSearchChange={setSearchQuery}
              onTagToggle={handleTagToggle}
              onLoadMore={hasNextPage ? fetchNextPage : undefined}
              isLoadingMore={isFetchingNextPage}
            />
          </div>

          {/* Editor panel */}
          <div
            className={cn(
              "flex-1 overflow-hidden flex flex-col",
              !mobileShowEditor ? "hidden md:flex" : "flex"
            )}
          >
            {activeEntry ? (
              <DiaryEditor
                entry={activeEntry}
                allTags={allTags}
                onSaved={handleEntrySaved}
                onBack={() => setMobileShowEditor(false)}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
                <PenLine className="h-12 w-12 text-muted-foreground/50" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    Start writing. Your thoughts are safe here.
                  </p>
                </div>
                <Button onClick={() => handleNewEntry()}>New Entry</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

