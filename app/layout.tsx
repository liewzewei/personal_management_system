/**
 * Root application layout for PMS.
 *
 * Responsibilities:
 * - Defines global document structure and metadata.
 * - Loads global styles.
 * - Provides a minimal, consistent page container.
 *
 * Note: Feature UI (tasks/calendar/diary/analytics) is intentionally not built yet.
 */

import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}

