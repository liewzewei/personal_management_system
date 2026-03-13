/**
 * iCal sync for one-way Outlook → PMS calendar import.
 *
 * HOW TO GET YOUR ICAL URL FROM OUTLOOK:
 *
 * 1. Go to https://outlook.office.com
 * 2. Settings (gear) → View all Outlook settings → Calendar
 * 3. Shared calendars → Publish a calendar
 * 4. Select the calendar and permission level "Can view all details"
 * 5. Copy the ICS link
 * 6. Paste it into PMS Settings → Calendar → Outlook iCal URL
 *
 * SYNC BEHAVIOUR:
 *
 * - One-way only: Outlook → PMS. Changes in PMS do not affect Outlook.
 * - Events from iCal are stored with source='outlook' in calendar_events.
 * - Deduplication uses outlook_event_id (the UID field from the .ics file).
 * - Deleted events in Outlook are removed from PMS on next sync.
 * - Sync can be triggered manually or runs automatically on calendar load
 *   (debounced to once every 10 minutes).
 */

import ical from "node-ical";
import {
  getIcalFeeds,
  getIcalFeedById,
  getOutlookEventsForFeed,
  upsertOutlookCalendarEvent,
  deleteCalendarEventById,
  updateIcalFeedLastSynced,
} from "@/lib/supabase";
import type { CalendarEvent, SyncResult } from "@/types";

/** Parsed iCal event shape used internally. */
interface ICalParsedEvent {
  uid: string;
  title: string;
  description: string | null;
  start: Date;
  end: Date;
  isAllDay: boolean;
  recurrenceRule: string | null;
}

/**
 * Fetches and parses an iCal (.ics) URL into an array of event objects.
 *
 * @param icalUrl - The full URL to the .ics file.
 * @returns Array of parsed iCal events.
 * @throws Descriptive error if fetch or parse fails.
 */
export async function fetchAndParseIcal(icalUrl: string): Promise<ICalParsedEvent[]> {
  let rawText: string;

  try {
    const response = await fetch(icalUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    rawText = await response.text();
  } catch (cause) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`Could not reach Outlook. Check the URL in Settings or try again later. (${msg})`);
  }

  let parsed: ical.CalendarResponse;
  try {
    parsed = ical.sync.parseICS(rawText);
  } catch {
    throw new Error("Could not parse calendar data. Make sure the URL points to a valid .ics file.");
  }

  const events: ICalParsedEvent[] = [];

  for (const key of Object.keys(parsed)) {
    const component = parsed[key];
    if (!component || component.type !== "VEVENT") continue;

    const vevent = component as ical.VEvent;

    const uid = vevent.uid;
    if (!uid) continue;

    const rawSummary = vevent.summary;
    const title: string = typeof rawSummary === "string"
      ? rawSummary
      : (rawSummary && typeof rawSummary === "object" && "val" in rawSummary)
        ? String((rawSummary as { val: string }).val)
        : "(No title)";
    const rawDesc = vevent.description;
    const description: string | null = typeof rawDesc === "string"
      ? rawDesc
      : (rawDesc && typeof rawDesc === "object" && "val" in rawDesc)
        ? String((rawDesc as { val: string }).val)
        : null;

    // Determine if all-day: node-ical sets `datetype` to "date" for all-day events
    const startRaw = vevent.start;
    const endRaw = vevent.end ?? vevent.start;

    const isAllDay = Boolean(
      startRaw && typeof startRaw === "object" && "dateOnly" in startRaw && (startRaw as { dateOnly?: boolean }).dateOnly
    );

    const start = startRaw instanceof Date ? startRaw : new Date(String(startRaw));
    const end = endRaw instanceof Date ? endRaw : new Date(String(endRaw));

    // Extract RRULE if present
    let recurrenceRule: string | null = null;
    if (vevent.rrule) {
      try {
        recurrenceRule = vevent.rrule.toString();
      } catch {
        recurrenceRule = null;
      }
    }

    events.push({
      uid,
      title,
      description,
      start,
      end,
      isAllDay,
      recurrenceRule,
    });
  }

  return events;
}

/**
 * Syncs a single iCal feed to local calendar_events.
 *
 * 1. Fetches the feed config from DB.
 * 2. Parses the iCal URL.
 * 3. Upserts new/changed events, deletes removed ones.
 * 4. Updates last_synced_at on the feed.
 *
 * @param userId - The authenticated user's ID.
 * @param feedId - The ical_feeds row ID to sync.
 * @returns SyncResult with counts of added, updated, deleted, and errors.
 */
export async function syncIcalToLocal(userId: string, feedId: string): Promise<SyncResult> {
  const result: SyncResult = { added: 0, updated: 0, deleted: 0, errors: [] };

  // 1. Fetch feed config
  const feedResult = await getIcalFeedById(feedId);
  if (feedResult.error || !feedResult.data) {
    result.errors.push(feedResult.error?.message ?? "Feed not found");
    return result;
  }
  const feed = feedResult.data;

  if (!feed.is_active) {
    return result;
  }

  // 2. Parse iCal
  let parsedEvents: ICalParsedEvent[];
  try {
    parsedEvents = await fetchAndParseIcal(feed.ical_url);
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
    return result;
  }

  // 3. Fetch existing events for this feed
  const existingResult = await getOutlookEventsForFeed(userId, feedId);
  const existingEvents = existingResult.data ?? [];

  // Build a map: outlook_event_id (uid) → calendar_event row
  const existingMap = new Map<string, CalendarEvent>();
  for (const evt of existingEvents) {
    if (evt.outlook_event_id) {
      existingMap.set(evt.outlook_event_id, evt);
    }
  }

  // Track which UIDs we see in this sync
  const seenUids = new Set<string>();

  // 4. Upsert events
  for (const icalEvent of parsedEvents) {
    seenUids.add(icalEvent.uid);
    const existing = existingMap.get(icalEvent.uid);

    const eventData = {
      outlook_event_id: icalEvent.uid,
      outlook_calendar_id: feedId,
      title: icalEvent.title,
      description: icalEvent.description,
      start_time: icalEvent.start.toISOString(),
      end_time: icalEvent.end.toISOString(),
      is_all_day: icalEvent.isAllDay,
      calendar_type: feed.calendar_type,
    };

    if (existing) {
      // Check if anything changed
      const changed =
        existing.title !== eventData.title ||
        existing.description !== eventData.description ||
        existing.start_time !== eventData.start_time ||
        existing.end_time !== eventData.end_time ||
        existing.is_all_day !== eventData.is_all_day;

      if (changed) {
        const upsertResult = await upsertOutlookCalendarEvent(userId, eventData);
        if (upsertResult.error) {
          result.errors.push(`Update failed for "${icalEvent.title}": ${upsertResult.error.message}`);
        } else {
          result.updated++;
        }
      }
    } else {
      // New event
      const upsertResult = await upsertOutlookCalendarEvent(userId, eventData);
      if (upsertResult.error) {
        result.errors.push(`Insert failed for "${icalEvent.title}": ${upsertResult.error.message}`);
      } else {
        result.added++;
      }
    }
  }

  // 5. Delete events that are no longer in the iCal feed
  for (const [uid, existingEvt] of existingMap) {
    if (!seenUids.has(uid)) {
      try {
        await deleteCalendarEventById(userId, existingEvt.id);
        result.deleted++;
      } catch {
        result.errors.push(`Delete failed for event ${existingEvt.id}`);
      }
    }
  }

  // 6. Update last_synced_at
  try {
    await updateIcalFeedLastSynced(feedId);
  } catch {
    result.errors.push("Failed to update last_synced_at");
  }

  return result;
}

/**
 * Syncs all active iCal feeds for a user.
 *
 * @param userId - The authenticated user's ID.
 * @returns Array of SyncResults, one per feed.
 */
export async function syncAllFeeds(userId: string): Promise<SyncResult[]> {
  const feedsResult = await getIcalFeeds();
  const feeds = feedsResult.data ?? [];

  const results: SyncResult[] = [];
  for (const feed of feeds) {
    if (!feed.is_active) continue;
    try {
      const syncResult = await syncIcalToLocal(userId, feed.id);
      results.push(syncResult);
    } catch (err) {
      results.push({
        added: 0,
        updated: 0,
        deleted: 0,
        errors: [err instanceof Error ? err.message : String(err)],
      });
    }
  }

  return results;
}
