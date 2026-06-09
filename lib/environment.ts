import { SupabaseClient } from "@supabase/supabase-js";
import type { UserEnvironmentSettings, EnvironmentForecast } from "./types";

export interface DailySummary {
  date: string;
  min_msl: number;
  max_msl: number;
  avg_msl: number;
  min_surf: number;
  max_surf: number;
  avg_surf: number;
  high_hours: number;
  crosses: boolean;
  raw_payload: any;
}

/**
 * Fetches the 7-day weather forecast from Open-Meteo API.
 */
export async function fetchOpenMeteoForecast(
  latitude: number,
  longitude: number,
  timezone: string
) {
  const tz = timezone || "auto";
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=pressure_msl,surface_pressure&timezone=${encodeURIComponent(tz)}&forecast_days=7`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Error al consultar Open-Meteo: Código HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Groups hourly readings by date (YYYY-MM-DD) and computes daily statistics.
 */
export function processHourlyForecast(
  hourlyData: { time: string[]; pressure_msl: number[]; surface_pressure: number[] },
  thresholdHpa: number,
  alertSustainedOnly: boolean
): DailySummary[] {
  const { time, pressure_msl, surface_pressure } = hourlyData;
  if (!time || !pressure_msl || !surface_pressure) {
    throw new Error("Formato de respuesta de Open-Meteo inválido.");
  }

  // Group readings by date string (YYYY-MM-DD)
  const groups: Record<string, { msl: number[]; surf: number[]; rawTimes: string[] }> = {};

  for (let i = 0; i < time.length; i++) {
    const dateTimeStr = time[i]; // e.g. "2026-06-09T00:00"
    const dateStr = dateTimeStr.slice(0, 10); // "2026-06-09"
    
    if (!groups[dateStr]) {
      groups[dateStr] = { msl: [], surf: [], rawTimes: [] };
    }

    const msl = pressure_msl[i];
    const surf = surface_pressure[i];

    if (typeof msl === "number" && !isNaN(msl)) {
      groups[dateStr].msl.push(msl);
    }
    if (typeof surf === "number" && !isNaN(surf)) {
      groups[dateStr].surf.push(surf);
    }
    groups[dateStr].rawTimes.push(dateTimeStr);
  }

  const summaries: DailySummary[] = [];

  for (const [date, data] of Object.entries(groups)) {
    if (data.msl.length === 0 || data.surf.length === 0) continue;

    const min_msl = Math.min(...data.msl);
    const max_msl = Math.max(...data.msl);
    const avg_msl = Math.round((data.msl.reduce((a, b) => a + b, 0) / data.msl.length) * 10) / 10;

    const min_surf = Math.min(...data.surf);
    const max_surf = Math.max(...data.surf);
    const avg_surf = Math.round((data.surf.reduce((a, b) => a + b, 0) / data.surf.length) * 10) / 10;

    const high_hours = data.msl.filter(val => val >= thresholdHpa).length;
    const crosses = alertSustainedOnly ? (high_hours >= 3) : (max_msl >= thresholdHpa);

    summaries.push({
      date,
      min_msl,
      max_msl,
      avg_msl,
      min_surf,
      max_surf,
      avg_surf,
      high_hours,
      crosses,
      raw_payload: {
        times: data.rawTimes,
        pressure_msl: data.msl,
        surface_pressure: data.surf
      }
    });
  }

  return summaries;
}

/**
 * Updates/refreshes the cached environment forecasts in the database.
 */
export async function updateUserForecasts(
  supabase: SupabaseClient,
  userId: string,
  settings: UserEnvironmentSettings
): Promise<EnvironmentForecast[]> {
  const lat = settings.location_latitude;
  const lon = settings.location_longitude;

  if (lat === null || lon === null || isNaN(Number(lat)) || isNaN(Number(lon))) {
    throw new Error("Las coordenadas de ubicación no están configuradas correctamente.");
  }

  const tz = settings.location_timezone || "auto";
  const rawData = await fetchOpenMeteoForecast(Number(lat), Number(lon), tz);
  
  if (!rawData.hourly) {
    throw new Error("No se obtuvieron datos horarios en la respuesta del clima.");
  }

  const threshold = settings.atmospheric_pressure_threshold_hpa;
  const sustainedOnly = settings.alert_sustained_pressure_only;

  const processed = processHourlyForecast(rawData.hourly, threshold, sustainedOnly);

  const forecastRows = processed.map(summary => ({
    user_id: userId,
    provider: settings.weather_provider || "open_meteo",
    latitude: Number(lat),
    longitude: Number(lon),
    timezone: tz,
    forecast_date: summary.date,
    fetched_at: new Date().toISOString(),
    pressure_msl_min_hpa: summary.min_msl,
    pressure_msl_max_hpa: summary.max_msl,
    pressure_msl_avg_hpa: summary.avg_msl,
    surface_pressure_min_hpa: summary.min_surf,
    surface_pressure_max_hpa: summary.max_surf,
    surface_pressure_avg_hpa: summary.avg_surf,
    high_pressure_hours: summary.high_hours,
    threshold_hpa_used: threshold,
    crosses_threshold: summary.crosses,
    raw_payload: summary.raw_payload
  }));

  // Perform upsert
  const { data, error } = await supabase
    .from("environment_forecasts")
    .upsert(forecastRows, { onConflict: "user_id,forecast_date" })
    .select();

  if (error) {
    throw new Error(`Error al almacenar forecasts de clima: ${error.message}`);
  }

  return data as EnvironmentForecast[];
}
