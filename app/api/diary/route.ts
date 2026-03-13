/**
 * GET /api/diary — list diary entries with optional tag/search/pagination.
 * POST /api/diary — create a new diary entry (can be empty).
 */

import { NextRequest, NextResponse } from "next/server";
import { getDiaryEntries, createDiaryEntry } from "@/lib/supabase";
import { diaryQuerySchema, createDiaryEntrySchema } from "@/lib/validations/diary";

export async function GET(request: NextRequest) {
  try {
    const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = diaryQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: "Invalid query parameters" }, { status: 400 });
    }

    const { tag, search, limit, offset } = parsed.data;
    const tagArray = tag ? tag.split(",").map((t) => t.trim()).filter(Boolean) : undefined;

    const result = await getDiaryEntries({ tag: tagArray, search, limit, offset });
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ data: result.data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Failed to fetch diary entries" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createDiaryEntrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const result = await createDiaryEntry(parsed.data);
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ data: result.data, error: null }, { status: 201 });
  } catch {
    return NextResponse.json({ data: null, error: "Failed to create diary entry" }, { status: 500 });
  }
}

