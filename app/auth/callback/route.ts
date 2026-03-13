/**
 * Supabase auth callback route for PMS.
 *
 * When the user clicks the magic link, Supabase redirects here with a `code`
 * query param. We exchange it for a session and store the auth cookies, then
 * redirect into the app.
 */

import { createServerSupabaseClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL("/tasks", requestUrl.origin));
}

