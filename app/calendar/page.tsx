/**
 * Calendar page — main calendar interface.
 *
 * Layout:
 * - Left sidebar (~240px): sync controls, calendar type filters with colour checkboxes.
 * - Main area: FullCalendar (month / week / day views).
 *
 * On load, checks if any iCal feed needs syncing (>10 min stale) and
 * triggers a background sync. Events are fetched from the API per view range.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg, EventClickArg, DatesSetArg, EventInput } from "@fullcalendar/core";
import { RefreshCw, Check, AlertTriangle, Settings, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { EventModal, type EventFormData } from "@/components/calendar/EventModal";
import { MobileHeader } from "@/components/MobileHeader";
import { SidebarToggle } from "@/components/SidebarToggle";
import { useSidebarState } from "@/lib/hooks/useSidebarState";
import { useCalendarEvents } from "@/lib/hooks/useCalendarEvents";
import { useToast } from "@/lib/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { CalendarEvent, IcalFeed } from "@/types";

/** Default colour palette for calendar types that have no feed colour. */
const TYPE_COLORS: Record<string, string> = {
  TASKS: "#F59E0B",
  LOCAL: "#3B82F6",
  LECTURES: "#8B5CF6",
  PERSONAL: "#10B981",
  BIRTHDAYS: "#EC4899",
};

function getTypeColor(type: string, feeds: IcalFeed[]): string {
  const feed = feeds.find((f) => f.calendar_type === type);
  if (feed?.color) return feed.color;
  return TYPE_COLORS[type] ?? "#6B7280";
}

export default function CalendarPage() {
  const calendarRef = useRef<FullCalendar>(null);
  const { toast } = useToast();

  // State
  const [feeds, setFeeds] = useState<IcalFeed[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncedJustNow, setSyncedJustNow] = useState(false);
  const [currentRange, setCurrentRange] = useState<{ start: string; end: string } | null>(null);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());

  // React Query cached calendar events
  const { events, refetch: refetchEvents } = useCalendarEvents(currentRange);

  // EventModal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [defaultStart, setDefaultStart] = useState<string | null>(null);
  const [defaultAllDay, setDefaultAllDay] = useState(false);

  // Feature sidebar state
  const filterSidebar = useSidebarState("calendar-filters", true);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // User preferences
  const [defaultView, setDefaultView] = useState("dayGridMonth");
  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(1); // 1=monday

  // Fetch preferences + feeds in parallel on mount
  useEffect(() => {
    Promise.all([
      fetch("/api/calendar/preferences").then(async (res) => {
        const body = (await res.json()) as { data: { calendar_default_view: string; calendar_week_starts_on: string } | null };
        if (body.data) {
          setDefaultView(body.data.calendar_default_view);
          setWeekStartsOn(body.data.calendar_week_starts_on === "sunday" ? 0 : 1);
        }
      }),
      fetch("/api/calendar/feeds").then(async (res) => {
        const body = (await res.json()) as { data: IcalFeed[] | null };
        if (body.data) setFeeds(body.data);
      }),
    ]).catch(() => {});
  }, []);

  // Auto-sync stale feeds on mount
  useEffect(() => {
    if (feeds.length === 0) return;
    const TEN_MINUTES = 10 * 60 * 1000;
    const needsSync = feeds.some((f) => {
      if (!f.is_active) return false;
      if (!f.last_synced_at) return true;
      return Date.now() - new Date(f.last_synced_at).getTime() > TEN_MINUTES;
    });
    if (needsSync) {
      // Background sync — don't await
      triggerSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feeds.length]);

  function handleDatesSet(arg: DatesSetArg) {
    const start = arg.start.toISOString();
    const end = arg.end.toISOString();
    setCurrentRange({ start, end });
  }

  // Compute calendar types from events
  const calendarTypes = useMemo(() => {
    const types = new Set<string>();
    for (const evt of events) {
      if (evt.calendar_type) types.add(evt.calendar_type);
    }
    // Always include TASKS and LOCAL
    types.add("TASKS");
    types.add("LOCAL");
    return Array.from(types).sort();
  }, [events]);

  // Compute type counts (events in current range)
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const evt of events) {
      const t = evt.calendar_type ?? "LOCAL";
      counts[t] = (counts[t] ?? 0) + 1;
    }
    return counts;
  }, [events]);

  // Convert events to FullCalendar format
  const fcEvents: EventInput[] = useMemo(() => {
    return events
      .filter((evt) => !hiddenTypes.has(evt.calendar_type ?? "LOCAL"))
      .map((evt) => {
        const color = getTypeColor(evt.calendar_type ?? "LOCAL", feeds);
        let titlePrefix = "";
        if (evt.source === "outlook") titlePrefix = "📅 ";
        if (evt.calendar_type === "TASKS") titlePrefix = "✓ ";

        return {
          id: evt.id,
          title: `${titlePrefix}${evt.title}`,
          start: evt.start_time,
          end: evt.end_time,
          allDay: evt.is_all_day,
          backgroundColor: color,
          borderColor: color,
          extendedProps: { calendarEvent: evt },
        };
      });
  }, [events, hiddenTypes, feeds]);

  // Toggle a calendar type filter
  function toggleType(type: string) {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  // Sync all feeds
  async function triggerSync() {
    setSyncing(true);
    setSyncedJustNow(false);
    try {
      const res = await fetch("/api/calendar/sync", { method: "POST" });
      const body = (await res.json()) as { data: { total_added: number; total_updated: number; total_deleted: number } | null };
      if (body.data) {
        const { total_added, total_updated, total_deleted } = body.data;
        if (total_added + total_updated + total_deleted > 0) {
          toast({
            title: `Synced: ${total_added} added, ${total_updated} updated, ${total_deleted} removed`,
          });
        }
      }
      setSyncedJustNow(true);
      // Refresh events and feeds
      refetchEvents();
      const feedsRes = await fetch("/api/calendar/feeds");
      const feedsBody = (await feedsRes.json()) as { data: IcalFeed[] | null };
      if (feedsBody.data) setFeeds(feedsBody.data);
    } catch {
      toast({ title: "Sync failed. Check your feed URLs in Settings.", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  // Calendar navigation helpers
  function goToday() { calendarRef.current?.getApi().today(); }
  function goPrev() { calendarRef.current?.getApi().prev(); }
  function goNext() { calendarRef.current?.getApi().next(); }

  // Event click → open modal in view/edit mode
  function handleEventClick(arg: EventClickArg) {
    const calEvent = arg.event.extendedProps.calendarEvent as CalendarEvent;
    setEditingEvent(calEvent);
    setDefaultStart(null);
    setDefaultAllDay(false);
    setModalOpen(true);
  }

  // Slot select → open modal in create mode
  function handleDateSelect(arg: DateSelectArg) {
    setEditingEvent(null);
    setDefaultStart(arg.startStr);
    setDefaultAllDay(arg.allDay);
    setModalOpen(true);
    // Deselect the range
    calendarRef.current?.getApi().unselect();
  }

  // Save handler
  async function handleSave(data: EventFormData) {
    try {
      if (editingEvent) {
        const res = await fetch(`/api/calendar/events/${editingEvent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const body = (await res.json()) as { error: string };
          toast({ title: body.error || "Failed to update event", variant: "destructive" });
          return;
        }
        toast({ title: "Event updated" });
      } else {
        const res = await fetch("/api/calendar/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error();
        toast({ title: "Event created" });
      }
      setModalOpen(false);
      refetchEvents();
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    }
  }

  // Delete handler
  async function handleDelete(eventId: string) {
    try {
      const res = await fetch(`/api/calendar/events/${eventId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json()) as { error: string };
        toast({ title: body.error || "Failed to delete event", variant: "destructive" });
        return;
      }
      toast({ title: "Event deleted" });
      setModalOpen(false);
      refetchEvents();
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    }
  }

  const hasFeeds = feeds.length > 0;
  const hasNeverSynced = feeds.some((f) => !f.last_synced_at);

  const filterContent = (
    <div className="p-4 space-y-5">
      {/* Navigation */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Sync section */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Outlook Sync
        </h3>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={triggerSync}
          disabled={syncing || !hasFeeds}
        >
          {syncing ? (
            <>
              <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
              Syncing...
            </>
          ) : syncedJustNow ? (
            <>
              <Check className="mr-2 h-3.5 w-3.5 text-green-600" />
              Synced just now
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Sync Outlook
            </>
          )}
        </Button>
        {!hasFeeds && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-800">
              No Outlook feeds connected.{" "}
              <a href="/settings#outlook" className="underline font-medium">
                Add one in Settings
              </a>
            </div>
          </div>
        )}
        {hasFeeds && hasNeverSynced && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800">
              Some feeds have never been synced. Click Sync Outlook above.
            </p>
          </div>
        )}
      </div>

      {/* Calendar type filters */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          My Calendars
        </h3>
        <div className="space-y-1">
          {calendarTypes.map((type) => {
            const color = getTypeColor(type, feeds);
            const isHidden = hiddenTypes.has(type);
            const count = typeCounts[type] ?? 0;
            return (
              <button
                key={type}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                onClick={() => toggleType(type)}
              >
                <div
                  className={cn(
                    "h-3 w-3 rounded-sm border transition-colors",
                    isHidden ? "bg-transparent" : ""
                  )}
                  style={{
                    borderColor: color,
                    backgroundColor: isHidden ? "transparent" : color,
                  }}
                />
                <span className={cn("flex-1 text-left truncate", isHidden && "text-muted-foreground line-through")}>
                  {type}
                </span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {count}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>

      {/* Settings link */}
      <div className="pt-2 border-t">
        <a
          href="/settings#outlook"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings className="h-3.5 w-3.5" />
          Add Outlook Feed
        </a>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <MobileHeader
        title="Calendar"
        actions={
          <div className="hidden md:flex">
            <SidebarToggle
              isOpen={filterSidebar.isOpen}
              onToggle={filterSidebar.toggle}
              label="Toggle calendar filters"
            />
          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Filter sidebar — desktop only, collapsible */}
        {filterSidebar.isOpen && (
          <aside className="hidden md:flex flex-col border-r bg-card w-[240px] shrink-0">
            <ScrollArea className="h-full">
              {filterContent}
            </ScrollArea>
          </aside>
        )}

        {/* Calendar main area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Mobile: filter sheet trigger */}
          <div className="md:hidden flex items-center gap-2 px-4 py-2 border-b shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilterSheetOpen(true)}
            >
              <Filter className="h-4 w-4 mr-1" /> Filters
            </Button>
          </div>

          {/* FullCalendar */}
          <div className="flex-1 p-2 md:p-4 overflow-hidden [&_.fc]:h-full [&_.fc-toolbar]:flex-wrap [&_.fc-toolbar-title]:text-sm [&_.fc-button]:text-xs [&_.fc-button]:px-2 md:[&_.fc-toolbar-title]:text-lg md:[&_.fc-button]:text-sm md:[&_.fc-button]:px-2.5">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView={defaultView}
              firstDay={weekStartsOn}
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay",
              }}
              events={fcEvents}
              editable={false}
              selectable={true}
              selectMirror={true}
              dayMaxEvents={true}
              datesSet={handleDatesSet}
              eventClick={handleEventClick}
              select={handleDateSelect}
              height="100%"
              eventDisplay="block"
              nowIndicator={true}
            />
          </div>
        </div>
      </div>

      {/* Mobile filter sheet */}
      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetHeader className="p-4 pb-0">
            <SheetTitle>Calendar Filters</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-full">
            {filterContent}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Event Modal */}
      <EventModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        event={editingEvent}
        defaultStart={defaultStart}
        defaultAllDay={defaultAllDay}
        calendarTypes={calendarTypes}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}

