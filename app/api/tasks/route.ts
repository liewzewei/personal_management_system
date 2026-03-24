/**
 * Tasks API routes (collection-level).
 *
 * GET  /api/tasks — List tasks with optional filters (tag, status, search, sortBy).
 * POST /api/tasks — Create a new task (title required).
 *
 * All handlers verify the session via Supabase server client and delegate
 * to typed helpers in `lib/supabase.ts`.
 */

import { getTasks, createTask } from "@/lib/supabase";
import { createTaskSchema } from "@/lib/validations/task";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const filters: Record<string, string | number> = {};
  const tag = params.get("tag");
  const status = params.get("status");
  const search = params.get("search");
  const sortBy = params.get("sortBy");
  const limit = params.get("limit");
  const offset = params.get("offset");

  if (tag) filters.tag = tag;
  if (status) filters.status = status;
  if (search) filters.search = search;
  if (sortBy) filters.sortBy = sortBy;
  if (limit) { const n = parseInt(limit, 10); if (!Number.isNaN(n)) filters.limit = n; }
  if (offset) { const n = parseInt(offset, 10); if (!Number.isNaN(n)) filters.offset = n; }

  const result = await getTasks(filters as Parameters<typeof getTasks>[0]);
  if (result.error) {
    return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ data: result.data, error: null });
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = createTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const result = await createTask(parsed.data);
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ data: result.data, error: null }, { status: 201 });
  } catch {
    return NextResponse.json({ data: null, error: "Invalid request body" }, { status: 400 });
  }
}

