import { NextResponse } from "next/server";
import { encodeOauthState } from "@/lib/oauth-state";
import { getAppUserContext } from "@/lib/app-user";
import { createClient } from "@/utils/supabase/server";

const googleHealthScopes = [
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
  "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
  "https://www.googleapis.com/auth/googlehealth.sleep.readonly"
];

export async function POST(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const supabase = await createClient();
  const userIdFromHeader = request.headers.get("x-user-id");
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const appUser = !user && !userIdFromHeader ? await getAppUserContext() : null;
  const userId = user?.id || userIdFromHeader || appUser?.userId;

  if (!clientId || !siteUrl) {
    return NextResponse.json({ ok: false, message: "Faltan GOOGLE_CLIENT_ID o NEXT_PUBLIC_SITE_URL." }, { status: 500 });
  }

  if (!userId) {
    return NextResponse.json({ ok: false, message: "Falta usuario autenticado." }, { status: 401 });
  }

  const redirectUri = `${siteUrl.replace(/\/$/, "")}/api/google-health/callback`;
  const state = encodeOauthState({
    userId,
    redirectUri,
    exp: Date.now() + 10 * 60 * 1000
  });

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", googleHealthScopes.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);

  return NextResponse.json({ ok: true, url: url.toString() });
}
