/**
 * Login API route for PMS.
 *
 * Responsibilities:
 * - Enforce intentional single-user mode (at the app layer).
 * - Trigger Supabase magic-link email delivery.
 *
 * Single-user enforcement:
 * We intentionally prevent multiple users from existing in `auth.users` for this
 * private, single-user app. If more than 1 user is found, we return 403.
 */

import { getExistingUsersUpTo2, sendMagicLinkEmail } from "@/lib/supabase";
import { assertNonEmptyString } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const email = assertNonEmptyString(
      (body as { email?: unknown } | null)?.email,
      "email"
    );

    const existingUsers = await getExistingUsersUpTo2();
    if (existingUsers.error) {
      return NextResponse.json(
        { error: existingUsers.error.message },
        { status: 500 }
      );
    }

    if (existingUsers.data.length > 1) {
      return NextResponse.json(
        { error: "Single-user mode: multiple users already exist." },
        { status: 403 }
      );
    }

    const origin = new URL(request.url).origin;
    const emailRedirectTo = `${origin}/auth/callback`;

    const sent = await sendMagicLinkEmail({ email, emailRedirectTo });
    if (sent.error) {
      return NextResponse.json({ error: sent.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid request" },
      { status: 400 }
    );
  }
}

