/**
 * Zod validation schemas for task API inputs.
 *
 * Used by API routes to validate request bodies before passing to
 * Supabase helper functions.
 */

import { z } from "zod";

const statusEnum = z.enum(["todo", "in_progress", "done"]);
const priorityEnum = z.enum(["low", "medium", "high"]);

/** Schema for POST /api/tasks — title is required, everything else optional. */
export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(5000).nullable().optional(),
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  tags: z.array(z.string().max(100)).nullable().optional(),
  deadline: z.string().datetime({ offset: true }).nullable().optional(),
  estimated_minutes: z.number().int().min(0).nullable().optional(),
  is_recurring: z.boolean().optional(),
  recurrence_rule: z.string().max(500).nullable().optional(),
  parent_task_id: z.string().uuid().nullable().optional(),
});

/** Schema for PATCH /api/tasks/[id] — all fields optional. */
export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  tags: z.array(z.string().max(100)).nullable().optional(),
  deadline: z.string().datetime({ offset: true }).nullable().optional(),
  estimated_minutes: z.number().int().min(0).nullable().optional(),
  is_recurring: z.boolean().optional(),
  recurrence_rule: z.string().max(500).nullable().optional(),
  parent_task_id: z.string().uuid().nullable().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
