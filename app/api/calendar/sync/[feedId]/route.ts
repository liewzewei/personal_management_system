/**
 * Single-feed calendar sync API route.
 *
 * POST /api/calendar/sync/[feedId] — Sync a specific iCal feed.
 */

import { createServerSupabaseClient, getIcalFeedById } from "@/lib/supabase";
import { syncIcalToLocal } from "@/lib/ical-sync";
import { NextResponse, type NextRequest } from "next/server";

type RouteContext = { params: Promise<{ feedId: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const { feedId } = await context.params;

  try {
    const client = await createServerSupabaseClient();
    const { data: userData, error: authError } = await client.auth.getUser();
    if (authError || !userData.user) {
      return NextResponse.json({ data: null, error: "Not authenticated" }, { status: 401 });
    }

    // Verify feed belongs to this user
    const feedResult = await getIcalFeedById(feedId);
    if (feedResult.error || !feedResult.data) {
      return NextResponse.json({ data: null, error: "Feed not found" }, { status: 404 });
    }
    if (feedResult.data.user_id !== userData.user.id) {
      return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });
    }

    const result = await syncIcalToLocal(userData.user.id, feedId);
    return NextResponse.json({ data: result, error: null });
  } catch (cause) {
    const msg = cause instanceof Error ? cause.message : "Sync failed";
    return NextResponse.json({ data: null, error: msg }, { status: 500 });
  }
}
