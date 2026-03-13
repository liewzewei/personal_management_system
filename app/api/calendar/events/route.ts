/**
 * Calendar events collection API routes.
 *
 * GET  /api/calendar/events — List events with date range and type filters.
 * POST /api/calendar/events — Create a new local calendar event.
 */

import { getCalendarEvents, createCalendarEvent } from "@/lib/supabase";
import { createCalendarEventSchema } from "@/lib/validations/calendar";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const start = params.get("start");
  const end = params.get("end");
  const calendarTypesRaw = params.get("calendarTypes");

  if (!start || !end) {
    return NextResponse.json(
      { data: null, error: "start and end query params are required" },
      { status: 400 }
    );
  }

  const filters: { start: string; end: string; calendarTypes?: string[] } = { start, end };
  if (calendarTypesRaw) {
    filters.calendarTypes = calendarTypesRaw.split(",").map((t) => t.trim()).filter(Boolean);
  }

  const result = await getCalendarEvents(filters);
  if (result.error) {
    return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ data: result.data, error: null });
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = createCalendarEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const result = await createCalendarEvent(parsed.data);
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ data: result.data, error: null }, { status: 201 });
  } catch {
    return NextResponse.json({ data: null, error: "Invalid request body" }, { status: 400 });
  }
}
