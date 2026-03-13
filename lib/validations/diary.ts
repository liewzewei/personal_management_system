/**
 * Zod validation schemas for diary API inputs.
 *
 * Used in /api/diary routes to validate request bodies and query params.
 */

import { z } from "zod";

export const createDiaryEntrySchema = z.object({
  title: z.string().max(500).optional(),
  content: z.record(z.string(), z.unknown()).optional(),
  content_text: z.string().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const updateDiaryEntrySchema = z.object({
  title: z.string().max(500).optional(),
  content: z.record(z.string(), z.unknown()).optional(),
  content_text: z.string().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const diaryQuerySchema = z.object({
  tag: z.string().optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
