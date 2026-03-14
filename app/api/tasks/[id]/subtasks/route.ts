/**
 * Subtasks API route.
 *
 * GET /api/tasks/[id]/subtasks — Returns all subtasks for a given parent task.
 * Used by the SubtaskDropdown component for real-time updates.
 */

import { getSubtasks } from "@/lib/supabase";
import { NextResponse, type NextRequest } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const result = await getSubtasks(id);
  if (result.error) {
    return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ data: result.data, error: null });
}
