/**
 * Daily nutrition API route.
 *
 * GET /api/exercise/nutrition?date=YYYY-MM-DD — Calculate daily nutrition summary.
 *
 * Example response:
 * { "data": { "date": "2026-03-15", "total_calories": 1450, "calories_burned": 420,
 *   "net_calories": 1030, "calorie_goal": 2200, "total_carbs_g": 180,
 *   "total_fat_g": 45, "total_protein_g": 62, "total_water_ml": 1500 }, "error": null }
 */

import { calculateDailyNutrition } from "@/lib/supabase";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ data: null, error: "date query param required (YYYY-MM-DD)" }, { status: 400 });
  }

  const result = await calculateDailyNutrition(date);
  if (result.error) {
    return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ data: result.data, error: null });
}
