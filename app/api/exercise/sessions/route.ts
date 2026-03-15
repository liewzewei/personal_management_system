/**
 * Exercise sessions API routes (collection-level).
 *
 * GET  /api/exercise/sessions — List sessions with optional filters (type, from, to, limit, offset).
 * POST /api/exercise/sessions — Create a new exercise session.
 *
 * Example POST body:
 * { "type": "run", "date": "2026-03-15", "duration_seconds": 1710,
 *   "distance_metres": 5100, "route_name": "NUS Loop", "effort_level": 3,
 *   "laps": [{ "lap_number": 1, "distance_metres": 1000, "duration_seconds": 330 }] }
 *
 * Example response:
 * { "data": { "id": "uuid", "is_pr": true, "pr_distance_bucket": "5km", ... }, "error": null }
 */

import { getExerciseSessions, createExerciseSession } from "@/lib/supabase";
import { createSessionSchema } from "@/lib/validations/exercise";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const filters: Record<string, string | number> = {};
  const type = params.get("type");
  const from = params.get("from");
  const to = params.get("to");
  const limit = params.get("limit");
  const offset = params.get("offset");

  if (type) filters.type = type;
  if (from) filters.from = from;
  if (to) filters.to = to;
  if (limit) filters.limit = parseInt(limit, 10);
  if (offset) filters.offset = parseInt(offset, 10);

  const result = await getExerciseSessions(filters as Parameters<typeof getExerciseSessions>[0]);
  if (result.error) {
    return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ data: result.data, error: null });
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = createSessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const result = await createExerciseSession(parsed.data);
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ data: result.data, error: null }, { status: 201 });
  } catch {
    return NextResponse.json({ data: null, error: "Invalid request body" }, { status: 400 });
  }
}
