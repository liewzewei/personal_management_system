/**
 * Portfolio admin blog page — /portfolio-admin/blog
 *
 * Renders the blog posts management tab within PMS chrome.
 */

"use client";

import { MobileHeader } from "@/components/MobileHeader";
import { AdminBlogTab } from "@/components/portfolio/AdminBlogTab";

export default function PortfolioAdminBlogPage() {
  return (
    <div className="flex flex-col h-full">
      <MobileHeader title="Blog Posts" />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <AdminBlogTab />
        </div>
      </div>
    </div>
  );
}
