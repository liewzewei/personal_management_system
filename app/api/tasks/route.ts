/**
 * Tasks API route placeholder.
 *
 * This exists to establish routing and demonstrate the rule:
 * route handlers call typed helpers in `lib/supabase.ts` (no inline queries).
 */

import { getTasks } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  const result = await getTasks();
  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ data: result.data });
}

