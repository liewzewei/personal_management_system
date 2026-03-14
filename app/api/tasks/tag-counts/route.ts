/**
 * Tag counts API route.
 *
 * GET /api/tasks/tag-counts — Returns unfiltered tag counts for sidebar badges.
 * Counts only incomplete (non-done) top-level tasks.
 */

import { getTaskTagCounts } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  const result = await getTaskTagCounts();
  if (result.error) {
    return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ data: result.data, error: null });
}
