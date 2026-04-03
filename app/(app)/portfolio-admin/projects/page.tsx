/**
 * Portfolio admin projects page — /portfolio-admin/projects
 *
 * Renders the projects management tab within PMS chrome.
 */

"use client";

import { MobileHeader } from "@/components/MobileHeader";
import { AdminProjectsTab } from "@/components/portfolio/AdminProjectsTab";

export default function PortfolioAdminProjectsPage() {
  return (
    <div className="flex flex-col h-full">
      <MobileHeader title="Projects" />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <AdminProjectsTab />
        </div>
      </div>
    </div>
  );
}
