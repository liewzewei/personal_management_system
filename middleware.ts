/**
 * Route protection middleware for PMS.
 *
 * Protects all routes by default and redirects unauthenticated users to `/login`.
 * This middleware intentionally allows:
 * - `/login` (auth entry)
 * - `/auth/callback` (Supabase magic-link code exchange)
 * - `/api/login` (initiates magic-link email)
 *
 * We use `@supabase/ssr` here because middleware runs on the Edge runtime and
 * needs cookie-aware session handling.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const cookie of cookiesToSet) {
            response.cookies.set(cookie);
          }
        },
      },
    }
  );

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    // If auth is misconfigured, fail closed (redirect to login).
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  const pathname = request.nextUrl.pathname;
  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/auth/callback" ||
    pathname === "/api/login";

  const isAuthenticated = Boolean(data.user);

  if (!isAuthenticated && !isPublicRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && pathname === "/login") {
    const tasksUrl = request.nextUrl.clone();
    tasksUrl.pathname = "/tasks";
    return NextResponse.redirect(tasksUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

