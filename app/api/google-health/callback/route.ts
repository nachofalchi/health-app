import { NextResponse } from "next/server";
import { decodeOauthState } from "@/lib/oauth-state";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { encryptToken } from "@/lib/token-crypto";
import { createClient } from "@/utils/supabase/server";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const stateValue = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const authSupabase = await createClient();
    const adminSupabase = createSupabaseAdmin();
    const supabase = adminSupabase || authSupabase;

    if (error) {
      return NextResponse.redirect(new URL(`/?google_health=${encodeURIComponent(error)}`, request.url));
    }

    if (!code || !stateValue || !clientId || !clientSecret || !supabase) {
      return NextResponse.json(
        {
          ok: false,
          step: "config",
          message:
            "OAuth callback incompleto o Supabase no configurado. Revisa NEXT_PUBLIC_SUPABASE_URL, GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET."
        },
        { status: 400 }
      );
    }

    const state = decodeOauthState(stateValue);
    const { data: authData, error: authError } = authSupabase
      ? await authSupabase.auth.getUser()
      : { data: { user: null }, error: null };
    const user = authData.user;

    if (authError) {
      return NextResponse.json({ ok: false, step: "supabase_auth", message: authError.message }, { status: 401 });
    }

    if (!adminSupabase && user?.id !== state.userId) {
      return NextResponse.json(
        {
          ok: false,
          step: "supabase_session",
          message: "La sesion de Supabase no coincide con OAuth. Volve a iniciar sesion y reconecta Google."
        },
        { status: 401 }
      );
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: state.redirectUri,
        grant_type: "authorization_code"
      })
    });

    const token = (await response.json()) as GoogleTokenResponse;

    if (!response.ok || !token.access_token) {
      return NextResponse.json(
        {
          ok: false,
          step: "google_token",
          message: token.error_description || token.error || "No se pudo obtener token de Google."
        },
        { status: 400 }
      );
    }

    const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null;

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: state.userId,
      email: user?.email ?? null
    });

    if (profileError) {
      return NextResponse.json(
        {
          ok: false,
          step: "profiles_upsert",
          message: profileError.message,
          hint: "Ejecuta supabase/schema.sql en el SQL editor de Supabase y verifica que estes logueado."
        },
        { status: 500 }
      );
    }

    const { data: existing, error: existingError } = await supabase
      .from("oauth_tokens")
      .select("refresh_token_encrypted")
      .eq("user_id", state.userId)
      .eq("provider", "google_health")
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        {
          ok: false,
          step: "oauth_tokens_select",
          message: existingError.message,
          hint: "Ejecuta supabase/schema.sql en el SQL editor de Supabase."
        },
        { status: 500 }
      );
    }

    const refreshToken = token.refresh_token
      ? encryptToken(token.refresh_token)
      : existing?.refresh_token_encrypted;

    if (!refreshToken) {
      return NextResponse.json(
        {
          ok: false,
          step: "google_refresh_token",
          message: "Google no devolvio refresh_token. Reintenta con prompt=consent o revoca el acceso anterior."
        },
        { status: 400 }
      );
    }

    const { error: upsertError } = await supabase.from("oauth_tokens").upsert({
      user_id: state.userId,
      provider: "google_health",
      access_token_encrypted: encryptToken(token.access_token),
      refresh_token_encrypted: refreshToken,
      expires_at: expiresAt,
      scopes: token.scope?.split(" ") ?? [],
      updated_at: new Date().toISOString()
    });

    if (upsertError) {
      return NextResponse.json(
        {
          ok: false,
          step: "oauth_tokens_upsert",
          message: upsertError.message,
          hint: "Ejecuta supabase/schema.sql en el SQL editor de Supabase y verifica RLS."
        },
        { status: 500 }
      );
    }

    return NextResponse.redirect(new URL("/?google_health=connected", request.url));
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        step: "unexpected",
        message: error instanceof Error ? error.message : "Error inesperado en callback de Google."
      },
      { status: 500 }
    );
  }
}
