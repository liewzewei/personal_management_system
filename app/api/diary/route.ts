/**
 * Diary API route placeholder.
 *
 * Diary editor/content model will be implemented after auth + schema are ready.
 */

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "Not implemented (scaffold only)." },
    { status: 501 }
  );
}

