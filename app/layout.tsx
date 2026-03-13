/**
 * Root application layout for PMS.
 *
 * Responsibilities:
 * - Defines global document structure and metadata.
 * - Loads global styles.
 * - Mounts the Toaster for toast notifications.
 * - Renders the sidebar navigation alongside page content.
 */

import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toaster";
import { SidebarNav } from "@/components/SidebarNav";
import { QueryProvider } from "@/components/QueryProvider";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "PMS (Personal Management System)",
  description: "A single-user personal productivity system.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <QueryProvider>
          <div className="flex h-screen overflow-hidden">
            <SidebarNav />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
