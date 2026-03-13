/**
 * POST /api/diary/upload — upload an image for the diary editor.
 *
 * Accepts multipart form data with a single "file" field.
 * Uploads to Supabase Storage diary-images bucket.
 * Returns the public URL of the uploaded image.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, ensureDiaryImagesBucket, uploadDiaryImage } from "@/lib/supabase";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
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
      return NextResponse.json({ data: null, error: "Image too large. Max size is 5MB." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ data: null, error: "Invalid file type. Use JPG, PNG, GIF, or WebP." }, { status: 400 });
    }

    // Ensure bucket exists
    await ensureDiaryImagesBucket();

    const fileName = file instanceof File ? file.name : `image-${Date.now()}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await uploadDiaryImage(userData.user.id, fileName, buffer, file.type);
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ data: result.data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Failed to upload image" }, { status: 500 });
  }
}
