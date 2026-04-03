/**
 * Site configuration tab for the portfolio admin panel.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useAdminSiteConfig,
  useSiteConfigMutation,
  usePortfolioImageUpload,
} from "@/lib/hooks/usePortfolio";
import { useToast } from "@/lib/hooks/use-toast";
import { Save, Upload } from "lucide-react";

export function AdminConfigTab() {
  const { data: config, isLoading } = useAdminSiteConfig();
  const { updateSiteConfig } = useSiteConfigMutation();
  const imageUpload = usePortfolioImageUpload();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [socialGithub, setSocialGithub] = useState("");
  const [socialLinkedin, setSocialLinkedin] = useState("");
  const [socialEmail, setSocialEmail] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setName(config.name);
      setTagline(config.tagline);
      setBio(config.bio ?? "");
      setAvatarUrl(config.avatar_url ?? "");
      setSocialGithub(config.social_github ?? "");
      setSocialLinkedin(config.social_linkedin ?? "");
      setSocialEmail(config.social_email ?? "");
      setSeoTitle(config.seo_title ?? "");
      setSeoDescription(config.seo_description ?? "");
    }
  }, [config]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateSiteConfig.mutateAsync({
        name,
        tagline,
        bio: bio || null,
        avatar_url: avatarUrl || null,
        social_github: socialGithub || null,
        social_linkedin: socialLinkedin || null,
        social_email: socialEmail || null,
        seo_title: seoTitle || null,
        seo_description: seoDescription || null,
      });
      toast({ title: "Site config saved" });
    } catch {
      toast({ title: "Error", description: "Failed to save config", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [updateSiteConfig, name, tagline, bio, avatarUrl, socialGithub, socialLinkedin, socialEmail, seoTitle, seoDescription, toast]);

  const handleAvatarUpload = useCallback(async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const url = await imageUpload.mutateAsync(file);
        setAvatarUrl(url);
      } catch {
        toast({ title: "Error", description: "Failed to upload avatar", variant: "destructive" });
      }
    };
    input.click();
  }, [imageUpload, toast]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Site Configuration</h2>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save size={14} className="mr-1" />
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <div>
        <label className="text-sm font-medium">Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
      </div>

      <div>
        <label className="text-sm font-medium">Tagline</label>
        <Input value={tagline} onChange={(e) => setTagline(e.target.value)} className="mt-1" />
      </div>

      <div>
        <label className="text-sm font-medium">Bio</label>
        <Textarea value={bio} onChange={(e) => setBio(e.target.value)} className="mt-1" rows={4} placeholder="Short bio for the hero section" />
      </div>

      <div>
        <label className="text-sm font-medium">Avatar URL</label>
        <div className="flex items-center gap-2 mt-1">
          <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." className="flex-1" />
          <Button variant="outline" size="sm" onClick={handleAvatarUpload} disabled={imageUpload.isPending}>
            <Upload size={14} className="mr-1" />Upload
          </Button>
        </div>
      </div>

      <hr className="border-border/50" />
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Social Links</h3>

      <div>
        <label className="text-sm font-medium">GitHub</label>
        <Input value={socialGithub} onChange={(e) => setSocialGithub(e.target.value)} className="mt-1" placeholder="https://github.com/..." />
      </div>

      <div>
        <label className="text-sm font-medium">LinkedIn</label>
        <Input value={socialLinkedin} onChange={(e) => setSocialLinkedin(e.target.value)} className="mt-1" placeholder="https://linkedin.com/in/..." />
      </div>

      <div>
        <label className="text-sm font-medium">Email</label>
        <Input value={socialEmail} onChange={(e) => setSocialEmail(e.target.value)} className="mt-1" placeholder="you@example.com" />
      </div>

      <hr className="border-border/50" />
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">SEO</h3>

      <div>
        <label className="text-sm font-medium">SEO Title</label>
        <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} className="mt-1" placeholder="Browser tab title override" />
      </div>

      <div>
        <label className="text-sm font-medium">SEO Description</label>
        <Textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} className="mt-1" rows={2} placeholder="Meta description for search engines" />
      </div>
    </div>
  );
}
