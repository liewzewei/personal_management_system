/**
 * Application sidebar navigation component.
 *
 * Shows nav items with active state indicators (usePathname),
 * overdue task badge, user email, and sign out button.
 * Caches overdue count for 5 minutes.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardList,
  CalendarDays,
  BarChart3,
  BookOpen,
  Settings,
  LogOut,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Tasks", href: "/tasks", icon: <ClipboardList className="h-4 w-4" /> },
  { label: "Calendar", href: "/calendar", icon: <CalendarDays className="h-4 w-4" /> },
  { label: "Analytics", href: "/analytics", icon: <BarChart3 className="h-4 w-4" /> },
  { label: "Diary", href: "/diary", icon: <BookOpen className="h-4 w-4" /> },
  { label: "Settings", href: "/settings", icon: <Settings className="h-4 w-4" /> },
];

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [overdueCount, setOverdueCount] = useState(0);
  const [signingOut, setSigningOut] = useState(false);

  // Fetch user email
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  // Fetch overdue count — cached for 5 minutes
  const fetchOverdueCount = useCallback(async () => {
    try {
      const cached = sessionStorage.getItem("pms_overdue_count");
      if (cached) {
        const { count, ts } = JSON.parse(cached) as { count: number; ts: number };
        if (Date.now() - ts < 5 * 60 * 1000) {
          setOverdueCount(count);
          return;
        }
      }

      const res = await fetch("/api/analytics?range=all");
      const body = (await res.json()) as {
        data: { overduePatterns: { currentlyOverdue: unknown[] } } | null;
        error: string | null;
      };
      const count = body.data?.overduePatterns?.currentlyOverdue?.length ?? 0;
      setOverdueCount(count);
      sessionStorage.setItem("pms_overdue_count", JSON.stringify({ count, ts: Date.now() }));
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    fetchOverdueCount();
  }, [fetchOverdueCount]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.signOut();
      router.push("/login");
    } catch {
      setSigningOut(false);
    }
  };

  // Don't render sidebar on login page
  if (pathname === "/login") return null;

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r bg-card">
      {/* Logo / App name */}
      <div className="shrink-0 border-b px-4 py-3">
        <h1 className="text-sm font-bold tracking-tight">PMS</h1>
        <p className="text-[10px] text-muted-foreground">Personal Management System</p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "border-l-2 border-l-primary bg-accent font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {item.icon}
              {item.label}
              {item.label === "Tasks" && overdueCount > 0 && (
                <Badge variant="destructive" className="ml-auto h-5 min-w-[20px] justify-center px-1.5 text-[10px]">
                  {overdueCount}
                </Badge>
              )}
            </button>
          );
        })}
      </nav>

      {/* User info + sign out */}
      <div className="shrink-0 border-t px-3 py-3 space-y-2">
        {userEmail && (
          <p className="truncate text-xs text-muted-foreground" title={userEmail}>
            {userEmail}
          </p>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          <LogOut className="mr-2 h-3.5 w-3.5" />
          {signingOut ? "Signing out..." : "Sign out"}
        </Button>
      </div>
    </aside>
  );
}
