import { NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/app-user";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createClient } from "@/utils/supabase/server";
import { calculateScoresAndInsights } from "@/lib/scoring";

export async function GET(request: Request) {
  try {
    const authSupabase = await createClient();
    const user = authSupabase ? (await authSupabase.auth.getUser()).data.user : null;
    const appUser = !user ? await getAppUserContext() : null;
    const supabase = appUser?.supabase || authSupabase || createSupabaseAdmin();
    const userId = user?.id || appUser?.userId;

    if (!userId) {
      return NextResponse.json({ ok: false, message: "Falta usuario autenticado." }, { status: 401 });
    }

    if (!supabase) {
      return NextResponse.json({ ok: false, message: "Supabase no está configurado." }, { status: 500 });
    }

    // 1. Fetch templates with their exercises and catalog details
    const { data: templates, error: tempError } = await supabase
      .from("workout_templates")
      .select("*, workout_template_exercises(*, exercise_catalog(*))")
      .or(`user_id.is.null,user_id.eq.${userId}`);

    if (tempError) throw tempError;

    // 2. Fetch exercises catalog
    const { data: exercises, error: exError } = await supabase
      .from("exercise_catalog")
      .select("*")
      .order("name", { ascending: true });

    if (exError) throw exError;

    // 3. Fetch muscle groups catalog
    const { data: muscleGroups, error: mgError } = await supabase
      .from("muscle_groups")
      .select("*");

    if (mgError) throw mgError;

    // 4. Fetch muscle volume for the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const dateLimit = sevenDaysAgo.toISOString().slice(0, 10);

    const { data: volumeRows, error: volError } = await supabase
      .from("muscle_volume_daily")
      .select("*")
      .eq("user_id", userId)
      .gte("date", dateLimit);

    if (volError) throw volError;

    // 5. Fetch workout history (last 5 sessions)
    const { data: history, error: histError } = await supabase
      .from("workout_sessions")
      .select("*, workout_templates(name)")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .order("start_time", { ascending: false })
      .limit(5);

    if (histError) throw histError;

    return NextResponse.json({
      ok: true,
      templates: templates || [],
      exercises: exercises || [],
      muscleGroups: muscleGroups || [],
      volumeWeekly: volumeRows || [],
      history: history || []
    });
  } catch (err: any) {
    console.error("Error in GET /api/workouts:", err);
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const authSupabase = await createClient();
    const user = authSupabase ? (await authSupabase.auth.getUser()).data.user : null;
    const appUser = !user ? await getAppUserContext() : null;
    const supabase = appUser?.supabase || authSupabase || createSupabaseAdmin();
    const userId = user?.id || appUser?.userId;

    if (!userId) {
      return NextResponse.json({ ok: false, message: "Falta usuario autenticado." }, { status: 401 });
    }

    if (!supabase) {
      return NextResponse.json({ ok: false, message: "Supabase no está configurado." }, { status: 500 });
    }

    const body = await request.json();
    const date = body.date || new Date().toISOString().slice(0, 10);

    let exercisesPayload = [];

    // --- QUICK LOG SHORTCUT FOR 'Rutina de casa' ---
    if (body.quick_log) {
      const { data: tempExs, error: tempError } = await supabase
        .from("workout_template_exercises")
        .select("exercise_id, section, default_sets, default_reps, default_duration_seconds")
        .eq("template_id", "c5a5b5a5-d5a5-45d5-95a5-f5a5b5a5c5a5")
        .order("order_index", { ascending: true });
        
      if (tempError || !tempExs || tempExs.length === 0) {
        console.error("Default template exercises lookup failed:", tempError);
        return NextResponse.json({ ok: false, message: "No se pudo cargar la plantilla 'Rutina de casa' por defecto." }, { status: 500 });
      }

      exercisesPayload = tempExs.map((te, idx) => {
        const sets = [];
        const isWarmup = te.section === "warmup";
        const count = te.default_sets || 3;
        
        for (let s = 1; s <= count; s++) {
          let reps = te.default_reps;
          // Custom reps for pushups (flexiones) if provided
          if (te.exercise_id === "f4c718a2-23c2-4841-9de3-cde11ffb0762" && body.flexionesReps) {
            reps = parseInt(body.flexionesReps, 10) || 10;
          } else if (reps === null || reps === undefined) {
            reps = 10;
          }
          
          sets.push({
            set_number: s,
            reps,
            weight_kg: 0,
            duration_seconds: te.default_duration_seconds || null,
            is_warmup: isWarmup,
            completed: true
          });
        }

        return {
          exercise_id: te.exercise_id,
          order_index: idx + 1,
          section: te.section,
          sets
        };
      });
    } else {
      exercisesPayload = body.exercises || [];
    }

    if (exercisesPayload.length === 0) {
      if (body.pain_spots && Array.isArray(body.pain_spots)) {
        for (const spot of body.pain_spots) {
          if (spot.intensity > 0) {
            const { error: painError } = await supabase.from("symptoms").insert({
              user_id: userId,
              date: date,
              type: "pain",
              location: spot.spot,
              intensity: Math.min(5, Math.max(1, Math.round(spot.intensity))),
              notes: body.notes || "Reportado manualmente"
            });
            if (painError) {
              console.error("Error inserting manual pain spot:", painError);
            }
          }
        }

        calculateScoresAndInsights(supabase, userId, date).catch(err => {
          console.error("Background score recalculation failed post-pain log:", err);
        });

        return NextResponse.json({ ok: true, message: "Molestias registradas." });
      }

      return NextResponse.json({ ok: false, message: "No se enviaron ejercicios para registrar." }, { status: 400 });
    }

    // 1. Insert Workout Session
    const { data: session, error: sessionError } = await supabase
      .from("workout_sessions")
      .insert({
        user_id: userId,
        template_id: body.template_id || (body.quick_log ? "c5a5b5a5-d5a5-45d5-95a5-f5a5b5a5c5a5" : null),
        name: body.name || (body.quick_log ? "Rutina de casa" : "Entrenamiento libre"),
        date: date,
        start_time: body.start_time || new Date().toISOString(),
        end_time: body.end_time || new Date().toISOString(),
        duration_minutes: body.duration_minutes || (body.quick_log ? 25 : null),
        source: body.source || "manual",
        session_rpe: body.session_rpe || null,
        energy_before: body.energy_before || null,
        energy_after: body.energy_after || null,
        notes: body.notes || null
      })
      .select()
      .single();

    if (sessionError) {
      console.error("Error creating workout session:", sessionError);
      return NextResponse.json({ ok: false, message: `Error al crear sesión: ${sessionError.message}` }, { status: 500 });
    }

    // 2. Loop & Insert exercises and sets
    for (const ex of exercisesPayload) {
      const { data: sessionEx, error: exError } = await supabase
        .from("workout_session_exercises")
        .insert({
          workout_session_id: session.id,
          exercise_id: ex.exercise_id,
          order_index: ex.order_index,
          section: ex.section || "main",
          notes: ex.notes || null
        })
        .select()
        .single();
      
      if (exError) {
        console.error("Error inserting workout session exercise:", exError);
        return NextResponse.json({ ok: false, message: `Error al insertar ejercicio: ${exError.message}` }, { status: 500 });
      }

      for (const set of ex.sets) {
        const { error: setError } = await supabase
          .from("workout_sets")
          .insert({
            workout_session_exercise_id: sessionEx.id,
            set_number: set.set_number,
            reps: set.reps !== undefined ? set.reps : null,
            weight_kg: set.weight_kg || 0,
            duration_seconds: set.duration_seconds || null,
            rir: set.rir !== undefined ? set.rir : null,
            rpe: set.rpe || null,
            is_warmup: set.is_warmup || false,
            completed: set.completed !== undefined ? set.completed : true,
            side: set.side || "both",
            notes: set.notes || null
          });
        
        if (setError) {
          console.error("Error inserting workout set:", setError);
          return NextResponse.json({ ok: false, message: `Error al insertar set: ${setError.message}` }, { status: 500 });
        }
      }
    }

    // 3. Save pain spots as symptoms if reported
    if (body.pain_spots && Array.isArray(body.pain_spots)) {
      for (const spot of body.pain_spots) {
        if (spot.intensity > 0) {
          const { error: painError } = await supabase.from("symptoms").insert({
            user_id: userId,
            date: date,
            type: "pain",
            location: spot.spot,
            intensity: Math.min(5, Math.max(1, Math.round(spot.intensity))),
            notes: `Reportado post-entrenamiento: ${session.name}`
          });
          if (painError) {
            console.error("Error inserting post-workout pain spot:", painError);
          }
        }
      }
    }

    // 4. Calculate muscle volume and update muscle_volume_daily table
    try {
      // Fetch all sessions on this date to compute total daily volume
      const { data: dateSessions } = await supabase
        .from("workout_sessions")
        .select("id")
        .eq("user_id", userId)
        .eq("date", date);

      if (dateSessions && dateSessions.length > 0) {
        const sessionIds = dateSessions.map(s => s.id);
        
        // Fetch session exercises
        const { data: sessExs } = await supabase
          .from("workout_session_exercises")
          .select("id, exercise_id")
          .in("workout_session_id", sessionIds);

        if (sessExs && sessExs.length > 0) {
          const sessExIds = sessExs.map(se => se.id);
          const exerciseIds = [...new Set(sessExs.map(se => se.exercise_id))];

          // Fetch sets
          const { data: sets } = await supabase
            .from("workout_sets")
            .select("id, workout_session_exercise_id")
            .in("workout_session_exercise_id", sessExIds)
            .eq("completed", true)
            .eq("is_warmup", false);

          // Fetch exercise catalog muscle mapping
          const { data: muscleMap } = await supabase
            .from("exercise_catalog_muscle_map")
            .select("exercise_id, muscle_group_id, contribution_percent")
            .in("exercise_id", exerciseIds);

          if (sets && sets.length > 0 && muscleMap && muscleMap.length > 0) {
            const muscleTotals: Record<string, number> = {};

            for (const set of sets) {
              const sessEx = sessExs.find(se => se.id === set.workout_session_exercise_id);
              if (!sessEx) continue;

              const maps = muscleMap.filter(m => m.exercise_id === sessEx.exercise_id);
              for (const map of maps) {
                const contr = Number(map.contribution_percent) / 100;
                muscleTotals[map.muscle_group_id] = (muscleTotals[map.muscle_group_id] || 0) + contr;
              }
            }

            // Clear old values for this date
            await supabase.from("muscle_volume_daily").delete().eq("user_id", userId).eq("date", date);

            // Insert new totals
            for (const [muscleGroupId, hardSets] of Object.entries(muscleTotals)) {
              if (hardSets > 0) {
                const { error: volErr } = await supabase.from("muscle_volume_daily").insert({
                  user_id: userId,
                  date: date,
                  muscle_group_id: muscleGroupId,
                  hard_sets: Math.round(hardSets * 100) / 100,
                  source: "manual"
                });
                if (volErr) {
                  console.error("Error upserting muscle volume daily:", volErr);
                }
              }
            }
          }
        }
      }
    } catch (volErr) {
      console.error("Non-fatal error computing muscle volume:", volErr);
    }

    // 5. Trigger v2 score calculation in background (non-blocking)
    calculateScoresAndInsights(supabase, userId, date).catch(err => {
      console.error("Background score recalculation failed post-workout:", err);
    });

    return NextResponse.json({ ok: true, sessionId: session.id });
  } catch (err: any) {
    console.error("Error in POST /api/workouts/session:", err);
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
