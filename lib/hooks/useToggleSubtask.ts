/**
 * useToggleSubtask hook.
 *
 * Mutation for toggling a subtask's completion status.
 * Uses optimistic updates — the UI updates instantly before API confirms.
 * On error, reverts to previous state.
 * After all subtasks are done, auto-completes the parent task.
 *
 * React Query key: ["subtasks", parentTaskId]
 * Also invalidates: ["tasks"], ["task-tag-counts"] when parent auto-completes.
 */

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Task } from "@/types";

export function useToggleSubtask(parentTaskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      subtaskId,
      currentStatus,
    }: {
      subtaskId: string;
      currentStatus: string;
    }) => {
      const newStatus = currentStatus === "done" ? "todo" : "done";
      const res = await fetch(`/api/tasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          completed_at: newStatus === "done" ? new Date().toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error("Failed to update subtask");
      return { subtaskId, newStatus };
    },

    onMutate: async ({ subtaskId, currentStatus }) => {
      // Cancel any outgoing refetches for this subtask list
      await queryClient.cancelQueries({
        queryKey: ["subtasks", parentTaskId],
      });

      // Snapshot previous value for rollback
      const previousSubtasks = queryClient.getQueryData<Task[]>([
        "subtasks",
        parentTaskId,
      ]);

      // Optimistically update the subtask in cache
      const newStatus = currentStatus === "done" ? "todo" : "done";
      queryClient.setQueryData<Task[]>(
        ["subtasks", parentTaskId],
        (old) =>
          old?.map((s) =>
            s.id === subtaskId
              ? {
                  ...s,
                  status: newStatus as Task["status"],
                  completed_at:
                    newStatus === "done" ? new Date().toISOString() : null,
                }
              : s
          ) ?? []
      );

      return { previousSubtasks };
    },

    onError: (_err, _vars, context) => {
      // Revert optimistic update on failure
      if (context?.previousSubtasks) {
        queryClient.setQueryData(
          ["subtasks", parentTaskId],
          context.previousSubtasks
        );
      }
    },

    onSuccess: (_data, { subtaskId, currentStatus }) => {
      const newStatus = currentStatus === "done" ? "todo" : "done";

      // Check if all subtasks are now done
      const subtasks = queryClient.getQueryData<Task[]>([
        "subtasks",
        parentTaskId,
      ]);

      const allDone =
        newStatus === "done" &&
        subtasks != null &&
        subtasks.length > 0 &&
        subtasks.every((s) =>
          s.id === subtaskId ? true : s.status === "done"
        );

      if (allDone) {
        // Auto-complete the parent task silently
        fetch(`/api/tasks/${parentTaskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "done",
            completed_at: new Date().toISOString(),
          }),
        }).then(() => {
          // Invalidate tasks so parent moves to Done column
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          queryClient.invalidateQueries({ queryKey: ["task-tag-counts"] });
        });
      }

      // Always refresh the subtask list after a successful toggle
      queryClient.invalidateQueries({
        queryKey: ["subtasks", parentTaskId],
      });
    },
  });
}
