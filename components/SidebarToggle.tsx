/**
 * SidebarToggle.tsx
 *
 * Reusable toggle button for feature-level sidebars.
 * Shows a panel icon that changes based on open state.
 * Used in Tasks, Calendar, and Diary pages for consistency.
 */

import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarToggleProps {
  isOpen: boolean;
  onToggle: () => void;
  label?: string;
}

export function SidebarToggle({
  isOpen,
  onToggle,
  label = "Toggle sidebar",
}: SidebarToggleProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-7 w-7"
          aria-label={label}
        >
          {isOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        {isOpen ? "Collapse" : "Expand"} sidebar
      </TooltipContent>
    </Tooltip>
  );
}
