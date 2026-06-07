import { NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/app-user";
import { parseManualLog } from "@/lib/manual-log";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createClient } from "@/utils/supabase/server";
import { calculateScoresAndInsights } from "@/lib/scoring";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const log = parseManualLog(formData);
    const authSupabase = await createClient();
    const user = authSupabase ? (await authSupabase.auth.getUser()).data.user : null;
    const appUser = !user ? await getAppUserContext() : null;
    const supabase = appUser?.supabase || authSupabase || createSupabaseAdmin();

    if (!supabase) {
      return NextResponse.json(
        {
          ok: false,
          message: "Supabase no está configurado todavía. El formulario ya está listo para conectarse."
        },
        { status: 503 }
      );
    }

    let today = new Date().toISOString().slice(0, 10);
    if (log.local_date && /^\d{4}-\d{2}-\d{2}$/.test(log.local_date)) {
      today = log.local_date;
    }
    const userId = user?.id || appUser?.userId;

    if (!userId) {
      return NextResponse.json({ ok: false, message: "Falta usuario autenticado." }, { status: 401 });
    }

    const { error } = await supabase.from("manual_daily_logs").upsert(
      {
        user_id: userId,
        date: today,
        energy_score: log.energy_score ?? null,
        mood_score: log.mood_score ?? null,
        stress_score: log.stress_score ?? null,
        caffeine_consumed: log.caffeine_consumed,
        caffeine_amount: log.caffeine_amount ?? null,
        last_caffeine_time: log.last_caffeine_time ?? null,
        alcohol_level: log.alcohol_level ?? "none",
        keto_adherence: log.keto_adherence ? "yes" : null,
        heavy_meal_at_night: log.heavy_meal_at_night,
        notes: log.notes || null,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id,date" }
    );

    if (error) {
      console.error("Error saving manual daily logs:", error);
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    if (log.systolic && log.diastolic) {
      const { error: bpError } = await supabase.from("blood_pressure_measurements").insert({
        user_id: userId,
        measured_at: new Date().toISOString(),
        systolic: log.systolic,
        diastolic: log.diastolic,
        pulse: log.pulse ?? null,
        context: "manual"
      });
      if (bpError) {
        console.error("Error saving blood pressure measurements:", bpError);
        return NextResponse.json({ ok: false, message: `Error de presión arterial: ${bpError.message}` }, { status: 500 });
      }
    }

    const bodyFields = [
      "weight_kg", "body_fat_percentage", "muscle_mass_kg", "water_percentage",
      "neck_cm", "shoulders_chest_cm",
      "arm_right_relaxed_cm", "arm_right_contracted_cm",
      "arm_left_relaxed_cm", "arm_left_contracted_cm",
      "waist_cm", "abdomen_cm", "hips_cm",
      "thigh_right_cm", "thigh_left_cm",
      "calf_right_cm", "calf_left_cm"
    ];
    
    const hasBodyMetrics = bodyFields.some(field => (log as any)[field] !== undefined);

    if (hasBodyMetrics) {
      const groupKey = `manual-${today}`;
      const measuredAt = new Date(`${today}T12:00:00Z`).toISOString();

      const { data: existing } = await supabase
        .from("body_measurements")
        .select("*")
        .eq("user_id", userId)
        .eq("measurement_group_key", groupKey)
        .maybeSingle();

      const mergedData: any = {
        user_id: userId,
        measured_at: measuredAt,
        measurement_group_key: groupKey,
        source_platform: "manual",
        source_application: "Salud Nacho"
      };

      bodyFields.forEach(field => {
        const val = (log as any)[field];
        if (val !== undefined) {
          mergedData[field] = val;
        } else if (existing && existing[field] !== undefined && existing[field] !== null) {
          mergedData[field] = existing[field];
        } else {
          mergedData[field] = null;
        }
      });

      const { error: bodyError } = await supabase.from("body_measurements").upsert(mergedData, { onConflict: "user_id,measurement_group_key" });
      if (bodyError) {
        console.error("Error saving body measurements:", bodyError);
        return NextResponse.json({ ok: false, message: `Error de medidas corporales: ${bodyError.message}` }, { status: 500 });
      }
    }

    if (log.pain_present) {
      const { error: painError } = await supabase.from("symptoms").insert({
        user_id: userId,
        date: today,
        type: "pain",
        intensity: null,
        notes: log.notes || null
      });
      if (painError) {
        console.error("Error saving pain symptoms:", painError);
        return NextResponse.json({ ok: false, message: `Error de síntomas: ${painError.message}` }, { status: 500 });
      }
    }

    // Recalculate scores and insights after saving manual log
    // This ensures scores update even without a Google Health sync
    try {
      await calculateScoresAndInsights(supabase, userId, today);
    } catch (err: any) {
      console.warn("Calculación no fatal falló:", err.message);
      // Non-fatal: score recalculation failure should not fail the log save
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Unhandled error in manual-log POST endpoint:", err);
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "Error interno del servidor" },
      { status: 500 }
    );
  }
}
