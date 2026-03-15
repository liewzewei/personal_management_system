/**
 * Exercise analytics API route.
 *
 * GET /api/exercise/analytics?range=7d|30d|90d|1y|all
 *
 * Returns ExerciseAnalytics object with running, swimming, nutrition, and combined stats.
 */

import { calculateExerciseAnalytics } from "@/lib/exercise-analytics";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const range = request.nextUrl.searchParams.get("range") ?? "30d";
  const validRanges = ["7d", "30d", "90d", "1y", "all"];
  if (!validRanges.includes(range)) {
    return NextResponse.json({ data: null, error: "Invalid range. Use: 7d, 30d, 90d, 1y, all" }, { status: 400 });
  }

  try {
    const analytics = await calculateExerciseAnalytics(range);
    return NextResponse.json({ data: analytics, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to calculate analytics";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
