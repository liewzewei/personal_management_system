/**
 * Client component for the hero section scroll-down arrow.
 *
 * Smooth-scrolls to a target section ID when clicked.
 */

"use client";

import { ArrowDown } from "lucide-react";

interface ScrollArrowProps {
  targetId: string;
}

export function ScrollArrow({ targetId }: ScrollArrowProps) {
  const handleClick = () => {
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="animate-bounce text-muted-foreground/40 hover:text-muted-foreground transition-colors"
      aria-label="Scroll to next section"
    >
      <ArrowDown size={24} />
    </button>
  );
}
