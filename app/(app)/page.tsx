/**
 * Root route for PMS.
 *
 * Redirects authenticated users to `/tasks`, otherwise to `/login`.
 */

import { createServerSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();

  redirect(data.user ? "/tasks" : "/login");
}

