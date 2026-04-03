/**
 * Portfolio single-page scroll — /portfolio
 *
 * Three full-viewport sections stacked vertically:
 * 1. Hero — name, tagline, bio, social links, scroll arrow
 * 2. Projects — top 3 published projects + "All Projects" link
 * 3. Blog — top 3 published blog posts + "All Posts" link
 *
 * Data fetched via service role SSR for SEO.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  getPublicSiteConfig,
  getPublishedProjects,
  getPublishedBlogPosts,
} from "@/lib/supabase";
import { Github, Linkedin, Mail, ArrowRight } from "lucide-react";
import { ProjectCard } from "@/components/portfolio/ProjectCard";
import { BlogCard } from "@/components/portfolio/BlogCard";
import { ScrollArrow } from "@/components/portfolio/ScrollArrow";

export async function generateMetadata(): Promise<Metadata> {
  const { data: config } = await getPublicSiteConfig();
  return {
    title: config?.seo_title ?? `${config?.name ?? "Ze Wei"} — Portfolio`,
    description: config?.seo_description ?? config?.tagline ?? "Building What's Next",
  };
}

export default async function PortfolioPage() {
  const [{ data: config }, { data: projects }, { data: posts }] = await Promise.all([
    getPublicSiteConfig(),
    getPublishedProjects(),
    getPublishedBlogPosts(),
  ]);

  const name = config?.name ?? "Ze Wei";
  const tagline = config?.tagline ?? "Building What's Next";
  const bio = config?.bio;
  const topProjects = (projects ?? []).slice(0, 3);
  const topPosts = (posts ?? []).slice(0, 3);

  return (
    <>
      {/* ── Hero Section ──────────────────────────────────────────────── */}
      <section
        id="hero"
        className="flex flex-col items-center justify-center min-h-[calc(100vh-5rem)] px-6 text-center relative"
      >
        <div className="portfolio-fade-in max-w-2xl">
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight bg-gradient-to-br from-foreground via-foreground/80 to-foreground/60 bg-clip-text text-transparent">
            {name}
          </h1>

          <p className="mt-4 text-xl sm:text-2xl text-muted-foreground font-light tracking-wide">
            {tagline}
          </p>

          {bio && (
            <p className="mt-6 text-base text-muted-foreground/80 max-w-lg mx-auto leading-relaxed">
              {bio}
            </p>
          )}

          {/* Social links */}
          <div className="flex items-center justify-center gap-4 mt-8">
            {config?.social_github && (
              <a
                href={config.social_github}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-card p-3 rounded-xl text-muted-foreground hover:text-foreground hover:scale-110 transition-all"
                aria-label="GitHub"
              >
                <Github size={20} />
              </a>
            )}
            {config?.social_linkedin && (
              <a
                href={config.social_linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-card p-3 rounded-xl text-muted-foreground hover:text-foreground hover:scale-110 transition-all"
                aria-label="LinkedIn"
              >
                <Linkedin size={20} />
              </a>
            )}
            {config?.social_email && (
              <a
                href={`mailto:${config.social_email}`}
                className="glass-card p-3 rounded-xl text-muted-foreground hover:text-foreground hover:scale-110 transition-all"
                aria-label="Email"
              >
                <Mail size={20} />
              </a>
            )}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <ScrollArrow targetId="projects" />
        </div>
      </section>

      {/* ── Projects Section ──────────────────────────────────────────── */}
      <section
        id="projects"
        className="min-h-screen flex flex-col justify-center px-6 py-20"
      >
        <div className="max-w-5xl mx-auto w-full">
          <div className="flex items-center justify-between mb-10 portfolio-fade-in">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                Projects
              </h2>
              <p className="mt-2 text-muted-foreground text-lg">
                A selection of things I&apos;ve built and explored.
              </p>
            </div>
            <Link
              href="/portfolio/projects"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline shrink-0"
            >
              All Projects
              <ArrowRight size={14} />
            </Link>
          </div>

          {topProjects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {topProjects.map((project, i) => (
                <div
                  key={project.id}
                  className="portfolio-fade-in"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <ProjectCard project={project} />
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-12 text-center">
              <p className="text-muted-foreground">No projects published yet.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Blog Section ──────────────────────────────────────────────── */}
      <section
        id="blog"
        className="min-h-screen flex flex-col justify-center px-6 py-20"
      >
        <div className="max-w-5xl mx-auto w-full">
          <div className="flex items-center justify-between mb-10 portfolio-fade-in">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                Blog
              </h2>
              <p className="mt-2 text-muted-foreground text-lg">
                Thoughts, ideas, and things I&apos;ve learned.
              </p>
            </div>
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline shrink-0"
            >
              All Posts
              <ArrowRight size={14} />
            </Link>
          </div>

          {topPosts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {topPosts.map((post, i) => (
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
      </section>
    </>
  );
}
