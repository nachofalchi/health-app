/**
 * Projections engine for Salud Nacho health categories.
 *
 * Provides linear regression, moving average, and trend detection
 * for projecting health metrics into the future.
 */

export type TrendDirection = "up" | "down" | "stable";
export type ProjectionConfidence = "low" | "medium" | "high";

export type Projection = {
  /** Projected value at the target horizon */
  projectedValue: number | null;
  /** Human-readable formatted value */
  projectedDisplay: string;
  /** Direction of the trend */
  direction: TrendDirection;
  /** Arrow character for display */
  directionArrow: "↑" | "↓" | "→";
  /** CSS color variable key */
  directionColor: "green" | "amber" | "red" | "blue";
  /** Confidence in the projection */
  confidence: ProjectionConfidence;
  /** Human-readable explanation */
  explanation: string;
};

// ─── Math helpers ──────────────────────────────────────────────────────────────

/**
 * Simple linear regression — returns slope and intercept.
 * x values are treated as indices (0, 1, 2, ...).
 */
function linearRegression(values: number[]): { slope: number; intercept: number } | null {
  const n = values.length;
  if (n < 2) return null;

  const xs = values.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = values.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (values[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }

  if (den === 0) return null;
  const slope = num / den;
  const intercept = meanY - slope * meanX;
  return { slope, intercept };
}

/** Project `daysAhead` using linear regression from the last `windowSize` values. */
function projectLinear(
  values: (number | null | undefined)[],
  daysAhead: number = 7,
  windowSize: number = 14
): { value: number | null; slope: number | null } {
  const valid = values
    .slice(0, windowSize)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    .reverse(); // oldest first for regression

  if (valid.length < 3) return { value: null, slope: null };

  const reg = linearRegression(valid);
  if (!reg) return { value: null, slope: null };

  const projected = reg.intercept + reg.slope * (valid.length - 1 + daysAhead);
  return { value: Math.round(projected * 10) / 10, slope: reg.slope };
}

function detectTrend(slope: number | null, threshold: number = 0.5): TrendDirection {
  if (slope === null) return "stable";
  if (slope > threshold) return "up";
  if (slope < -threshold) return "down";
  return "stable";
}

// ─── Per-category projections ─────────────────────────────────────────────────

export function projectRecovery(
  hrv: (number | null)[],
  sleepMinutes: (number | null)[]
): Projection {
  const { value: projHRV, slope: slopeHRV } = projectLinear(hrv, 7, 14);
  const direction = detectTrend(slopeHRV, 0.3);

  if (projHRV === null) {
    return {
      projectedValue: null,
      projectedDisplay: "sin baseline",
      direction: "stable",
      directionArrow: "→",
      directionColor: "amber",
      confidence: "low",
      explanation: "Se necesitan al menos 3 días con HRV registrado para proyectar recuperación."
    };
  }

  const isGood = projHRV >= 50;
  return {
    projectedValue: projHRV,
    projectedDisplay: `${projHRV.toFixed(0)} ms HRV`,
    direction,
    directionArrow: direction === "up" ? "↑" : direction === "down" ? "↓" : "→",
    directionColor: direction === "up" ? "green" : direction === "down" ? "red" : "amber",
    confidence: hrv.filter(Boolean).length >= 7 ? "medium" : "low",
    explanation:
      direction === "up"
        ? `Tu HRV muestra tendencia positiva. En 7 días se proyecta ~${projHRV.toFixed(0)} ms, indicando mejor recuperación.`
        : direction === "down"
          ? `Tu HRV está en tendencia descendente. En 7 días podría llegar a ~${projHRV.toFixed(0)} ms. Priorizá descanso.`
          : `Tu HRV se mantiene estable. Proyección a 7 días: ~${projHRV.toFixed(0)} ms.`
  };
}

export function projectSleep(sleepMinutes: (number | null)[]): Projection {
  const { value, slope } = projectLinear(sleepMinutes, 7, 14);
  const direction = detectTrend(slope, 5);

  if (value === null) {
    return {
      projectedValue: null,
      projectedDisplay: "sin baseline",
      direction: "stable",
      directionArrow: "→",
      directionColor: "amber",
      confidence: "low",
      explanation: "Se necesitan al menos 3 noches con datos de sueño para proyectar."
    };
  }

  const hours = Math.floor(value / 60);
  const mins = Math.round(value % 60);
  const display = `${hours}h ${mins}m`;
  const isOptimal = value >= 420 && value <= 540;

  return {
    projectedValue: value,
    projectedDisplay: display,
    direction,
    directionArrow: direction === "up" ? "↑" : direction === "down" ? "↓" : "→",
    directionColor: isOptimal ? "green" : value < 360 ? "red" : "amber",
    confidence: sleepMinutes.filter(Boolean).length >= 7 ? "medium" : "low",
    explanation:
      isOptimal
        ? `Tu promedio de sueño se proyecta en ${display} — dentro del rango óptimo (7-9 hs).`
        : value < 360
          ? `Alerta: el sueño proyectado (${display}) está por debajo de 6 horas. Intentá acostarte antes.`
          : `Tu sueño proyectado es ${display}. ${direction === "up" ? "Va mejorando." : direction === "down" ? "Está bajando — prestá atención." : "Se mantiene estable."}`
  };
}

export function projectTraining(steps: (number | null)[]): Projection {
  const { value, slope } = projectLinear(steps, 7, 14);
  const direction = detectTrend(slope, 200);

  if (value === null) {
    return {
      projectedValue: null,
      projectedDisplay: "sin baseline",
      direction: "stable",
      directionArrow: "→",
      directionColor: "amber",
      confidence: "low",
      explanation: "Se necesitan al menos 3 días con pasos registrados para proyectar."
    };
  }

  const formattedValue = new Intl.NumberFormat("es-AR").format(Math.round(value));
  const isActive = value >= 8000;

  return {
    projectedValue: value,
    projectedDisplay: `${formattedValue} pasos/día`,
    direction,
    directionArrow: direction === "up" ? "↑" : direction === "down" ? "↓" : "→",
    directionColor: isActive ? "green" : value >= 5000 ? "amber" : "red",
    confidence: steps.filter(Boolean).length >= 7 ? "medium" : "low",
    explanation:
      direction === "up"
        ? `Tu actividad está en aumento. Proyección: ~${formattedValue} pasos/día en 7 días.`
        : direction === "down"
          ? `Tu actividad está bajando. En 7 días podrías llegar a ~${formattedValue} pasos. Intentá mantener el ritmo.`
          : `Tu actividad es estable. Proyección: ~${formattedValue} pasos/día.`
  };
}

export function projectCardiovascular(restingHR: (number | null)[]): Projection {
  const { value, slope } = projectLinear(restingHR, 30, 30);
  const direction = detectTrend(slope, 0.2);
  // For resting HR: lower is better, so "down" is good
  const isGoodDirection = direction === "down";
  const isBadDirection = direction === "up";

  if (value === null) {
    return {
      projectedValue: null,
      projectedDisplay: "sin baseline",
      direction: "stable",
      directionArrow: "→",
      directionColor: "amber",
      confidence: "low",
      explanation: "Se necesitan al menos 3 días con FC en reposo para proyectar."
    };
  }

  return {
    projectedValue: value,
    projectedDisplay: `${value.toFixed(0)} bpm`,
    direction,
    directionArrow: direction === "up" ? "↑" : direction === "down" ? "↓" : "→",
    directionColor: isGoodDirection ? "green" : isBadDirection ? "red" : "amber",
    confidence: restingHR.filter(Boolean).length >= 14 ? "medium" : "low",
    explanation:
      isGoodDirection
        ? `Tu FC en reposo está bajando — señal positiva de mejora cardiovascular. Proyección a 30 días: ~${value.toFixed(0)} bpm.`
        : isBadDirection
          ? `Tu FC en reposo está subiendo. Puede indicar fatiga acumulada o menor aeróbico. Proyección: ~${value.toFixed(0)} bpm.`
          : `Tu FC en reposo se mantiene estable (~${value.toFixed(0)} bpm). Seguí monitoreando.`
  };
}

export function projectBodyComposition(
  weights: (number | null)[],
  windowDays: number = 30
): Projection {
  const { value, slope } = projectLinear(weights, windowDays, 30);
  const direction = detectTrend(slope, 0.05);

  if (value === null) {
    return {
      projectedValue: null,
      projectedDisplay: "sin baseline",
      direction: "stable",
      directionArrow: "→",
      directionColor: "amber",
      confidence: "low",
      explanation: "Se necesitan al menos 3 mediciones de peso para proyectar tendencia."
    };
  }

  const ratePerWeek = slope !== null ? slope * 7 : null;
  const rateText = ratePerWeek !== null
    ? `${ratePerWeek > 0 ? "+" : ""}${ratePerWeek.toFixed(2)} kg/semana`
    : "";

  return {
    projectedValue: value,
    projectedDisplay: `${value.toFixed(1)} kg`,
    direction,
    directionArrow: direction === "up" ? "↑" : direction === "down" ? "↓" : "→",
    directionColor: "blue",
    confidence: weights.filter(Boolean).length >= 5 ? "medium" : "low",
    explanation:
      direction === "stable"
        ? `Tu peso se mantiene estable alrededor de ${value.toFixed(1)} kg.`
        : `A la tasa actual (${rateText}), en ${windowDays} días tu peso proyectado sería ~${value.toFixed(1)} kg.`
  };
}

export function projectWellbeing(
  energyScores: (number | null)[],
  moodScores: (number | null)[]
): Projection {
  const combined = energyScores.map((e, i) => {
    const m = moodScores[i];
    if (e !== null && m !== null) return (e + m) / 2;
    return e ?? m ?? null;
  });

  const { value, slope } = projectLinear(combined, 7, 14);
  const direction = detectTrend(slope, 0.1);

  if (value === null) {
    return {
      projectedValue: null,
      projectedDisplay: "sin baseline",
      direction: "stable",
      directionArrow: "→",
      directionColor: "amber",
      confidence: "low",
      explanation: "Registrá energía y ánimo durante al menos 3 días para ver proyecciones."
    };
  }

  const score = Math.max(1, Math.min(5, value));
  return {
    projectedValue: score,
    projectedDisplay: `${score.toFixed(1)}/5`,
    direction,
    directionArrow: direction === "up" ? "↑" : direction === "down" ? "↓" : "→",
    directionColor: score >= 3.5 ? "green" : score >= 2.5 ? "amber" : "red",
    confidence: combined.filter(Boolean).length >= 5 ? "medium" : "low",
    explanation:
      direction === "up"
        ? `Tu bienestar subjetivo está mejorando. Proyección a 7 días: ${score.toFixed(1)}/5.`
        : direction === "down"
          ? `Tu bienestar está bajando. Proyección: ${score.toFixed(1)}/5. Revisá sueño y carga.`
          : `Tu bienestar se mantiene estable (~${score.toFixed(1)}/5).`
  };
}
