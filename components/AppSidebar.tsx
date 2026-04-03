/**
 * Main navigation sidebar using shadcn/ui Sidebar component.
 *
 * Behaviour:
 * - Desktop: collapsible between full (16rem) and icon-only (3rem).
 *   Toggle with SidebarTrigger or keyboard shortcut Cmd+B / Ctrl+B.
 * - Mobile: hidden, opens as Sheet drawer from the left
 *   triggered by SidebarTrigger in MobileHeader.
 * Persists state via cookie (handled by SidebarProvider in layout).
 *
 * Preserves overdue badge and sign-out from the old SidebarNav.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardList,
  Dumbbell,
  CalendarDays,
  BarChart3,
  BookOpen,
  Settings,
  LogOut,
  Globe,
  ChevronRight,
  FolderKanban,
  FileText,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

const NAV_ITEMS = [
  { href: "/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/exercise", label: "Exercise", icon: Dumbbell },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/diary", label: "Diary", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

const PORTFOLIO_SUB_ITEMS = [
  { href: "/portfolio-admin/projects", label: "Projects", icon: FolderKanban },
  { href: "/portfolio-admin/blog", label: "Blog", icon: FileText },
  { href: "/portfolio-admin/config", label: "Site Config", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="h-6 w-6 rounded bg-primary shrink-0" />
          <span className="font-semibold truncate group-data-[collapsible=icon]:hidden">
            PMS
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const isActive =
                  pathname === href || pathname.startsWith(href + "/");
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={label}
                    >
                      <a
                        href={href}
                        onClick={(e) => {
                          e.preventDefault();
                          setOpenMobile(false);
                          router.push(href);
                        }}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{label}</span>
                      </a>
                    </SidebarMenuButton>
                    {label === "Tasks" && overdueCount > 0 && (
                      <SidebarMenuBadge>
                        <Badge
                          variant="destructive"
                          className="h-5 min-w-[20px] justify-center px-1.5 text-[10px]"
                        >
                          {overdueCount}
                        </Badge>
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
              {/* Portfolio collapsible sub-menu */}
              <Collapsible
                asChild
                defaultOpen={pathname.startsWith("/portfolio-admin")}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip="Portfolio"
                      isActive={pathname.startsWith("/portfolio-admin")}
                    >
                      <Globe className="h-4 w-4 shrink-0" />
                      <span>Portfolio</span>
                      <ChevronRight className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {PORTFOLIO_SUB_ITEMS.map(({ href, label, icon: SubIcon }) => {
                        const isSubActive =
                          pathname === href || pathname.startsWith(href + "/");
                        return (
                          <SidebarMenuSubItem key={href}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isSubActive}
                            >
                              <a
                                href={href}
                                onClick={(e) => {
                                  e.preventDefault();
                                  setOpenMobile(false);
                                  router.push(href);
                                }}
                              >
                                <SubIcon className="h-4 w-4 shrink-0" />
                                <span>{label}</span>
                              </a>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        {userEmail && (
          <p className="truncate text-xs text-muted-foreground px-2 mb-1 group-data-[collapsible=icon]:hidden">
            {userEmail}
          </p>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleSignOut}
              disabled={signingOut}
              tooltip="Sign out"
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              <span>{signingOut ? "Signing out..." : "Sign out"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
