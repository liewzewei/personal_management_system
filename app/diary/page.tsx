/**
 * Diary page — two-panel layout.
 *
 * Desktop: fixed-width sidebar (entry list) + flex editor.
 * Mobile: single panel — list by default, editor when an entry is selected.
 * Auto-opens the most recent entry on first load.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { DiaryList } from "@/components/diary/DiaryList";
import { Button } from "@/components/ui/button";

const DiaryEditor = dynamic(
  () => import("@/components/diary/DiaryEditor").then((m) => m.DiaryEditor),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-muted" /> }
);
import { useToast } from "@/lib/hooks/use-toast";
import { PenLine } from "lucide-react";
import { useDiaryEntries, useDiaryMutation } from "@/lib/hooks/useDiaryEntries";
import { useTags } from "@/lib/hooks/useTags";
import { useQueryClient } from "@tanstack/react-query";
import type { DiaryEntry } from "@/types";

export default function DiaryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeEntry, setActiveEntry] = useState<DiaryEntry | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileShowEditor, setMobileShowEditor] = useState(false);
  const autoOpenedRef = useRef(false);

  // React Query hooks
  const { entries, loading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useDiaryEntries({ tags: selectedTags.length > 0 ? selectedTags : undefined, search: searchQuery || undefined });
  const { tags: allTags } = useTags("diary");
  const { createEntry, deleteEntry } = useDiaryMutation();

  // Auto-open most recent entry on first load
  useEffect(() => {
    if (!autoOpenedRef.current && entries.length > 0 && !activeEntry) {
      autoOpenedRef.current = true;
      loadEntry(entries[0].id);
    }
  }, [entries]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleNewEntry = useCallback(async () => {
    createEntry.mutate(undefined, {
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

  const handleDeleteEntry = useCallback(async (id: string) => {
    deleteEntry.mutate(id, {
      onSuccess: () => {
        if (activeEntry?.id === id) {
          setActiveEntry(null);
          setMobileShowEditor(false);
        }
        toast({ title: "Entry deleted" });
      },
      onError: () => {
        toast({ title: "Failed to delete entry", variant: "destructive" });
      },
    });
  }, [deleteEntry, activeEntry?.id, toast]);

  const handleDuplicateEntry = async (id: string) => {
    try {
      const res = await fetch(`/api/diary/${id}`);
      const original = (await res.json()) as { data: DiaryEntry | null; error: string | null };
      if (!original.data) return;

      createEntry.mutate({
        title: original.data.title ? `Copy of ${original.data.title}` : "Copy of Untitled",
        content: original.data.content as Record<string, unknown> | undefined,
        content_text: original.data.content_text ?? undefined,
        tags: original.data.tags ?? undefined,
      }, {
        onSuccess: () => toast({ title: "Entry duplicated" }),
        onError: () => toast({ title: "Failed to duplicate entry", variant: "destructive" }),
      });
    } catch {
      toast({ title: "Failed to duplicate entry", variant: "destructive" });
    }
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleEntrySaved = (updated: DiaryEntry) => {
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
    setActiveEntry(updated);
    queryClient.invalidateQueries({ queryKey: ["tags"] });
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar — hidden on mobile when editor is shown */}
      <div className={`w-full border-r md:block md:w-[300px] md:shrink-0 ${mobileShowEditor ? "hidden" : "block"}`}>
        <DiaryList
          entries={entries}
          activeEntryId={activeEntry?.id ?? null}
          allTags={allTags}
          selectedTags={selectedTags}
          searchQuery={searchQuery}
          onSelectEntry={loadEntry}
          onNewEntry={handleNewEntry}
          onDeleteEntry={handleDeleteEntry}
          onDuplicateEntry={handleDuplicateEntry}
          onSearchChange={setSearchQuery}
          onTagToggle={handleTagToggle}
          onLoadMore={hasNextPage ? fetchNextPage : undefined}
          isLoadingMore={isFetchingNextPage}
        />
      </div>

      {/* Editor panel — hidden on mobile when list is shown */}
      <div className={`flex-1 ${mobileShowEditor ? "block" : "hidden md:block"}`}>
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
            <Button onClick={handleNewEntry}>New Entry</Button>
          </div>
        )}
      </div>
    </div>
  );
}

