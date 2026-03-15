/**
 * Saved foods API routes (collection-level).
 *
 * GET  /api/exercise/saved-foods — List all saved foods.
 * POST /api/exercise/saved-foods — Create a new saved food.
 */

import { getSavedFoods, createSavedFood } from "@/lib/supabase";
import { createSavedFoodSchema } from "@/lib/validations/nutrition";
import { NextResponse, type NextRequest } from "next/server";

export async function GET() {
  const result = await getSavedFoods();
  if (result.error) {
    return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ data: result.data, error: null });
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = createSavedFoodSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const result = await createSavedFood(parsed.data);
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ data: result.data, error: null }, { status: 201 });
  } catch {
    return NextResponse.json({ data: null, error: "Invalid request body" }, { status: 400 });
  }
}
