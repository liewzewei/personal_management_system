/**
 * KanbanCard component.
 *
 * Draggable task card for the Kanban board.
 * Renders differently based on which column it appears in:
 * - To Do: no checkbox, draggable via @dnd-kit
 * - In Progress: completion checkbox, subtask dropdown placeholder
 * - Done: read-only, no drag
 *
 * Clicking the card (except checkbox/menu) opens the detail panel.
 */

"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { MoreHorizontal, Copy, Pencil, Trash2, GripVertical } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { SubtaskDropdown } from "@/components/tasks/SubtaskDropdown";
import type { Task } from "@/types";

interface KanbanCardProps {
  task: Task;
  column: "todo" | "in_progress" | "done";
  subtaskCount?: number;
  subtaskDoneCount?: number;
  onComplete?: (taskId: string) => void;
  onClick: (taskId: string) => void;
  onEdit?: (taskId: string) => void;
  onDuplicate?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  isDragging?: boolean;
}

const priorityConfig: Record<Task["priority"], { label: string; className: string }> = {
  high: { label: "High", className: "bg-red-100 text-red-700 border-red-200" },
  medium: { label: "Medium", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  low: { label: "Low", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

const MAX_VISIBLE_TAGS = 3;

function getOverdueDays(deadline: string): number {
  return Math.floor((Date.now() - new Date(deadline).getTime()) / 86400000);
}

function formatDeadline(deadline: string): { text: string; className: string } | null {
  const date = parseISO(deadline);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  if (date < todayStart) {
    const days = getOverdueDays(deadline);
    return { text: `Overdue by ${days} day${days === 1 ? "" : "s"}`, className: "text-red-500" };
  }
  if (date < tomorrowStart) {
    return { text: "Due Today", className: "text-amber-600 font-medium" };
  }
  return { text: `Due ${format(date, "EEE d MMM")}`, className: "text-muted-foreground" };
}

function formatEstimate(minutes: number): string {
  if (minutes < 60) return `~${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
}

function isOverdue(task: Task): boolean {
  if (!task.deadline || task.status === "done") return false;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return new Date(task.deadline) < todayStart;
}

function DraggableCard({ task, children }: { task: Task; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: task.id });

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)` 
      : undefined,
    userSelect: 'none',
    WebkitUserSelect: 'none' as React.CSSProperties['WebkitUserSelect'],
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
    // touchAction removed — now only on the handle element
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        "relative",   // ADD THIS — required for absolute grip to position correctly
        isDragging && "opacity-50"
      )}
    >
      <div
        ref={setActivatorNodeRef}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-6 flex items-center 
                   justify-center cursor-grab active:cursor-grabbing
                   opacity-0 group-hover:opacity-60 transition-opacity
                   hover:opacity-100 z-10"
        style={{ touchAction: 'none' }}
        // onPointerDown={(e) => {
        //   e.stopPropagation();
        //   console.log('grip handle pointer down');
        // }}
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      {children}
    </div>
  );
}

export function KanbanCard({
  task,
  column,
  subtaskCount = 0,
  subtaskDoneCount = 0,
  onComplete,
  onClick,
  onEdit,
  onDuplicate,
  onDelete,
}: KanbanCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const priority = priorityConfig[task.priority];
  const deadline = task.deadline ? formatDeadline(task.deadline) : null;
  const overdue = isOverdue(task);
  const visibleTags = task.tags?.slice(0, MAX_VISIBLE_TAGS) ?? [];
  const extraTagCount = (task.tags?.length ?? 0) - MAX_VISIBLE_TAGS;

  const cardContent = (
    <div
      className={cn(
        "group relative rounded-lg border bg-card p-3 min-h-[44px] transition-colors hover:bg-accent/50 active:opacity-80",
        column === "todo" ? "pl-6 cursor-default" : "cursor-pointer",
        overdue && "border-l-4 border-l-red-500"
      )}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest("[data-checkbox]") || target.closest("[data-menu]")) return;
        onClick(task.id);
      }}
    >
      {/* Top row: checkbox + title + menu */}
      <div className="flex items-start gap-2">
        {/* Checkbox — In Progress only */}
        {column === "in_progress" && onComplete && (
          <div data-checkbox="" className="pt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={false}
              onCheckedChange={() => onComplete(task.id)}
              aria-label="Mark as done"
            />
          </div>
        )}

        {/* Title */}
        <div className="flex-1 min-w-0">
          <span
            className={cn(
              "text-sm leading-tight",
              task.priority === "high" && column !== "done" && "font-bold",
              column === "done" && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </span>
        </div>

        {/* Three-dot menu */}
        {(onEdit || onDuplicate || onDelete) && (
          <div data-menu="" className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  className="rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent focus-visible:opacity-100"
                  aria-label="Task actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                {onEdit && (
                  <DropdownMenuItem onClick={() => { setMenuOpen(false); onEdit(task.id); }}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onDuplicate && (
                  <DropdownMenuItem onClick={() => { setMenuOpen(false); onDuplicate(task.id); }}>
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    Duplicate
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => { setMenuOpen(false); onDelete(task.id); }}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Priority badge */}
      <div className="mt-1.5">
        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", priority.className)}>
          {priority.label}
        </Badge>
      </div>

      {/* Tags */}
      {visibleTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground"
            >
              {tag}
            </span>
          ))}
          {extraTagCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">
              +{extraTagCount} more
            </span>
          )}
        </div>
      )}

      {/* Meta row: deadline, estimate, subtasks */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap mt-1.5">
        {deadline && <span className={deadline.className}>{deadline.text}</span>}
        {task.estimated_minutes != null && task.estimated_minutes > 0 && (
          <span>{formatEstimate(task.estimated_minutes)}</span>
        )}
        {subtaskCount > 0 && (
          <div className="flex items-center gap-1.5">
            <span>{subtaskDoneCount}/{subtaskCount} subtasks</span>
            <div className="h-1.5 w-12 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(subtaskDoneCount / subtaskCount) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Subtask dropdown for In Progress cards */}
      {column === "in_progress" && (
        <SubtaskDropdown parentTaskId={task.id} />
      )}
    </div>
  );

  // Only To Do cards are draggable
  if (column === "todo") {
    return <DraggableCard task={task}>{cardContent}</DraggableCard>;
  }

  return cardContent;
}
