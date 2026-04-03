/**
 * GET   /api/portfolio/admin/config — get site configuration (auto-creates default if none).
 * PATCH /api/portfolio/admin/config — update site configuration.
 *
 * Authenticated endpoint — requires valid session.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminSiteConfig, updateSiteConfig } from "@/lib/supabase";
import { updateSiteConfigSchema } from "@/lib/validations/portfolio";

export async function GET() {
  try {
    const result = await getAdminSiteConfig();
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ data: result.data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Failed to fetch site config" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = updateSiteConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const result = await updateSiteConfig(parsed.data);
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ data: result.data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Failed to update site config" }, { status: 500 });
  }
}
