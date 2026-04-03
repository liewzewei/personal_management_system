/**
 * GET    /api/portfolio/admin/blog/[id] — get a single blog post by ID.
 * PATCH  /api/portfolio/admin/blog/[id] — update a blog post.
 * DELETE /api/portfolio/admin/blog/[id] — delete a blog post.
 *
 * Authenticated endpoint — requires valid session.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminBlogPostById, updateBlogPost, deleteBlogPost } from "@/lib/supabase";
import { updateBlogPostSchema } from "@/lib/validations/portfolio";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const result = await getAdminBlogPostById(id);
    if (result.error) {
      const status = result.error.message === "Blog post not found" ? 404 : 500;
      return NextResponse.json({ data: null, error: result.error.message }, { status });
    }
    return NextResponse.json({ data: result.data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Failed to fetch blog post" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateBlogPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const result = await updateBlogPost(id, parsed.data);
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ data: result.data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Failed to update blog post" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const result = await deleteBlogPost(id);
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ data: null, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Failed to delete blog post" }, { status: 500 });
  }
}
