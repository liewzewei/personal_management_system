/**
 * Zod validation schemas for calendar-related API inputs.
 *
 * Covers:
 * - Calendar event creation and updates
 * - iCal feed creation and updates
 * - User preferences updates
 */

import { z } from "zod";

// =========================
// Calendar events
// =========================

export const createCalendarEventSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(5000).nullable().optional(),
  start_time: z.string().datetime({ message: "start_time must be a valid ISO datetime" }),
  end_time: z.string().datetime({ message: "end_time must be a valid ISO datetime" }),
  is_all_day: z.boolean().optional().default(false),
  calendar_type: z.string().max(100).nullable().optional(),
});

export const updateCalendarEventSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
  is_all_day: z.boolean().optional(),
  calendar_type: z.string().max(100).nullable().optional(),
});

export type CreateCalendarEventInput = z.infer<typeof createCalendarEventSchema>;
export type UpdateCalendarEventInput = z.infer<typeof updateCalendarEventSchema>;

// =========================
// iCal feeds
// =========================

export const createIcalFeedSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  ical_url: z
    .string()
    .url("Must be a valid URL")
    .refine(
      (url) => url.startsWith("http://") || url.startsWith("https://"),
      "URL must start with http:// or https://"
    ),
  calendar_type: z.string().min(1, "Calendar type is required").max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a hex color like #3B82F6").nullable().optional(),
});

export const updateIcalFeedSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  ical_url: z
    .string()
    .url()
    .refine(
      (url) => url.startsWith("http://") || url.startsWith("https://"),
      "URL must start with http:// or https://"
    )
    .optional(),
  calendar_type: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  is_active: z.boolean().optional(),
});

export type CreateIcalFeedInput = z.infer<typeof createIcalFeedSchema>;
export type UpdateIcalFeedInput = z.infer<typeof updateIcalFeedSchema>;

// =========================
// User preferences
// =========================

export const updateUserPreferencesSchema = z.object({
  calendar_default_view: z.enum(["dayGridMonth", "timeGridWeek", "timeGridDay"]).optional(),
  calendar_week_starts_on: z.enum(["sunday", "monday"]).optional(),
});

export type UpdateUserPreferencesInput = z.infer<typeof updateUserPreferencesSchema>;
