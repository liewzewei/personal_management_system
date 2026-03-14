/**
 * SubtaskDropdown component.
 *
 * Collapsible dropdown showing subtasks for an In Progress kanban card.
 * Renders a chevron toggle with progress summary, expanding to show
 * individual subtask checkboxes.
 *
 * Only rendered in the In Progress column of the kanban board.
 * All checkbox interactions are optimistic — UI updates before API confirms.
 * When all subtasks are checked, the parent task automatically moves to Done.
 *
 * Subtasks are only fetched when the dropdown is first opened (lazy loading).
 */

"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSubtasks } from "@/lib/hooks/useSubtasks";
import { useToggleSubtask } from "@/lib/hooks/useToggleSubtask";
import { useToast } from "@/lib/hooks/use-toast";

interface SubtaskDropdownProps {
  parentTaskId: string;
}

export function SubtaskDropdown({ parentTaskId }: SubtaskDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  // Only fetch subtasks when dropdown has been opened at least once
  const { data: subtasks, isLoading, isError, refetch } = useSubtasks(
    parentTaskId,
    isOpen
  );

  const toggleSubtask = useToggleSubtask(parentTaskId);

  // Handle toggle errors via the mutation's onError
  function handleToggle(subtaskId: string, currentStatus: string) {
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

  const total = subtasks?.length ?? 0;
  const done = subtasks?.filter((s) => s.status === "done").length ?? 0;

  return (
    <div
      className="mt-2 border-t pt-2"
      data-checkbox=""
      onClick={(e) => e.stopPropagation()}
    >
      {/* Toggle header */}
      <button
        type="button"
        className="flex items-center gap-2 w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        )}
        <span>
          Subtasks{total > 0 ? `: ${done}/${total}` : ""}
        </span>
        {/* Progress bar */}
        {total > 0 && (
          <div className="h-1.5 flex-1 max-w-20 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(done / total) * 100}%` }}
            />
          </div>
        )}
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="mt-1.5 space-y-1">
          {/* Loading state */}
          {isLoading && (
            <div className="space-y-1.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded bg-muted animate-pulse" />
                  <div className="h-3 flex-1 rounded bg-muted animate-pulse" />
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {isError && !isLoading && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <span>Failed to load subtasks</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => refetch()}
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !isError && total === 0 && (
            <p className="text-xs text-muted-foreground pl-5">No subtasks</p>
          )}

          {/* Subtask rows */}
          {!isLoading && !isError && subtasks && subtasks.length > 0 && (
            <div className="space-y-1">
              {subtasks.map((sub) => (
                <div key={sub.id} className="flex items-center gap-2 pl-1">
                  <Checkbox
                    checked={sub.status === "done"}
                    onCheckedChange={() => handleToggle(sub.id, sub.status)}
                    className="h-3.5 w-3.5"
                  />
                  <span
                    className={cn(
                      "text-xs leading-tight",
                      sub.status === "done" && "line-through text-muted-foreground"
                    )}
                  >
                    {sub.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
