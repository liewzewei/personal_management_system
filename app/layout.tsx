/**
 * Root application layout for PMS.
 *
 * Responsibilities:
 * - Defines global document structure and metadata.
 * - Loads global styles.
 * - Mounts the Toaster for toast notifications.
 * - Wraps app in QueryProvider and TooltipProvider.
 *
 * Layout groups:
 * - (app)       — authenticated PMS pages with sidebar/bottom nav
 * - (portfolio) — public portfolio pages with glassmorphism layout
 */

import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <QueryProvider>
          <TooltipProvider>
            {children}
          </TooltipProvider>
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
