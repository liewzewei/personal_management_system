/**
 * Blog posts management tab for the portfolio admin panel.
 */

"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  useAdminBlogPosts,
  useBlogPostMutation,
  usePortfolioImageUpload,
} from "@/lib/hooks/usePortfolio";
import { PortfolioContentEditor } from "@/components/portfolio/PortfolioContentEditor";
import { useToast } from "@/lib/hooks/use-toast";
import type { BlogPost } from "@/types";
import {
  Plus, Pencil, Trash2, Eye, EyeOff, ArrowLeft, Save, X, GripVertical, Upload,
} from "lucide-react";

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 200) || "untitled";
}

// ── Blog Post Editor ─────────────────────────────────────────────────────────

function BlogPostEditor({ post, onBack }: { post: BlogPost; onBack: () => void }) {
  const { updateBlogPost } = useBlogPostMutation();
  const imageUpload = usePortfolioImageUpload();
  const { toast } = useToast();
  const [title, setTitle] = useState(post.title);
  const [subtitle, setSubtitle] = useState(post.subtitle ?? "");
  const [slug, setSlug] = useState(post.slug);
  const [coverImageUrl, setCoverImageUrl] = useState(post.cover_image_url ?? "");
  const [tags, setTags] = useState<string[]>(post.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [content, setContent] = useState<Record<string, unknown> | null>(post.content);
  const [contentText, setContentText] = useState(post.content_text ?? "");
  const [isPublished, setIsPublished] = useState(post.is_published);
  const [saving, setSaving] = useState(false);

  const readingTime = Math.max(1, Math.round((contentText.split(/\s+/).filter(Boolean).length) / 200));

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await updateBlogPost.mutateAsync({
        id: post.id,
        data: {
          title, subtitle: subtitle || null, slug,
          cover_image_url: coverImageUrl || null,
          tags: tags.length > 0 ? tags : null,
          content, content_text: contentText || null,
          reading_time_minutes: readingTime,
          is_published: isPublished,
          published_at: isPublished && !post.published_at ? now : undefined,
        },
      });
      toast({ title: "Blog post saved" });
    } catch {
      toast({ title: "Error", description: "Failed to save blog post", variant: "destructive" });
    } finally { setSaving(false); }
  }, [updateBlogPost, post.id, post.published_at, title, subtitle, slug, coverImageUrl, tags, content, contentText, readingTime, isPublished, toast]);

  const handleCoverUpload = useCallback(async () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      try { const url = await imageUpload.mutateAsync(file); setCoverImageUrl(url); }
      catch { toast({ title: "Error", description: "Failed to upload image", variant: "destructive" }); }
    };
    input.click();
  }, [imageUpload, toast]);

  const addTag = useCallback(() => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  }, [tagInput, tags]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}><ArrowLeft size={16} /></Button>
        <h2 className="text-lg font-semibold flex-1">Edit Blog Post</h2>
        <span className="text-xs text-muted-foreground">{readingTime} min read</span>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="rounded" />
          Published
        </label>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save size={14} className="mr-1" />{saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <div><label className="text-sm font-medium">Title</label>
        <Input value={title} onChange={(e) => { setTitle(e.target.value); if (slug === slugify(post.title)) setSlug(slugify(e.target.value)); }} className="mt-1" />
      </div>

      <div><label className="text-sm font-medium">Subtitle</label>
        <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className="mt-1" placeholder="Optional subtitle" />
      </div>

      <div><label className="text-sm font-medium">Slug</label>
        <Input value={slug} onChange={(e) => setSlug(e.target.value)} className="mt-1 font-mono text-sm" />
      </div>

      <div><label className="text-sm font-medium">Cover Image</label>
        <div className="flex items-center gap-2 mt-1">
          <Input value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} placeholder="https://..." className="flex-1" />
          <Button variant="outline" size="sm" onClick={handleCoverUpload} disabled={imageUpload.isPending}>
            <Upload size={14} className="mr-1" />Upload
          </Button>
        </div>
      </div>

      <div><label className="text-sm font-medium">Tags</label>
        <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">{tag}
              <button type="button" onClick={() => setTags(tags.filter((t) => t !== tag))} className="ml-0.5 hover:text-destructive"><X size={12} /></button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-1">
          <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())} placeholder="Add tag..." className="h-8 text-sm" />
          <Button variant="outline" size="sm" className="h-8" onClick={addTag}>Add</Button>
        </div>
      </div>

      <div><label className="text-sm font-medium">Content</label>
        <div className="mt-1">
          <PortfolioContentEditor content={content} onChange={(json, text) => { setContent(json); setContentText(text); }} />
        </div>
      </div>
    </div>
  );
}

// ── Blog Posts List ──────────────────────────────────────────────────────────

export function AdminBlogTab() {
  const { data: posts, isLoading } = useAdminBlogPosts();
  const { createBlogPost, updateBlogPost, deleteBlogPost } = useBlogPostMutation();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    try { const r = await createBlogPost.mutateAsync({ title: "New Blog Post" }); setEditingId(r.id); }
    catch { toast({ title: "Error", description: "Failed to create post", variant: "destructive" }); }
  }, [createBlogPost, toast]);

  const handleTogglePublish = useCallback(async (p: BlogPost) => {
    try {
      const now = new Date().toISOString();
      await updateBlogPost.mutateAsync({ id: p.id, data: { is_published: !p.is_published, published_at: !p.is_published && !p.published_at ? now : undefined } });
      toast({ title: p.is_published ? "Unpublished" : "Published" });
    } catch { toast({ title: "Error", description: "Failed to update", variant: "destructive" }); }
  }, [updateBlogPost, toast]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this blog post?")) return;
    try { await deleteBlogPost.mutateAsync(id); toast({ title: "Deleted" }); }
    catch { toast({ title: "Error", description: "Failed to delete", variant: "destructive" }); }
  }, [deleteBlogPost, toast]);

  const editingPost = posts?.find((p) => p.id === editingId);
  if (editingPost) return <BlogPostEditor post={editingPost} onBack={() => setEditingId(null)} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Blog Posts</h2>
        <Button size="sm" onClick={handleCreate} disabled={createBlogPost.isPending}><Plus size={16} className="mr-1" />New Post</Button>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : posts && posts.length > 0 ? (
        <div className="space-y-2">
          {posts.map((post) => (
            <div key={post.id} className="flex items-center gap-4 p-4 border rounded-lg bg-background hover:bg-muted/30 transition-colors w-full">
              <GripVertical size={18} className="text-muted-foreground/60 shrink-0 cursor-grab" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{post.title}</span>
                  <Badge variant={post.is_published ? "default" : "secondary"} className="text-xs shrink-0">{post.is_published ? "Published" : "Draft"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">/{post.slug}{post.subtitle ? ` · ${post.subtitle}` : ""}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleTogglePublish(post)} title={post.is_published ? "Unpublish" : "Publish"}>{post.is_published ? <EyeOff size={16} /> : <Eye size={16} />}</Button>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setEditingId(post.id)} title="Edit"><Pencil size={16} /></Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => handleDelete(post.id)} title="Delete"><Trash2 size={16} /></Button>
              </div>
            </div>
          ))}
        </div>
      ) : <div className="text-center py-12 text-muted-foreground text-sm">No blog posts yet. Create your first one.</div>}
    </div>
  );
}
