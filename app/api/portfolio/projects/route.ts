/**
 * GET /api/portfolio/projects — list published portfolio projects.
 *
 * Public endpoint — no authentication required.
 * Uses service role client to bypass RLS.
 */

import { NextResponse } from "next/server";
import { getPublishedProjects } from "@/lib/supabase";

export async function GET() {
  try {
    const result = await getPublishedProjects();
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ data: result.data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Failed to fetch projects" }, { status: 500 });
  }
}
