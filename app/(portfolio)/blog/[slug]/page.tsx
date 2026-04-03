/**
 * Blog post detail page — /blog/[slug]
 *
 * Displays a single published blog post with cover image, title/subtitle,
 * author line, reading time, rich Tiptap content, and prev/next navigation.
 * SSR for SEO.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  getPublishedBlogPostBySlug,
  getPublicSiteConfig,
  getAdjacentBlogPosts,
} from "@/lib/supabase";
import { TiptapRenderer } from "@/components/portfolio/TiptapRenderer";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Clock, Calendar } from "lucide-react";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { data: post } = await getPublishedBlogPostBySlug(slug);
  const { data: config } = await getPublicSiteConfig();

  if (!post) return { title: "Post Not Found" };

  return {
    title: `${post.title} — ${config?.name ?? "Ze Wei"}`,
    description: post.subtitle ?? undefined,
    openGraph: {
      title: post.title,
      description: post.subtitle ?? undefined,
      images: post.cover_image_url ? [post.cover_image_url] : undefined,
      type: "article",
      publishedTime: post.published_at ?? undefined,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const { data: post } = await getPublishedBlogPostBySlug(slug);

  if (!post) notFound();

  const { data: config } = await getPublicSiteConfig();
  const { data: adjacent } = post.published_at
    ? await getAdjacentBlogPosts(post.published_at)
    : { data: { prev: null, next: null } };

  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <article className="max-w-[680px] mx-auto px-6">
      {/* Back link */}
      <Link
        href="/blog"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        All Posts
      </Link>

      {/* Cover image */}
      {post.cover_image_url && (
        <div className="relative w-full aspect-[2/1] rounded-2xl overflow-hidden mb-8">
          <Image
            src={post.cover_image_url}
            alt={post.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 680px"
            priority
          />
        </div>
      )}

      {/* Header */}
      <div className="portfolio-fade-in">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground leading-tight">
          {post.title}
        </h1>

        {post.subtitle && (
          <p className="mt-3 text-xl text-muted-foreground font-light">
            {post.subtitle}
          </p>
        )}

        {/* Author / Meta line */}
        <div className="flex items-center gap-4 mt-5 text-sm text-muted-foreground">
          <span className="font-medium text-foreground/80">
            {config?.name ?? "Ze Wei"}
          </span>
          {formattedDate && (
            <span className="inline-flex items-center gap-1">
              <Calendar size={14} />
              {formattedDate}
            </span>
          )}
          {post.reading_time_minutes && (
            <span className="inline-flex items-center gap-1">
              <Clock size={14} />
              {post.reading_time_minutes} min read
            </span>
          )}
        </div>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {post.tags.map((tag) => (
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
      </div>

      {/* Divider */}
      <hr className="my-8 border-border/30" />

      {/* Content body */}
      {post.content && (
        <div className="portfolio-fade-in" style={{ animationDelay: "200ms" }}>
          <TiptapRenderer content={post.content} className="portfolio-prose" />
        </div>
      )}

      {/* Prev / Next navigation */}
      {adjacent && (adjacent.prev || adjacent.next) && (
        <nav className="mt-16 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {adjacent.prev ? (
            <Link
              href={`/blog/${adjacent.prev.slug}`}
              className="glass-card rounded-2xl p-5 group hover:scale-[1.02] transition-all"
            >
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <ArrowLeft size={12} /> Previous
              </span>
              <span className="mt-1 text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2 block">
                {adjacent.prev.title}
              </span>
            </Link>
          ) : (
            <div />
          )}
          {adjacent.next ? (
            <Link
              href={`/blog/${adjacent.next.slug}`}
              className="glass-card rounded-2xl p-5 group hover:scale-[1.02] transition-all text-right"
            >
              <span className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                Next <ArrowRight size={12} />
              </span>
              <span className="mt-1 text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2 block">
                {adjacent.next.title}
              </span>
            </Link>
          ) : (
            <div />
          )}
        </nav>
      )}
    </article>
  );
}
