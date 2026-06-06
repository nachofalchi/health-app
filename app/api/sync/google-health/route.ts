import { NextResponse } from "next/server";
import { syncGoogleHealth } from "@/lib/google-health";
import { getAppUserContext } from "@/lib/app-user";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createClient } from "@/utils/supabase/server";

async function handleSync(request: Request) {
  const secret = process.env.SYNC_SECRET;
  const urlParams = new URL(request.url).searchParams;
  const authQuery = urlParams.get("secret");
  const authorization = request.headers.get("authorization");
  
  const isSecretAuthorized = Boolean(
    secret && 
    (authorization === `Bearer ${secret}` || authQuery === secret)
  );

  const authSupabase = await createClient();
  const user = authSupabase ? (await authSupabase.auth.getUser()).data.user : null;
  const appUser = !user && !isSecretAuthorized ? await getAppUserContext() : null;
  const supabase = isSecretAuthorized ? createSupabaseAdmin() || authSupabase : appUser?.supabase || authSupabase;
  
  let userId = user?.id || request.headers.get("x-user-id") || urlParams.get("userId");
  userId ||= appUser?.userId ?? null;

  if (!userId && !isSecretAuthorized) {
    return NextResponse.json({ ok: false, message: "Falta sesión de Supabase o SYNC_SECRET válido." }, { status: 401 });
  }

  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase no está configurado." }, { status: 500 });
  }

  if (!userId && isSecretAuthorized) {
    const { data: tokens, error } = await supabase
      .from("oauth_tokens")
      .select("user_id")
      .eq("provider", "google_health");

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ ok: true, message: "No hay cuentas de Google Health conectadas." });
    }

    const results = [];
    for (const t of tokens) {
      try {
        const syncResult = await syncGoogleHealth(supabase, t.user_id);
        results.push({ userId: t.user_id, status: "success", result: syncResult });
      } catch (err: any) {
        results.push({ userId: t.user_id, status: "error", message: err.message });
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Sincronización automatizada de ${tokens.length} cuentas completada.`,
      results
    });
  }

  if (!userId) {
    return NextResponse.json({ ok: false, message: "No hay usuario con Google Health conectado." }, { status: 400 });
  }

  const result = await syncGoogleHealth(supabase, userId);

  return NextResponse.json({
    ok: true,
    result
  });
}

export async function GET(request: Request) {
  return handleSync(request);
}

export async function POST(request: Request) {
  return handleSync(request);
}

