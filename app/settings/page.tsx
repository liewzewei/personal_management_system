/**
 * Settings page — Outlook calendar feeds management + calendar preferences.
 *
 * Section 1: Outlook Calendar Feeds
 * - Instructions panel (collapsible)
 * - Feed list table with status, sync now, edit, delete actions
 * - Add/edit feed inline form
 *
 * Section 2: Calendar Preferences
 * - Default view (month/week/day)
 * - Week starts on (Sunday/Monday)
 * - Timezone display (read-only)
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Check,
  AlertCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MobileHeader } from "@/components/MobileHeader";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/lib/hooks/use-toast";
import type { IcalFeed, SyncResult, UserPreferences } from "@/types";

const PRESET_COLORS = [
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#F59E0B",
  "#10B981",
  "#EF4444",
  "#06B6D4",
  "#6B7280",
];

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Never synced";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function SettingsPage() {
  const { toast } = useToast();

  // Feeds state
  const [feeds, setFeeds] = useState<IcalFeed[]>([]);
  const [loadingFeeds, setLoadingFeeds] = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingFeedId, setEditingFeedId] = useState<string | null>(null);
  const [syncingFeedId, setSyncingFeedId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formType, setFormType] = useState("");
  const [formColor, setFormColor] = useState(PRESET_COLORS[0]);
  const [formSaving, setFormSaving] = useState(false);

  // Preferences state
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [defaultView, setDefaultView] = useState("dayGridMonth");
  const [weekStartsOn, setWeekStartsOn] = useState("monday");
  const [savingPrefs, setSavingPrefs] = useState(false);

  const fetchFeeds = useCallback(async () => {
    try {
      const res = await fetch("/api/calendar/feeds");
      const body = (await res.json()) as { data: IcalFeed[] | null };
      if (body.data) {
        setFeeds(body.data);
        if (body.data.length === 0) setShowInstructions(true);
      }
    } catch {
      toast({ title: "Failed to load feeds", variant: "destructive" });
    } finally {
      setLoadingFeeds(false);
    }
  }, [toast]);

  useEffect(() => {
    // Fetch feeds and preferences in parallel
    Promise.all([
      fetchFeeds(),
      fetch("/api/calendar/preferences")
        .then(async (res) => {
          const body = (await res.json()) as { data: UserPreferences | null };
          if (body.data) {
            setPrefs(body.data);
            setDefaultView(body.data.calendar_default_view);
            setWeekStartsOn(body.data.calendar_week_starts_on);
          }
        })
        .catch(() => {}),
    ]);
  }, [fetchFeeds]);

  function resetForm() {
    setFormName("");
    setFormUrl("");
    setFormType("");
    setFormColor(PRESET_COLORS[0]);
    setEditingFeedId(null);
  }

  function startEdit(feed: IcalFeed) {
    setEditingFeedId(feed.id);
    setFormName(feed.name);
    setFormUrl(feed.ical_url);
    setFormType(feed.calendar_type);
    setFormColor(feed.color ?? PRESET_COLORS[0]);
    setShowAddForm(true);
  }

  async function handleSaveFeed() {
    if (!formName.trim() || !formUrl.trim() || !formType.trim()) return;
    setFormSaving(true);

    try {
      if (editingFeedId) {
        // Update existing feed
        const res = await fetch(`/api/calendar/feeds/${editingFeedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            ical_url: formUrl.trim(),
            calendar_type: formType.trim().toUpperCase(),
            color: formColor,
          }),
        });
        if (!res.ok) {
          const body = (await res.json()) as { error: string };
          toast({ title: body.error || "Failed to update feed", variant: "destructive" });
          return;
        }
        toast({ title: "Feed updated" });
      } else {
        // Create new feed
        const res = await fetch("/api/calendar/feeds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            ical_url: formUrl.trim(),
            calendar_type: formType.trim().toUpperCase(),
            color: formColor,
          }),
        });
        if (!res.ok) {
          const body = (await res.json()) as { error: string };
          toast({ title: body.error || "Failed to create feed", variant: "destructive" });
          return;
        }
        const body = (await res.json()) as { data: { feed: IcalFeed; syncResult: SyncResult | null } };
        const syncResult = body.data?.syncResult;
        if (syncResult && syncResult.added > 0) {
          toast({ title: `Feed added. ${syncResult.added} events imported.` });
        } else {
          toast({ title: "Feed added" });
        }
      }

      resetForm();
      setShowAddForm(false);
      await fetchFeeds();
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setFormSaving(false);
    }
  }

  async function handleDeleteFeed(feedId: string) {
    try {
      const res = await fetch(`/api/calendar/feeds/${feedId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast({ title: "Feed deleted" });
      await fetchFeeds();
    } catch {
      toast({ title: "Failed to delete feed", variant: "destructive" });
    }
  }

  async function handleSyncFeed(feedId: string) {
    setSyncingFeedId(feedId);
    try {
      const res = await fetch(`/api/calendar/sync/${feedId}`, { method: "POST" });
      const body = (await res.json()) as { data: SyncResult | null };
      if (body.data) {
        const { added, updated, deleted: del } = body.data;
        toast({ title: `Synced: ${added} added, ${updated} updated, ${del} removed` });
      }
      await fetchFeeds();
    } catch {
      toast({ title: "Sync failed", variant: "destructive" });
    } finally {
      setSyncingFeedId(null);
    }
  }

  async function handleSavePreferences() {
    setSavingPrefs(true);
    try {
      const res = await fetch("/api/calendar/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendar_default_view: defaultView,
          calendar_week_starts_on: weekStartsOn,
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Preferences saved" });
    } catch {
      toast({ title: "Failed to save preferences", variant: "destructive" });
    } finally {
      setSavingPrefs(false);
    }
  }

  const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="flex flex-col h-full">
      <MobileHeader title="Settings" />
      <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl p-4 md:p-6 space-y-8 w-full">

      {/* ============================== */}
      {/* Section 1: Outlook Calendar Feeds */}
      {/* ============================== */}
      <section id="outlook" className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Outlook Calendars</h2>
          <p className="text-sm text-muted-foreground">
            Import your Outlook calendars using iCal links. Changes in Outlook sync here automatically.
          </p>
        </div>

        {/* Instructions */}
        <div className="border rounded-lg">
          <button
            className="flex w-full items-center justify-between p-3 text-sm font-medium hover:bg-accent/50 transition-colors"
            onClick={() => setShowInstructions(!showInstructions)}
          >
            <span>How to get your iCal URL from Outlook</span>
            {showInstructions ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {showInstructions && (
            <div className="border-t p-3 text-sm text-muted-foreground space-y-1.5">
              <p>Go to <a href="https://outlook.office.com" className="underline text-primary" target="_blank" rel="noopener noreferrer">outlook.office.com</a></p>
              <ol className="list-decimal list-inside space-y-1 ml-1">
                <li>Click Settings (gear icon) → View all Outlook settings</li>
                <li>Go to Calendar → Shared calendars</li>
                <li>Under &quot;Publish a calendar&quot;, select a calendar</li>
                <li>Set permission to &quot;Can view all details&quot;</li>
                <li>Copy the ICS link and paste it below</li>
              </ol>
            </div>
          )}
        </div>

        {/* Feed table */}
        {loadingFeeds ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading feeds...
          </div>
        ) : feeds.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Feed</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-left p-3 font-medium">Last Synced</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {feeds.map((feed) => (
                  <tr key={feed.id} className="border-b last:border-b-0 hover:bg-accent/30">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: feed.color ?? "#6B7280" }}
                        />
                        <span className="font-medium">{feed.name}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs">
                        {feed.calendar_type}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {feed.last_synced_at ? (
                        <span className="flex items-center gap-1 text-green-700">
                          <Check className="h-3 w-3" />
                          {formatRelativeTime(feed.last_synced_at)}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600">
                          <AlertCircle className="h-3 w-3" />
                          Never synced
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleSyncFeed(feed.id)}
                          disabled={syncingFeedId === feed.id}
                          title="Sync now"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${syncingFeedId === feed.id ? "animate-spin" : ""}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => startEdit(feed)}
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteFeed(feed.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* Add/Edit form */}
        {showAddForm ? (
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold">
              {editingFeedId ? "Edit Feed" : "Add Calendar Feed"}
            </h3>

            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="feed-name">Name</Label>
                <Input
                  id="feed-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. NUS Lectures, Personal, Birthdays"
                  className="text-base sm:text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="feed-url">iCal URL</Label>
                <Input
                  id="feed-url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://outlook.office365.com/owa/calendar/..."
                  className="text-base sm:text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="feed-type">Calendar Type</Label>
                <Input
                  id="feed-type"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value.toUpperCase())}
                  placeholder="e.g. LECTURES, PERSONAL, BIRTHDAYS"
                  className="text-base sm:text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  This becomes the calendar type tag on all imported events.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Colour</Label>
                <div className="flex gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      className={`h-7 w-7 rounded-full border-2 transition-transform ${
                        formColor === c ? "border-foreground scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => setFormColor(c)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSaveFeed} disabled={formSaving || !formName.trim() || !formUrl.trim() || !formType.trim()}>
                {formSaving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {editingFeedId ? "Update Feed" : "Save & Sync"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  resetForm();
                  setShowAddForm(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetForm();
              setShowAddForm(true);
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Calendar Feed
          </Button>
        )}
      </section>

      {/* ============================== */}
      {/* Section 2: Calendar Preferences */}
      {/* ============================== */}
      <section className="space-y-4 border-t pt-6">
        <div>
          <h2 className="text-lg font-semibold">Calendar Preferences</h2>
          <p className="text-sm text-muted-foreground">
            Customize how the calendar displays.
          </p>
        </div>

        <div className="space-y-4 max-w-sm">
          <div className="space-y-1.5">
            <Label htmlFor="default-view">Default View</Label>
            <select
              id="default-view"
              value={defaultView}
              onChange={(e) => setDefaultView(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="dayGridMonth">Month</option>
              <option value="timeGridWeek">Week</option>
              <option value="timeGridDay">Day</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="week-start">Week Starts On</Label>
            <select
              id="week-start"
              value={weekStartsOn}
              onChange={(e) => setWeekStartsOn(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="monday">Monday</option>
              <option value="sunday">Sunday</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Time Zone</Label>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {detectedTz}
            </div>
          </div>

          <Button onClick={handleSavePreferences} disabled={savingPrefs}>
            {savingPrefs && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Save Preferences
          </Button>
        </div>
      </section>
    </div>
    </main>
    </div>
  );
}
