/**
 * Tags API route.
 *
 * GET /api/tags — Returns unique tags.
 * Query params:
 * - source: 'tasks' | 'diary' | 'all' (default 'all')
 *   Returns tags from the specified source(s).
 */

import { getAllTags, getAllTagsCombined } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("source") ?? "all";

  if (source === "tasks") {
    const result = await getAllTags();
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ data: result.data, error: null });
  }

  const result = await getAllTagsCombined();
  if (result.error) {
    return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
  }

  if (source === "diary") {
    return NextResponse.json({ data: result.data.diaryTags, error: null });
  }

  // source === 'all'
  return NextResponse.json({ data: result.data.allTags, error: null });
}
