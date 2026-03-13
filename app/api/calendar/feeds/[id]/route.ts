/**
 * Single iCal feed API routes.
 *
 * PATCH  /api/calendar/feeds/[id] — Update a feed.
 * DELETE /api/calendar/feeds/[id] — Delete a feed and all its imported events.
 */

import {
  updateIcalFeed,
  deleteIcalFeed,
  deleteOutlookEventsForFeed,
  getIcalFeedById,
  createServerSupabaseClient,
} from "@/lib/supabase";
import { updateIcalFeedSchema } from "@/lib/validations/calendar";
import { NextResponse, type NextRequest } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const body: unknown = await request.json();
    const parsed = updateIcalFeedSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const result = await updateIcalFeed(id, parsed.data);
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ data: result.data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const client = await createServerSupabaseClient();
    const { data: userData, error: authError } = await client.auth.getUser();
    if (authError || !userData.user) {
      return NextResponse.json({ data: null, error: "Not authenticated" }, { status: 401 });
    }

    // Verify feed belongs to this user
    const feedResult = await getIcalFeedById(id);
    if (feedResult.error || !feedResult.data) {
      return NextResponse.json({ data: null, error: "Feed not found" }, { status: 404 });
    }
    if (feedResult.data.user_id !== userData.user.id) {
      return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });
    }

    // Delete all imported events first
    await deleteOutlookEventsForFeed(userData.user.id, id);

    // Delete the feed
    const result = await deleteIcalFeed(id);
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ data: { deleted: true }, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Failed to delete feed" }, { status: 500 });
  }
}
