/**
 * Glass card component for displaying a portfolio project in a grid.
 *
 * Shows cover image, title, tagline, tags, and external links.
 * Uses glassmorphism styling with hover animation.
 */

"use client";

import Link from "next/link";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PortfolioProject } from "@/types";

interface ProjectCardProps {
  project: PortfolioProject;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      href={`/portfolio/projects/${project.slug}`}
      className="group glass-card rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg block"
    >
      {/* Cover image */}
      {project.cover_image_url && (
        <div className="relative w-full aspect-video overflow-hidden">
          <Image
            src={project.cover_image_url}
            alt={project.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
      )}

      <div className="p-5">
        <h3 className="text-lg font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors line-clamp-2">
          {project.title}
        </h3>

        {project.tagline && (
          <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
            {project.tagline}
          </p>
        )}

        {/* Tags */}
        {project.tags && project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {project.tags.slice(0, 4).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-xs bg-white/10 border-white/20 backdrop-blur-sm"
              >
                {tag}
              </Badge>
            ))}
            {project.tags.length > 4 && (
              <Badge variant="secondary" className="text-xs bg-white/10 border-white/20">
                +{project.tags.length - 4}
              </Badge>
            )}
          </div>
        )}

        {/* Links */}
        {project.links && project.links.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {project.links.map((link) => (
              <span
                key={link.url}
                className="inline-flex items-center gap-1 text-xs text-primary/80"
              >
                <ExternalLink size={12} />
                {link.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
