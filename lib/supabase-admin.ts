import "server-only";
import { createClient } from "@supabase/supabase-js";
import { readHttpUrlEnv } from "@/lib/env";

export function createSupabaseAdmin() {
  const url = readHttpUrlEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const isPlaceholder =
    serviceRoleKey?.startsWith("tu-") ||
    serviceRoleKey === "service-role-key" ||
    serviceRoleKey === "secret-key";

  if (!url || !serviceRoleKey || isPlaceholder) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
