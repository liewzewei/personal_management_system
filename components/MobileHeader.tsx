/**
 * MobileHeader.tsx
 *
 * Top bar shown on all pages. Contains:
 * - Hamburger/sidebar toggle (SidebarTrigger from shadcn)
 * - Page title
 * - Optional right-side actions slot
 *
 * On desktop it becomes the collapse/expand toggle for the sidebar.
 */

"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

interface MobileHeaderProps {
  title: string;
  actions?: React.ReactNode;
}

export function MobileHeader({ title, actions }: MobileHeaderProps) {
  return (
    <header className="flex h-12 items-center gap-2 border-b px-4 sticky top-0 bg-background z-10 shrink-0">
      <SidebarTrigger className="-ml-1 hidden md:flex" />
      <Separator orientation="vertical" className="h-4 hidden md:block" />
      <h1 className="font-semibold text-sm flex-1 truncate">{title}</h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
