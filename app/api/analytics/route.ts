/**
 * GET /api/analytics
 *
 * Returns comprehensive analytics payload computed server-side.
 * Accepts query params:
 * - range: '30d' | '90d' | '1y' | 'all' (default '30d')
 * - tag: optional string to filter to one tag
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTasksForAnalytics } from "@/lib/supabase";
import { calculateAnalytics } from "@/lib/analytics";
import { subDays, subMonths, subYears } from "date-fns";

const querySchema = z.object({
  range: z.enum(["30d", "90d", "1y", "all"]).default("30d"),
  tag: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = querySchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "Invalid query parameters" },
        { status: 400 }
      );
    }

    const { range, tag } = parsed.data;
    const now = new Date();
    let startDate: Date | undefined;

    switch (range) {
      case "30d":
        startDate = subDays(now, 30);
        break;
      case "90d":
        startDate = subDays(now, 90);
        break;
      case "1y":
        startDate = subYears(now, 1);
        break;
      case "all":
        startDate = undefined;
        break;
    }

    const result = await getTasksForAnalytics(startDate);
    if (result.error) {
      return NextResponse.json(
        { data: null, error: result.error.message },
        { status: 500 }
      );
    }

    let tasks = result.data;

    // Optional tag filter
    if (tag) {
      tasks = tasks.filter((t) => t.tags?.includes(tag));
    }

    const rangeStart = startDate ?? new Date("2020-01-01");
    const analytics = calculateAnalytics(tasks, rangeStart, now);

    return NextResponse.json({ data: analytics, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: "Failed to compute analytics" },
      { status: 500 }
    );
  }
}
