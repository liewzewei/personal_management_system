/**
 * Single food log API route.
 *
 * DELETE /api/exercise/food-logs/[id] — Delete a food log entry.
 */

import { deleteFoodLog } from "@/lib/supabase";
import { NextResponse, type NextRequest } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const result = await deleteFoodLog(id);
  if (result.error) {
    return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ data: result.data, error: null });
}
