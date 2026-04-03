/**
 * GET /api/portfolio/config — get public site configuration.
 *
 * Public endpoint — no authentication required.
 */

import { NextResponse } from "next/server";
import { getPublicSiteConfig } from "@/lib/supabase";

export async function GET() {
  try {
    const result = await getPublicSiteConfig();
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ data: result.data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Failed to fetch site config" }, { status: 500 });
  }
}
