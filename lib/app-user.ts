import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createClient } from "@/utils/supabase/server";

type AppUserContext = {
  supabase: SupabaseClient;
  userId: string;
  user: User | null;
  source: "session" | "local_single_user";
};

function isLocalSingleUserFallbackEnabled() {
  return process.env.ALLOW_SINGLE_USER_FALLBACK === "true";
}

let cachedFallbackUserId: string | null = null;
let hasCheckedFallback = false;

async function getSingleGoogleHealthUserId(supabase: SupabaseClient) {
  if (hasCheckedFallback) {
    return cachedFallbackUserId;
  }
  const { data, error } = await supabase
    .from("oauth_tokens")
    .select("user_id")
    .eq("provider", "google_health")
    .limit(2);

  hasCheckedFallback = true;
  if (error || !data || data.length !== 1) {
    cachedFallbackUserId = null;
  } else {
    cachedFallbackUserId = data[0]?.user_id ?? null;
  }
  return cachedFallbackUserId;
}

export async function getAppUserContext(): Promise<AppUserContext | null> {
  const sessionSupabase = await createClient();
  const sessionUser = sessionSupabase ? (await sessionSupabase.auth.getUser()).data.user : null;

  if (sessionSupabase && sessionUser) {
    return {
      supabase: sessionSupabase,
      userId: sessionUser.id,
      user: sessionUser,
      source: "session"
    };
  }

  if (!isLocalSingleUserFallbackEnabled()) return null;

  const adminSupabase = createSupabaseAdmin();
  if (!adminSupabase) return null;

  const userId = await getSingleGoogleHealthUserId(adminSupabase);
  if (!userId) return null;

  return {
    supabase: adminSupabase,
    userId,
    user: null,
    source: "local_single_user"
  };
}
