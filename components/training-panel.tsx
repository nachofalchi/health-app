"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Dumbbell,
  Play,
  Zap,
  Info,
  Calendar,
  AlertTriangle,
  History,
  TrendingUp,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  Plus,
  Minus,
  Check,
  X,
  Star,
  Activity,
  Heart,
  Smile,
  ShieldAlert
} from "lucide-react";

type MuscleGroup = { id: string; name: string; category: string };
type ExerciseCatalog = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  type: string;
  equipment: string;
  difficulty: string;
  is_warmup: boolean;
  counts_for_volume: boolean;
  regressions_json: string[];
  progressions_json: string[];
};

type WorkoutSetInput = {
  set_number: number;
  reps: number;
  weight_kg: number;
  duration_seconds: number | null;
  is_warmup: boolean;
  completed: boolean;
};

type WorkoutExerciseInput = {
  exercise_id: string;
  name: string;
  order_index: number;
  section: string;
  sets: WorkoutSetInput[];
  is_warmup: boolean;
};

type TrainingPanelProps = {
  advancedScores: any;
  showToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
};

const PAIN_SPOTS = [
  { id: "lumbar", name: "Lumbar / Espalda Baja" },
  { id: "rodilla", name: "Rodillas" },
  { id: "hombro", name: "Hombros" },
  { id: "muñeca", name: "Muñecas / Antebrazo" },
  { id: "cuello", name: "Cuello / Cervical" }
];

export function TrainingPanel({ advancedScores, showToast }: TrainingPanelProps) {
  const router = useRouter();
  const [activeSubTab, setActiveSubTab] = useState<"hoy" | "rutinas" | "ejercicios" | "progreso">("hoy");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // API Data
  const [templates, setTemplates] = useState<any[]>([]);
  const [exercises, setExercises] = useState<ExerciseCatalog[]>([]);
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);
  const [volumeWeekly, setVolumeWeekly] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  // UI States
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [exerciseFilter, setExerciseFilter] = useState<string>("all");
  const [exerciseSearch, setExerciseSearch] = useState<string>("");

  // Workout Logger Modal
  const [isLogging, setIsLogging] = useState(false);
  const [logExercises, setLogExercises] = useState<WorkoutExerciseInput[]>([]);
  const [logSessionNotes, setLogSessionNotes] = useState("");
  const [logRPE, setLogRPE] = useState<number>(7);
  const [logEnergyBefore, setLogEnergyBefore] = useState<number>(3);
  const [logEnergyAfter, setLogEnergyAfter] = useState<number>(3);
  const [logPainSpots, setLogPainSpots] = useState<Record<string, number>>({
    lumbar: 0, rodilla: 0, hombro: 0, muñeca: 0, cuello: 0
  });
  const [currentLoggerStep, setCurrentLoggerStep] = useState<"exercises" | "survey">("exercises");

  // Quick Log Popover
  const [showQuickLogModal, setShowQuickLogModal] = useState(false);
  const [quickFlexionesReps, setQuickFlexionesReps] = useState("12");
  const [quickLumbarPain, setQuickLumbarPain] = useState<number>(0);

  // Standalone Pain Logger Modal
  const [showStandalonePainModal, setShowStandalonePainModal] = useState(false);
  const [standalonePainSpots, setStandalonePainSpots] = useState<Record<string, number>>({
    lumbar: 0, rodilla: 0, hombro: 0, muñeca: 0, cuello: 0
  });
  const [standaloneNotes, setStandaloneNotes] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/workouts");
      if (!res.ok) throw new Error("Error al obtener los datos de entrenamiento.");
      const payload = await res.json();
      if (payload.ok) {
        setTemplates(payload.templates || []);
        setExercises(payload.exercises || []);
        setMuscleGroups(payload.muscleGroups || []);
        setVolumeWeekly(payload.volumeWeekly || []);
        setHistory(payload.history || []);
      } else {
        throw new Error(payload.message || "Error al decodificar respuesta.");
      }
    } catch (err: any) {
      setError(err.message || "Error de conexión.");
      showToast(err.message || "Error al sincronizar datos del servidor", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Cardiovascular warning check
  const alertsList = advancedScores?.alerts || [];
  const readiness = advancedScores?.dailyReadiness?.score ?? 70;
  
  const hasCardioOverride = alertsList.some((a: any) => 
    a.category === "cardiovascular" && (a.severity === "warning" || a.severity === "critical")
  ) || advancedScores?.dailyReadiness?.explanation?.toLowerCase().includes("sistólica") 
    || advancedScores?.dailyReadiness?.explanation?.toLowerCase().includes("arterial alta");

  const todayBpMessage = alertsList.find((a: any) => a.category === "cardiovascular")?.message;

  // Determine readiness text recommendations
  let recTitle = "Entrenamiento moderado";
  let recDetail = "Tu preparación es buena hoy. Mantén el esfuerzo bajo control.";
  let recWarningType: "none" | "cardio" | "pain" | "fatigue" = "none";
  
  // Pain symptoms check
  const lumbarSymptom = advancedScores?.dailyReadiness?.explanation?.toLowerCase().includes("lumbar") 
    || Object.entries(logPainSpots).some(([spot, intensity]) => spot === "lumbar" && intensity >= 6);

  if (hasCardioOverride) {
    recTitle = "Sesión suave / Movilidad";
    recDetail = "Advertencia de presión arterial sistólica elevada. Evita esfuerzos de alta intensidad hoy.";
    recWarningType = "cardio";
  } else if (readiness < 50) {
    recTitle = "Movilidad + Caminata suave";
    recDetail = "Tu score de recuperación física es bajo. Prioriza recuperar el sistema nervioso.";
    recWarningType = "fatigue";
  } else if (readiness < 75) {
    recTitle = "Entrenamiento normal (sin fallo)";
    recDetail = "Tu cuerpo está listo, pero evita entrenar al fallo muscular o pesos extremos.";
    if (lumbarSymptom) {
      recTitle = "Movilidad & Reducir rango";
      recDetail = "Molestia lumbar detectada. Evita sentadillas al aire profundas o hip thrust intensos. Enfócate en movilidad suave.";
      recWarningType = "pain";
    }
  } else {
    recTitle = "Rutina normal o Progresión";
    recDetail = "¡Excelente estado de preparación física! Hoy puedes intentar alguna progresión o aumentar dificultad.";
  }

  // Last session formatting helper
  const getLastSessionLabel = () => {
    if (history.length === 0) return "No se encontraron registros previos";
    const last = history[0];
    const daysDiff = Math.round((new Date().getTime() - new Date(last.date).getTime()) / (1000 * 60 * 60 * 24));
    let when = daysDiff === 0 ? "hoy" : daysDiff === 1 ? "ayer" : `hace ${daysDiff} días`;
    const rpeLabel = last.session_rpe ? ` · Esfuerzo RPE: ${last.session_rpe}/10` : "";
    return `${last.name} (${when})${rpeLabel}`;
  };

  // Start Workout Logger
  const handleStartRoutine = (template: any) => {
    // Populate form with template exercises
    const templateExs = template.workout_template_exercises || [];
    const initialLogExs = templateExs.map((te: any) => {
      const setsCount = te.default_sets || 3;
      const sets: WorkoutSetInput[] = [];
      for (let i = 1; i <= setsCount; i++) {
        sets.push({
          set_number: i,
          reps: te.default_reps || (te.tempo === "AMRAP" ? 10 : 12),
          weight_kg: 0,
          duration_seconds: te.default_duration_seconds || null,
          is_warmup: te.section === "warmup",
          completed: true
        });
      }
      return {
        exercise_id: te.exercise_id,
        name: te.exercise_catalog?.name || "Ejercicio",
        order_index: te.order_index,
        section: te.section,
        sets,
        is_warmup: te.section === "warmup"
      };
    });

    setLogExercises(initialLogExs);
    setLogSessionNotes("");
    setLogRPE(7);
    setLogEnergyBefore(3);
    setLogEnergyAfter(3);
    setLogPainSpots({ lumbar: 0, rodilla: 0, hombro: 0, muñeca: 0, cuello: 0 });
    setCurrentLoggerStep("exercises");
    setIsLogging(true);
  };

  // Submit Workout Log
  const handleSaveWorkout = async () => {
    try {
      setLoading(true);
      // Format pain spots into payload array
      const pain_spots = Object.entries(logPainSpots).map(([spot, intensity]) => ({
        spot,
        intensity
      }));

      const payload = {
        template_id: "c5a5b5a5-d5a5-45d5-95a5-f5a5b5a5c5a5", // house routine
        name: "Rutina de casa",
        source: "template",
        session_rpe: logRPE,
        energy_before: logEnergyBefore,
        energy_after: logEnergyAfter,
        notes: logSessionNotes,
        pain_spots,
        exercises: logExercises.map(le => ({
          exercise_id: le.exercise_id,
          order_index: le.order_index,
          section: le.section,
          sets: le.sets
        }))
      };

      const res = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("No se pudo guardar la sesión de entrenamiento.");
      const result = await res.json();
      if (result.ok) {
        showToast("¡Rutina guardada y volumen actualizado!", "success");
        setIsLogging(false);
        fetchData();
        router.refresh();
      } else {
        throw new Error(result.message);
      }
    } catch (err: any) {
      showToast(err.message || "Error al conectar con la base de datos", "error");
    } finally {
      setLoading(false);
    }
  };

  // Submit Quick Log
  const handleQuickLog = async () => {
    try {
      setLoading(true);
      const pain_spots = quickLumbarPain > 0 ? [{ spot: "lumbar", intensity: quickLumbarPain }] : [];
      
      const payload = {
        quick_log: true,
        flexionesReps: parseInt(quickFlexionesReps, 10) || 12,
        pain_spots,
        session_rpe: 6,
        energy_before: 3,
        energy_after: 3,
        notes: "Carga rápida desde la pantalla de Inicio de Entreno"
      };

      const res = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("No se pudo registrar la carga rápida.");
      const result = await res.json();
      if (result.ok) {
        showToast("¡Registro rápido completado con éxito!", "success");
        setShowQuickLogModal(false);
        fetchData();
        router.refresh();
      } else {
        throw new Error(result.message);
      }
    } catch (err: any) {
      showToast(err.message || "Error de conexión.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Submit Standalone Pain Log
  const handleSaveStandalonePain = async () => {
    try {
      setLoading(true);
      const pain_spots = Object.entries(standalonePainSpots).map(([spot, intensity]) => ({
        spot,
        intensity
      }));

      const payload = {
        pain_spots,
        notes: standaloneNotes || "Reporte de dolor manual autónomo"
      };

      const res = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("No se pudo registrar el dolor.");
      const result = await res.json();
      if (result.ok) {
        showToast("¡Molestias registradas y Readiness recalculado!", "success");
        setShowStandalonePainModal(false);
        fetchData();
        router.refresh();
      } else {
        throw new Error(result.message);
      }
    } catch (err: any) {
      showToast(err.message || "Error de conexión.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Helper to adjust reps in logs
  const changeReps = (exIdx: number, setIdx: number, delta: number) => {
    const next = [...logExercises];
    const currentReps = next[exIdx].sets[setIdx].reps;
    next[exIdx].sets[setIdx].reps = Math.max(0, currentReps + delta);
    setLogExercises(next);
  };

  // Helper to adjust duration in plancha logs
  const changeDuration = (exIdx: number, setIdx: number, delta: number) => {
    const next = [...logExercises];
    const currentSecs = next[exIdx].sets[setIdx].duration_seconds || 30;
    next[exIdx].sets[setIdx].duration_seconds = Math.max(0, currentSecs + delta);
    setLogExercises(next);
  };

  // Helper to calculate total weekly volume by muscle
  const getWeeklyVolumeForMuscle = (muscleId: string) => {
    const rows = volumeWeekly.filter(v => v.muscle_group_id === muscleId);
    return rows.reduce((sum, r) => sum + Number(r.hard_sets), 0);
  };

  const getWeekStart = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(today.setDate(diff));
    return monday.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      
      {/* Sub-tab Navigation */}
      <nav style={{
        display: "flex",
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "24px",
        padding: "4px",
        gap: "4px",
        position: "sticky",
        top: "0",
        zIndex: 10
      }}>
        {(
          [
            { id: "hoy", label: "Hoy" },
            { id: "rutinas", label: "Rutinas" },
            { id: "ejercicios", label: "Ejercicios" },
            { id: "progreso", label: "Progreso" }
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            style={{
              flex: 1,
              padding: "10px 4px",
              border: "none",
              background: activeSubTab === tab.id ? "var(--accent)" : "transparent",
              color: activeSubTab === tab.id ? "white" : "var(--ink-2)",
              fontWeight: 700,
              fontSize: "0.85rem",
              borderRadius: "20px",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {loading && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "200px" }}>
          <span className="btn-spinner dark" style={{ width: "30px", height: "30px" }} />
        </div>
      )}

      {!loading && error && (
        <div style={{
          background: "var(--red-light)",
          border: "1px solid var(--red-line)",
          padding: "16px",
          borderRadius: "var(--radius-md)",
          color: "var(--red)",
          display: "flex",
          gap: "10px",
          alignItems: "center"
        }}>
          <AlertTriangle size={18} />
          <p style={{ fontSize: "0.85rem", margin: 0 }}>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ────────────────── SUB-TAB: HOY ────────────────── */}
          {activeSubTab === "hoy" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              
              {/* Card 1: Rutina sugerida */}
              <div className="pillar-card theme-workout" style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-lg)",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "14px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Dumbbell size={20} style={{ color: "var(--orange, var(--accent))" }} />
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                      Rutina sugerida para hoy
                    </span>
                  </div>
                  <span style={{ fontSize: "0.75rem", background: "var(--panel-2)", padding: "2px 8px", borderRadius: "10px", color: "var(--ink-2)" }}>
                    20-30 min
                  </span>
                </div>

                <div>
                  <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "var(--ink)" }}>Rutina de casa</h3>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "var(--ink-2)", lineHeight: 1.4 }}>
                    Focalizado en Piernas, Empuje de tren superior (Pecho/Tríceps) y Core. Ideal para consistencia.
                  </p>
                </div>

                {recWarningType === "pain" && (
                  <div style={{
                    background: "rgba(255, 149, 0, 0.08)",
                    border: "1px solid rgba(255, 149, 0, 0.3)",
                    borderRadius: "var(--radius-md)",
                    padding: "10px 12px",
                    display: "flex",
                    gap: "8px",
                    alignItems: "flex-start",
                    color: "rgba(255, 149, 0, 1)"
                  }}>
                    <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
                    <p style={{ fontSize: "0.78rem", margin: 0, lineHeight: 1.3 }}>
                      <strong>Ajuste por molestia lumbar:</strong> Se desaconsejan progresiones intensas. Opta por sentadillas con rango controlado y calienta bien la cadera.
                    </p>
                  </div>
                )}

                <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                  <button
                    onClick={() => {
                      const houseTemplate = templates.find(t => t.id === "c5a5b5a5-d5a5-45d5-95a5-f5a5b5a5c5a5");
                      if (houseTemplate) handleStartRoutine(houseTemplate);
                      else showToast("Plantilla por defecto no cargada.", "error");
                    }}
                    style={{
                      flex: 1,
                      padding: "12px",
                      background: "var(--accent)",
                      color: "white",
                      border: "none",
                      borderRadius: "16px",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: "6px",
                      cursor: "pointer"
                    }}
                  >
                    <Play size={14} fill="currentColor" /> Iniciar rutina
                  </button>

                  <button
                    onClick={() => setShowQuickLogModal(true)}
                    style={{
                      padding: "12px 18px",
                      background: "var(--panel-2)",
                      color: "var(--blue)",
                      border: "1px solid var(--line)",
                      borderRadius: "16px",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      cursor: "pointer"
                    }}
                  >
                    <Zap size={14} fill="currentColor" /> Carga rápida
                  </button>
                </div>
              </div>

              {/* Card 2: Estado para entrenar */}
              <div style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-lg)",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                boxShadow: "var(--shadow)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                    Estado de disponibilidad física
                  </span>
                  <span className={`conf-tag conf-${advancedScores?.dailyReadiness?.confidence || "alta"}`} style={{ fontSize: "0.68rem" }}>
                    Readiness: {readiness}/100
                  </span>
                </div>

                <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "4px" }}>
                  <div style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: recWarningType === "cardio" ? "rgba(255, 59, 48, 0.08)" : (recWarningType === "pain" || recWarningType === "fatigue" ? "rgba(255, 149, 0, 0.08)" : "rgba(52, 199, 89, 0.08)"),
                    border: `1px solid ${recWarningType === "cardio" ? "var(--red)" : (recWarningType === "pain" || recWarningType === "fatigue" ? "var(--amber)" : "var(--green)")}`,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    color: recWarningType === "cardio" ? "var(--red)" : (recWarningType === "pain" || recWarningType === "fatigue" ? "var(--amber)" : "var(--green)"),
                    flexShrink: 0
                  }}>
                    <Activity size={22} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)" }}>{recTitle}</h4>
                    <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "var(--ink-2)", lineHeight: 1.3 }}>{recDetail}</p>
                  </div>
                </div>

                {hasCardioOverride && todayBpMessage && (
                  <div style={{
                    marginTop: "6px",
                    background: "rgba(255, 59, 48, 0.06)",
                    borderLeft: "3px solid var(--red)",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    color: "var(--ink-2)",
                    lineHeight: 1.3
                  }}>
                    <strong>Alerta cardiovascular:</strong> {todayBpMessage}
                  </div>
                )}
              </div>

              {/* Card 3: Volumen semanal actual */}
              <div style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-lg)",
                padding: "16px",
                boxShadow: "var(--shadow)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                    Series efectivas esta semana (Lunes {getWeekStart()})
                  </span>
                  <TrendingUp size={15} style={{ color: "var(--accent)" }} />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {[
                    { id: "chest", name: "Pecho (Empuje)", max: 15 },
                    { id: "quads", name: "Cuádriceps", max: 15 },
                    { id: "glutes", name: "Glúteos", max: 15 },
                    { id: "core", name: "Core", max: 10 },
                    { id: "back", name: "Espalda (Tirón)", max: 15 }
                  ].map((muscle) => {
                    const volume = getWeeklyVolumeForMuscle(muscle.id);
                    const pct = Math.min(100, Math.round((volume / muscle.max) * 100));
                    return (
                      <div key={muscle.id} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ width: "110px", fontSize: "0.78rem", color: "var(--ink-2)", fontWeight: 600 }}>
                          {muscle.name}
                        </span>
                        <div style={{
                          flex: 1,
                          height: "8px",
                          background: "var(--line-light)",
                          borderRadius: "4px",
                          overflow: "hidden"
                        }}>
                          <div style={{
                            width: `${pct}%`,
                            height: "100%",
                            background: volume === 0 ? "var(--muted)" : "var(--accent)",
                            borderRadius: "4px"
                          }} />
                        </div>
                        <span style={{ width: "42px", textAlign: "right", fontSize: "0.78rem", fontWeight: 700, color: "var(--ink)" }}>
                          {volume.toFixed(1)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Card 4: Último entrenamiento */}
              <div style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-lg)",
                padding: "16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                boxShadow: "var(--shadow)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <History size={16} style={{ color: "var(--muted)" }} />
                  <div>
                    <span style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                      Última sesión
                    </span>
                    <strong style={{ fontSize: "0.85rem", color: "var(--ink)" }}>
                      {getLastSessionLabel()}
                    </strong>
                  </div>
                </div>
                {history.length > 0 && history[0].notes && (
                  <span title={history[0].notes} style={{ fontSize: "0.75rem", color: "var(--accent)", cursor: "help" }}>
                    Ver notas
                  </span>
                )}
              </div>

            </div>
          )}

          {/* ────────────────── SUB-TAB: RUTINAS ────────────────── */}
          {activeSubTab === "rutinas" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--ink)" }}>Plantillas de Rutinas</h3>
              </div>

              {templates.map((template) => {
                const isExpanded = expandedTemplateId === template.id;
                const warmupExs = (template.workout_template_exercises || []).filter((e: any) => e.section === "warmup");
                const mainExs = (template.workout_template_exercises || []).filter((e: any) => e.section === "main");

                return (
                  <div
                    key={template.id}
                    style={{
                      background: "var(--panel)",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--radius-lg)",
                      overflow: "hidden"
                    }}
                  >
                    <button
                      onClick={() => setExpandedTemplateId(isExpanded ? null : template.id)}
                      style={{
                        width: "100%",
                        padding: "16px",
                        border: "none",
                        background: "transparent",
                        textAlign: "left",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        cursor: "pointer"
                      }}
                    >
                      <div>
                        <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--ink)" }}>
                          {template.name}
                        </h4>
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                          Dificultad: {template.difficulty === "beginner" ? "Principiante" : "Intermedio"} · {template.workout_template_exercises?.length || 0} Ejercicios
                        </span>
                      </div>
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>

                    {isExpanded && (
                      <div style={{
                        padding: "0 16px 16px 16px",
                        borderTop: "1px solid var(--line)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        background: "var(--panel-2)"
                      }}>
                        <p style={{ fontSize: "0.8rem", color: "var(--ink-2)", margin: "12px 0 0 0", lineHeight: 1.4 }}>
                          {template.description}
                        </p>

                        {/* Warmup Block */}
                        {warmupExs.length > 0 && (
                          <div>
                            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                              Bloque 1: Calentamiento / Movilidad (No suma volumen)
                            </span>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              {warmupExs.map((te: any) => (
                                <div key={te.id} style={{
                                  background: "var(--panel)",
                                  border: "1px solid var(--line)",
                                  borderRadius: "var(--radius-sm)",
                                  padding: "8px 12px",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center"
                                }}>
                                  <div>
                                    <strong style={{ fontSize: "0.82rem", color: "var(--ink)" }}>{te.exercise_catalog?.name}</strong>
                                    <span style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)" }}>{te.notes}</span>
                                  </div>
                                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--ink-2)" }}>
                                    {te.default_sets} x {te.default_reps} {te.default_reps === 1 ? "rep" : "reps"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Main Block */}
                        {mainExs.length > 0 && (
                          <div>
                            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                              Bloque 2: Fuerza / Core (Cuenta para volumen)
                            </span>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              {mainExs.map((te: any) => (
                                <div key={te.id} style={{
                                  background: "var(--panel)",
                                  border: "1px solid var(--line)",
                                  borderRadius: "var(--radius-sm)",
                                  padding: "8px 12px",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center"
                                }}>
                                  <div>
                                    <strong style={{ fontSize: "0.82rem", color: "var(--ink)" }}>{te.exercise_catalog?.name}</strong>
                                    <span style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)" }}>{te.notes}</span>
                                  </div>
                                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--accent)" }}>
                                    {te.default_sets} x {te.default_reps ? te.default_reps : (te.default_duration_seconds ? `${te.default_duration_seconds}s` : "AMRAP")}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <button
                          onClick={() => handleStartRoutine(template)}
                          style={{
                            padding: "10px",
                            background: "var(--accent)",
                            color: "white",
                            border: "none",
                            borderRadius: "12px",
                            fontWeight: 700,
                            fontSize: "0.85rem",
                            cursor: "pointer",
                            marginTop: "8px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px"
                          }}
                        >
                          <Play size={14} fill="currentColor" /> Registrar esta rutina paso a paso
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ────────────────── SUB-TAB: EJERCICIOS ────────────────── */}
          {activeSubTab === "ejercicios" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              
              {/* Search and Filters */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ position: "relative" }}>
                  <Search size={16} style={{ position: "absolute", left: "12px", top: "12px", color: "var(--muted)" }} />
                  <input
                    type="text"
                    placeholder="Buscar ejercicio..."
                    value={exerciseSearch}
                    onChange={(e) => setExerciseSearch(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 10px 10px 36px",
                      background: "var(--panel)",
                      border: "1px solid var(--line)",
                      borderRadius: "14px",
                      fontSize: "0.85rem",
                      color: "var(--ink)"
                    }}
                  />
                </div>

                <div style={{
                  display: "flex",
                  gap: "6px",
                  overflowX: "auto",
                  paddingBottom: "4px"
                }}>
                  {[
                    { id: "all", name: "Todos" },
                    { id: "strength", name: "Fuerza" },
                    { id: "mobility", name: "Movilidad" },
                    { id: "core", name: "Core" }
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setExerciseFilter(f.id)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "12px",
                        border: "1px solid var(--line)",
                        background: exerciseFilter === f.id ? "var(--ink)" : "var(--panel)",
                        color: exerciseFilter === f.id ? "var(--panel)" : "var(--ink-2)",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Exercises Catalog List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {exercises
                  .filter((ex) => {
                    const matchesSearch = ex.name.toLowerCase().includes(exerciseSearch.toLowerCase());
                    const matchesType = exerciseFilter === "all" || ex.type === exerciseFilter;
                    return matchesSearch && matchesType;
                  })
                  .map((ex) => {
                    const isExpanded = expandedExerciseId === ex.id;
                    return (
                      <div
                        key={ex.id}
                        style={{
                          background: "var(--panel)",
                          border: "1px solid var(--line)",
                          borderRadius: "var(--radius-md)",
                          overflow: "hidden"
                        }}
                      >
                        <button
                          onClick={() => setExpandedExerciseId(isExpanded ? null : ex.id)}
                          style={{
                            width: "100%",
                            padding: "12px 14px",
                            border: "none",
                            background: "transparent",
                            textAlign: "left",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            cursor: "pointer"
                          }}
                        >
                          <div>
                            <strong style={{ fontSize: "0.9rem", color: "var(--ink)", display: "block" }}>
                              {ex.name}
                            </strong>
                            <span style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "capitalize" }}>
                              {ex.type === "strength" ? "fuerza" : (ex.type === "mobility" ? "movilidad" : ex.type)} · {ex.equipment === "bodyweight" ? "Peso corporal" : ex.equipment}
                            </span>
                          </div>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {isExpanded && (
                          <div style={{
                            padding: "0 14px 14px 14px",
                            borderTop: "1px solid var(--line)",
                            background: "var(--panel-2)",
                            fontSize: "0.8rem",
                            lineHeight: 1.4,
                            color: "var(--ink-2)"
                          }}>
                            <p style={{ margin: "10px 0 6px 0" }}>{ex.description}</p>
                            
                            <div style={{ margin: "8px 0" }}>
                              <strong style={{ display: "block", fontSize: "0.75rem", color: "var(--ink)", fontWeight: 700, marginBottom: "4px" }}>
                                Instrucciones:
                              </strong>
                              <p style={{ margin: 0, paddingLeft: "8px", borderLeft: "2px solid var(--accent)", fontSize: "0.78rem" }}>
                                {ex.instructions}
                              </p>
                            </div>

                            {/* Show Progressions & Regressions */}
                            {ex.regressions_json && ex.regressions_json.length > 0 && (
                              <div style={{ margin: "8px 0" }}>
                                <strong style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase" }}>Regresiones (Más fácil):</strong>
                                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                                  {ex.regressions_json.map((r, i) => (
                                    <span key={i} style={{ background: "var(--panel)", border: "1px solid var(--line)", padding: "2px 8px", borderRadius: "10px", fontSize: "0.72rem" }}>
                                      {r}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {ex.progressions_json && ex.progressions_json.length > 0 && (
                              <div style={{ margin: "8px 0" }}>
                                <strong style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase" }}>Progresiones (Más difícil):</strong>
                                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                                  {ex.progressions_json.map((p, i) => (
                                    <span key={i} style={{ background: "var(--panel)", border: "1px solid var(--line)", padding: "2px 8px", borderRadius: "10px", fontSize: "0.72rem", color: "var(--accent)" }}>
                                      {p}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>

            </div>
          )}

          {/* ────────────────── SUB-TAB: PROGRESO ────────────────── */}
          {activeSubTab === "progreso" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              
              {/* Muscle volume summary */}
              <div style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-lg)",
                padding: "16px",
                boxShadow: "var(--shadow)"
              }}>
                <h4 style={{ margin: "0 0 6px 0", fontSize: "0.9rem", fontWeight: 700, color: "var(--ink)" }}>
                  Balance muscular semanal
                </h4>
                <p style={{ margin: "0 0 14px 0", fontSize: "0.78rem", color: "var(--muted)", lineHeight: 1.3 }}>
                  Series efectivas ponderadas acumuladas en la semana actual por grupo muscular.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {[
                    { id: "chest", name: "Pecho (Empuje)", category: "push" },
                    { id: "triceps", name: "Tríceps (Empuje)", category: "push" },
                    { id: "anterior_deltoid", name: "Deltoide Ant.", category: "push" },
                    { id: "quads", name: "Cuádriceps (Pierna)", category: "legs" },
                    { id: "glutes", name: "Glúteos (Pierna)", category: "legs" },
                    { id: "hamstrings", name: "Isquios (Pierna)", category: "legs" },
                    { id: "core", name: "Core", category: "core" },
                    { id: "back", name: "Espalda (Tirón)", category: "pull" },
                    { id: "biceps", name: "Bíceps (Tirón)", category: "pull" }
                  ].map((m) => {
                    const volume = getWeeklyVolumeForMuscle(m.id);
                    return (
                      <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line-light)", paddingBottom: "6px" }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--ink-2)", fontWeight: 500 }}>{m.name}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{
                            fontSize: "0.7rem",
                            background: m.category === "push" ? "rgba(255, 149, 0, 0.08)" : (m.category === "legs" ? "rgba(52, 199, 89, 0.08)" : "rgba(10, 132, 255, 0.08)"),
                            color: m.category === "push" ? "var(--orange, var(--accent))" : (m.category === "legs" ? "var(--green)" : "var(--blue)"),
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontWeight: 700
                          }}>
                            {m.category.toUpperCase()}
                          </span>
                          <strong style={{ fontSize: "0.82rem", color: "var(--ink)", width: "32px", textAlign: "right" }}>
                            {volume.toFixed(1)}
                          </strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Warning of muscles not worked */}
              {getWeeklyVolumeForMuscle("back") === 0 && (
                <div style={{
                  background: "var(--panel)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-lg)",
                  padding: "14px",
                  display: "flex",
                  gap: "10px",
                  alignItems: "flex-start",
                  boxShadow: "var(--shadow)"
                }}>
                  <Info size={18} style={{ color: "var(--accent)", flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <h5 style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "var(--ink)" }}>
                      Falta volumen de tracción
                    </h5>
                    <p style={{ margin: "4px 0 0 0", fontSize: "0.78rem", color: "var(--ink-2)", lineHeight: 1.3 }}>
                      La rutina actual trabaja piernas y empuje de empuje/core, pero casi no incluye <strong>espalda o bíceps (tirón)</strong>. Sugerimos agregar ejercicios de tirón como <em>remo con mochila</em> o <em>bandas elásticas</em> para evitar desbalances.
                    </p>
                  </div>
                </div>
              )}

              {/* Form 5: Registrar Molestias / Dolor manual */}
              <div style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-lg)",
                padding: "16px",
                boxShadow: "var(--shadow)"
              }}>
                <h4 style={{ margin: "0 0 4px 0", fontSize: "0.9rem", fontWeight: 700, color: "var(--ink)" }}>
                  Registrar molestia o dolor muscular
                </h4>
                <p style={{ margin: "0 0 12px 0", fontSize: "0.75rem", color: "var(--muted)" }}>
                  Registra dolores localizados del cuerpo en escala 0-10 para ajustar Readiness y recomendaciones.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {PAIN_SPOTS.map((spot) => (
                    <div key={spot.id} style={{ display: "flex", alignItems: "center", justifyItems: "center" }}>
                      <span style={{ width: "130px", fontSize: "0.78rem", color: "var(--ink-2)", fontWeight: 600 }}>
                        {spot.name}
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={standalonePainSpots[spot.id]}
                        onChange={(e) => setStandalonePainSpots({
                          ...standalonePainSpots,
                          [spot.id]: parseInt(e.target.value, 10)
                        })}
                        style={{ flex: 1, accentColor: "var(--accent)" }}
                      />
                      <span style={{ width: "36px", textAlign: "right", fontSize: "0.78rem", fontWeight: 700, color: standalonePainSpots[spot.id] > 0 ? "var(--red)" : "var(--muted)" }}>
                        {standalonePainSpots[spot.id]}/10
                      </span>
                    </div>
                  ))}

                  <textarea
                    placeholder="Notas o comentarios sobre las molestias..."
                    value={standaloneNotes}
                    onChange={(e) => setStandaloneNotes(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      background: "var(--panel-2)",
                      border: "1px solid var(--line)",
                      borderRadius: "10px",
                      fontSize: "0.78rem",
                      minHeight: "50px",
                      marginTop: "4px",
                      color: "var(--ink)"
                    }}
                  />

                  <button
                    onClick={handleSaveStandalonePain}
                    style={{
                      padding: "10px",
                      background: "var(--accent)",
                      color: "white",
                      border: "none",
                      borderRadius: "12px",
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      marginTop: "6px"
                    }}
                  >
                    Guardar reporte de molestias
                  </button>
                </div>
              </div>

            </div>
          )}
        </>
      )}

      {/* ────────────────── MODAL: QUICK LOG POPUP ────────────────── */}
      {showQuickLogModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 100,
          padding: "16px",
          backdropFilter: "blur(4px)"
        }}>
          <div style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-lg)",
            width: "100%",
            maxWidth: "400px",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            boxShadow: "var(--shadow-lg)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Zap size={18} style={{ color: "var(--blue)" }} />
                <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--ink)" }}>Carga rápida de rutina</h4>
              </div>
              <button onClick={() => setShowQuickLogModal(false)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)" }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--ink-2)", lineHeight: 1.4 }}>
              Esto registrará la Rutina de casa completa con los valores por defecto (Sentadilla 3x15, Plancha 3x30s, Hip Thrust 3x15).
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                  Repeticiones de Flexiones (AMRAP):
                </label>
                <input
                  type="number"
                  value={quickFlexionesReps}
                  onChange={(e) => setQuickFlexionesReps(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "var(--panel-2)",
                    border: "1px solid var(--line)",
                    borderRadius: "10px",
                    fontSize: "0.85rem",
                    color: "var(--ink)"
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                  ¿Surgió molestia lumbar hoy?
                </label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={quickLumbarPain}
                    onChange={(e) => setQuickLumbarPain(parseInt(e.target.value, 10))}
                    style={{ flex: 1, accentColor: "var(--accent)" }}
                  />
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: quickLumbarPain > 0 ? "var(--red)" : "var(--muted)", width: "36px", textAlign: "right" }}>
                    {quickLumbarPain}/10
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleQuickLog}
              style={{
                padding: "12px",
                background: "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: "12px",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
                marginTop: "6px"
              }}
            >
              Confirmar registro rápido
            </button>
          </div>
        </div>
      )}

      {/* ────────────────── MODAL: WORKOUT LOGGER STEP-BY-STEP ────────────────── */}
      {isLogging && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "var(--bg)",
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          padding: "16px 16px 80px 16px",
          overflowY: "auto"
        }}>
          {/* Header */}
          <header style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: "14px",
            borderBottom: "1px solid var(--line)"
          }}>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>
                Sesión en curso
              </span>
              <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "var(--ink)" }}>
                Rutina de casa
              </h2>
            </div>
            <button
              onClick={() => {
                if (confirm("¿Estás seguro de que deseas cancelar la sesión? Perderás el progreso.")) {
                  setIsLogging(false);
                }
              }}
              style={{
                border: "none",
                background: "var(--panel-2)",
                padding: "6px",
                borderRadius: "50%",
                cursor: "pointer",
                color: "var(--ink-2)"
              }}
            >
              <X size={18} />
            </button>
          </header>

          {currentLoggerStep === "exercises" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "16px" }}>
              
              {/* List of exercises */}
              {logExercises.map((le, exIdx) => (
                <div key={le.exercise_id} style={{
                  background: "var(--panel)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-lg)",
                  padding: "14px",
                  boxShadow: "var(--shadow)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <div>
                      <strong style={{ fontSize: "0.92rem", color: "var(--ink)" }}>{le.name}</strong>
                      <span style={{
                        fontSize: "0.68rem",
                        color: le.is_warmup ? "var(--green)" : "var(--accent)",
                        background: le.is_warmup ? "rgba(52, 199, 89, 0.08)" : "rgba(10, 132, 255, 0.08)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        marginLeft: "6px",
                        fontWeight: 700
                      }}>
                        {le.is_warmup ? "CALENTAMIENTO" : "BLOQUE PRINCIPAL"}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {le.sets.map((set, setIdx) => {
                      const isPlancha = le.exercise_id === "eb10cf1c-34d2-430b-9ee0-1123f81e3a6c";
                      const isFlexiones = le.exercise_id === "f4c718a2-23c2-4841-9de3-cde11ffb0762";
                      
                      return (
                        <div key={setIdx} style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "6px 8px",
                          background: "var(--panel-2)",
                          borderRadius: "var(--radius-sm)"
                        }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--muted)", width: "40px" }}>
                            SET {set.set_number}
                          </span>

                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            {/* Input for Reps / Duration */}
                            {isPlancha ? (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <button onClick={() => changeDuration(exIdx, setIdx, -5)} style={{ border: "none", background: "var(--line)", width: "24px", height: "24px", borderRadius: "50%", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer" }}>
                                  <Minus size={10} />
                                </button>
                                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ink)", width: "36px", textAlign: "center" }}>
                                  {set.duration_seconds || 30}s
                                </span>
                                <button onClick={() => changeDuration(exIdx, setIdx, 5)} style={{ border: "none", background: "var(--line)", width: "24px", height: "24px", borderRadius: "50%", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer" }}>
                                  <Plus size={10} />
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <button onClick={() => changeReps(exIdx, setIdx, -1)} style={{ border: "none", background: "var(--line)", width: "24px", height: "24px", borderRadius: "50%", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer" }}>
                                  <Minus size={10} />
                                </button>
                                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ink)", width: "28px", textAlign: "center" }}>
                                  {set.reps}
                                </span>
                                <button onClick={() => changeReps(exIdx, setIdx, 1)} style={{ border: "none", background: "var(--line)", width: "24px", height: "24px", borderRadius: "50%", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer" }}>
                                  <Plus size={10} />
                                </button>
                                {isFlexiones && setIdx === 0 && (
                                  <span style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 500 }}>
                                    (AMRAP)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div style={{ display: "flex", alignItems: "center" }}>
                            <button
                              onClick={() => {
                                const next = [...logExercises];
                                next[exIdx].sets[setIdx].completed = !set.completed;
                                setLogExercises(next);
                              }}
                              style={{
                                border: "none",
                                background: set.completed ? "var(--green)" : "var(--muted)",
                                color: "white",
                                width: "22px",
                                height: "22px",
                                borderRadius: "4px",
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                cursor: "pointer"
                              }}
                            >
                              <Check size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <button
                onClick={() => setCurrentLoggerStep("survey")}
                style={{
                  padding: "14px",
                  background: "var(--accent)",
                  color: "white",
                  border: "none",
                  borderRadius: "16px",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: "6px",
                  marginTop: "8px"
                }}
              >
                Continuar al cuestionario de cierre <ChevronRight size={16} />
              </button>

            </div>
          )}

          {currentLoggerStep === "survey" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
              
              {/* 1. RPE Slider */}
              <div style={{ background: "var(--panel)", border: "1px solid var(--line)", padding: "14px", borderRadius: "var(--radius-lg)" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                  Esfuerzo Percibido (RPE):
                </label>
                <p style={{ margin: "0 0 10px 0", fontSize: "0.75rem", color: "var(--muted)" }}>
                  ¿Qué tan duro fue el entrenamiento en escala del 1 (muy ligero) al 10 (esfuerzo máximo)?
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={logRPE}
                    onChange={(e) => setLogRPE(parseInt(e.target.value, 10))}
                    style={{ flex: 1, accentColor: "var(--accent)" }}
                  />
                  <span style={{ fontSize: "1rem", fontWeight: 800, color: "var(--accent)", width: "36px", textAlign: "right" }}>
                    {logRPE}/10
                  </span>
                </div>
              </div>

              {/* 2. Energy before & after */}
              <div style={{ background: "var(--panel)", border: "1px solid var(--line)", padding: "14px", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                    Energía antes de entrenar:
                  </label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        onClick={() => setLogEnergyBefore(val)}
                        style={{
                          background: logEnergyBefore >= val ? "rgba(255, 149, 0, 0.08)" : "transparent",
                          border: `1px solid ${logEnergyBefore >= val ? "rgba(255, 149, 0, 0.6)" : "var(--line)"}`,
                          color: logEnergyBefore >= val ? "var(--orange, var(--accent))" : "var(--muted)",
                          padding: "6px 12px",
                          borderRadius: "8px",
                          cursor: "pointer"
                        }}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                    Energía después de entrenar:
                  </label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        onClick={() => setLogEnergyAfter(val)}
                        style={{
                          background: logEnergyAfter >= val ? "rgba(255, 149, 0, 0.08)" : "transparent",
                          border: `1px solid ${logEnergyAfter >= val ? "rgba(255, 149, 0, 0.6)" : "var(--line)"}`,
                          color: logEnergyAfter >= val ? "var(--orange, var(--accent))" : "var(--muted)",
                          padding: "6px 12px",
                          borderRadius: "8px",
                          cursor: "pointer"
                        }}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. Pain Spots Scale */}
              <div style={{ background: "var(--panel)", border: "1px solid var(--line)", padding: "14px", borderRadius: "var(--radius-lg)" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                  ¿Apareció alguna molestia o dolor físico?
                </label>
                <p style={{ margin: "0 0 12px 0", fontSize: "0.75rem", color: "var(--muted)" }}>
                  Indica dolor o sobrecarga en escala 0 (nada) al 10 (severo) por zona:
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {PAIN_SPOTS.map((spot) => (
                    <div key={spot.id} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ width: "120px", fontSize: "0.78rem", color: "var(--ink-2)", fontWeight: 600 }}>
                        {spot.name}
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={logPainSpots[spot.id]}
                        onChange={(e) => setLogPainSpots({
                          ...logPainSpots,
                          [spot.id]: parseInt(e.target.value, 10)
                        })}
                        style={{ flex: 1, accentColor: "var(--accent)" }}
                      />
                      <span style={{ width: "32px", textAlign: "right", fontSize: "0.78rem", fontWeight: 700, color: logPainSpots[spot.id] > 0 ? "var(--red)" : "var(--muted)" }}>
                        {logPainSpots[spot.id]}/10
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Session Notes */}
              <textarea
                placeholder="Notas libres sobre el entrenamiento (sensaciones, adaptaciones, progresos)..."
                value={logSessionNotes}
                onChange={(e) => setLogSessionNotes(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  background: "var(--panel)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.82rem",
                  minHeight: "60px",
                  color: "var(--ink)"
                }}
              />

              <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                <button
                  onClick={() => setCurrentLoggerStep("exercises")}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: "var(--panel-2)",
                    border: "1px solid var(--line)",
                    borderRadius: "12px",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    color: "var(--ink)"
                  }}
                >
                  Volver a ejercicios
                </button>

                <button
                  onClick={handleSaveWorkout}
                  style={{
                    flex: 2,
                    padding: "12px",
                    background: "var(--green)",
                    color: "white",
                    border: "none",
                    borderRadius: "12px",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    cursor: "pointer"
                  }}
                >
                  Finalizar y Guardar
                </button>
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}
