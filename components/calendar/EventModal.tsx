/**
 * EventModal component.
 *
 * Handles create, view, and edit modes for calendar events.
 * - For source='outlook' events: all fields read-only with an info message.
 * - For local events: full editing with title, description, all-day toggle,
 *   datetime pickers, calendar type, and linked task display.
 * - Delete confirmation for existing local events.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { Calendar, Loader2, Trash2, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { CalendarEvent } from "@/types";

interface EventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, modal is in view/edit mode. */
  event?: CalendarEvent | null;
  /** Pre-filled start time when creating from a calendar slot click. */
  defaultStart?: string | null;
  /** Pre-filled end time when creating from a calendar drag selection. */
  defaultEnd?: string | null;
  /** Pre-filled all-day flag when clicking the all-day row. */
  defaultAllDay?: boolean;
  /** All known calendar types for autocomplete. */
  calendarTypes: string[];
  onSave: (data: EventFormData) => Promise<void>;
  onDelete?: (eventId: string) => void;
}

export interface EventFormData {
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  calendar_type: string | null;
}

function toDatetimeLocal(iso: string): string {
  const d = parseISO(iso);
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

function toDateLocal(iso: string): string {
  return iso.slice(0, 10);
}

export function EventModal({
  open,
  onOpenChange,
  event,
  defaultStart,
  defaultEnd,
  defaultAllDay,
  calendarTypes,
  onSave,
  onDelete,
}: EventModalProps) {
  const isEditing = Boolean(event);
  const isOutlook = event?.source === "outlook";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [calendarType, setCalendarType] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const resetForm = useCallback(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description ?? "");
      setIsAllDay(event.is_all_day);
      setCalendarType(event.calendar_type ?? "");

      if (event.is_all_day) {
        setStartDate(toDateLocal(event.start_time));
        setEndDate(toDateLocal(event.end_time));
        setStartTime("");
        setEndTime("");
      } else {
        const startDt = toDatetimeLocal(event.start_time);
        const endDt = toDatetimeLocal(event.end_time);
        setStartDate(startDt.slice(0, 10));
        setStartTime(startDt.slice(11, 16));
        setEndDate(endDt.slice(0, 10));
        setEndTime(endDt.slice(11, 16));
      }
    } else {
      setTitle("");
      setDescription("");
      setIsAllDay(defaultAllDay ?? false);
      setCalendarType("LOCAL");

      if (defaultStart) {
        const dt = toDatetimeLocal(defaultStart);
        setStartDate(dt.slice(0, 10));
        setStartTime(dt.slice(11, 16));
        // Use drag-selected end time if available, otherwise default to start + 1 hour
        const endSource = defaultEnd ? defaultEnd : (() => {
          const endDt = new Date(defaultStart);
          endDt.setHours(endDt.getHours() + 1);
          return endDt.toISOString();
        })();
        const endFormatted = toDatetimeLocal(endSource);
        setEndDate(endFormatted.slice(0, 10));
        setEndTime(endFormatted.slice(11, 16));
      } else {
        const now = new Date();
        const nowStr = toDatetimeLocal(now.toISOString());
        setStartDate(nowStr.slice(0, 10));
        setStartTime(nowStr.slice(11, 16));
        now.setHours(now.getHours() + 1);
        const endStr = toDatetimeLocal(now.toISOString());
        setEndDate(endStr.slice(0, 10));
        setEndTime(endStr.slice(11, 16));
      }
    }
    setSaving(false);
    setConfirmDelete(false);
  }, [event, defaultStart, defaultEnd, defaultAllDay]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) resetForm();
  }, [open, resetForm]);

  async function handleSave() {
    if (!title.trim() || !startDate) return;
    setSaving(true);

    let start_time: string;
    let end_time: string;

    if (isAllDay) {
      start_time = new Date(`${startDate}T00:00:00`).toISOString();
      end_time = new Date(`${endDate || startDate}T00:00:00`).toISOString();
    } else {
      start_time = new Date(`${startDate}T${startTime || "00:00"}:00`).toISOString();
      end_time = new Date(`${endDate || startDate}T${endTime || startTime || "00:00"}:00`).toISOString();
    }

    await onSave({
      title: title.trim(),
      description: description.trim() || null,
      start_time,
      end_time,
      is_all_day: isAllDay,
      calendar_type: calendarType.trim() || null,
    });

    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isOutlook ? "Outlook Event" : isEditing ? "Edit Event" : "New Event"}
          </DialogTitle>
          <DialogDescription>
            {isOutlook
              ? "This event was imported from Outlook."
              : isEditing
                ? "Update the event details."
                : "Create a new calendar event."}
          </DialogDescription>
        </DialogHeader>

        {isOutlook && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">Imported from Outlook</span>
            </div>
            <p>Edit this event in Outlook. It will re-sync automatically.</p>
          </div>
        )}

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              disabled={isOutlook}
              autoFocus={!isOutlook}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="event-desc">Description</Label>
            <Textarea
              id="event-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
              disabled={isOutlook}
            />
          </div>

          {/* All-day toggle */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="all-day"
              checked={isAllDay}
              onCheckedChange={(v) => setIsAllDay(Boolean(v))}
              disabled={isOutlook}
            />
            <Label htmlFor="all-day" className="cursor-pointer">
              All-day event
            </Label>
          </div>

          {/* Date/time inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start {isAllDay ? "date" : ""}</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isOutlook}
              />
              {!isAllDay && (
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  disabled={isOutlook}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>End {isAllDay ? "date" : ""}</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isOutlook}
              />
              {!isAllDay && (
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  disabled={isOutlook}
                />
              )}
            </div>
          </div>

          {/* Calendar type */}
          <div className="space-y-1.5">
            <Label>Calendar Type</Label>
            <Input
              value={calendarType}
              onChange={(e) => setCalendarType(e.target.value.toUpperCase())}
              placeholder="e.g. LOCAL, LECTURES, PERSONAL"
              disabled={isOutlook}
              list="calendar-type-suggestions"
            />
            <datalist id="calendar-type-suggestions">
              {calendarTypes.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>

          {/* Linked task */}
          {event?.task_id && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-2">
              <span className="text-sm text-muted-foreground">Linked to a task</span>
              <a
                href="/tasks"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View Task <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Source badge */}
          {event && (
            <div className="flex items-center gap-2">
              <Badge variant={event.source === "outlook" ? "secondary" : "outline"}>
                {event.source === "outlook" ? "Outlook" : "Local"}
              </Badge>
              {event.calendar_type && (
                <Badge variant="outline">{event.calendar_type}</Badge>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div>
            {isEditing && !isOutlook && event && onDelete && (
              <>
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-destructive">Delete?</span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onDelete(event.id)}
                    >
                      Confirm
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete
                  </Button>
                )}
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {isOutlook ? "Close" : "Cancel"}
            </Button>
            {!isOutlook && (
              <Button onClick={handleSave} disabled={!title.trim() || !startDate || saving}>
                {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Save
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
