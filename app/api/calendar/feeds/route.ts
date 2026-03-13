/**
 * iCal feeds collection API routes.
 *
 * GET  /api/calendar/feeds — List all feeds for the current user.
 * POST /api/calendar/feeds — Create a new feed and trigger initial sync.
 */

import { getIcalFeeds, createIcalFeed, createServerSupabaseClient } from "@/lib/supabase";
import { syncIcalToLocal } from "@/lib/ical-sync";
import { createIcalFeedSchema } from "@/lib/validations/calendar";
import { NextResponse, type NextRequest } from "next/server";

export async function GET() {
  const result = await getIcalFeeds();
  if (result.error) {
    return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ data: result.data, error: null });
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = createIcalFeedSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const result = await createIcalFeed(parsed.data);
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }

    // Immediately trigger sync for the new feed
    let syncResult = null;
    if (result.data) {
      try {
        const client = await createServerSupabaseClient();
        const { data: userData } = await client.auth.getUser();
        if (userData.user) {
          syncResult = await syncIcalToLocal(userData.user.id, result.data.id);
        }
      } catch {
        // Sync failure on initial create is non-fatal
      }
    }

    return NextResponse.json(
      { data: { feed: result.data, syncResult }, error: null },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ data: null, error: "Invalid request body" }, { status: 400 });
  }
}
