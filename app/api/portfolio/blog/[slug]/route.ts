/**
 * GET /api/portfolio/blog/[slug] — get a single published blog post by slug.
 *
 * Public endpoint — no authentication required.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPublishedBlogPostBySlug } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const result = await getPublishedBlogPostBySlug(slug);
    if (result.error) {
      const status = result.error.message === "Blog post not found" ? 404 : 500;
      return NextResponse.json({ data: null, error: result.error.message }, { status });
    }
    return NextResponse.json({ data: result.data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Failed to fetch blog post" }, { status: 500 });
  }
}
