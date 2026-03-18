/**
 * Root application layout for PMS.
 *
 * Responsibilities:
 * - Defines global document structure and metadata.
 * - Loads global styles.
 * - Mounts the Toaster for toast notifications.
 * - Wraps app in SidebarProvider (cookie-persisted sidebar state).
 * - Renders collapsible AppSidebar + mobile BottomNav.
 */

import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { BottomNav } from "@/components/BottomNav";
import { QueryProvider } from "@/components/QueryProvider";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "PMS (Personal Management System)",
  description: "A single-user personal productivity system.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <QueryProvider>
          <TooltipProvider>
            <SidebarProvider defaultOpen={defaultOpen}>
              <AppSidebar />
              <SidebarInset className="flex-1 overflow-y-auto min-w-0 pb-16 md:pb-0">
                {children}
              </SidebarInset>
              <BottomNav />
            </SidebarProvider>
          </TooltipProvider>
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
