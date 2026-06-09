"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Coffee,
  Wine,
  Utensils,
  Brain,
  Clock,
  HeartPulse,
  Scale,
  Smile,
  Zap,
} from "lucide-react";

// ─── Toast ─────────────────────────────────────────────────────────────────
type ToastType = "success" | "error" | "info" | "warning";
interface Toast { id: number; message: string; type: ToastType; icon: string }
const TOAST_ICONS: Record<ToastType, string> = {
  success: "✅", error: "❌", info: "🔄", warning: "⚠️",
};

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string, type: ToastType = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type, icon: TOAST_ICONS[type] }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);
  return { toasts, show };
}

// ─── Component ──────────────────────────────────────────────────────────────
export function DashboardControlCenter({
  environmentSettings,
  environmentForecasts
}: {
  environmentSettings?: any;
  environmentForecasts?: any[];
}) {
  const router = useRouter();
  const [activeSubTab, setActiveSubTab] = useState<"cardio" | "medidas" | "habitos">("cardio");
  const [isSaving, setIsSaving] = useState(false);
  const submittingRef = useRef(false);
  const { toasts, show: showToast } = useToast();

  const todayStr = new Date().toLocaleDateString("en-CA");
  const todayForecast = environmentForecasts?.find((f: any) => f.forecast_date === todayStr);
  const isPressureHighToday = environmentSettings?.atmospheric_pressure_tracking_enabled && todayForecast?.crosses_threshold;

  const [useThreeReadings, setUseThreeReadings] = useState(false);
  const [reading1, setReading1] = useState({ sys: "", dia: "", pulse: "" });
  const [reading2, setReading2] = useState({ sys: "", dia: "", pulse: "" });
  const [reading3, setReading3] = useState({ sys: "", dia: "", pulse: "" });

  const calculateAverageBP = useCallback(() => {
    const readings = [reading1, reading2, reading3].map(r => ({
      sys: r.sys ? parseInt(r.sys, 10) : NaN,
      dia: r.dia ? parseInt(r.dia, 10) : NaN,
      pulse: r.pulse ? parseInt(r.pulse, 10) : NaN,
    }));

    const validSys = readings.map(r => r.sys).filter(v => !isNaN(v));
    const validDia = readings.map(r => r.dia).filter(v => !isNaN(v));
    const validPulse = readings.map(r => r.pulse).filter(v => !isNaN(v));

    if (validSys.length === 0 || validDia.length === 0) return null;

    const avgSys = Math.round(validSys.reduce((a, b) => a + b, 0) / validSys.length);
    const avgDia = Math.round(validDia.reduce((a, b) => a + b, 0) / validDia.length);
    const avgPulse = validPulse.length > 0 
      ? Math.round(validPulse.reduce((a, b) => a + b, 0) / validPulse.length)
      : undefined;

    return {
      sys: avgSys,
      dia: avgDia,
      pulse: avgPulse
    };
  }, [reading1, reading2, reading3]);

  // Auto-sync every 30 min
  useEffect(() => {
    async function runAutoSync() {
      const lastSyncStr = localStorage.getItem("last_google_health_auto_sync");
      const now = Date.now();
      const THIRTY_MIN = 30 * 60 * 1000;
      if (lastSyncStr && now - parseInt(lastSyncStr, 10) < THIRTY_MIN) return;
      try {
        const response = await fetch("/api/sync/google-health", { method: "POST" });
        if (response.ok) {
          localStorage.setItem("last_google_health_auto_sync", now.toString());
          router.refresh();
        }
      } catch (err) {
        console.error("Auto-sync error:", err);
      }
    }
    runAutoSync();
  }, [router]);

  async function handleLogSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSaving(true);
    try {
      const res = await fetch("/api/manual-log", {
        method: "POST",
        body: new FormData(e.currentTarget),
      });
      if (!res.ok) {
        let errMsg = `Error del servidor (código ${res.status})`;
        try {
          const p = await res.json();
          if (p?.message) errMsg = p.message;
        } catch {
          // Response is not JSON
        }
        console.error("Server error saving manual log:", errMsg);
        showToast(errMsg, "error");
        return;
      }
      e.currentTarget.reset();
      setReading1({ sys: "", dia: "", pulse: "" });
      setReading2({ sys: "", dia: "", pulse: "" });
      setReading3({ sys: "", dia: "", pulse: "" });
      showToast("Registro guardado ✓", "success");
      router.refresh();
    } catch (err) {
      console.error("Error al guardar el registro manual:", err);
      const detail = err instanceof Error ? err.message : String(err);
      showToast(`Error de conexión: ${detail}`, "error");
    } finally {
      setIsSaving(false);
      submittingRef.current = false;
    }
  }

  return (
    <>
      <div className="log-form-panel" style={{ animation: "fade-up 0.4s var(--ease-out-cubic) both" }}>
        <div className="panel-header" style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--line-light)" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ink)" }}>
            Registrar hoy
          </h2>
        </div>

        {/* Sub-tabs segment control */}
        <div style={{ display: "flex", gap: "6px", padding: "8px 20px", borderBottom: "1px solid var(--line-light)", backgroundColor: "var(--panel-2)" }}>
          {[
            { id: "cardio", label: "Cardio", Icon: HeartPulse },
            { id: "medidas", label: "Medidas", Icon: Scale },
            { id: "habitos", label: "Hábitos y Estado", Icon: Brain }
          ].map(t => {
            const TabIcon = t.Icon;
            const isActive = activeSubTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveSubTab(t.id as any)}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  backgroundColor: isActive ? "var(--accent-bg)" : "transparent",
                  color: isActive ? "var(--accent)" : "var(--muted)",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                <TabIcon size={14} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleLogSubmit} className="log-form-body" style={{ padding: "20px" }}>
          {isPressureHighToday && (
            <div style={{
              background: "rgba(0, 122, 255, 0.06)",
              borderLeft: "4px solid var(--accent)",
              borderRadius: "var(--radius-sm)",
              padding: "12px 16px",
              marginBottom: "20px",
              animation: "fade-in 0.4s ease both"
            }}>
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>ℹ️</span>
                <div>
                  <strong style={{ fontSize: "0.82rem", color: "var(--ink)" }}>Contexto ambiental: Presión atmosférica alta</strong>
                  <p style={{ fontSize: "0.78rem", color: "var(--ink-2)", margin: "4px 0 0 0", lineHeight: 1.3 }}>
                    Hoy se espera una presión de hasta {Math.round(todayForecast.pressure_msl_max_hpa)} hPa. Si registrás dolor de cabeza, migraña, fatiga inusual o molestias hoy, recordá detallarlo en esta sección.
                  </p>
                </div>
              </div>
            </div>
          )}
          <input type="hidden" name="local_date" value={new Date().toLocaleDateString("en-CA")} />

          {/* TAB 1: CARDIO */}
          <div style={{ display: activeSubTab === "cardio" ? "block" : "none" }}>
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "8px", 
              marginBottom: "16px", 
              padding: "10px 12px", 
              background: "var(--panel-2)", 
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--line)"
            }}>
              <input
                type="checkbox"
                id="toggle-three-readings"
                checked={useThreeReadings}
                onChange={(e) => setUseThreeReadings(e.target.checked)}
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
              />
              <label htmlFor="toggle-three-readings" style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--ink)", cursor: "pointer", userSelect: "none" }}>
                Promediar 3 tomas consecutivas (Método Clínico)
              </label>
            </div>

            {!useThreeReadings ? (
              <div className="log-field-grid">
                <label className="log-label">
                  Sistólica
                  <input name="systolic" type="number" inputMode="numeric" min="70" max="230" placeholder="120" className="control-input" />
                  <span className="log-helper">Normal &lt; 120 mmHg</span>
                </label>
                <label className="log-label">
                  Diastólica
                  <input name="diastolic" type="number" inputMode="numeric" min="40" max="140" placeholder="80" className="control-input" />
                  <span className="log-helper">Normal &lt; 80 mmHg</span>
                </label>
                <label className="log-label" style={{ gridColumn: "1 / -1", marginTop: "8px" }}>
                  Pulso (Frecuencia cardíaca)
                  <input name="pulse" type="number" inputMode="numeric" min="30" max="220" placeholder="70" className="control-input" />
                  <span className="log-helper">Normal en reposo: 60-100 bpm</span>
                </label>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[1, 2, 3].map((num) => (
                  <div key={num} style={{ 
                    background: "var(--panel)", 
                    borderRadius: "var(--radius-md)", 
                    padding: "12px", 
                    border: "1px solid var(--line)"
                  }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                      Toma #{num}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                      <label className="log-label" style={{ fontSize: "0.75rem", margin: 0 }}>
                        Sistólica
                        <input 
                          type="number" 
                          placeholder="120" 
                          min="70" 
                          max="230"
                          className="control-input" 
                          value={num === 1 ? reading1.sys : num === 2 ? reading2.sys : reading3.sys}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (num === 1) setReading1(prev => ({ ...prev, sys: val }));
                            else if (num === 2) setReading2(prev => ({ ...prev, sys: val }));
                            else setReading3(prev => ({ ...prev, sys: val }));
                          }}
                        />
                      </label>
                      <label className="log-label" style={{ fontSize: "0.75rem", margin: 0 }}>
                        Diastólica
                        <input 
                          type="number" 
                          placeholder="80" 
                          min="40" 
                          max="140"
                          className="control-input" 
                          value={num === 1 ? reading1.dia : num === 2 ? reading2.dia : reading3.dia}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (num === 1) setReading1(prev => ({ ...prev, dia: val }));
                            else if (num === 2) setReading2(prev => ({ ...prev, dia: val }));
                            else setReading3(prev => ({ ...prev, dia: val }));
                          }}
                        />
                      </label>
                      <label className="log-label" style={{ fontSize: "0.75rem", margin: 0 }}>
                        Pulso
                        <input 
                          type="number" 
                          placeholder="70" 
                          min="30" 
                          max="220"
                          className="control-input" 
                          value={num === 1 ? reading1.pulse : num === 2 ? reading2.pulse : reading3.pulse}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (num === 1) setReading1(prev => ({ ...prev, pulse: val }));
                            else if (num === 2) setReading2(prev => ({ ...prev, pulse: val }));
                            else setReading3(prev => ({ ...prev, pulse: val }));
                          }}
                        />
                      </label>
                    </div>
                  </div>
                ))}

                {/* Display Calculated Average and render hidden inputs for form submission */}
                {(() => {
                  const avg = calculateAverageBP();
                  if (!avg) return (
                    <div style={{ fontSize: "0.78rem", color: "var(--muted)", textAlign: "center", padding: "10px", border: "1px dashed var(--line)", borderRadius: "var(--radius-md)" }}>
                      Completa al menos una toma para ver el promedio y poder guardar.
                    </div>
                  );
                  return (
                    <>
                      <input type="hidden" name="systolic" value={avg.sys} />
                      <input type="hidden" name="diastolic" value={avg.dia} />
                      {avg.pulse !== undefined && <input type="hidden" name="pulse" value={avg.pulse} />}

                      <div style={{ 
                        background: "rgba(0, 122, 255, 0.08)", 
                        border: "1px solid rgba(0, 122, 255, 0.2)",
                        borderRadius: "var(--radius-md)",
                        padding: "12px 16px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}>
                        <div>
                          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                            Promedio Clínico Calculado
                          </span>
                          <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--ink)", marginTop: "2px" }}>
                            {avg.sys} / {avg.dia} <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--muted)" }}>mmHg</span>
                            {avg.pulse ? <span style={{ marginLeft: "12px", fontSize: "0.95rem" }}>❤️ {avg.pulse} <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--muted)" }}>bpm</span></span> : null}
                          </div>
                        </div>
                        <span style={{ fontSize: "1.5rem" }}>📊</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* TAB 2: MEDIDAS */}
          <div style={{ display: activeSubTab === "medidas" ? "block" : "none" }}>
            <div className="log-field-grid">
              {/* Sección Composición General */}
              <div style={{ gridColumn: "1 / -1", margin: "4px 0", fontSize: "0.75rem", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--line-light)", paddingBottom: "4px" }}>
                Composición General
              </div>
              <label className="log-label">
                Peso (kg)
                <input name="weight_kg" type="number" step="0.1" inputMode="decimal" min="30" max="300" placeholder="75.0" className="control-input" />
              </label>
              <label className="log-label">
                Grasa Corporal (%)
                <input name="body_fat_percentage" type="number" step="0.1" inputMode="decimal" min="3" max="60" placeholder="15.0" className="control-input" />
              </label>
              <label className="log-label">
                Masa Muscular (kg)
                <input name="muscle_mass_kg" type="number" step="0.1" inputMode="decimal" min="10" max="150" placeholder="58.5" className="control-input" />
              </label>
              <label className="log-label">
                Agua (%)
                <input name="water_percentage" type="number" step="0.1" inputMode="decimal" min="20" max="85" placeholder="60.0" className="control-input" />
              </label>

              {/* Sección Tronco */}
              <div style={{ gridColumn: "1 / -1", margin: "14px 0 4px", fontSize: "0.75rem", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--line-light)", paddingBottom: "4px" }}>
                Tronco
              </div>
              <label className="log-label">
                Cuello (cm)
                <input name="neck_cm" type="number" step="0.1" inputMode="decimal" min="20" max="70" placeholder="38.0" className="control-input" />
              </label>
              <label className="log-label">
                Pecho / Hombros (cm)
                <input name="shoulders_chest_cm" type="number" step="0.1" inputMode="decimal" min="50" max="200" placeholder="105.0" className="control-input" />
              </label>
              <label className="log-label">
                Cintura (cm)
                <input name="waist_cm" type="number" step="0.1" inputMode="decimal" min="40" max="180" placeholder="82.0" className="control-input" />
              </label>
              <label className="log-label">
                Abdomen (ombligo) (cm)
                <input name="abdomen_cm" type="number" step="0.1" inputMode="decimal" min="40" max="180" placeholder="86.0" className="control-input" />
              </label>
              <label className="log-label" style={{ gridColumn: "1 / -1" }}>
                Cadera (cm)
                <input name="hips_cm" type="number" step="0.1" inputMode="decimal" min="40" max="180" placeholder="96.0" className="control-input" />
              </label>

              {/* Sección Extremidades Superiores */}
              <div style={{ gridColumn: "1 / -1", margin: "14px 0 4px", fontSize: "0.75rem", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--line-light)", paddingBottom: "4px" }}>
                Brazos (cm)
              </div>
              <label className="log-label">
                Brazo Izq. Relajado
                <input name="arm_left_relaxed_cm" type="number" step="0.1" inputMode="decimal" min="15" max="60" placeholder="32.0" className="control-input" />
              </label>
              <label className="log-label">
                Brazo Izq. Contraído
                <input name="arm_left_contracted_cm" type="number" step="0.1" inputMode="decimal" min="15" max="60" placeholder="35.5" className="control-input" />
              </label>
              <label className="log-label">
                Brazo Der. Relajado
                <input name="arm_right_relaxed_cm" type="number" step="0.1" inputMode="decimal" min="15" max="60" placeholder="32.2" className="control-input" />
              </label>
              <label className="log-label">
                Brazo Der. Contraído
                <input name="arm_right_contracted_cm" type="number" step="0.1" inputMode="decimal" min="15" max="60" placeholder="35.8" className="control-input" />
              </label>

              {/* Sección Extremidades Inferiores */}
              <div style={{ gridColumn: "1 / -1", margin: "14px 0 4px", fontSize: "0.75rem", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--line-light)", paddingBottom: "4px" }}>
                Piernas (cm)
              </div>
              <label className="log-label">
                Muslo Izquierdo
                <input name="thigh_left_cm" type="number" step="0.1" inputMode="decimal" min="25" max="100" placeholder="56.0" className="control-input" />
              </label>
              <label className="log-label">
                Muslo Derecho
                <input name="thigh_right_cm" type="number" step="0.1" inputMode="decimal" min="25" max="100" placeholder="56.5" className="control-input" />
              </label>
              <label className="log-label">
                Pantorrilla Izquierda
                <input name="calf_left_cm" type="number" step="0.1" inputMode="decimal" min="15" max="60" placeholder="37.0" className="control-input" />
              </label>
              <label className="log-label">
                Pantorrilla Derecha
                <input name="calf_right_cm" type="number" step="0.1" inputMode="decimal" min="15" max="60" placeholder="37.2" className="control-input" />
              </label>
            </div>
          </div>

          {/* TAB 3: HABITOS Y ESTADO */}
          <div style={{ display: activeSubTab === "habitos" ? "block" : "none" }}>
            <div className="log-field-grid">
              <label className="log-label">
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Zap size={11} /> Energía
                </span>
                <input name="energy_score" type="number" inputMode="numeric" min="1" max="5" placeholder="3" className="control-input" />
                <span className="log-helper">1 (baja) a 5 (muy alta)</span>
              </label>
              <label className="log-label">
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Smile size={11} /> Humor
                </span>
                <input name="mood_score" type="number" inputMode="numeric" min="1" max="5" placeholder="4" className="control-input" />
                <span className="log-helper">1 (mal) a 5 (excelente)</span>
              </label>
              <label className="log-label">
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Brain size={11} /> Estrés
                </span>
                <input name="stress_score" type="number" inputMode="numeric" min="1" max="5" placeholder="2" className="control-input" />
                <span className="log-helper">1 (bajo) a 5 (muy alto)</span>
              </label>
              <label className="log-label">
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Wine size={11} /> Alcohol
                </span>
                <select name="alcohol_level" className="control-input" style={{ appearance: "auto" }}>
                  <option value="none">Sin alcohol</option>
                  <option value="low">Poco (1 copa)</option>
                  <option value="moderate">Moderado (2-3)</option>
                  <option value="high">Bastante (4+)</option>
                </select>
              </label>
              <label className="log-label">
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Clock size={11} /> Última cafeína
                </span>
                <input name="last_caffeine_time" type="time" className="control-input" />
              </label>
              <label className="log-label">
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Coffee size={11} /> Cafeína (mg)
                </span>
                <input name="caffeine_amount" type="number" inputMode="numeric" min="0" max="1000" placeholder="80" className="control-input" />
                <span className="log-helper">Café ~80mg · Mate ~68mg/L</span>
              </label>
            </div>

            {/* Quick toggles */}
            <div className="log-chip-group" style={{ marginTop: "16px" }}>
              <label className="log-chip-label">
                <input name="caffeine_consumed" type="checkbox" value="true" />
                <div className="log-chip caffeine-chip">
                  <Coffee size={14} aria-hidden /> Cafeína
                </div>
              </label>
              <label className="log-chip-label">
                <input name="pain_present" type="checkbox" value="true" />
                <div className="log-chip pain-chip">
                  <Activity size={14} aria-hidden /> Molestia / Dolor
                </div>
              </label>
              <label className="log-chip-label">
                <input name="keto_adherence" type="checkbox" value="true" />
                <div className="log-chip keto-chip">🥑 Keto</div>
              </label>
              <label className="log-chip-label">
                <input name="heavy_meal_at_night" type="checkbox" value="true" />
                <div className="log-chip heavymeal-chip">
                  <Utensils size={13} aria-hidden /> Cena pesada
                </div>
              </label>
            </div>
          </div>

          {/* Notas (always visible at bottom) */}
          <div style={{ marginTop: "16px" }}>
            <textarea
              name="notes"
              rows={2}
              placeholder="Notas del día o síntomas..."
              className="control-textarea"
              style={{ width: "100%" }}
            />
          </div>

          <button type="submit" disabled={isSaving} className="log-submit-btn" style={{ marginTop: "16px" }}>
            {isSaving && <span className="btn-spinner" />}
            {isSaving ? "Guardando..." : "Guardar Registro"}
          </button>
        </form>
      </div>

      {/* Toast container */}
      <div className="toast-container" role="region" aria-live="polite" aria-label="Notificaciones del registro">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`} role="status">
            <span className="toast-icon" aria-hidden>{t.icon}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </>
  );
}

