import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DailyMetric, BodyMeasurement } from "@/lib/types";

// ─── Interfaces ─────────────────────────────────────────────────────────────

export type AlgorithmUsed = "baseline_personalizado" | "opcion_2_reglas_red_flags";

export type Confidence = "alta" | "media" | "baja" | "insuficiente";

export type ScoreComponent = {
  name: string;
  score: number | null;
  weight: number;
  value?: number | string | null;
  baseline?: number | string | null;
  explanation?: string;
};

export type ScoreResult = {
  score: number | null;
  algorithmUsed: AlgorithmUsed;
  confidence: Confidence;
  explanation: string;
  components: ScoreComponent[];
};

export type HealthScores = {
  healthIndex: ScoreResult;
  dailyReadiness: ScoreResult;
  bodyProgress: ScoreResult;
  generalScore: {
    score: number | null;
    confidence: Confidence;
    explanation: string;
  };
  alerts: Array<{
    severity: "info" | "warning" | "critical";
    category: "cardiovascular" | "sleep" | "recovery" | "body_composition" | "pain" | "data_quality" | "general" | "environment";
    title: string;
    message: string;
    relatedMetric?: string;
  }>;
  generatedAt: string;
};

// ─── Statistical Helpers ──────────────────────────────────────────────────────

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function standardDeviation(values: number[]): number {
  if (values.length <= 1) return 0;
  const avg = mean(values);
  const squareDiffs = values.map(v => Math.pow(v - avg, 2));
  return Math.sqrt(mean(squareDiffs));
}

// Legacy helpers kept for compatibility
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

export function calculateOverallScore(scores: Array<number | null | undefined>): number | null {
  const valid = scores.filter((s): s is number => typeof s === "number" && s !== null && !isNaN(s));
  if (!valid.length) return null;
  return Math.round(valid.reduce((sum, s) => sum + s, 0) / valid.length);
}

// ─── Advanced Scoring Engine ─────────────────────────────────────────────────

export function calculateAdvancedScores(params: {
  dailyMetrics: DailyMetric[];
  bodyMeasurements: any[];
  bloodPressureMeasurements: any[];
  manualLogs: any[];
  profileHeight: number | null;
  targetDate?: string;
  workoutSessions?: any[];
  muscleVolumeWeekly?: any[];
  recentSymptoms?: any[];
}): HealthScores {
  const {
    dailyMetrics = [],
    bodyMeasurements = [],
    bloodPressureMeasurements = [],
    manualLogs = [],
    profileHeight,
    targetDate,
    workoutSessions = [],
    muscleVolumeWeekly = [],
    recentSymptoms = []
  } = params;

  // 1. Identify target day metric
  const latestMetric = targetDate
    ? dailyMetrics.find(m => m.date === targetDate) ?? {
        date: targetDate,
        steps: null,
        sleep_minutes: null,
        resting_hr: null,
        hrv: null,
        spo2: null,
        respiratory_rate: null
      }
    : dailyMetrics[0] ?? {
        date: new Date().toLocaleDateString("en-CA"),
        steps: null,
        sleep_minutes: null,
        resting_hr: null,
        hrv: null,
        spo2: null,
        respiratory_rate: null
      };

  const todayStr = latestMetric.date;

  // Filter logs for today
  const todayManualLog = manualLogs.find(l => l.date === todayStr) || manualLogs[0];
  const todayBp = bloodPressureMeasurements.find(bp => {
    const bpDate = new Date(bp.measured_at).toLocaleDateString("en-CA");
    return bpDate === todayStr;
  }) || bloodPressureMeasurements[0];

  const todayBody = bodyMeasurements.find(b => {
    const bDate = new Date(b.measured_at).toLocaleDateString("en-CA");
    return bDate === todayStr;
  }) || bodyMeasurements[0];

  const alerts: HealthScores["alerts"] = [];

  // ─── A. DAILY READINESS ─────────────────────────────────────────────────────
  // Weights: HRV (25%), RHR (20%), Sleep (25%), Training Load (15%), Pain (10%), Subjective Energy (5%)
  const readinessComponents: ScoreComponent[] = [];

  // 1. HRV Component
  const hrvValues = dailyMetrics.map(m => m.hrv).filter((v): v is number => typeof v === "number" && v !== null);
  const todayHrv = latestMetric.hrv;
  if (todayHrv !== null && todayHrv !== undefined) {
    if (hrvValues.length >= 14) {
      const bHrv = median(hrvValues);
      const pct = (todayHrv - bHrv) / bHrv;
      let score = 75;
      if (pct >= 0.05) score = 95 + Math.min(5, Math.round((pct - 0.05) * 50));
      else if (pct >= -0.05) score = 80 + Math.round((pct + 0.05) * 150);
      else if (pct >= -0.10) score = 65 + Math.round((pct + 0.10) * 300);
      else if (pct >= -0.20) score = 45 + Math.round((pct + 0.20) * 200);
      else score = Math.max(15, 25 + Math.round((pct + 0.50) * 60));

      readinessComponents.push({
        name: "Variabilidad Cardíaca (HRV)",
        score: Math.min(100, Math.max(0, score)),
        weight: 0.25,
        value: `${todayHrv} ms`,
        baseline: `${Math.round(bHrv)} ms`,
        explanation: "Puntuado contra tu baseline personal de 28 días"
      });
    } else {
      let score = 42;
      if (todayHrv >= 60) score = 88;
      else if (todayHrv >= 40) score = 72;
      else if (todayHrv >= 25) score = 58;

      readinessComponents.push({
        name: "Variabilidad Cardíaca (HRV)",
        score,
        weight: 0.25,
        value: `${todayHrv} ms`,
        baseline: null,
        explanation: "Puntuación por reglas generales debido a datos insuficientes de baseline"
      });
    }
  } else {
    readinessComponents.push({
      name: "Variabilidad Cardíaca (HRV)",
      score: null,
      weight: 0.25,
      value: "Sin dato hoy",
      baseline: null,
      explanation: "No hay datos de HRV sincronizados hoy"
    });
  }

  // 2. Resting Heart Rate Component
  const rhrValues = dailyMetrics.map(m => m.resting_hr).filter((v): v is number => typeof v === "number" && v !== null);
  const todayRhr = latestMetric.resting_hr;
  if (todayRhr !== null && todayRhr !== undefined) {
    if (rhrValues.length >= 14) {
      const bRhr = median(rhrValues);
      const delta = todayRhr - bRhr;
      let score = 75;
      if (delta <= 0) score = 95 + Math.min(5, Math.abs(delta));
      else if (delta <= 3) score = 80 + (3 - delta) * 5;
      else if (delta <= 6) score = 65 + (6 - delta) * 5;
      else if (delta <= 10) score = 45 + (10 - delta) * 5;
      else score = Math.max(15, 30 - (delta - 10) * 2);

      readinessComponents.push({
        name: "Frecuencia Cardíaca en Reposo",
        score: Math.min(100, Math.max(0, score)),
        weight: 0.20,
        value: `${todayRhr} bpm`,
        baseline: `${Math.round(bRhr)} bpm`,
        explanation: "Desviación contra tu mediana personal de 28 días"
      });
    } else {
      let score = 35;
      if (todayRhr < 55) score = 85;
      else if (todayRhr <= 65) score = 75;
      else if (todayRhr <= 75) score = 65;
      else if (todayRhr <= 85) score = 50;

      readinessComponents.push({
        name: "Frecuencia Cardíaca en Reposo",
        score,
        weight: 0.20,
        value: `${todayRhr} bpm`,
        baseline: null,
        explanation: "Puntuación por reglas generales debido a datos insuficientes de baseline"
      });
    }
  } else {
    readinessComponents.push({
      name: "Frecuencia Cardíaca en Reposo",
      score: null,
      weight: 0.20,
      value: "Sin dato hoy",
      baseline: null,
      explanation: "No hay frecuencia cardíaca en reposo hoy"
    });
  }

  // 3. Sleep Component (Last Night)
  const sleepValues = dailyMetrics.map(m => m.sleep_minutes).filter((v): v is number => typeof v === "number" && v !== null);
  const todaySleep = latestMetric.sleep_minutes;
  if (todaySleep !== null && todaySleep !== undefined) {
    let baseScore = 30;
    if (todaySleep >= 420 && todaySleep <= 540) baseScore = 95;
    else if (todaySleep >= 390) baseScore = 80 + Math.round((todaySleep - 390) * 0.5);
    else if (todaySleep >= 360) baseScore = 68 + Math.round((todaySleep - 360) * 0.4);
    else if (todaySleep >= 300) baseScore = 50 + Math.round((todaySleep - 300) * 0.3);
    else if (todaySleep > 540) baseScore = Math.max(70, 95 - Math.round((todaySleep - 540) * 0.2));

    if (sleepValues.length >= 14) {
      const bSleep = median(sleepValues);
      let penalty = 0;
      if (todaySleep < bSleep - 60) penalty = 25;
      else if (todaySleep < bSleep - 30) penalty = 10;

      const score = Math.max(15, baseScore - penalty);
      readinessComponents.push({
        name: "Sueño de Anoche",
        score,
        weight: 0.25,
        value: `${(todaySleep / 60).toFixed(1)} h`,
        baseline: `${(bSleep / 60).toFixed(1)} h`,
        explanation: `Puntuación ajustada por desvío de tu baseline (-${penalty} pts)`
      });
    } else {
      readinessComponents.push({
        name: "Sueño de Anoche",
        score: baseScore,
        weight: 0.25,
        value: `${(todaySleep / 60).toFixed(1)} h`,
        baseline: null,
        explanation: "Puntuación por reglas generales debido a datos insuficientes de baseline"
      });
    }
  } else {
    readinessComponents.push({
      name: "Sueño de Anoche",
      score: null,
      weight: 0.25,
      value: "Sin dato hoy",
      baseline: null,
      explanation: "No se registraron datos de sueño anoche"
    });
  }

  // 4. Recent Training Load Component
  const stepsValues = dailyMetrics.map(m => m.steps).filter((v): v is number => typeof v === "number" && v !== null);
  const activeMinutesValues = dailyMetrics.map(m => m.active_minutes).filter((v): v is number => typeof v === "number" && v !== null);
  const hasStepsBaseline = dailyMetrics.filter(m => m.steps !== null).length >= 7;

  const getPastDateStr = (base: string, offsetDays: number) => {
    try {
      const d = new Date(base);
      d.setDate(d.getDate() - offsetDays);
      return d.toISOString().slice(0, 10);
    } catch {
      return base;
    }
  };

  const targetDateMinus1 = getPastDateStr(todayStr, 1);
  const targetDateMinus2 = getPastDateStr(todayStr, 2);
  const last3Days = [todayStr, targetDateMinus1, targetDateMinus2];

  const recentVolumeRows = muscleVolumeWeekly.filter((v: any) => last3Days.includes(v.date));
  const recentTrainingLoad = recentVolumeRows.reduce((sum: number, v: any) => sum + Number(v.hard_sets), 0);

  let trainingLoadScore = 75;
  let trainingLoadValue = "Sin entrenos";
  let trainingExplanation = "";

  if (recentTrainingLoad > 0) {
    if (recentTrainingLoad <= 6) {
      trainingLoadScore = 95;
      trainingLoadValue = `${recentTrainingLoad.toFixed(1)} series`;
      trainingExplanation = "Carga baja en 72h. Estímulo óptimo de recuperación.";
    } else if (recentTrainingLoad <= 12) {
      trainingLoadScore = 85;
      trainingLoadValue = `${recentTrainingLoad.toFixed(1)} series`;
      trainingExplanation = "Carga moderada en 72h. Fatiga normal y controlada.";
    } else if (recentTrainingLoad <= 18) {
      trainingLoadScore = 65;
      trainingLoadValue = `${recentTrainingLoad.toFixed(1)} series`;
      trainingExplanation = "Carga elevada en 72h. Se sugiere moderar intensidad hoy.";
    } else {
      trainingLoadScore = 40;
      trainingLoadValue = `${recentTrainingLoad.toFixed(1)} series`;
      trainingExplanation = "Carga excesiva en 72h. Recomendación de descanso o deload.";
    }

    readinessComponents.push({
      name: "Carga de Actividad Reciente",
      score: trainingLoadScore,
      weight: 0.15,
      value: trainingLoadValue,
      baseline: null,
      explanation: trainingExplanation
    });
  } else if (hasStepsBaseline) {
    const avg7 = mean(dailyMetrics.slice(0, 7).map(m => m.steps).filter(Boolean) as number[]);
    const avg28 = mean(dailyMetrics.map(m => m.steps).filter(Boolean) as number[]);
    const ratio = avg28 > 0 ? avg7 / avg28 : 1.0;
    let score = 75;
    if (ratio >= 0.8 && ratio <= 1.3) score = 95;
    else if (ratio >= 0.5 && ratio < 0.8) score = 75;
    else if (ratio > 1.3 && ratio <= 1.6) score = 70;
    else if (ratio < 0.5) score = 50;
    else score = 40;

    readinessComponents.push({
      name: "Carga de Actividad Reciente",
      score,
      weight: 0.15,
      value: `${Math.round(avg7)} pasos (7d)`,
      baseline: `${Math.round(avg28)} pasos (28d)`,
      explanation: `Relación de carga 7d/28d es ${(ratio).toFixed(2)}x`
    });
  } else {
    // Option 2 fallback
    const recentActiveMinutes = activeMinutesValues.length > 0 ? activeMinutesValues[0] : null;
    let score = 25;
    if (recentActiveMinutes !== null) {
      if (recentActiveMinutes >= 45) score = 90;
      else if (recentActiveMinutes >= 20) score = 75;
      else if (recentActiveMinutes >= 10) score = 55;
    } else if (stepsValues.length > 0) {
      const steps = stepsValues[0];
      if (steps >= 9000) score = 85;
      else if (steps >= 6000) score = 70;
      else if (steps >= 3000) score = 50;
    }

    readinessComponents.push({
      name: "Carga de Actividad Reciente",
      score,
      weight: 0.15,
      value: stepsValues.length > 0 ? `${stepsValues[0]} pasos` : "Sin actividad",
      baseline: null,
      explanation: "Calculado sobre pasos o minutos activos recientes"
    });
  }

  // 5. Pain / Soreness Component
  const todayPainSpots = recentSymptoms.filter(
    (s: any) => s.date === todayStr && s.type === "pain"
  );
  const maxPainIntensity = todayPainSpots.length > 0
    ? Math.max(...todayPainSpots.map((s: any) => s.intensity))
    : 0;

  let painScore = 100;
  let painLabel = "Sin molestias";
  let painExplanation = "Sin reportes de molestias físicas hoy";

  if (maxPainIntensity > 0) {
    const uiScalePain = maxPainIntensity * 2;
    painScore = Math.max(10, 100 - uiScalePain * 10);
    const locations = todayPainSpots.map((s: any) => `${s.location} (${s.intensity * 2}/10)`).join(", ");
    painLabel = `Dolor ${uiScalePain}/10`;
    painExplanation = `Molestia detectada en: ${locations}`;
  } else if (todayManualLog?.pain_present) {
    painScore = 55;
    painLabel = "Con molestias";
    painExplanation = "Se detectaron dolores o molestias musculares hoy (manual)";
  }

  readinessComponents.push({
    name: "Estado de Molestia o Dolor",
    score: painScore,
    weight: 0.10,
    value: painLabel,
    baseline: null,
    explanation: painExplanation
  });

  // 6. Subjective Energy Component
  let energyScoreVal: number | null = null;
  if (todayManualLog?.energy_score !== undefined && todayManualLog?.energy_score !== null) {
    energyScoreVal = todayManualLog.energy_score * 20;
    readinessComponents.push({
      name: "Energía Subjetiva",
      score: energyScoreVal,
      weight: 0.05,
      value: `${todayManualLog.energy_score}/5`,
      baseline: null,
      explanation: "Nivel de energía reportado manualmente"
    });
  } else {
    readinessComponents.push({
      name: "Energía Subjetiva",
      score: null,
      weight: 0.05,
      value: "Sin registro",
      baseline: null,
      explanation: "No has registrado tu energía hoy"
    });
  }

  // Calculate readiness score
  let readinessScore: number | null = null;
  let readinessAlgorithm: AlgorithmUsed = "opcion_2_reglas_red_flags";
  let readinessConfidence: Confidence = "insuficiente";
  let readinessExplanation = "";

  const validReadiness = readinessComponents.filter(c => c.score !== null);
  const totalReadinessWeight = validReadiness.reduce((sum, c) => sum + c.weight, 0);

  if (totalReadinessWeight >= 0.40) {
    const weightedSum = validReadiness.reduce((sum, c) => sum + (c.score || 0) * c.weight, 0);
    let rawScore = Math.round(weightedSum / totalReadinessWeight);

    // Baseline calculation verification
    const hrvDone = readinessComponents.find(c => c.name.includes("HRV"))?.baseline !== null;
    const rhrDone = readinessComponents.find(c => c.name.includes("Reposo"))?.baseline !== null;
    const sleepDone = readinessComponents.find(c => c.name.includes("Sueño"))?.baseline !== null;

    if (hrvDone && rhrDone && sleepDone) {
      readinessAlgorithm = "baseline_personalizado";
      readinessConfidence = "alta";
      readinessExplanation = "Calculado contra tus medianas históricas (HRV, RHR y Sueño).";
    } else {
      readinessAlgorithm = "opcion_2_reglas_red_flags";
      readinessConfidence = totalReadinessWeight >= 0.70 ? "media" : "baja";
      readinessExplanation = "Cálculo por reglas generales debido a la falta de historia clínica de baseline.";
    }

    // Apply Overrides
    const overridesApplied: string[] = [];

    // 1. Sleep < 5h
    if (todaySleep !== null && todaySleep < 300) {
      rawScore = Math.min(rawScore, 60);
      overridesApplied.push("sueño muy bajo (<5h)");
    }
    // 2. Severe pain
    const isSeverePain = maxPainIntensity >= 3;
    if (isSeverePain) {
      rawScore = Math.min(rawScore, 55);
      const highPainLocs = todayPainSpots.filter((s: any) => s.intensity >= 3).map((s: any) => s.location).join(", ");
      overridesApplied.push(`dolor muscular alto en ${highPainLocs}`);
    } else if (todayManualLog?.pain_present) {
      rawScore = Math.min(rawScore, 55);
      overridesApplied.push("dolor físico reportado");
    }
    // 3. HRV low + RHR high for 3 days
    const last3Hrv = dailyMetrics.slice(0, 3).map(m => m.hrv).filter((v): v is number => typeof v === "number" && v !== null);
    const last3Rhr = dailyMetrics.slice(0, 3).map(m => m.resting_hr).filter((v): v is number => typeof v === "number" && v !== null);
    if (hrvDone && rhrDone) {
      const bHrv = median(hrvValues);
      const bRhr = median(rhrValues);
      if (
        last3Hrv.length === 3 && last3Hrv.every(h => h < bHrv * 0.8) &&
        last3Rhr.length === 3 && last3Rhr.every(r => r > bRhr + 6)
      ) {
        rawScore = Math.min(rawScore, 55);
        overridesApplied.push("fatiga autonómica (HRV deprimida y RHR elevada sostenidas)");
      }
    }
    // 3b. Over-training override
    if (recentTrainingLoad > 15 && hrvDone && rhrDone) {
      const bHrv = median(hrvValues);
      const bRhr = median(rhrValues);
      const hrvDrop = todayHrv ? (bHrv - todayHrv) / bHrv : 0;
      const rhrIncrease = todayRhr ? todayRhr - bRhr : 0;
      if (hrvDrop > 0.15 || rhrIncrease > 4) {
        rawScore = Math.min(rawScore, 55);
        overridesApplied.push("fatiga acumulada por entrenamiento intenso");
      }
    }
    // 4. Blood pressure override
    if (todayBp) {
      if (todayBp.systolic >= 180 || todayBp.diastolic >= 120) {
        rawScore = Math.min(rawScore, 40);
        overridesApplied.push("presión arterial crítica");
      } else if (todayBp.systolic >= 140 || todayBp.diastolic >= 90) {
        rawScore = Math.min(rawScore, 70);
        if (todayBp.systolic >= 140 && todayBp.diastolic < 90) {
          overridesApplied.push("sistólica elevada registrada");
        } else {
          overridesApplied.push("presión arterial alta");
        }
      }
    }

    if (overridesApplied.length > 0) {
      readinessExplanation += ` Override aplicado por: ${overridesApplied.join(", ")}.`;
    }

    readinessScore = rawScore;
  } else {
    readinessConfidence = "insuficiente";
    readinessExplanation = "Datos insuficientes para evaluar la preparación diaria.";
  }


  // ─── B. HEALTH INDEX ────────────────────────────────────────────────────────
  // Weights: Cardiometabolic (35%), Sleep (20%), Activity (15%), BodyComposition (20%), Wellbeing (10%)
  const healthComponents: ScoreComponent[] = [];

  // 1. Cardiometabolic Domain (BP 45%, RHR 20%, WHTR 20%, SpO2 10%, HRV 5%)
  const cardioSubComponents: { name: string; score: number | null; weight: number; label?: string }[] = [];

  // 1a. Blood Pressure sub-component
  const validBps = bloodPressureMeasurements.filter(bp => bp.systolic !== null && bp.diastolic !== null);
  if (validBps.length > 0) {
    // Option 3 if >=3 BP entries in 21 days
    const bpRecent = validBps.slice(0, 7); // average of recent
    const avgSys = mean(bpRecent.map(b => b.systolic));
    const avgDia = mean(bpRecent.map(b => b.diastolic));

    let bpScore = 35;
    if (avgSys < 120 && avgDia < 80) bpScore = 95;
    else if (avgSys < 130 && avgDia < 80) bpScore = 80;
    else if (avgSys < 140 || avgDia < 90) bpScore = 60;
    else if (avgSys >= 180 || avgDia >= 120) bpScore = 15;

    cardioSubComponents.push({
      name: "Presión Arterial",
      score: bpScore,
      weight: 0.45,
      label: `${Math.round(avgSys)}/${Math.round(avgDia)} mmHg`
    });
  } else {
    cardioSubComponents.push({ name: "Presión Arterial", score: null, weight: 0.45 });
  }

  // 1b. Resting HR sub-component
  if (todayRhr !== null && todayRhr !== undefined) {
    if (rhrValues.length >= 14) {
      const bRhr = median(rhrValues);
      const avgRhr7d = mean(dailyMetrics.slice(0, 7).map(m => m.resting_hr).filter(Boolean) as number[]);
      const delta = avgRhr7d - bRhr;
      let score = 75;
      if (delta <= 0) score = 95;
      else if (delta <= 3) score = 82;
      else if (delta <= 6) score = 65;
      else score = 40;

      cardioSubComponents.push({ name: "Frecuencia Cardíaca", score, weight: 0.20, label: `${Math.round(avgRhr7d)} bpm (7d)` });
    } else {
      let score = 35;
      if (todayRhr < 55) score = 85;
      else if (todayRhr <= 65) score = 75;
      else if (todayRhr <= 75) score = 65;
      else score = 50;

      cardioSubComponents.push({ name: "Frecuencia Cardíaca", score, weight: 0.20, label: `${todayRhr} bpm` });
    }
  } else {
    cardioSubComponents.push({ name: "Frecuencia Cardíaca", score: null, weight: 0.20 });
  }

  // 1c. Waist to Height Ratio
  const currentWaist = todayBody?.waist_cm || (bodyMeasurements.find(b => b.waist_cm)?.[0]?.waist_cm);
  if (currentWaist && profileHeight) {
    const whtr = currentWaist / profileHeight;
    let score = 50;
    if (whtr >= 0.40 && whtr <= 0.49) score = 95;
    else if (whtr >= 0.50 && whtr <= 0.59) score = 70;
    else if (whtr >= 0.60) score = 40;
    else if (whtr < 0.40) score = 80;

    cardioSubComponents.push({ name: "Índice Cintura/Altura", score, weight: 0.20, label: `${whtr.toFixed(2)}` });
  } else {
    cardioSubComponents.push({ name: "Índice Cintura/Altura", score: null, weight: 0.20 });
  }

  // 1d. SpO2 or respiration
  const todaySpo2 = latestMetric.spo2;
  if (todaySpo2 !== null && todaySpo2 !== undefined) {
    let score = 30;
    if (todaySpo2 >= 95) score = 95;
    else if (todaySpo2 >= 90) score = 60;

    cardioSubComponents.push({ name: "Saturación Oxígeno (SpO2)", score, weight: 0.10, label: `${todaySpo2}%` });
  } else {
    cardioSubComponents.push({ name: "Saturación Oxígeno (SpO2)", score: null, weight: 0.10 });
  }

  // 1e. HRV Trend
  if (todayHrv !== null && todayHrv !== undefined && hrvValues.length >= 14) {
    const bHrv = median(hrvValues);
    const avgHrv7d = mean(dailyMetrics.slice(0, 7).map(m => m.hrv).filter(Boolean) as number[]);
    const ratio = bHrv > 0 ? avgHrv7d / bHrv : 1.0;
    let score = 50;
    if (ratio >= 0.95) score = 95;
    else if (ratio >= 0.90) score = 80;
    else if (ratio >= 0.80) score = 60;
    else score = 35;

    cardioSubComponents.push({ name: "Tendencia HRV", score, weight: 0.05, label: `${Math.round(avgHrv7d)} ms (7d)` });
  } else {
    cardioSubComponents.push({ name: "Tendencia HRV", score: null, weight: 0.05 });
  }

  // Calculate Cardiometabolic Score
  let cardiometabolicScore: number | null = null;
  const validCardio = cardioSubComponents.filter(c => c.score !== null);
  const totalCardioWeight = validCardio.reduce((sum, c) => sum + c.weight, 0);
  if (totalCardioWeight > 0) {
    const weightedSum = validCardio.reduce((sum, c) => sum + (c.score || 0) * c.weight, 0);
    let finalCardioScore = Math.round(weightedSum / totalCardioWeight);

    // Apply cardiovascular limit overrides
    if (validBps.length > 0) {
      const recentBps = validBps.slice(0, 3);
      const avgSys = mean(recentBps.map(b => b.systolic));
      const avgDia = mean(recentBps.map(b => b.diastolic));
      if (avgSys >= 140 || avgDia >= 90) {
        finalCardioScore = Math.min(finalCardioScore, 50);
      }
      if (avgSys >= 180 || avgDia >= 120) {
        finalCardioScore = Math.min(finalCardioScore, 30);
      }
    }
    cardiometabolicScore = finalCardioScore;
  }

  healthComponents.push({
    name: "Cardiometabólico",
    score: cardiometabolicScore,
    weight: 0.35,
    value: cardiometabolicScore !== null ? `${cardiometabolicScore}/100` : "Faltan datos",
    explanation: "Promedio ponderado de Presión, FC, SpO2, WHTR y HRV"
  });

  // 2. Sleep Domain (Long-term)
  let longTermSleepScore: number | null = null;
  const recentSleeps = dailyMetrics.slice(0, 7).map(m => m.sleep_minutes).filter((v): v is number => typeof v === "number" && v !== null);
  if (recentSleeps.length > 0) {
    const avgSleep = mean(recentSleeps);
    let score = 30;
    if (avgSleep >= 420 && avgSleep <= 540) score = 95;
    else if (avgSleep >= 390) score = 80;
    else if (avgSleep >= 360) score = 65;
    else if (avgSleep >= 300) score = 48;

    longTermSleepScore = score;
  }
  healthComponents.push({
    name: "Sueño (Largo Plazo)",
    score: longTermSleepScore,
    weight: 0.20,
    value: longTermSleepScore !== null ? `${longTermSleepScore}/100` : "Sin datos",
    explanation: "Puntuación de sueño calculada en promedio móvil de 7 días"
  });

  // 3. Activity Domain (Long-term)
  let longTermActivityScore: number | null = null;
  const steps7d = dailyMetrics.slice(0, 7).map(m => m.steps).filter((v): v is number => typeof v === "number" && v !== null);
  const activeMins7d = dailyMetrics.slice(0, 7).map(m => m.active_minutes).filter((v): v is number => typeof v === "number" && v !== null);
  const workouts7d = workoutSessions.filter((s: any) => {
    try {
      const diffDays = (new Date(todayStr).getTime() - new Date(s.date).getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays < 7;
    } catch {
      return false;
    }
  });
  const workoutCount7d = workouts7d.length;

  if (activeMins7d.length > 0 || steps7d.length > 0 || workoutCount7d > 0) {
    const totalActive = activeMins7d.reduce((a, b) => a + b, 0);
    let activeScore = 10;
    if (totalActive >= 300) activeScore = 100;
    else if (totalActive >= 150) activeScore = 80;
    else if (totalActive >= 75) activeScore = 50;

    const avgSteps = steps7d.length > 0 ? mean(steps7d) : 0;
    let stepsScore = 30;
    if (avgSteps >= 9000) stepsScore = 95;
    else if (avgSteps >= 6000) stepsScore = 80;
    else if (avgSteps >= 3000) stepsScore = 55;

    let baseActivity = activeMins7d.length > 0
      ? Math.round(activeScore * 0.8 + stepsScore * 0.2)
      : stepsScore;

    const workoutBoost = Math.min(15, workoutCount7d * 5);
    longTermActivityScore = Math.min(100, baseActivity + workoutBoost);

    healthComponents.push({
      name: "Actividad Física (Largo Plazo)",
      score: longTermActivityScore,
      weight: 0.15,
      value: `${workoutCount7d} entrenos, ${Math.round(avgSteps).toLocaleString("es-AR")} pasos (7d)`,
      baseline: null,
      explanation: `Evaluado sobre pasos de 7d, minutos activos y ${workoutCount7d} entrenamientos (+${workoutBoost} pts boost)`
    });
  } else {
    healthComponents.push({
      name: "Actividad Física (Largo Plazo)",
      score: null,
      weight: 0.15,
      value: "Sin datos",
      baseline: null,
      explanation: "Sin datos de pasos ni de entrenamientos registrados esta semana"
    });
  }

  // 4. Body Composition Domain (Long-term)
  let compositionScore: number | null = null;
  if (todayBody && currentWaist && profileHeight) {
    const whtr = currentWaist / profileHeight;
    let baseScore = 50;
    if (whtr >= 0.40 && whtr <= 0.49) baseScore = 95;
    else if (whtr >= 0.50 && whtr <= 0.59) baseScore = 70;
    else if (whtr >= 0.60) baseScore = 40;

    compositionScore = baseScore;
  } else if (todayBody?.weight_kg) {
    compositionScore = 65; // fallback weight-only
  }
  healthComponents.push({
    name: "Composición Corporal",
    score: compositionScore,
    weight: 0.20,
    value: compositionScore !== null ? `${compositionScore}/100` : "Sin datos",
    explanation: "Puntuación basada en índice de cintura/altura y peso corporal"
  });

  // 5. Wellbeing Domain
  let wellbeingScore: number | null = null;
  const recentLogs = manualLogs.slice(0, 14);
  const energies = recentLogs.map(l => l.energy_score).filter((v): v is number => typeof v === "number" && v !== null);
  const moods = recentLogs.map(l => l.mood_score).filter((v): v is number => typeof v === "number" && v !== null);
  const stresses = recentLogs.map(l => l.stress_score).filter((v): v is number => typeof v === "number" && v !== null);

  if (energies.length > 0 && moods.length > 0) {
    const avgEnergy = mean(energies) * 20;
    const avgMood = mean(moods) * 20;
    const avgStress = stresses.length > 0 ? (6 - mean(stresses)) * 20 : 60; // stress inverted
    wellbeingScore = Math.round(avgEnergy * 0.4 + avgMood * 0.3 + avgStress * 0.3);
  }
  healthComponents.push({
    name: "Bienestar Subjetivo",
    score: wellbeingScore,
    weight: 0.10,
    value: wellbeingScore !== null ? `${wellbeingScore}/100` : "Sin datos",
    explanation: "Historial de energía, humor y niveles de estrés registrados manualmente"
  });

  // Calculate Health Index
  let healthIndexScore: number | null = null;
  let healthAlgorithm: AlgorithmUsed = "opcion_2_reglas_red_flags";
  let healthConfidence: Confidence = "insuficiente";
  let healthExplanation = "";

  const validHealth = healthComponents.filter(c => c.score !== null);
  const totalHealthWeight = validHealth.reduce((sum, c) => sum + c.weight, 0);
  if (totalHealthWeight >= 0.40) {
    const weightedSum = validHealth.reduce((sum, c) => sum + (c.score || 0) * c.weight, 0);
    healthIndexScore = Math.round(weightedSum / totalHealthWeight);

    const bpOk = validBps.length >= 3;
    const stepsOk = stepsValues.length >= 14;
    const sleepOk = sleepValues.length >= 14;

    if (bpOk && stepsOk && sleepOk) {
      healthAlgorithm = "baseline_personalizado";
      healthConfidence = "alta";
      healthExplanation = "Calculado con tendencias e historiales completos (pasos, sueño y presión).";
    } else {
      healthAlgorithm = "opcion_2_reglas_red_flags";
      healthConfidence = totalHealthWeight >= 0.70 ? "media" : "baja";
      healthExplanation = "Calculado parcialmente por reglas de salud pública debido a historial clínico incompleto.";
    }
  } else {
    healthConfidence = "insuficiente";
    healthExplanation = "No hay datos suficientes para evaluar la salud a largo plazo.";
  }


  // ─── C. BODY PROGRESS ──────────────────────────────────────────────────────
  let bodyScore: number | null = null;
  let bodyAlgorithm: AlgorithmUsed = "opcion_2_reglas_red_flags";
  let bodyConfidence: Confidence = "insuficiente";
  let bodyExplanation = "";
  const bodyComponents: ScoreComponent[] = [];

  // Sort body measurements by date descending
  const sortedBody = [...bodyMeasurements].sort((a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime());
  const currentBody = sortedBody[0];

  // Find previous body measurement separated by at least 14 days and within last 90 days
  let previousBody: any = null;
  if (currentBody) {
    const currTime = new Date(currentBody.measured_at).getTime();
    for (let i = 1; i < sortedBody.length; i++) {
      const prevTime = new Date(sortedBody[i].measured_at).getTime();
      const diffDays = Math.abs(currTime - prevTime) / (1000 * 60 * 60 * 24);
      if (diffDays >= 14 && diffDays <= 90) {
        previousBody = sortedBody[i];
        break;
      }
    }
  }

  if (currentBody && previousBody) {
    bodyAlgorithm = "baseline_personalizado";
    bodyConfidence = "alta";

    const weightChange = currentBody.weight_kg - previousBody.weight_kg;
    const waistChange = (currentBody.waist_cm && previousBody.waist_cm) ? currentBody.waist_cm - previousBody.waist_cm : null;
    const fatChange = (currentBody.body_fat_percentage && previousBody.body_fat_percentage) ? currentBody.body_fat_percentage - previousBody.body_fat_percentage : null;

    const armLeftChange = (currentBody.arm_left_relaxed_cm && previousBody.arm_left_relaxed_cm) ? currentBody.arm_left_relaxed_cm - previousBody.arm_left_relaxed_cm : 0;
    const armRightChange = (currentBody.arm_right_relaxed_cm && previousBody.arm_right_relaxed_cm) ? currentBody.arm_right_relaxed_cm - previousBody.arm_right_relaxed_cm : 0;
    const thighLeftChange = (currentBody.thigh_left_cm && previousBody.thigh_left_cm) ? currentBody.thigh_left_cm - previousBody.thigh_left_cm : 0;
    const thighRightChange = (currentBody.thigh_right_cm && previousBody.thigh_right_cm) ? currentBody.thigh_right_cm - previousBody.thigh_right_cm : 0;

    const muscleChange = (armLeftChange + armRightChange + thighLeftChange + thighRightChange) / 2;

    const totalVolume28d = (muscleVolumeWeekly || []).reduce((sum: number, v: any) => sum + Number(v.hard_sets), 0);

    // Detect recomposition, clean bulk, deficit, fat gain
    if (waistChange !== null && waistChange <= -0.5 && (muscleChange >= 0.2 || totalVolume28d >= 12) && Math.abs(weightChange) <= 1.5) {
      bodyScore = 95;
      bodyExplanation = `Señal compatible con recomposición corporal positiva: reducción de cintura (${waistChange.toFixed(1)} cm) con volumen activo (${totalVolume28d.toFixed(1)} series).`;
    } else if (weightChange >= 0.8 && waistChange !== null && waistChange <= 0.8 && (muscleChange >= 0.2 || totalVolume28d >= 15)) {
      bodyScore = 90;
      bodyExplanation = `Señal compatible con aumento limpio de masa muscular (volumen limpio): incremento de peso con cintura controlada y volumen activo (${totalVolume28d.toFixed(1)} series).`;
    } else if (weightChange <= -1.0 && waistChange !== null && waistChange <= -0.8 && Math.abs(muscleChange) < 0.5) {
      bodyScore = 92;
      bodyExplanation = "Señal compatible con pérdida de grasa exitosa (definición): reducción notable de peso y cintura preservando la masa muscular.";
    } else if (weightChange >= 1.0 && waistChange !== null && waistChange >= 1.0 && totalVolume28d < 8) {
      bodyScore = 42;
      bodyExplanation = "Señal compatible con probable ganancia grasa o retención: aumento de peso y cintura con volumen de entrenamiento de fuerza bajo.";
    } else {
      bodyScore = 75;
      bodyExplanation = "Medidas y composición corporal estables en comparación con tu medición de hace más de 14 días.";
    }

    bodyComponents.push(
      { name: "Variación Peso", score: null, weight: 0, value: `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)} kg` },
      { name: "Variación Cintura", score: null, weight: 0, value: waistChange !== null ? `${waistChange > 0 ? "+" : ""}${waistChange.toFixed(1)} cm` : "--" },
      { name: "Variación Grasa", score: null, weight: 0, value: fatChange !== null ? `${fatChange > 0 ? "+" : ""}${fatChange.toFixed(1)}%` : "--" },
      { name: "Variación Masa Muscular", score: null, weight: 0, value: `${muscleChange > 0 ? "+" : ""}${muscleChange.toFixed(1)} cm prom.` }
    );
  } else {
    // Option 2 rules
    bodyAlgorithm = "opcion_2_reglas_red_flags";
    bodyConfidence = currentBody ? "media" : "insuficiente";

    if (currentBody && profileHeight && currentBody.waist_cm) {
      const whtr = currentBody.waist_cm / profileHeight;
      if (whtr >= 0.40 && whtr <= 0.49) {
        bodyScore = 80;
        bodyExplanation = "Composición física en rangos saludables de cintura/altura.";
      } else if (whtr >= 0.50 && whtr <= 0.59) {
        bodyScore = 60;
        bodyExplanation = "Cintura ligeramente elevada respecto a tu altura. Considera registrar más medidas.";
      } else {
        bodyScore = 40;
        bodyExplanation = "Índice de cintura/altura elevado. Se sugiere monitoreo regular y hábitos de definición.";
      }

      bodyComponents.push(
        { name: "Cintura actual", score: null, weight: 0, value: `${currentBody.waist_cm} cm` },
        { name: "Índice Cintura/Altura", score: null, weight: 0, value: whtr.toFixed(2) }
      );
    } else {
      bodyScore = 50;
      bodyConfidence = "insuficiente";
      bodyExplanation = "Datos históricos insuficientes para calcular tendencias físicas. Registra tu peso y cintura periódicamente para evaluar tu progreso.";
    }
  }


  // ─── D. GENERAL SCORE ──────────────────────────────────────────────────────
  let generalScoreVal: number | null = null;
  let generalConfidence: Confidence = "insuficiente";
  let generalExplanation = "";

  const generalWeightMap = [
    { score: healthIndexScore, weight: 0.60, name: "Health Index" },
    { score: readinessScore, weight: 0.25, name: "Daily Readiness" },
    { score: bodyScore, weight: 0.15, name: "Body Progress" }
  ];

  const validGeneral = generalWeightMap.filter(w => w.score !== null);
  const totalGeneralWeight = validGeneral.reduce((sum, w) => sum + w.weight, 0);

  if (totalGeneralWeight >= 0.40) {
    const weightedSum = validGeneral.reduce((sum, w) => sum + (w.score || 0) * w.weight, 0);
    generalScoreVal = Math.round(weightedSum / totalGeneralWeight);
    
    // Determine overall confidence
    const confidences = [healthConfidence, readinessConfidence, bodyConfidence];
    if (confidences.includes("insuficiente") || confidences.filter(c => c === "baja").length >= 2) {
      generalConfidence = "baja";
    } else if (confidences.filter(c => c === "alta").length >= 2) {
      generalConfidence = "alta";
    } else {
      generalConfidence = "media";
    }

    generalExplanation = "Resumen ponderado de tu salud general (60%), preparación diaria (25%) y progreso físico (15%).";
  } else {
    generalConfidence = "insuficiente";
    generalExplanation = "No hay suficientes categorías con datos para calcular una puntuación general.";
  }


  // ─── E. RED FLAGS / ALERTS SYSTEM ──────────────────────────────────────────
  const last3Rhr = dailyMetrics.slice(0, 3).map(m => m.resting_hr).filter((v): v is number => typeof v === "number" && v !== null);
  const last3Hrv = dailyMetrics.slice(0, 3).map(m => m.hrv).filter((v): v is number => typeof v === "number" && v !== null);

  // 1. Critical/High BP and Pulse Pressure Alerts
  if (todayBp) {
    const pulsePressure = todayBp.systolic - todayBp.diastolic;
    const isWidePulsePressure = pulsePressure >= 60;
    const isIsolatedSystolic = todayBp.systolic >= 140 && todayBp.diastolic < 90;

    if (todayBp.systolic >= 180 || todayBp.diastolic >= 120) {
      alerts.push({
        severity: "critical",
        category: "cardiovascular",
        title: "Presión arterial crítica",
        message: `Se registró una presión arterial de ${todayBp.systolic}/${todayBp.diastolic} mmHg. Se sugiere reposar en un ambiente tranquilo y repetir la medición. Si los valores siguen altos o presentas dolor en el pecho, falta de aire o dolor de cabeza severo, busca atención médica de inmediato.${isWidePulsePressure ? ` Se observa una presión de pulso muy amplia de ${pulsePressure} mmHg.` : ""}`,
        relatedMetric: "blood_pressure"
      });
    } else if (isIsolatedSystolic) {
      alerts.push({
        severity: "warning",
        category: "cardiovascular",
        title: "Sistólica elevada registrada",
        message: `Se detectó una presión sistólica elevada (${todayBp.systolic} mmHg) con una diastólica normal (${todayBp.diastolic} mmHg), consistente con hipertensión sistólica aislada. Asimismo, presenta una presión de pulso amplia (${pulsePressure} mmHg, normal < 50-60 mmHg), lo cual puede indicar rigidez arterial. Se recomienda monitorear con regularidad en reposo y consultarlo con tu médico.`,
        relatedMetric: "blood_pressure"
      });
    } else if (todayBp.systolic >= 140 || todayBp.diastolic >= 90) {
      alerts.push({
        severity: "warning",
        category: "cardiovascular",
        title: "Presión arterial alta",
        message: `El registro de presión arterial (${todayBp.systolic}/${todayBp.diastolic} mmHg) califica como elevado. Conviene realizar monitoreos en reposo de forma regular y consultarlo con tu médico.${isWidePulsePressure ? ` Se observa una presión de pulso amplia de ${pulsePressure} mmHg (normal < 50-60 mmHg).` : ""}`,
        relatedMetric: "blood_pressure"
      });
    } else if (isWidePulsePressure) {
      alerts.push({
        severity: "info",
        category: "cardiovascular",
        title: "Presión de pulso amplia",
        message: `Aunque tu presión arterial se encuentra en rangos aceptables (${todayBp.systolic}/${todayBp.diastolic} mmHg), la diferencia entre sistólica y diastólica es de ${pulsePressure} mmHg (presión de pulso amplia, normal < 50-60 mmHg). Sigue monitoreando en reposo.`,
        relatedMetric: "blood_pressure"
      });
    }
  }

  // 2. Resting HR > 10 bpm above baseline for 3 consecutive days
  if (rhrValues.length >= 14 && last3Rhr.length === 3) {
    const bRhr = median(rhrValues);
    if (last3Rhr.every(r => r > bRhr + 10)) {
      alerts.push({
        severity: "warning",
        category: "cardiovascular",
        title: "FC reposo elevada",
        message: "Tu frecuencia cardíaca en reposo ha estado más de 10 bpm por encima de tu mediana habitual en los últimos 3 días. Podría ser un síntoma de fatiga física acumulada, estrés psicológico o inicio de una infección.",
        relatedMetric: "resting_hr"
      });
    }
  }

  // 3. HRV > 20% below baseline for 3 consecutive days
  if (hrvValues.length >= 14 && last3Hrv.length === 3) {
    const bHrv = median(hrvValues);
    if (last3Hrv.every(h => h < bHrv * 0.8)) {
      alerts.push({
        severity: "warning",
        category: "recovery",
        title: "Variabilidad cardíaca deprimida",
        message: "Tu variabilidad cardíaca (HRV) ha estado más de un 20% por debajo de tu nivel habitual durante 3 días seguidos. Indica una sobreexcitación del sistema nervioso simpático, sugiriendo bajar la carga y priorizar la recuperación.",
        relatedMetric: "hrv"
      });
    }
  }

  // 4. Sleep < 5h for 2+ nights
  const last3Sleeps = dailyMetrics.slice(0, 3).map(m => m.sleep_minutes).filter((v): v is number => typeof v === "number" && v !== null);
  if (last3Sleeps.length >= 2) {
    const shortNights = last3Sleeps.slice(0, 2).filter(s => s < 300).length;
    if (shortNights === 2) {
      alerts.push({
        severity: "warning",
        category: "sleep",
        title: "Deuda acumulada de sueño",
        message: "Has dormido menos de 5 horas durante 2 noches consecutivas. Esta privación del sueño afecta directamente la recuperación muscular, la regulación hormonal y la toma de decisiones diarias.",
        relatedMetric: "sleep_minutes"
      });
    }
  }

  // 5. Weight change > 3kg in 7d
  if (sortedBody.length >= 2) {
    const lastBody = sortedBody[0];
    const prevBody7d = sortedBody.find(b => {
      const diff = Math.abs(new Date(lastBody.measured_at).getTime() - new Date(b.measured_at).getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 5 && diff <= 10;
    });
    if (prevBody7d) {
      const wDiff = Math.abs(lastBody.weight_kg - prevBody7d.weight_kg);
      if (wDiff >= 3.0) {
        alerts.push({
          severity: "info",
          category: "body_composition",
          title: "Variación rápida de peso",
          message: `Tu peso corporal cambió ${wDiff.toFixed(1)} kg en una semana. Estas fluctuaciones suelen deberse a cambios rápidos en retención de líquidos, glucógeno muscular y contenido digestivo, más que a ganancia o pérdida de tejido graso.`,
          relatedMetric: "weight_kg"
        });
      }
    }
  }

  // 6. Waist change > 1.5cm in 14d
  if (sortedBody.length >= 2) {
    const lastBody = sortedBody[0];
    const prevBody14d = sortedBody.find(b => {
      const diff = Math.abs(new Date(lastBody.measured_at).getTime() - new Date(b.measured_at).getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 10 && diff <= 18;
    });
    if (prevBody14d && lastBody.waist_cm && prevBody14d.waist_cm) {
      const waistDiff = lastBody.waist_cm - prevBody14d.waist_cm;
      if (waistDiff >= 1.5) {
        alerts.push({
          severity: "warning",
          category: "body_composition",
          title: "Incremento de cintura rápido",
          message: `Tu cintura aumentó ${waistDiff.toFixed(1)} cm en las últimas dos semanas. Conviene observar tus hábitos nutricionales, posible inflamación o hinchazón abdominal.`,
          relatedMetric: "waist_cm"
        });
      }
    }
  }

  // 7. Subjective pain warning
  const last3Logs = manualLogs.slice(0, 3);
  const pains = last3Logs.map(l => l.pain_present).filter(Boolean);
  if (pains.length === 3) {
    alerts.push({
      severity: "warning",
      category: "pain",
      title: "Dolor físico persistente",
      message: "Se han reportado molestias físicas o dolores musculares por 3 días consecutivos. Se sugiere ajustar la rutina deportiva para no agravar las zonas comprometidas.",
      relatedMetric: "pain_present"
    });
  }

  return {
    healthIndex: {
      score: healthIndexScore,
      algorithmUsed: healthAlgorithm,
      confidence: healthConfidence,
      explanation: healthExplanation,
      components: healthComponents
    },
    dailyReadiness: {
      score: readinessScore,
      algorithmUsed: readinessAlgorithm,
      confidence: readinessConfidence,
      explanation: readinessExplanation,
      components: readinessComponents
    },
    bodyProgress: {
      score: bodyScore,
      algorithmUsed: bodyAlgorithm,
      confidence: bodyConfidence,
      explanation: bodyExplanation,
      components: bodyComponents
    },
    generalScore: {
      score: generalScoreVal,
      confidence: generalConfidence,
      explanation: generalExplanation
    },
    alerts,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Calculates scores and inserts insights for a given user based on recent data.
 * Callable from both sync (google-health.ts) and manual log (api/manual-log).
 */
export async function calculateScoresAndInsights(
  supabase: SupabaseClient,
  userId: string,
  targetDate?: string
): Promise<{ scores: number; insights: number }> {
  // Query 28 days of daily metrics to calculate baselines
  const metricsQuery = supabase
    .from("daily_metrics")
    .select("date,steps,sleep_minutes,resting_hr,hrv,spo2,respiratory_rate,active_minutes")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(28);

  const [
    { data: metrics },
    { data: bodyRows },
    { data: manualLogs },
    { data: bloodPressure },
    { data: profileRow },
    { data: workoutSessions },
    { data: muscleVolumeWeekly },
    { data: recentSymptoms }
  ] = await Promise.all([
    metricsQuery,
    supabase
      .from("body_measurements")
      .select("*")
      .eq("user_id", userId)
      .order("measured_at", { ascending: false })
      .limit(50),
    supabase
      .from("manual_daily_logs")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(28),
    supabase
      .from("blood_pressure_measurements")
      .select("*")
      .eq("user_id", userId)
      .order("measured_at", { ascending: false })
      .limit(30),
    supabase
      .from("profiles")
      .select("height_cm,target_weight_kg")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("workout_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(50),
    supabase
      .from("muscle_volume_daily")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(100),
    supabase
      .from("symptoms")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(50)
  ]);

  const dailyMetrics = (metrics ?? []) as DailyMetric[];
  if (dailyMetrics.length === 0 && targetDate) {
    dailyMetrics.push({
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
    });
  }

  const latest = targetDate
    ? dailyMetrics.find((m) => m.date === targetDate) ?? dailyMetrics[0]
    : dailyMetrics[0];

  if (!latest) return { scores: 0, insights: 0 };

  const height = profileRow?.height_cm ? Number(profileRow.height_cm) : null;

  // Calculate advanced scores
  const advancedResult = calculateAdvancedScores({
    dailyMetrics,
    bodyMeasurements: bodyRows ?? [],
    bloodPressureMeasurements: bloodPressure ?? [],
    manualLogs: manualLogs ?? [],
    profileHeight: height,
    targetDate: latest.date,
    workoutSessions: workoutSessions ?? [],
    muscleVolumeWeekly: muscleVolumeWeekly ?? [],
    recentSymptoms: recentSymptoms ?? []
  });

  // Backward compatibility mappings
  const recoveryScore = advancedResult.dailyReadiness.score;
  const sleepScore = advancedResult.dailyReadiness.components.find(c => c.name.includes("Sueño"))?.score ?? null;
  const trainingScore = advancedResult.dailyReadiness.components.find(c => c.name.includes("Carga"))?.score ?? null;
  const cardiovascularScore = advancedResult.healthIndex.score;
  const compositionScore = advancedResult.bodyProgress.score;
  const wellbeingScore = advancedResult.healthIndex.components.find(c => c.name.includes("Bienestar"))?.score ?? null;
  const overallScore = advancedResult.generalScore.score;

  const { error: scoreError } = await supabase.from("scores").upsert(
    {
      user_id: userId,
      date: latest.date,
      recovery_score: recoveryScore,
      sleep_score: sleepScore,
      training_score: trainingScore,
      cardiovascular_score: cardiovascularScore,
      body_composition_score: compositionScore,
      wellbeing_score: wellbeingScore,
      overall_score: overallScore,
      health_index: advancedResult.healthIndex.score,
      daily_readiness: advancedResult.dailyReadiness.score,
      body_progress: advancedResult.bodyProgress.score,
      calculation_version: "v2",
      explanation_json: advancedResult
    },
    { onConflict: "user_id,date" }
  );

  if (scoreError) throw new Error(scoreError.message);

  // Re-fill standard insights
  const latestBody = bodyRows?.[0];
  const weeklySteps =
    dailyMetrics.length > 0
      ? Math.round(dailyMetrics.slice(0, 7).reduce((sum, row) => sum + (row.steps ?? 0), 0) / Math.max(1, dailyMetrics.slice(0, 7).filter(m => m.steps !== null).length))
      : null;

  const insightsList = [
    {
      category: "activity",
      title: "Actividad física",
      explanation: `Último día registrado: ${latest.date}. Pasos: ${latest.steps ?? "sin dato"}.`,
      recommendation: weeklySteps
        ? `Tu promedio semanal actual es de ${weeklySteps} pasos.`
        : "Sin promedio semanal suficiente.",
      confidence: dailyMetrics.length >= 3 ? "medium" as const : "low" as const,
      supporting_data_json: { latest, weeklySteps }
    },
    {
      category: "body_composition",
      title: "Composición corporal",
      explanation: latestBody
        ? `Última medición disponible: ${latestBody.weight_kg ?? "sin peso"} kg, ${latestBody.body_fat_percentage ?? "sin grasa"}% grasa.`
        : "Todavía no hay medición de composición corporal.",
      recommendation: "Mirar tendencia de 2 a 4 semanas, no un punto aislado.",
      confidence: latestBody ? "medium" as const : "low" as const,
      supporting_data_json: latestBody ?? {}
    }
  ];

  // Clean old insights for the same date and insert new ones
  await supabase.from("insights").delete().eq("user_id", userId).eq("date", latest.date);

  let insightCount = 0;
  for (const insight of insightsList) {
    const { error } = await supabase.from("insights").insert({
      user_id: userId,
      date: latest.date,
      ...insight
    });
    if (!error) insightCount += 1;
  }

  return { scores: 1, insights: insightCount };
}
