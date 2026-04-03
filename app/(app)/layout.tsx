/**
 * App layout for authenticated PMS pages.
 *
 * Contains the sidebar, mobile nav, and main content area.
 * This layout wraps all authenticated app pages (tasks, calendar, etc.)
 * but NOT the public portfolio pages.
 */

import { cookies } from "next/headers";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { BottomNav } from "@/components/BottomNav";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen} className="!h-svh">
      <AppSidebar />
      <SidebarInset className="flex-1 overflow-y-auto min-w-0 pb-16 md:pb-0">
        {children}
      </SidebarInset>
      <BottomNav />
    </SidebarProvider>
  );
}
