/**
 * Single-task API routes.
 *
 * GET    /api/tasks/[id] — Fetch a task with its subtasks.
 * PATCH  /api/tasks/[id] — Update a task (all fields optional).
 * DELETE /api/tasks/[id] — Delete a task and its subtasks.
 *
 * All handlers verify the session via Supabase server client and delegate
 * to typed helpers in `lib/supabase.ts`.
 */

import { getTaskById, updateTask, deleteTask, duplicateTask } from "@/lib/supabase";
import { updateTaskSchema } from "@/lib/validations/task";
import { NextResponse, type NextRequest } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const result = await getTaskById(id);
  if (result.error) {
    return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ data: result.data, error: null });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const body: unknown = await request.json();
    const parsed = updateTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const result = await updateTask(id, parsed.data);
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

  const result = await deleteTask(id);
  if (result.error) {
    return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ data: result.data, error: null });
}

/** POST /api/tasks/[id] with ?action=duplicate to duplicate a task. */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const action = request.nextUrl.searchParams.get("action");

  if (action === "duplicate") {
    const result = await duplicateTask(id);
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ data: result.data, error: null }, { status: 201 });
  }

  return NextResponse.json({ data: null, error: "Unknown action" }, { status: 400 });
}
