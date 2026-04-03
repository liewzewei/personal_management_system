/**
 * Exercise page — Tab navigation for Running, Swimming, Calories, Analytics.
 *
 * Lazy-loads each tab using Next.js dynamic imports (ssr: false).
 * Default tab: Running.
 * Fetches user preferences for distance_unit and weight_kg.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileHeader } from "@/components/MobileHeader";
import type { DistanceUnit, UserPreferences } from "@/types";

const RunningTab = dynamic(
  () => import("@/components/exercise/RunningTab").then((m) => ({ default: m.RunningTab })),
  { ssr: false, loading: () => <TabLoader /> }
);

const SwimmingTab = dynamic(
  () => import("@/components/exercise/SwimmingTab").then((m) => ({ default: m.SwimmingTab })),
  { ssr: false, loading: () => <TabLoader /> }
);

const CaloriesTab = dynamic(
  () => import("@/components/exercise/CaloriesTab").then((m) => ({ default: m.CaloriesTab })),
  { ssr: false, loading: () => <TabLoader /> }
);

const AnalyticsTab = dynamic(
  () => import("@/components/exercise/AnalyticsTab").then((m) => ({ default: m.AnalyticsTab })),
  { ssr: false, loading: () => <TabLoader /> }
);

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

type TabKey = "running" | "swimming" | "calories" | "analytics";

const TABS: { key: TabKey; label: string }[] = [
  { key: "running", label: "Running" },
  { key: "swimming", label: "Swimming" },
  { key: "calories", label: "Calories" },
  { key: "analytics", label: "Analytics" },
];

export default function ExercisePage() {
  const [activeTab, setActiveTab] = useState<TabKey>("running");
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>("km");
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [prefsVersion, setPrefsVersion] = useState(0);

  // Fetch user preferences
  useEffect(() => {
    async function loadPrefs() {
      try {
        const res = await fetch("/api/calendar/preferences");
        if (!res.ok) return;
        const body = (await res.json()) as { data: UserPreferences | null };
        if (body.data) {
          setPreferences(body.data);
          if (body.data.distance_unit === "miles") setDistanceUnit("miles");
          if (body.data.weight_kg) setWeightKg(Number(body.data.weight_kg));
        }
      } catch {
        // Non-critical — use defaults
      }
    }
    loadPrefs();
  }, [prefsVersion]);

  const handlePreferencesUpdate = useCallback(() => {
    setPrefsVersion((v) => v + 1);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <MobileHeader title="Exercise" />

      {/* Tab Navigation — scrollable on mobile */}
      <div className="border-b bg-card overflow-x-auto scrollbar-none shrink-0">
        <nav className="flex gap-0 px-4 md:px-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px shrink-0",
                activeTab === tab.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              )}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        {activeTab === "running" && (
          <RunningTab distanceUnit={distanceUnit} weightKg={weightKg} />
        )}
        {activeTab === "swimming" && (
          <SwimmingTab distanceUnit={distanceUnit} weightKg={weightKg} />
        )}
        {activeTab === "calories" && (
          <CaloriesTab preferences={preferences} onPreferencesUpdate={handlePreferencesUpdate} />
        )}
        {activeTab === "analytics" && (
          <AnalyticsTab />
        )}
      </main>
    </div>
  );
}
