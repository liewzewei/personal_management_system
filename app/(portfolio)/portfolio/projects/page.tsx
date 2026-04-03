/**
 * Portfolio projects grid page — /portfolio/projects
 *
 * Displays published projects in a responsive grid with glass cards.
 * Server component with SSR for SEO.
 */

import type { Metadata } from "next";
import { getPublishedProjects, getPublicSiteConfig } from "@/lib/supabase";
import { ProjectCard } from "@/components/portfolio/ProjectCard";

export async function generateMetadata(): Promise<Metadata> {
  const { data: config } = await getPublicSiteConfig();
  return {
    title: `Projects — ${config?.name ?? "Ze Wei"}`,
    description: `Explore projects by ${config?.name ?? "Ze Wei"}`,
  };
}

export default async function ProjectsPage() {
  const { data: projects } = await getPublishedProjects();

  return (
    <div className="max-w-5xl mx-auto px-6">
      <div className="portfolio-fade-in mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          Projects
        </h1>
        <p className="mt-2 text-muted-foreground text-lg">
          A selection of things I&apos;ve built and explored.
        </p>
      </div>

      {projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {projects.map((project, i) => (
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
  );
}
