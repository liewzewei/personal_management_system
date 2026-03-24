/**
 * Body metrics API route.
 *
 * GET   /api/exercise/body-metrics — Fetch body metrics (optional from/to/limit filters).
 * PATCH /api/exercise/body-metrics — Upsert a body metric entry (one per user+date).
 */

import { getBodyMetrics, upsertBodyMetric } from "@/lib/supabase";
import { upsertBodyMetricSchema } from "@/lib/validations/nutrition";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const filters: Record<string, string | number> = {};
  const from = params.get("from");
  const to = params.get("to");
  const limit = params.get("limit");
  if (from) filters.from = from;
  if (to) filters.to = to;
  if (limit) { const n = parseInt(limit, 10); if (!Number.isNaN(n)) filters.limit = n; }

  const result = await getBodyMetrics(filters as Parameters<typeof getBodyMetrics>[0]);
  if (result.error) {
    return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ data: result.data, error: null });
}

export async function PATCH(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = upsertBodyMetricSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const result = await upsertBodyMetric(parsed.data);
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ data: result.data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Invalid request body" }, { status: 400 });
  }
}
