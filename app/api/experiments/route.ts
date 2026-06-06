import { NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/app-user";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  const authSupabase = await createClient();
  const user = authSupabase ? (await authSupabase.auth.getUser()).data.user : null;
  const appUser = !user ? await getAppUserContext() : null;
  const supabase = appUser?.supabase || authSupabase || createSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase no configurado" }, { status: 503 });
  }

  const userId = user?.id || appUser?.userId;
  if (!userId) {
    return NextResponse.json({ ok: false, message: "Falta usuario autenticado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, hypothesis, metric, baseline_start, intervention_start, intervention_end } = body;

    if (!title || !metric || !baseline_start || !intervention_start) {
      return NextResponse.json({ ok: false, message: "Faltan campos obligatorios" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("experiments")
      .insert({
        user_id: userId,
        title,
        hypothesis,
        metric,
        baseline_start,
        intervention_start,
        intervention_end: intervention_end || null,
        result_json: {},
        confidence: "medium"
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ ok: false, message: "Falta ID del experimento" }, { status: 400 });
  }

  const authSupabase = await createClient();
  const user = authSupabase ? (await authSupabase.auth.getUser()).data.user : null;
  const appUser = !user ? await getAppUserContext() : null;
  const supabase = appUser?.supabase || authSupabase || createSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase no configurado" }, { status: 503 });
  }

  const userId = user?.id || appUser?.userId;
  if (!userId) {
    return NextResponse.json({ ok: false, message: "Falta usuario autenticado." }, { status: 401 });
  }

  const { error } = await supabase
    .from("experiments")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
