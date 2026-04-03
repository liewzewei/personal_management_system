/**
 * POST /api/portfolio/admin/upload — upload an image for portfolio content.
 *
 * Accepts multipart form data with a single "file" field.
 * Uploads to Supabase Storage portfolio-images bucket.
 * Returns the public URL of the uploaded image.
 *
 * Authenticated endpoint — requires valid session.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, ensurePortfolioImagesBucket, uploadPortfolioImage } from "@/lib/supabase";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export async function POST(request: NextRequest) {
  try {
    const client = await createServerSupabaseClient();
    const { data: userData, error: authError } = await client.auth.getUser();
    if (authError || !userData.user) {
      return NextResponse.json({ data: null, error: "Not authenticated" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ data: null, error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ data: null, error: "Image too large. Max size is 10MB." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ data: null, error: "Invalid file type. Use JPG, PNG, GIF, or WebP." }, { status: 400 });
    }

    await ensurePortfolioImagesBucket();

    const fileName = file instanceof File ? file.name : `image-${Date.now()}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await uploadPortfolioImage(userData.user.id, fileName, buffer, file.type);
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ data: result.data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Failed to upload image" }, { status: 500 });
  }
}
