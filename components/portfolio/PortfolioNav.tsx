/**
 * Floating glassmorphic navigation bar for the public portfolio site.
 *
 * Fixed at top, transparent blur background, name/brand on left,
 * nav links on right, mobile hamburger menu.
 *
 * On the main `/portfolio` page, links smooth-scroll to section anchors.
 * On detail pages, links navigate to `/portfolio#section`.
 */

"use client";

import { useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { anchor: "hero", label: "Home" },
  { anchor: "projects", label: "Projects" },
  { anchor: "blog", label: "Blog" },
];

interface PortfolioNavProps {
  name?: string;
}

export function PortfolioNav({ name = "Ze Wei" }: PortfolioNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isHomePage = pathname === "/portfolio";

  const handleNavClick = useCallback(
    (anchor: string) => {
      setMobileOpen(false);
      if (isHomePage) {
        const el = document.getElementById(anchor);
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
          return;
        }
      }
      router.push(`/portfolio#${anchor}`);
    },
    [isHomePage, router]
  );

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-3xl">
      <div className="glass-card rounded-2xl px-6 py-3 flex items-center justify-between">
        {/* Brand */}
        <button
          type="button"
          onClick={() => handleNavClick("hero")}
          className="font-semibold text-lg tracking-tight text-foreground hover:text-primary transition-colors"
        >
          {name}
        </button>

        {/* Desktop links */}
        <div className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map(({ anchor, label }) => (
            <button
              key={anchor}
              type="button"
              onClick={() => handleNavClick(anchor)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                "text-muted-foreground hover:text-foreground hover:bg-white/10"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          className="sm:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="sm:hidden glass-card rounded-2xl mt-2 px-4 py-3 flex flex-col gap-1">
          {NAV_LINKS.map(({ anchor, label }) => (
            <button
              key={anchor}
              type="button"
              onClick={() => handleNavClick(anchor)}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
                "text-muted-foreground hover:text-foreground hover:bg-white/10"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}
