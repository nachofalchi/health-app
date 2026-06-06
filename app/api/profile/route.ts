import { NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/app-user";

export async function POST(request: Request) {
  const appUser = await getAppUserContext();
  if (!appUser) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }

  const { supabase, userId } = appUser;
  try {
    const body = await request.json();
    const { height_cm, target_weight_kg, age, gender, activity_level } = body;

    const { error } = await supabase
      .from("profiles")
      .update({
        height_cm: height_cm ? Number(height_cm) : null,
        target_weight_kg: target_weight_kg ? Number(target_weight_kg) : null,
        age: age ? Number(age) : null,
        gender: gender || null,
        activity_level: activity_level || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", userId);

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "Perfil guardado con éxito." });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
