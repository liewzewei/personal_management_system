/**
 * Login API route for PMS.
 *
 * Responsibilities:
 * - Validate email and password credentials using Supabase Auth
 * - Create user session if credentials are valid
 * - Return appropriate error messages for invalid credentials
 */

import { createServerSupabaseClient } from "@/lib/supabase";
import { assertNonEmptyString } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const email = assertNonEmptyString(
      (body as { email?: unknown } | null)?.email,
      "email"
    );
    const password = assertNonEmptyString(
      (body as { password?: unknown } | null)?.password,
      "password"
    );

    const supabase = await createServerSupabaseClient();
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid request" },
      { status: 400 }
    );
  }
}

