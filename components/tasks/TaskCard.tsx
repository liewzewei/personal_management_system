/**
 * TaskCard component.
 *
 * Displays a single task as a card in the task list. Shows checkbox, title,
 * priority badge, tag chips, deadline, time estimate, subtask progress,
 * and a three-dot action menu (edit, duplicate, delete).
 *
 * Clicking the card (except checkbox/menu) opens the detail panel.
 * Clicking the checkbox triggers an optimistic status toggle.
 */

"use client";

import { useState } from "react";
import { format, differenceInDays, isToday, isPast, parseISO } from "date-fns";
import { MoreHorizontal, Copy, Pencil, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Task } from "@/types";

interface TaskCardProps {
  task: Task;
  subtaskCount?: number;
  subtaskDoneCount?: number;
  onToggleDone: (taskId: string, currentStatus: Task["status"]) => void;
  onClick: (taskId: string) => void;
  onEdit: (taskId: string) => void;
  onDuplicate: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}

const priorityConfig: Record<Task["priority"], { label: string; className: string }> = {
  high: { label: "High", className: "bg-red-100 text-red-700 border-red-200" },
  medium: { label: "Medium", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  low: { label: "Low", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

function formatDeadline(deadline: string): { text: string; className: string } | null {
  const date = parseISO(deadline);
  if (isToday(date)) {
    return { text: "Due Today", className: "text-amber-600 font-medium" };
  }
  if (isPast(date)) {
    const days = differenceInDays(new Date(), date);
    return { text: `Overdue by ${days} day${days === 1 ? "" : "s"}`, className: "text-red-600 font-medium" };
  }
  return { text: `Due ${format(date, "EEE d MMM")}`, className: "text-muted-foreground" };
}

function formatEstimate(minutes: number): string {
  if (minutes < 60) return `~${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
}

export function TaskCard({
  task,
  subtaskCount = 0,
  subtaskDoneCount = 0,
  onToggleDone,
  onClick,
  onEdit,
  onDuplicate,
  onDelete,
}: TaskCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isDone = task.status === "done";
  const priority = priorityConfig[task.priority];
  const deadline = task.deadline ? formatDeadline(task.deadline) : null;

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50 cursor-pointer",
        isDone && "opacity-60"
      )}
      onClick={(e) => {
        // Don't open detail if clicking checkbox or menu
        const target = e.target as HTMLElement;
        if (target.closest("[data-checkbox]") || target.closest("[data-menu]")) return;
        onClick(task.id);
      }}
    >
      {/* Checkbox */}
      <div data-checkbox="" className="pt-0.5" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isDone}
          onCheckedChange={() => onToggleDone(task.id, task.status)}
          aria-label={isDone ? "Mark as not done" : "Mark as done"}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Title + Priority */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              "text-sm leading-tight",
              task.priority === "high" && !isDone && "font-bold",
              isDone && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </span>
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", priority.className)}>
            {priority.label}
          </Badge>
        </div>

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Meta row: deadline, estimate, subtasks */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {deadline && <span className={deadline.className}>{deadline.text}</span>}
          {task.estimated_minutes != null && task.estimated_minutes > 0 && (
            <span>{formatEstimate(task.estimated_minutes)}</span>
          )}
          {subtaskCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span>
                {subtaskDoneCount} / {subtaskCount} subtasks
              </span>
              <div className="h-1.5 w-16 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${(subtaskDoneCount / subtaskCount) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Three-dot menu */}
      <div data-menu="" onClick={(e) => e.stopPropagation()}>
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
            <DropdownMenuItem onClick={() => { setMenuOpen(false); onEdit(task.id); }}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setMenuOpen(false); onDuplicate(task.id); }}>
              <Copy className="mr-2 h-3.5 w-3.5" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => { setMenuOpen(false); onDelete(task.id); }}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
