import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readHttpUrlEnv } from "@/lib/env";

export async function createClient() {
  const cookieStore = await cookies();
  const supabaseUrl = readHttpUrlEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot mutate cookies; middleware keeps sessions fresh.
        }
      }
    }
  });
}
