/**
 * BottomNav.tsx
 *
 * Mobile-only bottom navigation bar. Shows 5 primary sections.
 * Hidden on md: and above (desktop uses the sidebar instead).
 * Uses fixed positioning over content.
 * Active state matches AppSidebar active detection logic.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  CalendarDays,
  Dumbbell,
  BarChart3,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BOTTOM_NAV_ITEMS = [
  { href: "/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/exercise", label: "Exercise", icon: Dumbbell },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/diary", label: "Diary", icon: BookOpen },
];

export function BottomNav() {
  const pathname = usePathname();

  // Hide on login page
  if (pathname === "/login") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background border-t safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {BOTTOM_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-1",
                "min-w-[56px] py-2 px-3 rounded-lg transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "fill-primary/10")} />
              <span className="text-[10px] font-medium leading-none">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
