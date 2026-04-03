/**
 * Portfolio layout — public-facing pages with glassmorphism aesthetic.
 *
 * No PMS chrome (no sidebar, no bottom nav). Renders:
 * - Animated gradient background
 * - Floating PortfolioNav
 * - Page content
 */

import { getPublicSiteConfig } from "@/lib/supabase";
import { PortfolioNav } from "@/components/portfolio/PortfolioNav";

export default async function PortfolioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: config } = await getPublicSiteConfig();

  return (
    <div className="portfolio-shell min-h-screen relative">
      {/* Animated gradient background */}
      <div className="portfolio-bg fixed inset-0 -z-10" aria-hidden="true">
        <div className="portfolio-orb portfolio-orb-1" />
        <div className="portfolio-orb portfolio-orb-2" />
        <div className="portfolio-orb portfolio-orb-3" />
      </div>

      <PortfolioNav name={config?.name} />

      <main className="pt-20 pb-16">
        {children}
      </main>
    </div>
  );
}
