/**
 * Blog listing page — /blog
 *
 * Displays published blog posts in a responsive grid with glass cards.
 * Server component with SSR for SEO.
 */

import type { Metadata } from "next";
import { getPublishedBlogPosts, getPublicSiteConfig } from "@/lib/supabase";
import { BlogCard } from "@/components/portfolio/BlogCard";

export async function generateMetadata(): Promise<Metadata> {
  const { data: config } = await getPublicSiteConfig();
  return {
    title: `Blog — ${config?.name ?? "Ze Wei"}`,
    description: `Thoughts and writing by ${config?.name ?? "Ze Wei"}`,
  };
}

export default async function BlogPage() {
  const { data: posts } = await getPublishedBlogPosts();

  return (
    <div className="max-w-5xl mx-auto px-6">
      <div className="portfolio-fade-in mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          Blog
        </h1>
        <p className="mt-2 text-muted-foreground text-lg">
          Thoughts, ideas, and things I&apos;ve learned.
        </p>
      </div>

      {posts && posts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {posts.map((post, i) => (
            <div
              key={post.id}
              className="portfolio-fade-in"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <BlogCard post={post} />
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-12 text-center">
          <p className="text-muted-foreground">No blog posts published yet.</p>
        </div>
      )}
    </div>
  );
}
