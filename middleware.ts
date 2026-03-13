/**
 * Route protection middleware for PMS.
 *
 * Protects all routes by default and redirects unauthenticated users to `/login`.
 * This middleware intentionally allows:
 * - `/login` (auth entry)
 * - `/auth/callback` (Supabase auth code exchange)
 * - `/api/login` (email/password sign-in)
 *
 * We use `@supabase/ssr` here because middleware runs on the Edge runtime and
 * needs cookie-aware session handling.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/auth/callback" ||
    pathname === "/api/login";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase is not configured correctly, fail closed but do not crash the app.
  if (!supabaseUrl || !supabaseAnonKey) {
    if (!isPublicRoute) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  const response = NextResponse.next();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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
  });

  const { data, error } = await supabase.auth.getUser();
  
  // For public routes, don't enforce authentication
  if (isPublicRoute) {
    return response;
  }
  
  // If auth check fails, treat the user as unauthenticated.
  if (error) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  const isAuthenticated = Boolean(data.user);

  if (!isAuthenticated) {
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

