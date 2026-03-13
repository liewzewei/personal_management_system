/**
 * GET /api/diary/[id] — fetch a single diary entry.
 * PATCH /api/diary/[id] — update a diary entry.
 * DELETE /api/diary/[id] — delete a diary entry.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDiaryEntryById, updateDiaryEntry, deleteDiaryEntry } from "@/lib/supabase";
import { updateDiaryEntrySchema } from "@/lib/validations/diary";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await getDiaryEntryById(id);
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 404 });
    }
    return NextResponse.json({ data: result.data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Failed to fetch diary entry" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateDiaryEntrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const result = await updateDiaryEntry(id, parsed.data);
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ data: result.data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Failed to update diary entry" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await deleteDiaryEntry(id);
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ data: { deleted: true }, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Failed to delete diary entry" }, { status: 500 });
  }
}
