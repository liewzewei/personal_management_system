/**
 * Zod validation schemas for portfolio API routes.
 *
 * Covers portfolio projects, blog posts, site config, and reorder operations.
 */

import { z } from "zod";

// ── Slug helpers ─────────────────────────────────────────────────────────────

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const slugSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(slugRegex, "Slug must be lowercase alphanumeric with hyphens only");

// ── Link schema ──────────────────────────────────────────────────────────────

const linkSchema = z.object({
  label: z.string().min(1).max(100),
  url: z.string().url().max(2000),
});

// ── Portfolio Projects ───────────────────────────────────────────────────────

export const createProjectSchema = z.object({
  title: z.string().min(1).max(500),
  slug: slugSchema.optional(),
  tagline: z.string().max(300).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  content: z.record(z.string(), z.unknown()).nullable().optional(),
  content_text: z.string().nullable().optional(),
  cover_image_url: z.string().url().max(2000).nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).nullable().optional(),
  links: z.array(linkSchema).max(10).optional(),
  display_order: z.number().int().min(0).optional(),
  is_published: z.boolean().optional(),
});

export const updateProjectSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  slug: slugSchema.optional(),
  tagline: z.string().max(300).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  content: z.record(z.string(), z.unknown()).nullable().optional(),
  content_text: z.string().nullable().optional(),
  cover_image_url: z.string().url().max(2000).nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).nullable().optional(),
  links: z.array(linkSchema).max(10).optional(),
  display_order: z.number().int().min(0).optional(),
  is_published: z.boolean().optional(),
});

// ── Blog Posts ───────────────────────────────────────────────────────────────

export const createBlogPostSchema = z.object({
  title: z.string().min(1).max(500),
  subtitle: z.string().max(500).nullable().optional(),
  slug: slugSchema.optional(),
  content: z.record(z.string(), z.unknown()).nullable().optional(),
  content_text: z.string().nullable().optional(),
  cover_image_url: z.string().url().max(2000).nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).nullable().optional(),
  reading_time_minutes: z.number().int().min(1).nullable().optional(),
  display_order: z.number().int().min(0).optional(),
  is_published: z.boolean().optional(),
  published_at: z.string().datetime({ offset: true }).nullable().optional(),
});

export const updateBlogPostSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  subtitle: z.string().max(500).nullable().optional(),
  slug: slugSchema.optional(),
  content: z.record(z.string(), z.unknown()).nullable().optional(),
  content_text: z.string().nullable().optional(),
  cover_image_url: z.string().url().max(2000).nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).nullable().optional(),
  reading_time_minutes: z.number().int().min(1).nullable().optional(),
  display_order: z.number().int().min(0).optional(),
  is_published: z.boolean().optional(),
  published_at: z.string().datetime({ offset: true }).nullable().optional(),
});

// ── Site Config ──────────────────────────────────────────────────────────────

export const updateSiteConfigSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  tagline: z.string().min(1).max(500).optional(),
  bio: z.string().max(2000).nullable().optional(),
  avatar_url: z.string().url().max(2000).nullable().optional(),
  social_github: z.string().url().max(500).nullable().optional(),
  social_linkedin: z.string().url().max(500).nullable().optional(),
  social_email: z.string().email().max(200).nullable().optional(),
  seo_title: z.string().max(200).nullable().optional(),
  seo_description: z.string().max(500).nullable().optional(),
});

// ── Reorder ──────────────────────────────────────────────────────────────────

export const reorderSchema = z.object({
  type: z.enum(["project", "blog"]),
  ordered_ids: z.array(z.string().uuid()).min(1),
});
