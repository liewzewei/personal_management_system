/**
 * Diary entry list sidebar component.
 *
 * Shows search input, tag filter chips, folder tree, and ungrouped entries.
 * Supports folder organization, drag-and-drop, context menus, and inline rename.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { FolderPlus, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DiaryEntryTreeRow,
  DiaryFolderTree,
  type DiaryTreeRenameState,
} from "@/components/diary/DiaryFolderTree";
import { useDiaryFolders } from "@/lib/hooks/useDiaryFolders";
import { useDiaryFolderCollapseState } from "@/lib/hooks/useDiaryFolderCollapseState";
import { useToast } from "@/lib/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { DiaryEntry, DiaryFolder } from "@/types";

interface DiaryListProps {
  loading?: boolean;
  entries: DiaryEntry[];
  activeEntryId: string | null;
  allTags: string[];
  selectedTags: string[];
  searchQuery: string;
  onSelectEntry: (id: string) => void;
  onNewEntry: (folderId?: string | null) => void;
  onDeleteEntry: (id: string) => void;
  onRenameEntry: (id: string, title: string | null) => void;
  onMoveEntry: (id: string, folderId: string | null) => void;
  onSearchChange: (query: string) => void;
  onTagToggle: (tag: string) => void;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

type ActiveDragItem = {
  type: "entry" | "folder";
  id: string;
  label: string;
};

function sortEntries(entries: DiaryEntry[]) {
  return [...entries].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

function FolderDropSection({
  id,
  active,
  enabled,
  className,
  children,
}: {
  id: string;
  active: boolean;
  enabled: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !enabled });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-md transition-colors",
        active && isOver && "bg-primary/5 ring-1 ring-primary/25",
        className
      )}
    >
      {children}
    </div>
  );
}

export function DiaryList({
  loading,
  entries,
  activeEntryId,
  allTags,
  selectedTags,
  searchQuery,
  onSelectEntry,
  onNewEntry,
  onDeleteEntry,
  onRenameEntry,
  onMoveEntry,
  onSearchChange,
  onTagToggle,
  onLoadMore,
  isLoadingMore,
}: DiaryListProps) {
  const { toast } = useToast();
  const { folders, loading: foldersLoading, createFolder, renameFolder, deleteFolder, moveFolder } = useDiaryFolders();
  const collapseState = useDiaryFolderCollapseState();
  const [deleteTarget, setDeleteTarget] = useState<DiaryEntry | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<DiaryFolder | null>(null);
  const [renaming, setRenaming] = useState<DiaryTreeRenameState | null>(null);
  const [activeDragItem, setActiveDragItem] = useState<ActiveDragItem | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const ungroupedEntries = useMemo(
    () => sortEntries(entries.filter((entry) => entry.folder_id === null)),
    [entries]
  );
  const draggingType = activeDragItem?.type ?? null;
  const draggingFolderId = activeDragItem?.type === "folder" ? activeDragItem.id : null;

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

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  const canDropFolderInto = useCallback(
    (targetFolderId: string) => {
      if (!draggingFolderId) return false;
      if (draggingFolderId === targetFolderId) return false;

      const parentById = new Map(folders.map((folder) => [folder.id, folder.parent_folder_id]));
      let currentParent: string | null = targetFolderId;
      while (currentParent) {
        if (currentParent === draggingFolderId) return false;
        currentParent = parentById.get(currentParent) ?? null;
      }
      return true;
    },
    [draggingFolderId, folders]
  );

  const canDropIntoContainer = useCallback(
    (folderId: string | null) => {
      if (draggingType === "entry") return true;
      if (draggingType === "folder") {
        if (folderId === null) return true;
        return canDropFolderInto(folderId);
      }
      return false;
    },
    [draggingType, canDropFolderInto]
  );

  const handleCreateFolder = useCallback(
    (parentFolderId: string | null = null) => {
      if (parentFolderId) collapseState.expand(parentFolderId);
      createFolder.mutate(
        { name: "New Folder", parentFolderId },
        {
          onSuccess: (folder) => {
            setRenaming({
              type: "folder",
              id: folder.id,
              value: folder.name,
              originalValue: folder.name,
            });
          },
          onError: (error) => {
            toast({ title: error.message || "Failed to create folder", variant: "destructive" });
          },
        }
      );
    },
    [collapseState, createFolder, toast]
  );

  const handleStartRenameFolder = useCallback((folder: DiaryFolder) => {
    setRenaming({ type: "folder", id: folder.id, value: folder.name, originalValue: folder.name });
  }, []);

  const handleStartRenameEntry = useCallback((entry: DiaryEntry) => {
    setRenaming({ type: "entry", id: entry.id, value: entry.title ?? "", originalValue: entry.title ?? null });
  }, []);

  const handleConfirmRename = useCallback(() => {
    if (!renaming) return;
    const trimmed = renaming.value.trim();
    if (!trimmed || trimmed === (renaming.originalValue ?? "")) {
      setRenaming(null);
      return;
    }

    if (renaming.type === "entry") {
      onRenameEntry(renaming.id, trimmed);
      setRenaming(null);
      return;
    }

    renameFolder.mutate(
      { folderId: renaming.id, newName: trimmed },
      {
        onError: (error) => {
          toast({ title: error.message || "Failed to rename folder", variant: "destructive" });
        },
      }
    );
    setRenaming(null);
  }, [onRenameEntry, renameFolder, renaming, toast]);

  const handleCancelRename = useCallback(() => {
    setRenaming(null);
  }, []);

  const handleMoveEntryToFolder = useCallback(
    (entryId: string, folderId: string | null) => {
      onMoveEntry(entryId, folderId);
    },
    [onMoveEntry]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const data = event.active.data.current as { type?: "entry" | "folder"; entryId?: string; folderId?: string } | undefined;
      if (data?.type === "entry" && data.entryId) {
        const entry = entries.find((item) => item.id === data.entryId);
        setActiveDragItem({ type: "entry", id: data.entryId, label: entry?.title?.trim() || "Untitled" });
      }
      if (data?.type === "folder" && data.folderId) {
        const folder = folders.find((item) => item.id === data.folderId);
        setActiveDragItem({ type: "folder", id: data.folderId, label: folder?.name || "Folder" });
      }
    },
    [entries, folders]
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragItem(null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const active = activeDragItem;
      setActiveDragItem(null);
      if (!active || !event.over) return;

      const over = event.over;
      const overData = over.data.current as
        | { type?: "folder-row" | "entry-row"; folderId?: string; containerFolderId?: string | null }
        | undefined;

      if (active.type === "entry") {
        let nextFolderId: string | null | undefined;
        if (over.id === "drop:ungrouped") nextFolderId = null;
        else if (overData?.type === "folder-row") nextFolderId = overData.folderId ?? null;
        else if (overData?.type === "entry-row") nextFolderId = overData.containerFolderId ?? null;

        if (typeof nextFolderId !== "undefined") {
          onMoveEntry(active.id, nextFolderId);
        }
        return;
      }

      let newParentId: string | null | undefined;
      if (over.id === "drop:root") newParentId = null;
      else if (overData?.type === "folder-row") newParentId = overData.folderId ?? null;
      else if (overData?.type === "entry-row") newParentId = overData.containerFolderId ?? null;

      if (typeof newParentId === "undefined") return;
      if (newParentId !== null && !canDropFolderInto(newParentId)) {
        toast({ title: "Cannot move a folder into its own descendant", variant: "destructive" });
        return;
      }

      moveFolder.mutate(
        { folderId: active.id, newParentId },
        {
          onError: (error) => {
            toast({ title: error.message || "Failed to move folder", variant: "destructive" });
          },
        }
      );
    },
    [activeDragItem, canDropFolderInto, moveFolder, onMoveEntry, toast]
  );

  const showEmptyState = !loading && !foldersLoading && folders.length === 0 && entries.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Diary</h2>
          <Button size="sm" onClick={() => handleCreateFolder(null)}>
            <FolderPlus className="mr-1 h-3.5 w-3.5" />
            New Folder
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

      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              {loading && entries.length === 0 && foldersLoading ? (
                <div className="flex items-center justify-center p-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : showEmptyState ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {searchQuery || selectedTags.length > 0 ? "No entries match your filters." : "No diary entries yet."}
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragCancel={handleDragCancel}
                >
                  <div className="p-2 space-y-3">
                    <FolderDropSection
                      id="drop:root"
                      active={draggingType === "folder"}
                      enabled={draggingType === "folder"}
                      className="space-y-1 p-1"
                    >
                      <DiaryFolderTree
                        folders={folders}
                        entries={entries}
                        parentFolderId={null}
                        activeEntryId={activeEntryId}
                        allFolders={folders}
                        renaming={renaming}
                        draggingType={draggingType}
                        draggingFolderId={draggingFolderId}
                        isCollapsed={collapseState.isCollapsed}
                        onToggleFolder={collapseState.toggle}
                        onSelectEntry={onSelectEntry}
                        onStartRenameFolder={handleStartRenameFolder}
                        onStartRenameEntry={handleStartRenameEntry}
                        onRenameValueChange={(value) =>
                          setRenaming((prev) => (prev ? { ...prev, value } : prev))
                        }
                        onConfirmRename={handleConfirmRename}
                        onCancelRename={handleCancelRename}
                        onCreateEntry={(folderId) => onNewEntry(folderId)}
                        onCreateSubfolder={(folderId) => handleCreateFolder(folderId)}
                        onRequestDeleteFolder={setDeleteFolderTarget}
                        onRequestDeleteEntry={setDeleteTarget}
                        onMoveEntryToFolder={handleMoveEntryToFolder}
                        canDropFolderInto={canDropFolderInto}
                        canDropIntoContainer={canDropIntoContainer}
                      />
                    </FolderDropSection>

                    {ungroupedEntries.length > 0 && folders.length > 0 && <div className="border-t" />}

                    {ungroupedEntries.length > 0 && (
                      <FolderDropSection
                        id="drop:ungrouped"
                        active={draggingType === "entry"}
                        enabled={draggingType === "entry"}
                        className="space-y-1 p-1"
                      >
                        <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          No Folder
                        </div>
                        {ungroupedEntries.map((entry) => (
                          <DiaryEntryTreeRow
                            key={entry.id}
                            entry={entry}
                            depth={0}
                            activeEntryId={activeEntryId}
                            allFolders={folders}
                            renaming={renaming}
                            draggingType={draggingType}
                            containerFolderId={null}
                            onSelectEntry={onSelectEntry}
                            onStartRenameEntry={handleStartRenameEntry}
                            onRenameValueChange={(value) =>
                              setRenaming((prev) => (prev ? { ...prev, value } : prev))
                            }
                            onConfirmRename={handleConfirmRename}
                            onCancelRename={handleCancelRename}
                            onRequestDeleteEntry={setDeleteTarget}
                            onMoveEntryToFolder={handleMoveEntryToFolder}
                            canDropIntoContainer={canDropIntoContainer}
                          />
                        ))}
                      </FolderDropSection>
                    )}
                  </div>

                  <DragOverlay>
                    {activeDragItem ? (
                      <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-md opacity-90">
                        {activeDragItem.label}
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              )}
            </ScrollArea>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onNewEntry(null)}>New Entry</ContextMenuItem>
          <ContextMenuItem onClick={() => handleCreateFolder(null)}>New Folder</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

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
                if (deleteTarget) onDeleteEntry(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteFolderTarget} onOpenChange={() => setDeleteFolderTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this folder?</AlertDialogTitle>
            <AlertDialogDescription>
              This only works when the folder is empty.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteFolderTarget) return;
                deleteFolder.mutate(deleteFolderTarget.id, {
                  onSuccess: () => {
                    toast({ title: "Folder deleted" });
                  },
                  onError: (error) => {
                    toast({ title: error.message || "Failed to delete folder", variant: "destructive" });
                  },
                });
                setDeleteFolderTarget(null);
              }}
            >
              Delete Folder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
