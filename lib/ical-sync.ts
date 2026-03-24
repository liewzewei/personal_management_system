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
  batchUpsertOutlookCalendarEvents,
  upsertOutlookCalendarEvent,
  deleteCalendarEventById,
  updateIcalFeedLastSynced,
} from "@/lib/supabase";
import type { CalendarEvent, SyncResult } from "@/types";

/** Maximum number of rows per Supabase upsert call (Supabase recommends ≤500). */
const UPSERT_BATCH_SIZE = 500;

/** Fetch timeout in milliseconds for downloading .ics files. */
const FETCH_TIMEOUT_MS = 60_000;

/** How far back/forward (in months) to expand recurring events. */
const RECURRENCE_MONTHS_BACK = 3;
const RECURRENCE_MONTHS_FORWARD = 6;

/** Separator used to make occurrence UIDs unique: `<baseUID>__<startISO>`. */
const RECURRING_UID_SEP = "__";

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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(icalUrl, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Accept": "text/calendar, text/plain, */*",
        "Accept-Charset": "utf-8",
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    rawText = await response.text();
  } catch (cause) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    const isTimeout = cause instanceof DOMException && cause.name === "AbortError";
    const detail = isTimeout
      ? `Request timed out after ${FETCH_TIMEOUT_MS / 1000}s — the feed may be very large or the server slow.`
      : msg;
    console.error(`[iCal Sync] Failed to fetch feed URL: ${detail}`);
    throw new Error(`Could not reach Outlook. Check the URL in Settings or try again later. (${detail})`);
  }

  let parsed: ical.CalendarResponse;
  try {
    parsed = ical.sync.parseICS(rawText);
  } catch (cause) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    console.error(`[iCal Sync] Failed to parse .ics data (${rawText.length} chars): ${msg}`);
    throw new Error("Could not parse calendar data. Make sure the URL points to a valid .ics file.");
  }

  const events: ICalParsedEvent[] = [];

  // Build a date window for expanding recurring events
  const now = new Date();
  const expandFrom = new Date(now);
  expandFrom.setMonth(expandFrom.getMonth() - RECURRENCE_MONTHS_BACK);
  const expandTo = new Date(now);
  expandTo.setMonth(expandTo.getMonth() + RECURRENCE_MONTHS_FORWARD);

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

    // Recurring event — expand into individual occurrences
    if (vevent.rrule) {
      try {
        const instances = ical.expandRecurringEvent(vevent, {
          from: expandFrom,
          to: expandTo,
        });

        for (const instance of instances) {
          const instStart = instance.start instanceof Date ? instance.start : new Date(String(instance.start));
          const instEnd = instance.end instanceof Date ? instance.end : new Date(String(instance.end));

          events.push({
            uid: `${uid}${RECURRING_UID_SEP}${instStart.toISOString()}`,
            title,
            description,
            start: instStart,
            end: instEnd,
            isAllDay: instance.isFullDay,
            recurrenceRule: null,
          });
        }
      } catch (err) {
        // Fallback: if expansion fails, store the master event as a single occurrence
        console.warn(`[iCal Sync] Failed to expand recurring event "${title}" (${uid}): ${err instanceof Error ? err.message : String(err)}`);
        const startRaw = vevent.start;
        const endRaw = vevent.end ?? vevent.start;
        const start = startRaw instanceof Date ? startRaw : new Date(String(startRaw));
        const end = endRaw instanceof Date ? endRaw : new Date(String(endRaw));
        const isAllDay = Boolean(
          startRaw && typeof startRaw === "object" && "dateOnly" in startRaw && (startRaw as { dateOnly?: boolean }).dateOnly
        );
        events.push({ uid, title, description, start, end, isAllDay, recurrenceRule: null });
      }
      continue;
    }

    // Non-recurring event — single occurrence
    const startRaw = vevent.start;
    const endRaw = vevent.end ?? vevent.start;

    const isAllDay = Boolean(
      startRaw && typeof startRaw === "object" && "dateOnly" in startRaw && (startRaw as { dateOnly?: boolean }).dateOnly
    );

    const start = startRaw instanceof Date ? startRaw : new Date(String(startRaw));
    const end = endRaw instanceof Date ? endRaw : new Date(String(endRaw));

    events.push({
      uid,
      title,
      description,
      start,
      end,
      isAllDay,
      recurrenceRule: null,
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
    const errMsg = feedResult.error?.message ?? "Feed not found";
    console.error(`[iCal Sync] Feed ${feedId}: ${errMsg}`);
    result.errors.push(errMsg);
    return result;
  }
  const feed = feedResult.data;
  const feedLabel = `"${feed.name}" (${feed.calendar_type})`;

  if (!feed.is_active) {
    console.warn(`[iCal Sync] Skipping inactive feed ${feedLabel}`);
    return result;
  }

  // 2. Parse iCal
  let parsedEvents: ICalParsedEvent[];
  try {
    console.log(`[iCal Sync] Fetching feed ${feedLabel}...`);
    parsedEvents = await fetchAndParseIcal(feed.ical_url);
    console.log(`[iCal Sync] Parsed ${parsedEvents.length} events from ${feedLabel}`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[iCal Sync] Feed ${feedLabel} failed: ${errMsg}`);
    result.errors.push(errMsg);
    return result;
  }

  // 3. Fetch existing events for this feed
  const existingResult = await getOutlookEventsForFeed(userId, feedId);
  if (existingResult.error) {
    console.error(`[iCal Sync] Failed to fetch existing events for ${feedLabel}: ${existingResult.error.message}`);
  }
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

  // 4. Collect events to upsert — separate new from changed for accurate counts
  type EventRow = {
    outlook_event_id: string;
    outlook_calendar_id: string;
    title: string;
    description: string | null;
    start_time: string;
    end_time: string;
    is_all_day: boolean;
    calendar_type: string;
  };

  const newRows: EventRow[] = [];
  const changedRows: EventRow[] = [];

  for (const icalEvent of parsedEvents) {
    seenUids.add(icalEvent.uid);
    const existing = existingMap.get(icalEvent.uid);

    const eventData: EventRow = {
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
      const changed =
        existing.title !== eventData.title ||
        existing.description !== eventData.description ||
        existing.start_time !== eventData.start_time ||
        existing.end_time !== eventData.end_time ||
        existing.is_all_day !== eventData.is_all_day;

      if (changed) {
        changedRows.push(eventData);
      }
    } else {
      newRows.push(eventData);
    }
  }

  // Batch upsert new + changed events in chunks of UPSERT_BATCH_SIZE
  const allUpsertRows = [...newRows, ...changedRows];
  if (allUpsertRows.length > 0) {
    console.log(`[iCal Sync] ${feedLabel}: upserting ${allUpsertRows.length} events (${newRows.length} new, ${changedRows.length} changed) in batches of ${UPSERT_BATCH_SIZE}`);

    for (let i = 0; i < allUpsertRows.length; i += UPSERT_BATCH_SIZE) {
      const chunk = allUpsertRows.slice(i, i + UPSERT_BATCH_SIZE);
      const batchResult = await batchUpsertOutlookCalendarEvents(userId, chunk);
      if (batchResult.error) {
        const errMsg = `Batch upsert failed for ${feedLabel} (chunk ${Math.floor(i / UPSERT_BATCH_SIZE) + 1}): ${batchResult.error.message}`;
        console.error(`[iCal Sync] ${errMsg}`);
        result.errors.push(errMsg);
        // Fall back to individual upserts for this chunk
        console.warn(`[iCal Sync] Falling back to individual upserts for chunk of ${chunk.length} events`);
        for (const row of chunk) {
          const individual = await upsertOutlookCalendarEvent(userId, row);
          if (individual.error) {
            const rowErr = `Upsert failed for "${row.title}": ${individual.error.message}`;
            console.error(`[iCal Sync] ${rowErr}`);
            result.errors.push(rowErr);
          }
        }
      }
    }
  }

  // Update counts based on intent (new vs changed)
  result.added = newRows.length;
  result.updated = changedRows.length;

  // 5. Delete events that are no longer in the iCal feed
  const toDelete = [...existingMap.entries()].filter(([uid]) => !seenUids.has(uid));
  for (const [, existingEvt] of toDelete) {
    try {
      await deleteCalendarEventById(userId, existingEvt.id);
      result.deleted++;
    } catch (err) {
      const errMsg = `Delete failed for event ${existingEvt.id}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[iCal Sync] ${errMsg}`);
      result.errors.push(errMsg);
    }
  }

  // 6. Update last_synced_at
  try {
    await updateIcalFeedLastSynced(feedId);
  } catch (err) {
    const errMsg = `Failed to update last_synced_at for ${feedLabel}: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`[iCal Sync] ${errMsg}`);
    result.errors.push(errMsg);
  }

  console.log(`[iCal Sync] ${feedLabel} complete: +${result.added} added, ~${result.updated} updated, -${result.deleted} deleted, ${result.errors.length} errors`);
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
  if (feedsResult.error) {
    console.error(`[iCal Sync] Failed to fetch feeds: ${feedsResult.error.message}`);
    return [{ added: 0, updated: 0, deleted: 0, errors: [feedsResult.error.message] }];
  }
  const feeds = feedsResult.data ?? [];
  console.log(`[iCal Sync] Starting sync for ${feeds.filter((f) => f.is_active).length} active feed(s)`);

  const results: SyncResult[] = [];
  for (const feed of feeds) {
    if (!feed.is_active) continue;
    try {
      const syncResult = await syncIcalToLocal(userId, feed.id);
      results.push(syncResult);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[iCal Sync] Unhandled error syncing feed "${feed.name}": ${errMsg}`);
      results.push({
        added: 0,
        updated: 0,
        deleted: 0,
        errors: [errMsg],
      });
    }
  }

  return results;
}
