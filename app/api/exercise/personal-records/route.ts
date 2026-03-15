/**
 * Personal records API route.
 *
 * GET /api/exercise/personal-records — Fetch all PR records with session context.
 *
 * Example response:
 * { "data": [{ "distance_bucket": "5km", "best_pace_seconds_per_km": 330,
 *   "achieved_at": "2026-03-15", "session_route": "NUS Loop" }], "error": null }
 */

import { getPersonalRecords } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  const result = await getPersonalRecords();
  if (result.error) {
    return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
  }
  const response = NextResponse.json({ data: result.data, error: null });
  response.headers.set("Cache-Control", "private, max-age=60, stale-while-revalidate=300");
  return response;
}
