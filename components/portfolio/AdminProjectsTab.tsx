/**
 * Projects management tab for the portfolio admin panel.
 */

"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  useAdminProjects,
  useProjectMutation,
  usePortfolioImageUpload,
} from "@/lib/hooks/usePortfolio";
import { PortfolioContentEditor } from "@/components/portfolio/PortfolioContentEditor";
import { useToast } from "@/lib/hooks/use-toast";
import type { PortfolioProject } from "@/types";
import {
  Plus, Pencil, Trash2, Eye, EyeOff, ArrowLeft, Save, X, GripVertical, Upload,
} from "lucide-react";

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 200) || "untitled";
}

// ── Project Editor ───────────────────────────────────────────────────────────

function ProjectEditor({ project, onBack }: { project: PortfolioProject; onBack: () => void }) {
  const { updateProject } = useProjectMutation();
  const imageUpload = usePortfolioImageUpload();
  const { toast } = useToast();
  const [title, setTitle] = useState(project.title);
  const [slug, setSlug] = useState(project.slug);
  const [tagline, setTagline] = useState(project.tagline ?? "");
  const [description, setDescription] = useState(project.description ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(project.cover_image_url ?? "");
  const [tags, setTags] = useState<string[]>(project.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [links, setLinks] = useState<{ label: string; url: string }[]>(project.links ?? []);
  const [content, setContent] = useState<Record<string, unknown> | null>(project.content);
  const [contentText, setContentText] = useState(project.content_text ?? "");
  const [isPublished, setIsPublished] = useState(project.is_published);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateProject.mutateAsync({
        id: project.id,
        data: { title, slug, tagline: tagline || null, description: description || null, cover_image_url: coverImageUrl || null, tags: tags.length > 0 ? tags : null, links, content, content_text: contentText || null, is_published: isPublished },
      });
      toast({ title: "Project saved" });
    } catch {
      toast({ title: "Error", description: "Failed to save project", variant: "destructive" });
    } finally { setSaving(false); }
  }, [updateProject, project.id, title, slug, tagline, description, coverImageUrl, tags, links, content, contentText, isPublished, toast]);

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
        <h2 className="text-lg font-semibold flex-1">Edit Project</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="rounded" />
          Published
        </label>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save size={14} className="mr-1" />{saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <div><label className="text-sm font-medium">Title</label>
        <Input value={title} onChange={(e) => { setTitle(e.target.value); if (slug === slugify(project.title)) setSlug(slugify(e.target.value)); }} className="mt-1" />
      </div>

      <div><label className="text-sm font-medium">Slug</label>
        <Input value={slug} onChange={(e) => setSlug(e.target.value)} className="mt-1 font-mono text-sm" />
      </div>

      <div><label className="text-sm font-medium">Tagline</label>
        <Input value={tagline} onChange={(e) => setTagline(e.target.value)} className="mt-1" placeholder="Short one-liner" />
      </div>

      <div><label className="text-sm font-medium">Description</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" rows={3} />
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

      <div><label className="text-sm font-medium">Links</label>
        <div className="space-y-2 mt-1">
          {links.map((link, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={link.label} onChange={(e) => { const nl = [...links]; nl[i] = { ...nl[i], label: e.target.value }; setLinks(nl); }} placeholder="Label" className="h-8 text-sm w-32" />
              <Input value={link.url} onChange={(e) => { const nl = [...links]; nl[i] = { ...nl[i], url: e.target.value }; setLinks(nl); }} placeholder="https://..." className="h-8 text-sm flex-1" />
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setLinks(links.filter((_, j) => j !== i))}><X size={14} /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setLinks([...links, { label: "", url: "" }])}><Plus size={14} className="mr-1" />Add Link</Button>
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

// ── Projects List ────────────────────────────────────────────────────────────

export function AdminProjectsTab() {
  const { data: projects, isLoading } = useAdminProjects();
  const { createProject, updateProject, deleteProject } = useProjectMutation();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    try { const r = await createProject.mutateAsync({ title: "New Project" }); setEditingId(r.id); }
    catch { toast({ title: "Error", description: "Failed to create project", variant: "destructive" }); }
  }, [createProject, toast]);

  const handleTogglePublish = useCallback(async (p: PortfolioProject) => {
    try { await updateProject.mutateAsync({ id: p.id, data: { is_published: !p.is_published } }); toast({ title: p.is_published ? "Unpublished" : "Published" }); }
    catch { toast({ title: "Error", description: "Failed to update", variant: "destructive" }); }
  }, [updateProject, toast]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this project?")) return;
    try { await deleteProject.mutateAsync(id); toast({ title: "Deleted" }); }
    catch { toast({ title: "Error", description: "Failed to delete", variant: "destructive" }); }
  }, [deleteProject, toast]);

  const editingProject = projects?.find((p) => p.id === editingId);
  if (editingProject) return <ProjectEditor project={editingProject} onBack={() => setEditingId(null)} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Projects</h2>
        <Button size="sm" onClick={handleCreate} disabled={createProject.isPending}><Plus size={16} className="mr-1" />New Project</Button>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : projects && projects.length > 0 ? (
        <div className="space-y-2">
          {projects.map((project) => (
            <div key={project.id} className="flex items-center gap-4 p-4 border rounded-lg bg-background hover:bg-muted/30 transition-colors w-full">
              <GripVertical size={18} className="text-muted-foreground/60 shrink-0 cursor-grab" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{project.title}</span>
                  <Badge variant={project.is_published ? "default" : "secondary"} className="text-xs shrink-0">{project.is_published ? "Published" : "Draft"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">/{project.slug}{project.tagline ? ` · ${project.tagline}` : ""}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleTogglePublish(project)} title={project.is_published ? "Unpublish" : "Publish"}>{project.is_published ? <EyeOff size={16} /> : <Eye size={16} />}</Button>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setEditingId(project.id)} title="Edit"><Pencil size={16} /></Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => handleDelete(project.id)} title="Delete"><Trash2 size={16} /></Button>
              </div>
            </div>
          ))}
        </div>
      ) : <div className="text-center py-12 text-muted-foreground text-sm">No projects yet. Create your first one.</div>}
    </div>
  );
}
