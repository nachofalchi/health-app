import { NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/app-user";
import { updateUserForecasts } from "@/lib/environment";

export async function POST() {
  const appUser = await getAppUserContext();
  if (!appUser) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }

  const { supabase, userId } = appUser;
  try {
    // Fetch the user settings first to get the location coordinates
    const { data: settings, error: settingsError } = await supabase
      .from("user_environment_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (settingsError) {
      return NextResponse.json({ ok: false, message: settingsError.message }, { status: 500 });
    }

    if (!settings || !settings.atmospheric_pressure_tracking_enabled) {
      return NextResponse.json({
        ok: false,
        message: "El seguimiento de presión atmosférica no está habilitado."
      }, { status: 400 });
    }

    if (settings.location_latitude === null || settings.location_longitude === null) {
      return NextResponse.json({
        ok: false,
        message: "La ubicación no está configurada. Por favor establece una latitud y longitud primero."
      }, { status: 400 });
    }

    // Call update forecasts
    const forecasts = await updateUserForecasts(supabase, userId, settings);

    return NextResponse.json({
      ok: true,
      message: "Presión atmosférica actualizada con éxito.",
      forecasts
    });
  } catch (err: any) {
    console.error("Error manual refresh forecast:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
