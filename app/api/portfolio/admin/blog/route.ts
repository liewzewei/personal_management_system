/**
 * GET  /api/portfolio/admin/blog — list all blog posts (drafts + published).
 * POST /api/portfolio/admin/blog — create a new blog post.
 *
 * Authenticated endpoint — requires valid session.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminBlogPosts, createBlogPost } from "@/lib/supabase";
import { createBlogPostSchema } from "@/lib/validations/portfolio";

export async function GET() {
  try {
    const result = await getAdminBlogPosts();
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ data: result.data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Failed to fetch blog posts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createBlogPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const result = await createBlogPost(parsed.data);
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ data: result.data, error: null }, { status: 201 });
  } catch {
    return NextResponse.json({ data: null, error: "Failed to create blog post" }, { status: 500 });
  }
}
