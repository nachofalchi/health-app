import { NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/app-user";
import { updateUserForecasts } from "@/lib/environment";

const DEFAULT_SETTINGS = {
  atmospheric_pressure_tracking_enabled: false,
  atmospheric_pressure_threshold_hpa: 1025,
  weather_provider: "open_meteo",
  alert_sustained_pressure_only: true,
  location_name: null,
  location_latitude: null,
  location_longitude: null,
  location_timezone: null
};

export async function GET() {
  const appUser = await getAppUserContext();
  if (!appUser) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }

  const { supabase, userId } = appUser;
  try {
    const { data, error } = await supabase
      .from("user_environment_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, settings: data || DEFAULT_SETTINGS });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const appUser = await getAppUserContext();
  if (!appUser) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }

  const { supabase, userId } = appUser;
  try {
    const body = await request.json();
    const {
      atmospheric_pressure_tracking_enabled,
      atmospheric_pressure_threshold_hpa,
      weather_provider,
      alert_sustained_pressure_only,
      location_name,
      location_latitude,
      location_longitude,
      location_timezone
    } = body;

    const payload = {
      user_id: userId,
      atmospheric_pressure_tracking_enabled: Boolean(atmospheric_pressure_tracking_enabled),
      atmospheric_pressure_threshold_hpa: Number(atmospheric_pressure_threshold_hpa) || 1025,
      weather_provider: weather_provider || "open_meteo",
      alert_sustained_pressure_only: alert_sustained_pressure_only !== false,
      location_name: location_name || null,
      location_latitude: location_latitude !== null && location_latitude !== undefined ? Number(location_latitude) : null,
      location_longitude: location_longitude !== null && location_longitude !== undefined ? Number(location_longitude) : null,
      location_timezone: location_timezone || null,
      updated_at: new Date().toISOString()
    };

    const { data: savedSettings, error } = await supabase
      .from("user_environment_settings")
      .upsert(payload, { onConflict: "user_id" })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    let forecastUpdated = false;
    let forecastErrorMsg = null;

    // If tracking is enabled and location coordinates are provided, try to pre-fetch/update forecasts
    if (
      savedSettings.atmospheric_pressure_tracking_enabled &&
      savedSettings.location_latitude !== null &&
      savedSettings.location_longitude !== null
    ) {
      try {
        await updateUserForecasts(supabase, userId, savedSettings);
        forecastUpdated = true;
      } catch (err: any) {
        console.error("Error al actualizar forecast en save de settings:", err);
        forecastErrorMsg = err.message || "Fallo en Open-Meteo";
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Configuración guardada con éxito.",
      settings: savedSettings,
      forecastUpdated,
      forecastError: forecastErrorMsg
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
