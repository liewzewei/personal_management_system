/**
 * Calendar API root route.
 *
 * Sub-routes handle all calendar functionality:
 * - /api/calendar/events     — CRUD for calendar events
 * - /api/calendar/feeds      — CRUD for iCal feeds
 * - /api/calendar/sync       — Trigger iCal sync
 * - /api/calendar/preferences — User calendar preferences
 */

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    data: {
      routes: [
        "GET/POST /api/calendar/events",
        "GET/PATCH/DELETE /api/calendar/events/[id]",
        "GET/POST /api/calendar/feeds",
        "PATCH/DELETE /api/calendar/feeds/[id]",
        "POST /api/calendar/sync",
        "POST /api/calendar/sync/[feedId]",
        "GET/PATCH /api/calendar/preferences",
      ],
    },
    error: null,
  });
}

