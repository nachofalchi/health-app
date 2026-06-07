import "server-only";
import { getAppUserContext } from "@/lib/app-user";
import { demoDay, sectorCards as demoSectorCards, weeklySummary as demoWeeklySummary } from "@/lib/demo-data";
import type {
  DailyMetric,
  BodyMeasurement,
  Exercise,
  ManualLog,
  BloodPressure,
  SyncRun,
  ScoreRow,
  InsightRow
} from "@/lib/types";
import { scoreFromSteps, calculateAdvancedScores, type HealthScores } from "@/lib/scoring";

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "sin dato";
  return new Intl.NumberFormat("es-AR").format(value);
}

function formatKg(value: number | null | undefined) {
  return typeof value === "number" ? `${value.toFixed(1)} kg` : "sin dato";
}

function formatPercent(value: number | null | undefined) {
  return typeof value === "number" ? `${value.toFixed(1)}%` : "sin dato";
}

function formatKm(value: number | null | undefined) {
  return typeof value === "number" ? `${(value / 1000).toFixed(2)} km` : "sin dato";
}

function average(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!valid.length) return null;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}


function bodyGroupKey(row: BodyMeasurement) {
  const minute = row.measured_at.slice(0, 16);
  return [minute, row.source_platform ?? ""].join("|");
}

function fuseBodyMeasurements(rows: BodyMeasurement[]) {
  const groups = new Map<string, BodyMeasurement>();

  for (const row of rows) {
    const key = bodyGroupKey(row);
    const current = groups.get(key);

    if (!current) {
      groups.set(key, { ...row });
      continue;
    }

    groups.set(key, {
      ...current,
      weight_kg: current.weight_kg ?? row.weight_kg,
      body_fat_percentage: current.body_fat_percentage ?? row.body_fat_percentage
    });
  }

  return [...groups.values()].sort((a, b) => Date.parse(b.measured_at) - Date.parse(a.measured_at));
}

function uniqueInsights(rows: InsightRow[]) {
  const seen = new Set<string>();
  const unique: InsightRow[] = [];

  for (const row of rows) {
    const key = row.title.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }

  return unique;
}

async function safeQuery<T>(query: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await query;
  if (error) return null;
  return data;
}

export async function getDashboardData(prefetchedUser?: Awaited<ReturnType<typeof getAppUserContext>>) {
  const appUser = prefetchedUser !== undefined ? prefetchedUser : await getAppUserContext();

  if (!appUser) {
    return {
      isReal: false,
      day: demoDay,
      sectorCards: demoSectorCards,
      weeklySummary: demoWeeklySummary,
      latestExercise: null,
      latestBodyMeasurement: null,
      latestMetric: null,
      latestManual: null,
      latestBloodPressure: null,
      latestSync: null,
      stepsSeries: [],
      dataCards: [],
      syncSummary: null,
      profile: null,
      isGoogleHealthConnected: false
    };
  }

  const { supabase, userId } = appUser;

  const [
    metrics,
    bodyMeasurements,
    exercises,
    manualLogs,
    bloodPressure,
    syncRuns,
    scores,
    dbInsights,
    dbExperiments,
    rawProfileRow,
    oauthRow,
    workoutSessions,
    muscleVolumeWeekly,
    recentSymptoms
  ] = await Promise.all([
    safeQuery(
      supabase
        .from("daily_metrics")
        .select("date,steps,distance_meters,calories_kcal,active_minutes,sleep_minutes,resting_hr,hrv,spo2,respiratory_rate")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(30)
    ),
    safeQuery(
      supabase
        .from("body_measurements")
        .select("*")
        .eq("user_id", userId)
        .order("measured_at", { ascending: false })
        .limit(50)
    ),
    safeQuery(
      supabase
        .from("exercises")
        .select("start_time,end_time,display_name,exercise_type,active_duration_seconds,steps,distance_meters,calories_kcal,average_heart_rate,source_platform")
        .eq("user_id", userId)
        .order("start_time", { ascending: false })
        .limit(1)
    ),
    safeQuery(
      supabase
        .from("manual_daily_logs")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(28)
    ),
    safeQuery(
      supabase
        .from("blood_pressure_measurements")
        .select("*")
        .eq("user_id", userId)
        .order("measured_at", { ascending: false })
        .limit(30)
    ),
    safeQuery(
      supabase
        .from("sync_runs")
        .select("status,finished_at,daily_metrics_upserted,raw_datapoints_upserted,exercises_upserted,sleep_sessions_upserted,body_measurements_upserted,empty_responses,errors_json")
        .eq("user_id", userId)
        .order("finished_at", { ascending: false })
        .limit(1)
    ),
    safeQuery(
      supabase
        .from("scores")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(28)
    ),
    safeQuery(
      supabase
        .from("insights")
        .select("title,explanation,recommendation,confidence")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(3)
    ),
    safeQuery(
      supabase
        .from("experiments")
        .select("id,title,hypothesis,metric,baseline_start,intervention_start,intervention_end,result_json,confidence")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
    ),
    safeQuery(
      supabase
        .from("profiles")
        .select("height_cm, target_weight_kg, age, gender, activity_level")
        .eq("id", userId)
        .maybeSingle()
    ),
    safeQuery(
      supabase
        .from("oauth_tokens")
        .select("id")
        .eq("user_id", userId)
        .eq("provider", "google_health")
        .maybeSingle()
    ),
    safeQuery(
      supabase
        .from("workout_sessions")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(50)
    ),
    safeQuery(
      supabase
        .from("muscle_volume_daily")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(100)
    ),
    safeQuery(
      supabase
        .from("symptoms")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(50)
    )
  ]);
  const profileRow = rawProfileRow as any;

  const dailyMetrics = (metrics ?? []) as DailyMetric[];
  const latestMetric = dailyMetrics[0] ?? null;
  const latestMetricWithSteps = dailyMetrics.find((metric) => metric.steps !== null) ?? latestMetric;
  const bodyRows = fuseBodyMeasurements((bodyMeasurements ?? []) as BodyMeasurement[]);
  const latestBody =
    bodyRows.find((row) => row.weight_kg !== null && row.body_fat_percentage !== null) ??
    bodyRows.find((row) => row.weight_kg !== null || row.body_fat_percentage !== null) ??
    null;
  const latestExercise = ((exercises ?? []) as Exercise[])[0] ?? null;
  const latestManual = ((manualLogs ?? []) as ManualLog[])[0] ?? null;
  const latestBloodPressure = ((bloodPressure ?? []) as BloodPressure[])[0] ?? null;
  const latestSync = ((syncRuns ?? []) as SyncRun[])[0] ?? null;
  const latestScore = ((scores ?? []) as ScoreRow[])[0] ?? null;
  const advancedScores = (latestScore?.calculation_version === "v2" && latestScore?.explanation_json)
    ? latestScore.explanation_json as HealthScores
    : calculateAdvancedScores({
        dailyMetrics,
        bodyMeasurements: bodyRows ?? [],
        bloodPressureMeasurements: bloodPressure ?? [],
        manualLogs: manualLogs ?? [],
        profileHeight: profileRow?.height_cm ? Number(profileRow.height_cm) : null,
        targetDate: latestMetric?.date,
        workoutSessions: (workoutSessions as any[]) ?? [],
        muscleVolumeWeekly: (muscleVolumeWeekly as any[]) ?? [],
        recentSymptoms: (recentSymptoms as any[]) ?? []
      });
  const latestInsights = uniqueInsights((dbInsights ?? []) as InsightRow[]);
  const weeklySteps = average(dailyMetrics.slice(0, 7).map((row) => row.steps));
  const overall = advancedScores.generalScore.score;
  const bodyLabel = latestBody
    ? [
        latestBody.weight_kg !== null ? formatKg(latestBody.weight_kg) : null,
        latestBody.body_fat_percentage !== null ? `${formatPercent(latestBody.body_fat_percentage)} grasa` : null
      ]
        .filter(Boolean)
        .join(" · ")
    : "sin dato";
  const exerciseMinutes = latestExercise?.active_duration_seconds
    ? Math.round(latestExercise.active_duration_seconds / 60)
    : null;
  const stepsSeries = [...dailyMetrics.slice(0, 7)]
    .reverse()
    .map((metric) => ({
      date: metric.date,
      label: metric.date.slice(5),
      steps: metric.steps ?? 0,
      intensity: Math.max(8, Math.min(100, Math.round(((metric.steps ?? 0) / 12000) * 100)))
    }));

  const latestExerciseFormatted = latestExercise
    ? {
        ...latestExercise,
        cardioLoad: Math.round(((latestExercise.active_duration_seconds ? latestExercise.active_duration_seconds / 60 : 0) * (latestExercise.average_heart_rate ?? 0)) / 100),
        cardioLoadLabel: (() => {
          const mins = latestExercise.active_duration_seconds ? latestExercise.active_duration_seconds / 60 : 0;
          const hr = latestExercise.average_heart_rate ?? 0;
          const cardioLoad = Math.round((mins * hr) / 100);
          if (cardioLoad >= 120) return "Alta" as const;
          if (cardioLoad >= 50) return "Media" as const;
          return "Baja" as const;
        })()
      }
    : null;

  const day = {
    overall,
    status: latestMetric ? "Datos reales sincronizados" : "Sin datos sincronizados",
    summary: latestMetricWithSteps
      ? `Ultimo dia con pasos: ${latestMetricWithSteps.date}. Pasos registrados: ${formatNumber(latestMetricWithSteps.steps)}.`
      : "Conecta Google Health y sincroniza para empezar a reemplazar los datos demo.",
    trainingRecommendation: overall !== null && overall !== undefined ? (overall >= 75 ? "Moderado" : "Liviano") : "sin dato",
    insights:
      latestInsights.length > 0
        ? latestInsights.map((insight) => ({
            title: insight.title,
            body: insight.recommendation ? `${insight.explanation} ${insight.recommendation}` : insight.explanation,
            confidence: insight.confidence === "high" ? "alta" : insight.confidence === "medium" ? "media" : "baja"
          }))
        : [
            {
              title: "Actividad sincronizada",
              body: latestMetric
                ? `Google Health trajo ${formatNumber(latestMetricWithSteps?.steps)} pasos para ${latestMetricWithSteps?.date}.`
                : "Todavia no hay pasos reales en daily_metrics.",
              confidence: latestMetric ? "alta" : "baja"
            },
            {
              title: "Composicion corporal",
              body: latestBody
                ? `Ultima medicion: ${bodyLabel}. Fuente: ${latestBody.source_platform ?? "sin fuente"}.`
                : "Todavia no hay mediciones normalizadas de peso o grasa corporal.",
              confidence: latestBody ? "media" : "baja"
            },
            {
              title: "Baseline en aprendizaje",
              body: `Hay ${dailyMetrics.length} dias de metricas diarias. El baseline real necesita 4 a 6 semanas.`,
              confidence: "alta"
            }
          ]
  };

  const last7Scores = ((scores ?? []) as ScoreRow[]).slice().reverse();
  const getHistory = (key: keyof ScoreRow) => {
    return last7Scores.map(s => s[key]).filter((v): v is number => typeof v === 'number');
  };

  const sectorCards = [
    {
      name: "Recuperacion",
      score: latestScore?.recovery_score ?? 45,
      state: latestMetric?.hrv ? "con HRV" : "sin HRV",
      tone: "watch",
      history: getHistory("recovery_score")
    },
    {
      name: "Sueno",
      score: latestScore?.sleep_score ?? 40,
      state: latestMetric?.sleep_minutes ? "con dato" : "sin dato",
      tone: latestMetric?.sleep_minutes ? "good" : "care",
      history: getHistory("sleep_score")
    },
    {
      name: "Entrenamiento",
      score: latestScore?.training_score ?? (latestExercise ? 70 : 45),
      state: latestExercise ? "detectado" : "sin dato",
      tone: latestExercise ? "good" : "watch",
      history: getHistory("training_score")
    },
    {
      name: "Cardiovascular",
      score: latestScore?.cardiovascular_score ?? (latestBloodPressure || latestMetric?.resting_hr ? 42 : null),
      state: latestBloodPressure
        ? `${latestBloodPressure.systolic}/${latestBloodPressure.diastolic}`
        : latestMetric?.resting_hr
          ? "con FC"
          : "sin dato",
      tone: latestBloodPressure || latestMetric?.resting_hr ? "watch" : "muted",
      history: getHistory("cardiovascular_score")
    },
    {
      name: "Composicion",
      score: latestScore?.body_composition_score ?? (latestBody ? 70 : 45),
      state: latestBody ? "actualizada" : "sin dato",
      tone: latestBody ? "good" : "watch",
      history: getHistory("body_composition_score")
    }
  ];

  const weeklySummary = [
      { label: "Pasos ultimo dia", value: formatNumber(latestMetricWithSteps?.steps) },
    { label: "Pasos promedio 7 dias", value: formatNumber(weeklySteps) },
    { label: "Composicion reciente", value: bodyLabel || "sin dato" },
    {
      label: "Ultimo ejercicio",
      value: latestExercise
        ? `${latestExercise.display_name ?? latestExercise.exercise_type ?? "Ejercicio"}${exerciseMinutes ? ` · ${exerciseMinutes} min` : ""}`
        : "sin dato"
    }
  ];

  const anomaliesList: Array<{ title: string; body: string; severity: "warning" | "danger" }> = [];
  if (dailyMetrics.length > 1) {
    const latestHRV = latestMetric?.hrv;
    const latestResp = latestMetric?.respiratory_rate;

    const historicalMetrics = dailyMetrics.slice(1, 15);
    const hrvBaseline = average(historicalMetrics.map((m) => m.hrv));
    const respBaseline = average(historicalMetrics.map((m) => m.respiratory_rate));

    if (latestHRV && hrvBaseline) {
      const hrvDrop = (hrvBaseline - latestHRV) / hrvBaseline;
      if (hrvDrop > 0.15) {
        anomaliesList.push({
          title: "Caída de HRV detectada",
          body: `Tu HRV de hoy (${latestHRV.toFixed(0)} ms) está un ${(hrvDrop * 100).toFixed(0)}% por debajo de tu promedio de 14 días (${hrvBaseline.toFixed(0)} ms). Esto indica cansancio acumulado o necesidad de descanso.`,
          severity: "danger"
        });
      }
    }

    if (latestResp && respBaseline) {
      const respIncrease = (latestResp - respBaseline) / respBaseline;
      if (respIncrease > 0.1) {
        anomaliesList.push({
          title: "Frecuencia respiratoria elevada",
          body: `Tu frecuencia respiratoria anoche (${latestResp.toFixed(1)} rpm) subió un ${(respIncrease * 100).toFixed(0)}% sobre tu promedio de 14 días (${respBaseline.toFixed(1)} rpm). Podría indicar estrés físico o ambiental.`,
          severity: "warning"
        });
      }
    }
  }

  const calculatedExperiments = dbExperiments
    ? dbExperiments.map((exp: any) => {
        const metricName = exp.metric as keyof DailyMetric;

        const baselineMetrics = dailyMetrics.filter(
          (m) => m.date >= exp.baseline_start && m.date < exp.intervention_start
        );
        const endIntervention = exp.intervention_end || new Date().toISOString().slice(0, 10);
        const interventionMetrics = dailyMetrics.filter(
          (m) => m.date >= exp.intervention_start && m.date <= endIntervention
        );

        const baselineVals = baselineMetrics
          .map((m) => m[metricName])
          .filter((v): v is number => typeof v === "number" && v !== null);
        const interventionVals = interventionMetrics
          .map((m) => m[metricName])
          .filter((v): v is number => typeof v === "number" && v !== null);

        const avgBaseline = baselineVals.length
          ? baselineVals.reduce((a, b) => a + b, 0) / baselineVals.length
          : null;
        const avgIntervention = interventionVals.length
          ? interventionVals.reduce((a, b) => a + b, 0) / interventionVals.length
          : null;

        let pctChange = 0;
        let summary = "Faltan datos de comparación.";
        let status: "positive" | "negative" | "neutral" = "neutral";

        if (avgBaseline !== null && avgIntervention !== null && avgBaseline > 0) {
          pctChange = ((avgIntervention - avgBaseline) / avgBaseline) * 100;
          const absPct = Math.abs(pctChange).toFixed(1);
          const isLowerBetter = exp.metric === "resting_hr";

          if (pctChange > 0) {
            status = isLowerBetter ? ("negative" as const) : ("positive" as const);
            summary = `Tu promedio subió un ${absPct}% (de ${Math.round(avgBaseline)} a ${Math.round(avgIntervention)}).`;
          } else if (pctChange < 0) {
            status = isLowerBetter ? ("positive" as const) : ("negative" as const);
            summary = `Tu promedio bajó un ${absPct}% (de ${Math.round(avgBaseline)} a ${Math.round(avgIntervention)}).`;
          } else {
            summary = `Sin cambios en el promedio (${Math.round(avgBaseline)}).`;
          }
        }

        return {
          id: exp.id,
          title: exp.title,
          hypothesis: exp.hypothesis,
          metric: exp.metric,
          baseline_start: exp.baseline_start,
          intervention_start: exp.intervention_start,
          intervention_end: exp.intervention_end,
          result_json: exp.result_json,
          confidence: exp.confidence,
          avgBaseline,
          avgIntervention,
          pctChange,
          summary,
          status,
          active: !exp.intervention_end || exp.intervention_end >= new Date().toISOString().slice(0, 10)
        };
      })
    : [];

  return {
    isReal: true,
    day,
    sectorCards,
    weeklySummary,
    latestExercise: latestExerciseFormatted,
    latestBodyMeasurement: latestBody,
    latestMetric,
    latestManual,
    latestBloodPressure,
    latestSync,
    stepsSeries,
    dataCards: [
      { label: "Distancia ultimo dia", value: formatKm(latestMetricWithSteps?.distance_meters) },
      {
        label: "Calorias ultimo dia",
        value: latestMetricWithSteps?.calories_kcal ? `${Math.round(latestMetricWithSteps.calories_kcal)} kcal` : "sin dato"
      },
      { label: "Minutos activos", value: latestMetricWithSteps?.active_minutes ? `${latestMetricWithSteps.active_minutes} min` : "sin dato" },
      { label: "Peso", value: formatKg(latestBody?.weight_kg) },
      { label: "Grasa corporal", value: formatPercent(latestBody?.body_fat_percentage) },
      {
        label: "Presion reciente",
        value: latestBloodPressure ? `${latestBloodPressure.systolic}/${latestBloodPressure.diastolic}` : "sin dato"
      }
    ],
    syncSummary: latestSync
      ? {
          status: latestSync.status,
          finishedAt: latestSync.finished_at,
          summary: `${latestSync.daily_metrics_upserted} metricas, ${latestSync.raw_datapoints_upserted} raw, ${latestSync.exercises_upserted} ejercicios, ${latestSync.sleep_sessions_upserted} sueno`,
          errors: latestSync.errors_json ?? []
        }
      : null,
    anomalies: anomaliesList.length ? anomaliesList : null,
    experiments: calculatedExperiments,
    advancedScores,
    profile: profileRow ? {
      height_cm: Number(profileRow.height_cm) || null,
      target_weight_kg: Number(profileRow.target_weight_kg) || null,
      age: Number(profileRow.age) || null,
      gender: profileRow.gender || null,
      activity_level: profileRow.activity_level || null
    } : null,
    isGoogleHealthConnected: Boolean(oauthRow)
  };
}
