/**
 * Single exercise session API routes.
 *
 * GET    /api/exercise/sessions/[id] — Fetch session with laps.
 * PATCH  /api/exercise/sessions/[id] — Update session (all fields optional).
 * DELETE /api/exercise/sessions/[id] — Delete session (cascades laps, recalculates PRs).
 */

import { getExerciseSessionById, updateExerciseSession, deleteExerciseSession } from "@/lib/supabase";
import { updateSessionSchema } from "@/lib/validations/exercise";
import { NextResponse, type NextRequest } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const result = await getExerciseSessionById(id);
  if (result.error) {
    return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ data: result.data, error: null });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const body: unknown = await request.json();
    const parsed = updateSessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const result = await updateExerciseSession(id, parsed.data);
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

  const result = await deleteExerciseSession(id);
  if (result.error) {
    return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ data: result.data, error: null });
}
