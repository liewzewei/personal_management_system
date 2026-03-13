/**
 * Single calendar event API routes.
 *
 * GET    /api/calendar/events/[id] — Fetch a single event.
 * PATCH  /api/calendar/events/[id] — Update a local event (blocks outlook events).
 * DELETE /api/calendar/events/[id] — Delete a local event (blocks outlook events).
 */

import { getCalendarEventById, updateCalendarEvent, deleteCalendarEvent } from "@/lib/supabase";
import { updateCalendarEventSchema } from "@/lib/validations/calendar";
import { NextResponse, type NextRequest } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const result = await getCalendarEventById(id);
  if (result.error) {
    return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ data: result.data, error: null });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const body: unknown = await request.json();
    const parsed = updateCalendarEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const result = await updateCalendarEvent(id, parsed.data);
    if (result.error) {
      // Check if it's an outlook protection error
      if (result.error.message.includes("Outlook events")) {
        return NextResponse.json({ data: null, error: result.error.message }, { status: 400 });
      }
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ data: result.data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const result = await deleteCalendarEvent(id);
  if (result.error) {
    if (result.error.message.includes("Outlook events")) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 400 });
    }
    return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ data: result.data, error: null });
}
