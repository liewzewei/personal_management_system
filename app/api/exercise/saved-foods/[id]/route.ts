/**
 * Single saved food API routes.
 *
 * PATCH  /api/exercise/saved-foods/[id] — Update a saved food.
 * DELETE /api/exercise/saved-foods/[id] — Delete a saved food.
 */

import { updateSavedFood, deleteSavedFood } from "@/lib/supabase";
import { updateSavedFoodSchema } from "@/lib/validations/nutrition";
import { NextResponse, type NextRequest } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  try {
    const body: unknown = await request.json();
    const parsed = updateSavedFoodSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const result = await updateSavedFood(id, parsed.data);
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

  const result = await deleteSavedFood(id);
  if (result.error) {
    return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ data: result.data, error: null });
}
