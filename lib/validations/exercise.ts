/**
 * Zod validation schemas for exercise API inputs.
 *
 * Used by API routes to validate request bodies before passing to
 * Supabase helper functions.
 */

import { z } from "zod";

const exerciseTypeEnum = z.enum(["run", "swim", "other"]);
const strokeTypeEnum = z.enum([
  "freestyle", "backstroke", "breaststroke", "butterfly", "mixed",
]);

const lapSchema = z.object({
  lap_number: z.number().int().positive(),
  distance_metres: z.number().positive(),
  duration_seconds: z.number().int().positive(),
});

/** Schema for POST /api/exercise/sessions */
export const createSessionSchema = z.object({
  type: exerciseTypeEnum,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  started_at: z.string().datetime({ offset: true }).optional(),
  duration_seconds: z.number().int().positive(),
  distance_metres: z.number().positive().optional(),
  calories_burned: z.number().int().min(0).optional(),
  notes: z.string().max(1000).optional(),
  // Running-specific
  route_name: z.string().max(200).optional(),
  effort_level: z.number().int().min(1).max(5).optional(),
  // Swimming-specific
  pool_length_metres: z.union([z.literal(25), z.literal(50)]).optional(),
  total_laps: z.number().int().positive().optional(),
  stroke_type: strokeTypeEnum.optional(),
  swolf_score: z.number().min(0).optional(),
  // Laps (running only)
  laps: z.array(lapSchema).optional(),
});

/** Schema for PATCH /api/exercise/sessions/[id] — all fields optional */
export const updateSessionSchema = z.object({
  type: exerciseTypeEnum.optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional(),
  started_at: z.string().datetime({ offset: true }).nullable().optional(),
  duration_seconds: z.number().int().positive().optional(),
  distance_metres: z.number().positive().nullable().optional(),
  calories_burned: z.number().int().min(0).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  route_name: z.string().max(200).nullable().optional(),
  effort_level: z.number().int().min(1).max(5).nullable().optional(),
  pool_length_metres: z.union([z.literal(25), z.literal(50)]).nullable().optional(),
  total_laps: z.number().int().positive().nullable().optional(),
  stroke_type: strokeTypeEnum.nullable().optional(),
  swolf_score: z.number().min(0).nullable().optional(),
  laps: z.array(lapSchema).nullable().optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
