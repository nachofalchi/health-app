import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DailyMetric, BodyMeasurement } from "@/lib/types";

/**
 * Unified scoring module for Salud Nacho.
 *
 * All score calculation logic lives here. Import from this module instead of
 * duplicating formulas across google-health.ts and dashboard-data.ts.
 */

// ─── Sub-score formulas ────────────────────────────────────────────────────────

export function scoreFromSteps(steps?: number | null): number | null {
  if (steps === null || steps === undefined) return null;
  return Math.max(35, Math.min(95, Math.round((steps / 10000) * 82)));
}

export function scoreFromSleep(minutes?: number | null): number | null {
  if (minutes === null || minutes === undefined) return null;
  if (minutes >= 420 && minutes <= 540) return 82;
  if (minutes >= 360) return 68;
  return 48;
}

export function scoreFromHRV(hrv?: number | null): number | null {
  if (hrv === null || hrv === undefined) return null;
  if (hrv >= 60) return 88;
  if (hrv >= 40) return 72;
  if (hrv >= 25) return 58;
  return 42;
}

export function scoreFromRestingHR(hr?: number | null): number | null {
  if (hr === null || hr === undefined) return null;
  if (hr <= 55) return 85;
  if (hr <= 65) return 72;
  if (hr <= 75) return 58;
  return 42;
}

export function calculateOverallScore(
  scores: Array<number | null | undefined>
): number | null {
  const valid = scores.filter((s): s is number => typeof s === "number" && s !== null && !isNaN(s));
  if (!valid.length) return null;
  return Math.round(valid.reduce((sum, s) => sum + s, 0) / valid.length);
}

// ─── Main scoring + insights function ────────────────────────────────────────

/**
 * Calculates scores and inserts insights for a given user based on recent data.
 * Callable from both sync (google-health.ts) and manual log (api/manual-log).
 *
 * @param supabase  - Supabase client with appropriate permissions
 * @param userId    - The user's UUID
 * @param targetDate - Optional: specific date to score. Defaults to most recent metric date.
 */
export async function calculateScoresAndInsights(
  supabase: SupabaseClient,
  userId: string,
  targetDate?: string
): Promise<{ scores: number; insights: number }> {
  const metricsQuery = supabase
    .from("daily_metrics")
    .select("date,steps,sleep_minutes,resting_hr,hrv")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(7);

  const [{ data: metrics }, { data: bodyRows }, { data: manualLogs }] = await Promise.all([
    metricsQuery,
    supabase
      .from("body_measurements")
      .select("measured_at,weight_kg,body_fat_percentage,source_platform")
      .eq("user_id", userId)
      .order("measured_at", { ascending: false })
      .limit(1),
    supabase
      .from("manual_daily_logs")
      .select("date,energy_score,mood_score,stress_score")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(1)
  ]);

  const latest = targetDate
    ? (metrics ?? []).find((m) => m.date === targetDate) ?? {
        date: targetDate,
        steps: null,
        distance_meters: null,
        calories_kcal: null,
        active_minutes: null,
        sleep_minutes: null,
        resting_hr: null,
        hrv: null,
        spo2: null,
        respiratory_rate: null,
        deep_sleep_minutes: null,
        rem_sleep_minutes: null,
        light_sleep_minutes: null,
        awake_minutes: null,
        vo2max: null
      }
    : (metrics ?? [])[0];

  if (!latest) return { scores: 0, insights: 0 };

  const activityScore = scoreFromSteps(latest.steps);
  const sleepScore = scoreFromSleep(latest.sleep_minutes);
  const compositionScore = bodyRows?.length ? 70 : null;
  const cardiovascularScore = scoreFromRestingHR(latest.resting_hr);
  const hrvScore = scoreFromHRV(latest.hrv);

  const recoveryParts = [sleepScore, hrvScore].filter((v): v is number => v !== null);
  const recoveryScore = recoveryParts.length > 0
    ? Math.round(recoveryParts.reduce((a, b) => a + b, 0) / recoveryParts.length)
    : null;

  // Factor in subjective wellbeing if available
  const latestManual = (manualLogs ?? [])[0];
  const subjectiveScore =
    latestManual?.energy_score && latestManual?.mood_score
      ? Math.round(((latestManual.energy_score + latestManual.mood_score) / 2) * 20)
      : null;
  const stressModifier =
    latestManual?.stress_score && latestManual.stress_score >= 4 ? -10 : 0;
  const wellbeingScore = subjectiveScore !== null
    ? Math.max(25, Math.min(90, subjectiveScore + stressModifier))
    : null;

  const overallScore = calculateOverallScore([
    activityScore,
    sleepScore,
    compositionScore,
    cardiovascularScore,
    recoveryScore,
    wellbeingScore
  ]);

  const { error: scoreError } = await supabase.from("scores").upsert(
    {
      user_id: userId,
      date: latest.date,
      recovery_score: recoveryScore,
      sleep_score: sleepScore,
      training_score: activityScore,
      cardiovascular_score: cardiovascularScore,
      body_composition_score: compositionScore,
      wellbeing_score: wellbeingScore,
      overall_score: overallScore,
      calculation_version: "v1",
      explanation_json: {
        steps: latest.steps,
        sleep_minutes: latest.sleep_minutes,
        resting_hr: latest.resting_hr,
        hrv: latest.hrv,
        energy_score: latestManual?.energy_score,
        mood_score: latestManual?.mood_score,
        stress_score: latestManual?.stress_score
      }
    },
    { onConflict: "user_id,date" }
  );

  if (scoreError) throw new Error(scoreError.message);

  const weeklySteps =
    metrics && metrics.length
      ? Math.round(metrics.reduce((sum, row) => sum + (row.steps ?? 0), 0) / metrics.length)
      : null;

  const insights = [
    {
      category: "activity",
      title: "Actividad sincronizada",
      explanation: `Ultimo dia con datos: ${latest.date}. Pasos: ${latest.steps ?? "sin dato"}.`,
      recommendation: weeklySteps
        ? `Promedio semanal actual: ${weeklySteps} pasos.`
        : "Sin promedio semanal suficiente.",
      confidence: metrics && metrics.length >= 3 ? "medium" : "low",
      supporting_data_json: { latest, weeklySteps }
    },
    {
      category: "body_composition",
      title: "Composicion corporal",
      explanation: bodyRows?.[0]
        ? `Ultima medicion disponible: ${bodyRows[0].weight_kg ?? "sin peso"} kg, ${bodyRows[0].body_fat_percentage ?? "sin grasa"}% grasa.`
        : "Todavia no hay medicion de composicion corporal.",
      recommendation: "Mirar tendencia de 2 a 4 semanas, no un punto aislado.",
      confidence: bodyRows?.[0] ? "medium" : "low",
      supporting_data_json: bodyRows?.[0] ?? {}
    }
  ];

  let insightCount = 0;
  for (const insight of insights) {
    const { error } = await supabase.from("insights").insert({
      user_id: userId,
      date: latest.date,
      ...insight
    });
    if (!error) insightCount += 1;
  }

  return { scores: 1, insights: insightCount };
}
