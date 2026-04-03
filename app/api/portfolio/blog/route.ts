/**
 * GET /api/portfolio/blog — list published blog posts.
 *
 * Public endpoint — no authentication required.
 */

import { NextResponse } from "next/server";
import { getPublishedBlogPosts } from "@/lib/supabase";

export async function GET() {
  try {
    const result = await getPublishedBlogPosts();
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ data: result.data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Failed to fetch blog posts" }, { status: 500 });
  }
}
