/**
 * Zod validation schemas for nutrition/food API inputs.
 */

import { z } from "zod";

export const createFoodLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  meal_slot: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  food_name: z.string().min(1).max(200),
  calories: z.number().int().min(0),
  carbs_g: z.number().min(0).optional(),
  fat_g: z.number().min(0).optional(),
  protein_g: z.number().min(0).optional(),
  water_ml: z.number().int().min(0).default(0),
  saved_food_id: z.string().uuid().optional(),
});

export const createSavedFoodSchema = z.object({
  food_name: z.string().min(1).max(200),
  calories: z.number().int().min(0),
  carbs_g: z.number().min(0).optional(),
  fat_g: z.number().min(0).optional(),
  protein_g: z.number().min(0).optional(),
});

export const updateSavedFoodSchema = z.object({
  food_name: z.string().min(1).max(200).optional(),
  calories: z.number().int().min(0).optional(),
  carbs_g: z.number().min(0).nullable().optional(),
  fat_g: z.number().min(0).nullable().optional(),
  protein_g: z.number().min(0).nullable().optional(),
});

export const upsertBodyMetricSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  weight_kg: z.number().min(0).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export type CreateFoodLogInput = z.infer<typeof createFoodLogSchema>;
export type CreateSavedFoodInput = z.infer<typeof createSavedFoodSchema>;
export type UpdateSavedFoodInput = z.infer<typeof updateSavedFoodSchema>;
export type UpsertBodyMetricInput = z.infer<typeof upsertBodyMetricSchema>;
