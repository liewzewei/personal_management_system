/**
 * Portfolio admin site config page — /portfolio-admin/config
 *
 * Renders the site configuration tab within PMS chrome.
 */

"use client";

import { MobileHeader } from "@/components/MobileHeader";
import { AdminConfigTab } from "@/components/portfolio/AdminConfigTab";

export default function PortfolioAdminConfigPage() {
  return (
    <div className="flex flex-col h-full">
      <MobileHeader title="Site Config" />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <AdminConfigTab />
        </div>
      </div>
    </div>
  );
}
