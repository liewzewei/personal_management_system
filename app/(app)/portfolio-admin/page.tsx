/**
 * Portfolio admin default page — /portfolio-admin
 *
 * Empty state prompting the user to select a section from the sidebar.
 */

import { MobileHeader } from "@/components/MobileHeader";
import { Globe } from "lucide-react";

export default function PortfolioAdminPage() {
  return (
    <div className="flex flex-col h-full">
      <MobileHeader title="Portfolio Admin" />

      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <Globe className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Select a section from the sidebar to get started.
        </p>
      </div>
    </div>
  );
}
