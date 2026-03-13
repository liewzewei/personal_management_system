/**
 * Calendar sync API route (all feeds).
 *
 * POST /api/calendar/sync — Sync all active iCal feeds for the current user.
 */

import { createServerSupabaseClient } from "@/lib/supabase";
import { syncAllFeeds } from "@/lib/ical-sync";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) {
      return NextResponse.json({ data: null, error: "Not authenticated" }, { status: 401 });
    }

    const results = await syncAllFeeds(data.user.id);

    const totals = results.reduce(
      (acc, r) => ({
        total_added: acc.total_added + r.added,
        total_updated: acc.total_updated + r.updated,
        total_deleted: acc.total_deleted + r.deleted,
      }),
      { total_added: 0, total_updated: 0, total_deleted: 0 }
    );

    return NextResponse.json({
      data: { results, ...totals },
      error: null,
    });
  } catch (cause) {
    const msg = cause instanceof Error ? cause.message : "Sync failed";
    return NextResponse.json({ data: null, error: msg }, { status: 500 });
  }
}
