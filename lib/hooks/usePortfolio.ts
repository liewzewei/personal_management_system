/**
 * React Query hooks for portfolio admin panel.
 *
 * All hooks use the authenticated admin API routes.
 * Public portfolio pages use SSR (server components) and don't need client hooks.
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PortfolioProject, PortfolioProjectInput, BlogPost, BlogPostInput, SiteConfig, SiteConfigInput } from "@/types";

// ── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = (await res.json()) as { data: T | null; error: string | null };
  if (!res.ok || body.error) throw new Error(body.error ?? `Request failed: ${res.status}`);
  return body.data as T;
}

// ── Projects ─────────────────────────────────────────────────────────────────

export function useAdminProjects() {
  return useQuery<PortfolioProject[]>({
    queryKey: ["admin-projects"],
    queryFn: () => fetchJson<PortfolioProject[]>("/api/portfolio/admin/projects"),
    staleTime: 2 * 60 * 1000,
  });
}

export function useAdminProject(id: string | null) {
  return useQuery<PortfolioProject>({
    queryKey: ["admin-project", id],
    queryFn: () => fetchJson<PortfolioProject>(`/api/portfolio/admin/projects/${id}`),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
}

export function useProjectMutation() {
  const queryClient = useQueryClient();

  const createProject = useMutation({
    mutationFn: (data: PortfolioProjectInput) =>
      fetchJson<PortfolioProject>("/api/portfolio/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
    },
  });

  const updateProject = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PortfolioProjectInput }) =>
      fetchJson<PortfolioProject>(`/api/portfolio/admin/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
      queryClient.invalidateQueries({ queryKey: ["admin-project", variables.id] });
    },
  });

  const deleteProject = useMutation({
    mutationFn: (id: string) =>
      fetchJson<null>(`/api/portfolio/admin/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
    },
  });

  const reorderProjects = useMutation({
    mutationFn: (orderedIds: string[]) =>
      fetchJson<null>("/api/portfolio/admin/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "project", ordered_ids: orderedIds }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
    },
  });

  return { createProject, updateProject, deleteProject, reorderProjects };
}

// ── Blog Posts ───────────────────────────────────────────────────────────────

export function useAdminBlogPosts() {
  return useQuery<BlogPost[]>({
    queryKey: ["admin-blog-posts"],
    queryFn: () => fetchJson<BlogPost[]>("/api/portfolio/admin/blog"),
    staleTime: 2 * 60 * 1000,
  });
}

export function useAdminBlogPost(id: string | null) {
  return useQuery<BlogPost>({
    queryKey: ["admin-blog-post", id],
    queryFn: () => fetchJson<BlogPost>(`/api/portfolio/admin/blog/${id}`),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
}

export function useBlogPostMutation() {
  const queryClient = useQueryClient();

  const createBlogPost = useMutation({
    mutationFn: (data: BlogPostInput) =>
      fetchJson<BlogPost>("/api/portfolio/admin/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-blog-posts"] });
    },
  });

  const updateBlogPost = useMutation({
    mutationFn: ({ id, data }: { id: string; data: BlogPostInput }) =>
      fetchJson<BlogPost>(`/api/portfolio/admin/blog/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-blog-posts"] });
      queryClient.invalidateQueries({ queryKey: ["admin-blog-post", variables.id] });
    },
  });

  const deleteBlogPost = useMutation({
    mutationFn: (id: string) =>
      fetchJson<null>(`/api/portfolio/admin/blog/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-blog-posts"] });
    },
  });

  const reorderBlogPosts = useMutation({
    mutationFn: (orderedIds: string[]) =>
      fetchJson<null>("/api/portfolio/admin/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "blog", ordered_ids: orderedIds }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-blog-posts"] });
    },
  });

  return { createBlogPost, updateBlogPost, deleteBlogPost, reorderBlogPosts };
}

// ── Site Config ──────────────────────────────────────────────────────────────

export function useAdminSiteConfig() {
  return useQuery<SiteConfig>({
    queryKey: ["admin-site-config"],
    queryFn: () => fetchJson<SiteConfig>("/api/portfolio/admin/config"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSiteConfigMutation() {
  const queryClient = useQueryClient();

  const updateSiteConfig = useMutation({
    mutationFn: (data: SiteConfigInput) =>
      fetchJson<SiteConfig>("/api/portfolio/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-site-config"] });
    },
  });

  return { updateSiteConfig };
}

// ── Image Upload ─────────────────────────────────────────────────────────────

export function usePortfolioImageUpload() {
  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/portfolio/admin/upload", {
        method: "POST",
        body: formData,
      });
      const body = (await res.json()) as { data: string | null; error: string | null };
      if (!res.ok || body.error) throw new Error(body.error ?? "Upload failed");
      return body.data as string;
    },
  });
}
