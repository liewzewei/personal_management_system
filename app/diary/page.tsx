/**
 * Diary page — two-panel layout.
 *
 * Desktop: fixed-width sidebar (entry list) + flex editor.
 * Mobile: single panel — list by default, editor when an entry is selected.
 * Auto-opens the most recent entry on first load.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { DiaryList } from "@/components/diary/DiaryList";
import { DiaryEditor } from "@/components/diary/DiaryEditor";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import { PenLine } from "lucide-react";
import type { DiaryEntry } from "@/types";

export default function DiaryPage() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<DiaryEntry | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [mobileShowEditor, setMobileShowEditor] = useState(false);

  // Fetch entries
  const fetchEntries = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedTags.length > 0) params.set("tag", selectedTags.join(","));
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/diary?${params}`);
      const body = (await res.json()) as { data: DiaryEntry[] | null; error: string | null };
      if (body.data) {
        setEntries(body.data);
        return body.data;
      }
    } catch {
      toast({ title: "Failed to load diary entries", variant: "destructive" });
    }
    return null;
  }, [selectedTags, searchQuery, toast]);

  // Fetch tags
  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch("/api/tags?source=diary");
      const body = (await res.json()) as { data: string[] | null; error: string | null };
      if (body.data) setAllTags(body.data);
    } catch {
      // Tags are non-critical
    }
  }, []);

  // Initial load
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchEntries(), fetchTags()]).then(([data]) => {
      // Auto-open most recent entry
      if (data && data.length > 0 && !activeEntry) {
        loadEntry(data[0].id);
      }
      setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch on filter changes
  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

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

  const handleNewEntry = async () => {
    try {
      const res = await fetch("/api/diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await res.json()) as { data: DiaryEntry | null; error: string | null };
      if (body.data) {
        setEntries((prev) => [body.data!, ...prev]);
        setActiveEntry(body.data);
        setMobileShowEditor(true);
      }
    } catch {
      toast({ title: "Failed to create entry", variant: "destructive" });
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await fetch(`/api/diary/${id}`, { method: "DELETE" });
      setEntries((prev) => prev.filter((e) => e.id !== id));
      if (activeEntry?.id === id) {
        setActiveEntry(null);
        setMobileShowEditor(false);
      }
      toast({ title: "Entry deleted" });
      fetchTags();
    } catch {
      toast({ title: "Failed to delete entry", variant: "destructive" });
    }
  };

  const handleDuplicateEntry = async (id: string) => {
    try {
      // Fetch original, then create copy
      const res = await fetch(`/api/diary/${id}`);
      const original = (await res.json()) as { data: DiaryEntry | null; error: string | null };
      if (!original.data) return;

      const copyRes = await fetch("/api/diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: original.data.title ? `Copy of ${original.data.title}` : "Copy of Untitled",
          content: original.data.content,
          content_text: original.data.content_text,
          tags: original.data.tags,
        }),
      });
      const copy = (await copyRes.json()) as { data: DiaryEntry | null; error: string | null };
      if (copy.data) {
        setEntries((prev) => [copy.data!, ...prev]);
        toast({ title: "Entry duplicated" });
      }
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
    setEntries((prev) =>
      prev.map((e) => (e.id === updated.id ? updated : e))
    );
    setActiveEntry(updated);
    fetchTags();
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

