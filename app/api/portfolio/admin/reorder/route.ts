/**
 * PATCH /api/portfolio/admin/reorder — reorder projects or blog posts.
 *
 * Body: { type: "project" | "blog", ordered_ids: string[] }
 *
 * Authenticated endpoint — requires valid session.
 */

import { NextRequest, NextResponse } from "next/server";
import { reorderProjects, reorderBlogPosts } from "@/lib/supabase";
import { reorderSchema } from "@/lib/validations/portfolio";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { type, ordered_ids } = parsed.data;
    const result =
      type === "project"
        ? await reorderProjects(ordered_ids)
        : await reorderBlogPosts(ordered_ids);

    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ data: null, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Failed to reorder items" }, { status: 500 });
  }
}
