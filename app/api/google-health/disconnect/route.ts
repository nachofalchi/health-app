import { NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/app-user";

export async function POST() {
  const appUser = await getAppUserContext();
  if (!appUser) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }

  const { supabase, userId } = appUser;
  const { error } = await supabase
    .from("oauth_tokens")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "google_health");

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "Google Health desvinculado con éxito." });
}
