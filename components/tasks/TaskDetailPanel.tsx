/**
 * TaskDetailPanel component.
 *
 * Slide-in panel from the right side showing full task details in display mode.
 * Shows all fields, subtasks with statuses, created/updated dates.
 * Has an Edit button to open the TaskModal pre-filled with this task.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { format, parseISO, differenceInDays, isToday, isPast } from "date-fns";
import { Pencil } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { LinkedDescription } from "@/components/tasks/LinkedDescription";
import { useSubtasks } from "@/lib/hooks/useSubtasks";
import { useToggleSubtask } from "@/lib/hooks/useToggleSubtask";
import { useToast } from "@/lib/hooks/use-toast";
import type { Task, TaskWithSubtasks } from "@/types";

interface TaskDetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string | null;
  task: Task | null;
  onEdit: (taskId: string) => void;
}

const priorityConfig: Record<string, { label: string; className: string }> = {
  high: { label: "High", className: "bg-red-100 text-red-700 border-red-200" },
  medium: { label: "Medium", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  low: { label: "Low", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

const statusLabels: Record<string, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  done: "Done",
};

function formatEstimate(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h} hour${h > 1 ? "s" : ""}`;
}

function formatDeadline(deadline: string): { text: string; className: string } {
  const date = parseISO(deadline);
  if (isToday(date)) {
    return { text: "Due Today", className: "text-amber-600 font-medium" };
  }
  if (isPast(date)) {
    const days = differenceInDays(new Date(), date);
    return { text: `Overdue by ${days} day${days === 1 ? "" : "s"}`, className: "text-red-600 font-medium" };
  }
  return { text: format(date, "EEEE, d MMMM yyyy 'at' HH:mm"), className: "text-foreground" };
}

function parseRruleDisplay(rule: string): string {
  const freqMatch = rule.match(/FREQ=(\w+)/);
  const freq = freqMatch ? freqMatch[1] : "WEEKLY";

  const dayMap: Record<string, string> = {
    MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun",
  };

  if (freq === "DAILY") return "Daily";
  if (freq === "WEEKLY") {
    const byDayMatch = rule.match(/BYDAY=([A-Z,]+)/);
    if (byDayMatch) {
      const days = byDayMatch[1].split(",").map((d) => dayMap[d] ?? d).join(", ");
      return `Weekly on ${days}`;
    }
    return "Weekly";
  }
  if (freq === "MONTHLY") {
    const byMdMatch = rule.match(/BYMONTHDAY=(\d+)/);
    if (byMdMatch) return `Monthly on day ${byMdMatch[1]}`;
    return "Monthly";
  }
  return rule;
}

export function TaskDetailPanel({
  open,
  onOpenChange,
  taskId,
  task,
  onEdit,
}: TaskDetailPanelProps) {
  const { toast } = useToast();

  // Shared subtask cache — same key as SubtaskDropdown in KanbanCard
  const { data: subtasks } = useSubtasks(open && taskId ? taskId : null);
  const toggleSubtask = useToggleSubtask(taskId ?? "");

  function handleToggleSubtask(subtaskId: string, currentStatus: string) {
    toggleSubtask.mutate(
      { subtaskId, currentStatus },
      {
        onError: () => {
          toast({
            title: "Failed to update subtask. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  }

  const priority = task ? priorityConfig[task.priority] : null;
  const deadline = task?.deadline ? formatDeadline(task.deadline) : null;
  // Use shared subtask cache
  const activeSubtasks = subtasks ?? [];
  const doneSubtasks = activeSubtasks.filter((s: Task) => s.status === "done").length;
  const totalSubtasks = activeSubtasks.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="flex flex-row items-start justify-between gap-2">
          <div className="flex-1">
            <SheetTitle className="text-left">
              {task?.title ?? "Task"}
            </SheetTitle>
            <SheetDescription className="text-left">
              Task details
            </SheetDescription>
          </div>
          {task && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(task.id)}
              className="shrink-0"
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
          )}
        </SheetHeader>

        {task && (
          <div className="mt-6 space-y-5">
            {/* Status & Priority */}
            <div className="flex items-center gap-2">
              <Badge variant="outline">{statusLabels[task.status]}</Badge>
              {priority && (
                <Badge variant="outline" className={priority.className}>
                  {priority.label}
                </Badge>
              )}
            </div>

            {/* Description */}
            {task.description && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Description
                </p>
                <LinkedDescription text={task.description} />
              </div>
            )}

            {/* Tags */}
            {task.tags && task.tags.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Tags
                </p>
                <div className="flex flex-wrap gap-1">
                  {task.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Deadline */}
            {deadline && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Deadline
                </p>
                <p className={cn("text-sm", deadline.className)}>{deadline.text}</p>
              </div>
            )}

            {/* Time Estimate */}
            {task.estimated_minutes != null && task.estimated_minutes > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Time Estimate
                </p>
                <p className="text-sm">{formatEstimate(task.estimated_minutes)}</p>
              </div>
            )}

            {/* Recurring */}
            {task.is_recurring && task.recurrence_rule && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Recurrence
                </p>
                <p className="text-sm">{parseRruleDisplay(task.recurrence_rule)}</p>
              </div>
            )}

            {/* Subtasks */}
            {totalSubtasks > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Subtasks
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {doneSubtasks}/{totalSubtasks}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(doneSubtasks / totalSubtasks) * 100}%` }}
                  />
                </div>
                <div className="space-y-1">
                  {activeSubtasks.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={sub.status === "done"}
                        onCheckedChange={() => handleToggleSubtask(sub.id, sub.status)}
                      />
                      <span
                        className={cn(
                          "text-sm",
                          sub.status === "done" && "line-through text-muted-foreground"
                        )}
                      >
                        {sub.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="space-y-1 border-t pt-4">
              <p className="text-xs text-muted-foreground">
                Created {format(parseISO(task.created_at), "d MMM yyyy, HH:mm")}
              </p>
              <p className="text-xs text-muted-foreground">
                Updated {format(parseISO(task.updated_at), "d MMM yyyy, HH:mm")}
              </p>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
