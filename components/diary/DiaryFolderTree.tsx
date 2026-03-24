"use client";

import * as React from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronRight,
  FilePlus,
  FileText,
  Folder,
  FolderPlus,
  GripVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import type { DiaryEntry, DiaryFolder } from "@/types";
import { Input } from "@/components/ui/input";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type DiaryTreeRenameState = {
  type: "folder" | "entry";
  id: string;
  value: string;
  originalValue: string | null;
};

interface DiaryFolderTreeProps {
  folders: DiaryFolder[];
  entries: DiaryEntry[];
  parentFolderId: string | null;
  depth?: number;
  activeEntryId: string | null;
  allFolders: DiaryFolder[];
  renaming: DiaryTreeRenameState | null;
  draggingType: "folder" | "entry" | null;
  draggingFolderId: string | null;
  isCollapsed: (folderId: string) => boolean;
  onToggleFolder: (folderId: string) => void;
  onSelectEntry: (id: string) => void;
  onStartRenameFolder: (folder: DiaryFolder) => void;
  onStartRenameEntry: (entry: DiaryEntry) => void;
  onRenameValueChange: (value: string) => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  onCreateEntry: (folderId: string | null) => void;
  onCreateSubfolder: (folderId: string) => void;
  onRequestDeleteFolder: (folder: DiaryFolder) => void;
  onRequestDeleteEntry: (entry: DiaryEntry) => void;
  onMoveEntryToFolder: (entryId: string, folderId: string | null) => void;
  canDropFolderInto: (targetFolderId: string) => boolean;
  canDropIntoContainer: (folderId: string | null) => boolean;
}

interface DiaryEntryTreeRowProps {
  entry: DiaryEntry;
  depth: number;
  activeEntryId: string | null;
  allFolders: DiaryFolder[];
  renaming: DiaryTreeRenameState | null;
  draggingType: "folder" | "entry" | null;
  containerFolderId: string | null;
  onSelectEntry: (id: string) => void;
  onStartRenameEntry: (entry: DiaryEntry) => void;
  onRenameValueChange: (value: string) => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  onRequestDeleteEntry: (entry: DiaryEntry) => void;
  onMoveEntryToFolder: (entryId: string, folderId: string | null) => void;
  canDropIntoContainer: (folderId: string | null) => boolean;
}

function combineRefs<T>(...refs: Array<((node: T | null) => void) | undefined>) {
  return (node: T | null) => {
    refs.forEach((ref) => ref?.(node));
  };
}

function sortFolders(folders: DiaryFolder[]) {
  return [...folders].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

function sortEntries(entries: DiaryEntry[]) {
  return [...entries].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

function rowPadding(depth: number) {
  return depth * 14 + 8;
}

export function DiaryEntryTreeRow({
  entry,
  depth,
  activeEntryId,
  allFolders,
  renaming,
  draggingType,
  containerFolderId,
  onSelectEntry,
  onStartRenameEntry,
  onRenameValueChange,
  onConfirmRename,
  onCancelRename,
  onRequestDeleteEntry,
  onMoveEntryToFolder,
  canDropIntoContainer,
}: DiaryEntryTreeRowProps) {
  const draggable = useDraggable({
    id: `entry:${entry.id}`,
    data: { type: "entry", entryId: entry.id },
    disabled: renaming?.type === "entry" && renaming.id === entry.id,
  });

  const droppable = useDroppable({
    id: `entry:${entry.id}`,
    data: { type: "entry-row", entryId: entry.id, containerFolderId },
  });

  const isRenaming = renaming?.type === "entry" && renaming.id === entry.id;
  const isActive = activeEntryId === entry.id;
  const canDropHere = draggingType ? canDropIntoContainer(containerFolderId) : false;

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(draggable.transform),
    opacity: draggable.isDragging ? 0.45 : 1,
  };

  const displayTitle = entry.title?.trim() ? entry.title : null;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={combineRefs(draggable.setNodeRef, droppable.setNodeRef)}
          style={style}
          className={cn(
            "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
            isActive && "bg-accent text-accent-foreground",
            !isActive && "hover:bg-accent/60",
            droppable.isOver && canDropHere && "bg-primary/10 ring-1 ring-primary/30",
            droppable.isOver && !canDropHere && "cursor-not-allowed bg-destructive/10"
          )}
          onClick={() => onSelectEntry(entry.id)}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1" style={{ paddingLeft: rowPadding(depth) }}>
            <GripVertical
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100",
                draggable.isDragging && "opacity-100"
              )}
              {...draggable.attributes}
              {...draggable.listeners}
            />
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            {isRenaming ? (
              <Input
                autoFocus
                value={renaming.value}
                onChange={(e) => onRenameValueChange(e.target.value)}
                onBlur={onConfirmRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onConfirmRename();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    onCancelRename();
                  }
                }}
                className="h-7 px-2 text-sm"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className={cn("truncate select-none cursor-default", !displayTitle && "text-muted-foreground")}>{displayTitle ?? "Untitled"}</span>
            )}
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent alignOffset={4}>
        <ContextMenuItem
          onClick={(e) => {
            e.preventDefault();
            onStartRenameEntry(entry);
          }}
        >
          <Pencil className="mr-2 h-4 w-4" />
          Rename Entry
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>Move to...</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={() => onMoveEntryToFolder(entry.id, null)}>No Folder</ContextMenuItem>
            <ContextMenuSeparator />
            {sortFolders(allFolders).map((folder) => (
              <ContextMenuItem key={folder.id} onClick={() => onMoveEntryToFolder(entry.id, folder.id)}>
                {folder.name}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onClick={(e) => {
            e.preventDefault();
            onRequestDeleteEntry(entry);
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Entry
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function DiaryFolderRow(props: DiaryFolderTreeProps & { folder: DiaryFolder; depth: number }) {
  const {
    folder,
    depth,
    folders,
    entries,
    activeEntryId,
    allFolders,
    renaming,
    draggingType,
    isCollapsed,
    draggingFolderId,
    onToggleFolder,
    onSelectEntry,
    onStartRenameFolder,
    onStartRenameEntry,
    onRenameValueChange,
    onConfirmRename,
    onCancelRename,
    onCreateEntry,
    onCreateSubfolder,
    onRequestDeleteFolder,
    onRequestDeleteEntry,
    onMoveEntryToFolder,
    canDropFolderInto,
    canDropIntoContainer,
  } = props;

  const childFolders = sortFolders(folders.filter((item) => item.parent_folder_id === folder.id));
  const childEntries = sortEntries(entries.filter((entry) => entry.folder_id === folder.id));
  const hasChildren = childFolders.length > 0 || childEntries.length > 0;
  const collapsed = isCollapsed(folder.id);
  const isRenaming = renaming?.type === "folder" && renaming.id === folder.id;
  const deleteDisabled = childFolders.length > 0 || childEntries.length > 0;

  const draggable = useDraggable({
    id: `folder:${folder.id}`,
    data: { type: "folder", folderId: folder.id },
    disabled: isRenaming,
  });

  const droppable = useDroppable({
    id: `folder:${folder.id}`,
    data: { type: "folder-row", folderId: folder.id },
  });

  const canDropHere = draggingType === "entry" || (draggingType === "folder" && canDropFolderInto(folder.id));

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(draggable.transform),
    opacity: draggable.isDragging ? 0.45 : 1,
  };

  return (
    <div className="space-y-0.5">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={combineRefs(draggable.setNodeRef, droppable.setNodeRef)}
            style={style}
            className={cn(
              "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
              "hover:bg-accent/60",
              droppable.isOver && canDropHere && "bg-primary/10 ring-1 ring-primary/30",
              droppable.isOver && !canDropHere && "cursor-not-allowed bg-destructive/10"
            )}
            onClick={() => onToggleFolder(folder.id)}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1" style={{ paddingLeft: rowPadding(depth) }}>
              <GripVertical
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100",
                  draggable.isDragging && "opacity-100"
                )}
                {...draggable.attributes}
                {...draggable.listeners}
                onClick={(e) => e.stopPropagation()}
              />
              {hasChildren ? (
                collapsed ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <div className="h-4 w-4 shrink-0" />
              )}
              <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
              {isRenaming ? (
                <Input
                  autoFocus
                  value={renaming.value}
                  onChange={(e) => onRenameValueChange(e.target.value)}
                  onBlur={onConfirmRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onConfirmRename();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      onCancelRename();
                    }
                  }}
                  className="h-7 px-2 text-sm"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="truncate font-medium select-none cursor-default">{folder.name}</span>
              )}
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent alignOffset={4}>
          <ContextMenuItem onClick={() => onCreateEntry(folder.id)}>
            <FilePlus className="mr-2 h-4 w-4" />
            New Entry
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onCreateSubfolder(folder.id)}>
            <FolderPlus className="mr-2 h-4 w-4" />
            New Subfolder
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onStartRenameFolder(folder)}>
            <Pencil className="mr-2 h-4 w-4" />
            Rename Folder
          </ContextMenuItem>
          <ContextMenuSeparator />
          {deleteDisabled ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div title="Remove all contents first">
                  <ContextMenuItem disabled>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Folder
                  </ContextMenuItem>
                </div>
              </TooltipTrigger>
              <TooltipContent>Remove all contents first</TooltipContent>
            </Tooltip>
          ) : (
            <ContextMenuItem className="text-destructive focus:text-destructive" onClick={() => onRequestDeleteFolder(folder)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Folder
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {!collapsed && (
        <div className="space-y-0.5">
          {childFolders.map((childFolder) => (
            <DiaryFolderRow key={childFolder.id} {...props} folder={childFolder} depth={depth + 1} />
          ))}
          {childEntries.map((entry) => (
            <DiaryEntryTreeRow
              key={entry.id}
              entry={entry}
              depth={depth + 1}
              activeEntryId={activeEntryId}
              allFolders={allFolders}
              renaming={renaming}
              draggingType={draggingType}
              containerFolderId={folder.id}
              onSelectEntry={onSelectEntry}
              onStartRenameEntry={onStartRenameEntry}
              onRenameValueChange={onRenameValueChange}
              onConfirmRename={onConfirmRename}
              onCancelRename={onCancelRename}
              onRequestDeleteEntry={onRequestDeleteEntry}
              onMoveEntryToFolder={onMoveEntryToFolder}
              canDropIntoContainer={canDropIntoContainer}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function DiaryFolderTree(props: DiaryFolderTreeProps) {
  const topFolders = sortFolders(props.folders.filter((folder) => folder.parent_folder_id === props.parentFolderId));

  if (topFolders.length === 0) {
    return null;
  }

  return (
    <div className="space-y-0.5">
      {topFolders.map((folder) => (
        <DiaryFolderRow key={folder.id} {...props} folder={folder} depth={props.depth ?? 0} />
      ))}
    </div>
  );
}
