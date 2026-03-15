/**
 * Food logs API routes (collection-level).
 *
 * GET  /api/exercise/food-logs?date=YYYY-MM-DD — List food logs for a date.
 * POST /api/exercise/food-logs — Create a new food log entry.
 */

import { getFoodLogsForDate, createFoodLog } from "@/lib/supabase";
import { createFoodLogSchema } from "@/lib/validations/nutrition";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ data: null, error: "date query param required (YYYY-MM-DD)" }, { status: 400 });
  }

  const result = await getFoodLogsForDate(date);
  if (result.error) {
    return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ data: result.data, error: null });
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = createFoodLogSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const result = await createFoodLog(parsed.data);
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ data: result.data, error: null }, { status: 201 });
  } catch {
    return NextResponse.json({ data: null, error: "Invalid request body" }, { status: 400 });
  }
}
