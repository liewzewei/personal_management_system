/**
 * Glass card component for displaying a blog post in a grid.
 *
 * Shows cover image, title, subtitle, tags, reading time, and date.
 * Uses glassmorphism styling with hover animation.
 */

"use client";

import Link from "next/link";
import Image from "next/image";
import { Clock, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BlogPost } from "@/types";

interface BlogCardProps {
  post: BlogPost;
}

export function BlogCard({ post }: BlogCardProps) {
  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group glass-card rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg block"
    >
      {/* Cover image */}
      {post.cover_image_url && (
        <div className="relative w-full aspect-[2/1] overflow-hidden">
          <Image
            src={post.cover_image_url}
            alt={post.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
      )}

      <div className="p-5">
        <h3 className="text-lg font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors line-clamp-2">
          {post.title}
        </h3>

        {post.subtitle && (
          <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
            {post.subtitle}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
          {formattedDate && (
            <span className="inline-flex items-center gap-1">
              <Calendar size={12} />
              {formattedDate}
            </span>
          )}
          {post.reading_time_minutes && (
            <span className="inline-flex items-center gap-1">
              <Clock size={12} />
              {post.reading_time_minutes} min read
            </span>
          )}
        </div>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {post.tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-xs bg-white/10 border-white/20 backdrop-blur-sm"
              >
                {tag}
              </Badge>
            ))}
            {post.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs bg-white/10 border-white/20">
                +{post.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
