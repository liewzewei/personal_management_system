/**
 * User calendar preferences API routes.
 *
 * GET  /api/calendar/preferences — Fetch current user's calendar preferences.
 * PATCH /api/calendar/preferences — Update calendar preferences (upsert).
 */

import { getUserPreferences, upsertUserPreferences } from "@/lib/supabase";
import { updateUserPreferencesSchema } from "@/lib/validations/calendar";
import { NextResponse, type NextRequest } from "next/server";

export async function GET() {
  const result = await getUserPreferences();
  if (result.error) {
    return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ data: result.data, error: null });
}

export async function PATCH(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = updateUserPreferencesSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const result = await upsertUserPreferences(parsed.data);
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ data: result.data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Invalid request body" }, { status: 400 });
  }
}
