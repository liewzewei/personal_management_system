/**
 * Diary entry list sidebar component.
 *
 * Shows search input, tag filter chips, entry list sorted by updated_at desc,
 * and entry count. Supports context menu for duplicate/delete actions.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Search, MoreHorizontal, Copy, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, isToday, isYesterday, format } from "date-fns";
import type { DiaryEntry } from "@/types";

interface DiaryListProps {
  entries: DiaryEntry[];
  activeEntryId: string | null;
  allTags: string[];
  selectedTags: string[];
  searchQuery: string;
  onSelectEntry: (id: string) => void;
  onNewEntry: () => void;
  onDeleteEntry: (id: string) => void;
  onDuplicateEntry: (id: string) => void;
  onSearchChange: (query: string) => void;
  onTagToggle: (tag: string) => void;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

function formatEntryDate(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return formatDistanceToNow(d, { addSuffix: true });
  if (isYesterday(d)) return "Yesterday";
  const now = new Date();
  if (d.getFullYear() === now.getFullYear()) return format(d, "MMM d");
  return format(d, "MMM d, yyyy");
}

export function DiaryList({
  entries,
  activeEntryId,
  allTags,
  selectedTags,
  searchQuery,
  onSelectEntry,
  onNewEntry,
  onDeleteEntry,
  onDuplicateEntry,
  onSearchChange,
  onTagToggle,
  onLoadMore,
  isLoadingMore,
}: DiaryListProps) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localSearch, setLocalSearch] = useState(searchQuery);

  // Debounced search
  const handleSearchInput = useCallback(
    (value: string) => {
      setLocalSearch(value);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => {
        onSearchChange(value);
      }, 300);
    },
    [onSearchChange]
  );

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Diary</h2>
          <Button size="sm" onClick={onNewEntry}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            New Entry
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={localSearch}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Search entries..."
            className="h-8 pl-8 text-sm"
          />
        </div>

        {/* Tag filters */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {allTags.map((tag) => (
              <Badge
                key={tag}
                variant={selectedTags.includes(tag) ? "default" : "outline"}
                className="cursor-pointer text-[10px]"
                onClick={() => onTagToggle(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Entry list */}
      <ScrollArea className="flex-1">
        {entries.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {searchQuery || selectedTags.length > 0
              ? "No entries match your filters."
              : "No diary entries yet."}
          </div>
        ) : (
          <div className="divide-y">
            {entries.map((entry) => {
              const isActive = entry.id === activeEntryId;
              const preview = entry.content_text
                ? entry.content_text.slice(0, 80) + (entry.content_text.length > 80 ? "..." : "")
                : "";
              const displayTags = entry.tags?.slice(0, 3) ?? [];
              const extraTags = (entry.tags?.length ?? 0) - 3;

              return (
                <div
                  key={entry.id}
                  className={cn(
                    "group relative cursor-pointer px-3 py-2.5 transition-colors hover:bg-accent/50",
                    isActive && "border-l-2 border-l-primary bg-accent/30"
                  )}
                  onClick={() => onSelectEntry(entry.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {entry.title || (
                          <span className="text-muted-foreground">Untitled entry</span>
                        )}
                      </div>
                      {preview && (
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {preview}
                        </div>
                      )}
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">
                          {formatEntryDate(entry.updated_at)}
                        </span>
                        {displayTags.length > 0 && (
                          <div className="flex gap-0.5">
                            {displayTags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-[9px] px-1 py-0">
                                {tag}
                              </Badge>
                            ))}
                            {extraTags > 0 && (
                              <span className="text-[9px] text-muted-foreground">+{extraTags}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Context menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicateEntry(entry.id);
                          }}
                        >
                          <Copy className="mr-2 h-3.5 w-3.5" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(entry.id);
                          }}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Load more / entry count */}
      <div className="shrink-0 border-t px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
        <span>{entries.length} {entries.length === 1 ? "entry" : "entries"}</span>
        {onLoadMore && (
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="text-primary hover:underline disabled:opacity-50"
          >
            {isLoadingMore ? <Loader2 className="h-3 w-3 animate-spin" /> : "Load more"}
          </button>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) onDeleteEntry(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
