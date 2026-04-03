/**
 * Portfolio project detail page — /portfolio/projects/[slug]
 *
 * Displays a single published project with cover image hero,
 * title, tags, links, and rich Tiptap content. SSR for SEO.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getPublishedProjectBySlug, getPublicSiteConfig } from "@/lib/supabase";
import { TiptapRenderer } from "@/components/portfolio/TiptapRenderer";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink } from "lucide-react";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { data: project } = await getPublishedProjectBySlug(slug);
  const { data: config } = await getPublicSiteConfig();

  if (!project) return { title: "Project Not Found" };

  return {
    title: `${project.title} — ${config?.name ?? "Ze Wei"}`,
    description: project.tagline ?? project.description ?? undefined,
    openGraph: {
      title: project.title,
      description: project.tagline ?? undefined,
      images: project.cover_image_url ? [project.cover_image_url] : undefined,
    },
  };
}

export default async function ProjectDetailPage({ params }: Props) {
  const { slug } = await params;
  const { data: project } = await getPublishedProjectBySlug(slug);

  if (!project) notFound();

  return (
    <article className="max-w-3xl mx-auto px-6">
      {/* Back link */}
      <Link
        href="/portfolio/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        All Projects
      </Link>

      {/* Cover image */}
      {project.cover_image_url && (
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden mb-8">
          <Image
            src={project.cover_image_url}
            alt={project.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 768px"
            priority
          />
        </div>
      )}

      {/* Header */}
      <div className="portfolio-fade-in">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          {project.title}
        </h1>

        {project.tagline && (
          <p className="mt-3 text-lg text-muted-foreground">{project.tagline}</p>
        )}

        {/* Tags */}
        {project.tags && project.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {project.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="bg-white/10 border-white/20 backdrop-blur-sm"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* External links */}
        {project.links && project.links.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-4">
            {project.links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-card inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-primary hover:scale-105 transition-all"
              >
                <ExternalLink size={14} />
                {link.label}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Content body */}
      {project.content && (
        <div className="mt-10 portfolio-fade-in" style={{ animationDelay: "200ms" }}>
          <TiptapRenderer content={project.content} className="portfolio-prose" />
        </div>
      )}
    </article>
  );
}
