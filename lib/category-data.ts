import "server-only";
import { getAppUserContext } from "@/lib/app-user";
import { demoDay } from "@/lib/demo-data";
import {
  projectRecovery,
  projectSleep,
  projectTraining,
  projectCardiovascular,
  projectBodyComposition,
  projectWellbeing,
  type Projection
} from "@/lib/projections";

export const categorySlugs = ["recuperacion", "sueno", "entrenamiento", "cardiovascular", "composicion", "bienestar"] as const;

export type CategorySlug = (typeof categorySlugs)[number];

import type {
  DailyMetric,
  ScoreRow,
  BodyMeasurement,
  Exercise,
  ManualLog,
  BloodPressure,
  InsightRow
} from "@/lib/types";

export type CategoryDetail = {
  slug: CategorySlug;
  title: string;
  score: number;
  status: string;
  summary: string;
  isReal: boolean;
  primaryMetric: { label: string; value: string };
  metrics: Array<{ label: string; value: string }>;
  trend: Array<{ label: string; value: number | null; display: string; intensity: number }>;
  recommendations: Array<{ title: string; body: string; confidence: string }>;
  projection: {
    title: string;
    body: string;
    value: string;
    direction?: "up" | "down" | "stable";
    directionArrow?: "↑" | "↓" | "→";
    directionColor?: "green" | "amber" | "red" | "blue";
    confidence?: "low" | "medium" | "high";
  };
  sleepStages?: { deep: number; rem: number; light: number; awake: number } | null;
  anomalies?: Array<{ title: string; body: string; severity: "warning" | "danger" }> | null;
  habitsCorrelation?: Array<{ title: string; value: string; description: string; type: "positive" | "negative" | "neutral" }> | null;
  exercises?: Array<{
    start_time: string;
    display_name: string | null;
    exercise_type: string | null;
    active_duration_seconds: number | null;
    average_heart_rate: number | null;
    cardioLoad: number;
    cardioLoadLabel: "Baja" | "Media" | "Alta";
  }> | null;
};

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "sin dato";
  return new Intl.NumberFormat("es-AR").format(Math.round(value));
}

function formatDecimal(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "sin dato";
  return value.toFixed(digits);
}

function formatMinutes(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "sin dato";
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return hours ? `${hours} h ${minutes} m` : `${minutes} m`;
}

function average(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function latestValue<T>(rows: T[], reader: (row: T) => number | null | undefined) {
  return rows.find((row) => reader(row) !== null && reader(row) !== undefined) ?? null;
}

function trendFromMetrics(
  metrics: DailyMetric[],
  reader: (row: DailyMetric) => number | null | undefined,
  formatter: (value: number | null | undefined) => string,
  maxFallback: number
) {
  const rows = [...metrics].reverse();
  const maxValue = Math.max(maxFallback, ...rows.map((row) => reader(row) ?? 0));

  return rows.map((row) => {
    const value = reader(row) ?? null;
    return {
      label: row.date.slice(5, 10),
      value,
      display: formatter(value),
      intensity: value === null ? 5 : Math.max(8, Math.min(100, Math.round((value / maxValue) * 100)))
    };
  });
}

function confidenceLabel(value: InsightRow["confidence"]) {
  if (value === "high") return "alta";
  if (value === "medium") return "media";
  return "baja";
}

async function safeQuery<T>(query: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await query;
  if (error) return null;
  return data;
}

function demoCategory(slug: CategorySlug): CategoryDetail {
  const baseScore = demoDay.overall;
  const labels: Record<CategorySlug, string> = {
    recuperacion: "Recuperacion",
    sueno: "Sueno",
    entrenamiento: "Entrenamiento",
    cardiovascular: "Cardiovascular",
    composicion: "Composicion",
    bienestar: "Bienestar"
  };

  return {
    slug,
    title: labels[slug],
    score: baseScore,
    status: "Modo demo",
    summary: "Inicia sesion y sincroniza Google Health para reemplazar esta vista por tus datos reales.",
    isReal: false,
    primaryMetric: { label: "Score", value: `${baseScore}/100` },
    metrics: [
      { label: "Datos", value: "demo" },
      { label: "Baseline", value: "pendiente" },
      { label: "Confianza", value: "baja" }
    ],
    trend: [52, 58, 61, 64, 67, 69, 72].map((value, index) => ({
      label: `D${index + 1}`,
      value,
      display: `${value}`,
      intensity: value
    })),
    recommendations: demoDay.insights.map((insight) => ({
      title: insight.title,
      body: insight.body,
      confidence: insight.confidence
    })),
    projection: {
      title: "Proyeccion",
      value: "sin baseline",
      body: "La proyeccion real necesita varias semanas de datos sincronizados."
    }
  };
}

export async function getCategoryDetail(slug?: string): Promise<CategoryDetail | null> {
  if (!slug) return null;
  if (!categorySlugs.includes(slug as CategorySlug)) return null;
  const category = slug as CategorySlug;
  const appUser = await getAppUserContext();

  if (!appUser) return demoCategory(category);

  const { supabase, userId } = appUser;

  let metrics: DailyMetric[] = [];
  let scores: ScoreRow[] = [];
  let body: BodyMeasurement[] = [];
  let exercises: Exercise[] = [];
  let manual: ManualLog[] = [];
  let pressure: BloodPressure[] = [];
  let insights: InsightRow[] = [];

  const promises: Promise<any>[] = [];

  const scoresPromise = safeQuery(
    supabase
      .from("scores")
      .select("date,recovery_score,sleep_score,training_score,cardiovascular_score,body_composition_score,wellbeing_score,overall_score")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(30)
  ).then(res => { scores = (res ?? []) as ScoreRow[]; });
  promises.push(scoresPromise);

  const insightsPromise = safeQuery(
    supabase
      .from("insights")
      .select("title,explanation,recommendation,confidence")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(8)
  ).then(res => { insights = (res ?? []) as InsightRow[]; });
  promises.push(insightsPromise);

  if (category === "sueno" || category === "entrenamiento" || category === "cardiovascular" || category === "recuperacion" || category === "bienestar") {
    const metricsPromise = safeQuery(
      supabase
        .from("daily_metrics")
        .select("date,steps,calories_kcal,active_minutes,sleep_minutes,resting_hr,hrv,spo2,respiratory_rate,deep_sleep_minutes,rem_sleep_minutes,light_sleep_minutes,awake_minutes")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(30)
    ).then(res => { metrics = (res ?? []) as DailyMetric[]; });
    promises.push(metricsPromise);
  }

  if (category === "entrenamiento") {
    const exercisesPromise = safeQuery(
      supabase
        .from("exercises")
        .select("start_time,display_name,exercise_type,active_duration_seconds,steps,distance_meters,calories_kcal,average_heart_rate")
        .eq("user_id", userId)
        .order("start_time", { ascending: false })
        .limit(12)
    ).then(res => { exercises = (res ?? []) as Exercise[]; });
    promises.push(exercisesPromise);
  }

  if (category === "composicion") {
    const bodyPromise = safeQuery(
      supabase
        .from("body_measurements")
        .select("measured_at,weight_kg,body_fat_percentage")
        .eq("user_id", userId)
        .order("measured_at", { ascending: false })
        .limit(30)
    ).then(res => { body = (res ?? []) as BodyMeasurement[]; });
    promises.push(bodyPromise);
  }

  if (category === "cardiovascular") {
    const pressurePromise = safeQuery(
      supabase
        .from("blood_pressure_measurements")
        .select("measured_at,systolic,diastolic,pulse")
        .eq("user_id", userId)
        .order("measured_at", { ascending: false })
        .limit(10)
    ).then(res => { pressure = (res ?? []) as BloodPressure[]; });
    promises.push(pressurePromise);
  }

  if (category === "bienestar") {
    const manualPromise = safeQuery(
      supabase
        .from("manual_daily_logs")
        .select("date,energy_score,mood_score,caffeine_consumed,alcohol_level,heavy_meal_at_night,notes")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(30)
    ).then(res => { manual = (res ?? []) as ManualLog[]; });
    promises.push(manualPromise);
  }

  await Promise.all(promises);
  const latestMetric = metrics[0] ?? null;
  const latestScore = scores[0] ?? null;
  const latestBody = body.find((row) => row.weight_kg !== null || row.body_fat_percentage !== null) ?? null;
  const latestExercise = exercises[0] ?? null;
  const latestPressure = pressure[0] ?? null;
  const latestManual = manual[0] ?? null;
  const recentSteps = average(metrics.slice(0, 7).map((row) => row.steps));
  const recentSleep = average(metrics.slice(0, 7).map((row) => row.sleep_minutes));
  const recentCalories = average(metrics.slice(0, 7).map((row) => row.calories_kcal));

  const genericRecommendations = insights.length
    ? insights.slice(0, 3).map((insight) => ({
        title: insight.title,
        body: insight.recommendation ? `${insight.explanation} ${insight.recommendation}` : insight.explanation,
        confidence: confidenceLabel(insight.confidence)
      }))
    : [
        {
          title: "Baseline en progreso",
          body: "La app necesita mas datos para detectar patrones personales con mejor confianza.",
          confidence: "media"
        }
      ];

  const scoreTrend = (reader: (row: ScoreRow) => number | null | undefined) => {
    const rows = [...scores].reverse().slice(-14);
    return rows.map((row) => {
      const value = reader(row) ?? null;
      return {
        label: row.date.slice(5, 10),
        value,
        display: value === null ? "sin dato" : `${Math.round(value)}`,
        intensity: value === null ? 5 : Math.max(8, Math.min(100, Math.round(value)))
      };
    });
  };

  if (category === "sueno") {
    const latestSleep = latestValue(metrics, (row) => row.sleep_minutes) as DailyMetric | null;
    const hasStages = latestSleep && (
      (latestSleep.deep_sleep_minutes ?? 0) > 0 ||
      (latestSleep.rem_sleep_minutes ?? 0) > 0 ||
      (latestSleep.light_sleep_minutes ?? 0) > 0 ||
      (latestSleep.awake_minutes ?? 0) > 0
    );

    const proj = projectSleep(metrics.map(m => m.sleep_minutes));

    return {
      slug: category,
      title: "Sueno",
      score: latestScore?.sleep_score ?? 40,
      status: latestSleep?.sleep_minutes ? "Con datos sincronizados" : "Sin sueno reciente",
      summary: latestSleep?.sleep_minutes
        ? `Ultimo registro: ${formatMinutes(latestSleep.sleep_minutes)}. Promedio reciente: ${formatMinutes(recentSleep)}.`
        : "Google Health todavia no envio sueno util para esta categoria.",
      isReal: true,
      primaryMetric: { label: "Ultimo sueno", value: formatMinutes(latestSleep?.sleep_minutes) },
      metrics: [
        { label: "Promedio 7 dias", value: formatMinutes(recentSleep) },
        { label: "Dias con dato", value: `${metrics.filter((row) => row.sleep_minutes !== null).length}` },
        { label: "Score", value: `${latestScore?.sleep_score ?? 40}/100` }
      ],
      trend: trendFromMetrics(metrics.slice(0, 14), (row) => row.sleep_minutes, formatMinutes, 540),
      recommendations: [
        {
          title: "Regularidad antes que perfeccion",
          body: "Usa el promedio de 7 dias para decidir ajustes; una noche aislada pesa menos que la tendencia.",
          confidence: metrics.length >= 7 ? "media" : "baja"
        },
        ...genericRecommendations.slice(0, 2)
      ],
      projection: {
        title: "Proyeccion 7 dias",
        value: proj.projectedDisplay,
        body: proj.explanation,
        direction: proj.direction,
        directionArrow: proj.directionArrow,
        directionColor: proj.directionColor,
        confidence: proj.confidence
      },
      sleepStages: hasStages ? {
        deep: latestSleep.deep_sleep_minutes ?? 0,
        rem: latestSleep.rem_sleep_minutes ?? 0,
        light: latestSleep.light_sleep_minutes ?? 0,
        awake: latestSleep.awake_minutes ?? 0
      } : null
    };
  }

  if (category === "entrenamiento") {
    const exercisesList = exercises.map((ex) => {
      const mins = ex.active_duration_seconds ? ex.active_duration_seconds / 60 : 0;
      const hr = ex.average_heart_rate ?? 0;
      const cardioLoad = Math.round((mins * hr) / 100);
      let cardioLoadLabel: "Baja" | "Media" | "Alta" = "Baja";
      if (cardioLoad >= 120) cardioLoadLabel = "Alta";
      else if (cardioLoad >= 50) cardioLoadLabel = "Media";

      return {
        start_time: ex.start_time,
        display_name: ex.display_name,
        exercise_type: ex.exercise_type,
        active_duration_seconds: ex.active_duration_seconds,
        average_heart_rate: ex.average_heart_rate,
        cardioLoad,
        cardioLoadLabel
      };
    });

    const proj = projectTraining(metrics.map(m => m.steps));

    return {
      slug: category,
      title: "Entrenamiento",
      score: latestScore?.training_score ?? (latestExercise ? 70 : 45),
      status: latestExercise ? "Ejercicio detectado" : "Sin ejercicio normalizado",
      summary: latestExercise
        ? `Ultima actividad: ${latestExercise.display_name ?? latestExercise.exercise_type ?? "Ejercicio"}. Pasos recientes: ${formatNumber(recentSteps)}.`
        : `Pasos promedio recientes: ${formatNumber(recentSteps)}.`,
      isReal: true,
      primaryMetric: { label: "Pasos promedio", value: formatNumber(recentSteps) },
      metrics: [
        { label: "Ultimos pasos", value: formatNumber(latestMetric?.steps) },
        { label: "Calorias promedio", value: recentCalories ? `${formatNumber(recentCalories)} kcal` : "sin dato" },
        { label: "Ejercicios", value: `${exercises.length}` }
      ],
      trend: trendFromMetrics(metrics.slice(0, 14), (row) => row.steps, formatNumber, 12000),
      recommendations: [
        {
          title: "Carga por tendencia",
          body: recentSteps && recentSteps > 8500 ? "Hay buena base de movimiento; conviene progresar por intensidad, no solo por volumen." : "Subir volumen de a poco ayuda a construir baseline sin fatiga excesiva.",
          confidence: metrics.length >= 7 ? "media" : "baja"
        },
        ...genericRecommendations.slice(0, 2)
      ],
      projection: {
        title: "Proyeccion semanal",
        value: proj.projectedDisplay,
        body: proj.explanation,
        direction: proj.direction,
        directionArrow: proj.directionArrow,
        directionColor: proj.directionColor,
        confidence: proj.confidence
      },
      exercises: exercisesList
    };
  }

  if (category === "composicion") {
    const bodyTrend = [...body].reverse().slice(-10).map((row) => ({
      label: row.measured_at.slice(5, 10),
      value: row.weight_kg,
      display: row.weight_kg ? `${formatDecimal(row.weight_kg)} kg` : "sin dato",
      intensity: row.weight_kg ? Math.max(8, Math.min(100, Math.round((row.weight_kg / 100) * 100))) : 5
    }));

    const proj = projectBodyComposition(body.map(r => r.weight_kg));

    return {
      slug: category,
      title: "Composicion",
      score: latestScore?.body_composition_score ?? (latestBody ? 70 : 45),
      status: latestBody ? "Medicion disponible" : "Sin mediciones",
      summary: latestBody
        ? `Ultima medicion: ${formatDecimal(latestBody.weight_kg)} kg y ${formatDecimal(latestBody.body_fat_percentage)}% grasa.`
        : "Aun no hay mediciones normalizadas de peso o grasa.",
      isReal: true,
      primaryMetric: { label: "Peso", value: latestBody?.weight_kg ? `${formatDecimal(latestBody.weight_kg)} kg` : "sin dato" },
      metrics: [
        { label: "Grasa corporal", value: latestBody?.body_fat_percentage ? `${formatDecimal(latestBody.body_fat_percentage)}%` : "sin dato" },
        { label: "Mediciones", value: `${body.length}` },
        { label: "Score", value: `${latestScore?.body_composition_score ?? (latestBody ? 70 : 45)}/100` }
      ],
      trend: bodyTrend,
      recommendations: [
        {
          title: "Mirar tendencia, no un punto",
          body: "Peso y grasa corporal fluctuan por hidratacion, comida y horario. Compara promedios de 2 a 4 semanas.",
          confidence: body.length >= 3 ? "media" : "baja"
        },
        ...genericRecommendations.slice(0, 2)
      ],
      projection: {
        title: "Proyeccion 30 dias",
        value: proj.projectedDisplay,
        body: proj.explanation,
        direction: proj.direction,
        directionArrow: proj.directionArrow,
        directionColor: proj.directionColor,
        confidence: proj.confidence
      }
    };
  }

  if (category === "cardiovascular") {
    const proj = projectCardiovascular(metrics.map(m => m.resting_hr));

    return {
      slug: category,
      title: "Cardiovascular",
      score: latestScore?.cardiovascular_score ?? 42,
      status: latestMetric?.resting_hr || latestPressure ? "Datos parciales" : "Sin FC o presion",
      summary: latestPressure
        ? `Ultima presion: ${latestPressure.systolic}/${latestPressure.diastolic}.`
        : latestMetric?.resting_hr
          ? `Frecuencia en reposo: ${Math.round(latestMetric.resting_hr)} bpm.`
          : "Todavia faltan frecuencia cardiaca en reposo o presion arterial.",
      isReal: true,
      primaryMetric: { label: "FC reposo", value: latestMetric?.resting_hr ? `${Math.round(latestMetric.resting_hr)} bpm` : "sin dato" },
      metrics: [
        { label: "Presion", value: latestPressure ? `${latestPressure.systolic}/${latestPressure.diastolic}` : "sin dato" },
        { label: "Pulso", value: latestPressure?.pulse ? `${latestPressure.pulse} bpm` : "sin dato" },
        { label: "Score", value: `${latestScore?.cardiovascular_score ?? 42}/100` }
      ],
      trend: trendFromMetrics(metrics.slice(0, 14), (row) => row.resting_hr, (value) => (value ? `${Math.round(value)} bpm` : "sin dato"), 100),
      recommendations: [
        {
          title: "Completar senales",
          body: "La categoria mejora mucho cuando combina FC en reposo, HRV y presion tomada en condiciones similares.",
          confidence: latestMetric?.resting_hr || latestPressure ? "media" : "baja"
        },
        ...genericRecommendations.slice(0, 2)
      ],
      projection: {
        title: "Tendencia FC (30 dias)",
        value: proj.projectedDisplay,
        body: proj.explanation,
        direction: proj.direction,
        directionArrow: proj.directionArrow,
        directionColor: proj.directionColor,
        confidence: proj.confidence
      }
    };
  }

  if (category === "bienestar") {
    const moodAverage = average(manual.map((row) => row.mood_score));
    const energyAverage = average(manual.map((row) => row.energy_score));

    const habits: Array<{ title: string; value: string; description: string; type: "positive" | "negative" | "neutral" }> = [];

    const merged = manual.map(log => {
      const metric = metrics.find(m => m.date === log.date);
      return { log, metric };
    }).filter(x => x.metric !== undefined);

    if (merged.length >= 3) {
      // 1. Caffeine vs Sleep
      const withCaf = merged.filter(x => x.log.caffeine_consumed);
      const noCaf = merged.filter(x => !x.log.caffeine_consumed);
      if (withCaf.length > 0 && noCaf.length > 0) {
        const avgSleepWith = average(withCaf.map(x => x.metric?.sleep_minutes));
        const avgSleepNo = average(noCaf.map(x => x.metric?.sleep_minutes));
        if (avgSleepWith !== null && avgSleepNo !== null) {
          const diff = avgSleepNo - avgSleepWith;
          const diffAbs = Math.abs(diff);
          if (diffAbs >= 15) {
            habits.push({
              title: "Cafeína vs. Sueño",
              value: `${diff > 0 ? "-" : "+"}${Math.round(diffAbs)} min`,
              description: diff > 0 
                ? `Duermes un promedio de ${Math.round(diffAbs)} minutos MENOS en días que consumes cafeína.`
                : `Duermes un promedio de ${Math.round(diffAbs)} minutos MÁS en días con cafeína.`,
              type: diff > 0 ? "negative" : "positive"
            });
          }
        }
      }

      // 2. Alcohol vs HRV
      const withAlc = merged.filter(x => x.log.alcohol_level && x.log.alcohol_level !== "none");
      const noAlc = merged.filter(x => !x.log.alcohol_level || x.log.alcohol_level === "none");
      if (withAlc.length > 0 && noAlc.length > 0) {
        const avgHrvWith = average(withAlc.map(x => x.metric?.hrv));
        const avgHrvNo = average(noAlc.map(x => x.metric?.hrv));
        if (avgHrvWith !== null && avgHrvNo !== null) {
          const diff = avgHrvNo - avgHrvWith;
          if (diff > 0) {
            habits.push({
              title: "Alcohol vs. HRV",
              value: `-${Math.round(diff)} ms`,
              description: `Tu variabilidad de frecuencia cardíaca (HRV) promedio disminuye ${Math.round(diff)} ms los días que consumes alcohol.`,
              type: "negative"
            });
          }
        }
      }

      // 3. Heavy meal at night vs Sleep
      const withHeavyMeal = merged.filter(x => x.log.heavy_meal_at_night);
      const noHeavyMeal = merged.filter(x => !x.log.heavy_meal_at_night);
      if (withHeavyMeal.length > 0 && noHeavyMeal.length > 0) {
        const avgSleepWith = average(withHeavyMeal.map(x => x.metric?.sleep_minutes));
        const avgSleepNo = average(noHeavyMeal.map(x => x.metric?.sleep_minutes));
        if (avgSleepWith !== null && avgSleepNo !== null) {
          const diff = avgSleepNo - avgSleepWith;
          if (diff > 10) {
            habits.push({
              title: "Cena Pesada vs. Sueño",
              value: `-${Math.round(diff)} min`,
              description: `Cenar pesado por la noche se asocia con perder ${Math.round(diff)} minutos de sueño total.`,
              type: "negative"
            });
          }
        }
      }
    }

    if (habits.length === 0) {
      habits.push({
        title: "Aprendiendo correlaciones",
        value: "Pendiente",
        description: "Se necesitan registrar al menos 3 días con hábitos diferentes (ej. con y sin cafeína) para estimar el impacto.",
        type: "neutral"
      });
    }

    const proj = projectWellbeing(
      manual.map(r => r.energy_score),
      manual.map(r => r.mood_score)
    );

    return {
      slug: category,
      title: "Bienestar",
      score: latestScore?.wellbeing_score ?? (latestManual ? 60 : 45),
      status: latestManual ? "Carga manual disponible" : "Sin carga manual",
      summary: latestManual
        ? `Ultima carga: energia ${formatNumber(latestManual.energy_score)}, animo ${formatNumber(latestManual.mood_score)}.`
        : "Carga energia, animo y notas para que esta categoria tenga contexto subjetivo.",
      isReal: true,
      primaryMetric: { label: "Energia", value: formatNumber(latestManual?.energy_score) },
      metrics: [
        { label: "Animo", value: formatNumber(latestManual?.mood_score) },
        { label: "Promedio energia", value: formatNumber(energyAverage) },
        { label: "Promedio animo", value: formatNumber(moodAverage) }
      ],
      trend: [...manual].reverse().map((row) => {
        const value = row.energy_score ?? row.mood_score ?? null;
        return {
          label: row.date.slice(5, 10),
          value,
          display: formatNumber(value),
          intensity: value === null ? 5 : Math.max(8, Math.min(100, value))
        };
      }),
      recommendations: [
        {
          title: "Contexto humano",
          body: "Los datos subjetivos ayudan a explicar dias donde pasos o sueno no cuentan toda la historia.",
          confidence: manual.length >= 3 ? "media" : "baja"
        },
        ...genericRecommendations.slice(0, 2)
      ],
      projection: {
        title: "Proyeccion bienestar",
        value: proj.projectedDisplay,
        body: proj.explanation,
        direction: proj.direction,
        directionArrow: proj.directionArrow,
        directionColor: proj.directionColor,
        confidence: proj.confidence
      },
      habitsCorrelation: habits
    };
  }

  const anomaliesList: Array<{ title: string; body: string; severity: "warning" | "danger" }> = [];
  if (metrics.length > 1) {
    const latestHRV = latestMetric?.hrv;
    const latestResp = latestMetric?.respiratory_rate;

    const historicalMetrics = metrics.slice(1, 15);
    const hrvBaseline = average(historicalMetrics.map((m) => m.hrv));
    const respBaseline = average(historicalMetrics.map((m) => m.respiratory_rate));

    if (latestHRV && hrvBaseline) {
      const hrvDrop = (hrvBaseline - latestHRV) / hrvBaseline;
      if (hrvDrop > 0.15) {
        anomaliesList.push({
          title: "Caída de HRV detectada",
          body: `Tu HRV de hoy (${latestHRV.toFixed(0)} ms) está un ${(hrvDrop * 100).toFixed(0)}% por debajo de tu promedio de 14 días (${hrvBaseline.toFixed(0)} ms). Esto suele indicar fatiga acumulada, sobreentrenamiento o estrés físico elevado.`,
          severity: "danger"
        });
      }
    }

    if (latestResp && respBaseline) {
      const respIncrease = (latestResp - respBaseline) / respBaseline;
      if (respIncrease > 0.1) {
        anomaliesList.push({
          title: "Frecuencia respiratoria elevada",
          body: `Tu frecuencia respiratoria anoche (${latestResp.toFixed(1)} rpm) subió un ${(respIncrease * 100).toFixed(0)}% sobre tu promedio de 14 días (${respBaseline.toFixed(1)} rpm). Podría indicar estrés ambiental o inicio de malestar.`,
          severity: "warning"
        });
      }
    }
  }

  // Recuperacion category
  const proj = projectRecovery(
    metrics.map(m => m.hrv),
    metrics.map(m => m.sleep_minutes)
  );

  return {
    slug: category,
    title: "Recuperacion",
    score: latestScore?.recovery_score ?? 45,
    status: latestMetric?.hrv || latestMetric?.sleep_minutes ? "Datos parciales" : "Sin HRV",
    summary: latestMetric?.hrv
      ? `HRV reciente: ${formatDecimal(latestMetric.hrv)}. Sueno reciente: ${formatMinutes(latestMetric.sleep_minutes)}.`
      : `Sueno promedio reciente: ${formatMinutes(recentSleep)}. HRV todavia no esta disponible.`,
    isReal: true,
    primaryMetric: { label: "Score", value: `${latestScore?.recovery_score ?? 45}/100` },
    metrics: [
      { label: "HRV", value: latestMetric?.hrv ? formatDecimal(latestMetric.hrv) : "sin dato" },
      { label: "Sueno promedio", value: formatMinutes(recentSleep) },
      { label: "FC reposo", value: latestMetric?.resting_hr ? `${Math.round(latestMetric.resting_hr)} bpm` : "sin dato" }
    ],
    trend: scores.length ? scoreTrend((row) => row.recovery_score) : trendFromMetrics(metrics.slice(0, 14), (row) => row.sleep_minutes, formatMinutes, 540),
    recommendations: [
      {
        title: "Cargar segun recuperacion",
        body: recentSleep && recentSleep < 390 ? "El sueno reciente esta corto; conviene moderar la intensidad." : "La recuperacion se interpreta mejor combinando HRV, FC reposo y sueno.",
        confidence: latestMetric?.hrv ? "media" : "baja"
      },
      ...genericRecommendations.slice(0, 2)
    ],
    projection: {
      title: "Proyeccion HRV 7 dias",
      value: proj.projectedDisplay,
      body: proj.explanation,
      direction: proj.direction,
      directionArrow: proj.directionArrow,
      directionColor: proj.directionColor,
      confidence: proj.confidence
    },
    anomalies: anomaliesList.length ? anomaliesList : null
  };
}
