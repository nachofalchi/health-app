"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Coffee,
  ChevronDown,
  ChevronUp,
  Wine,
  Utensils,
  Brain,
  Clock,
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
export function DashboardControlCenter() {
  const router = useRouter();
  const [showMore, setShowMore] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toasts, show: showToast } = useToast();

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
    setIsSaving(true);
    try {
      const res = await fetch("/api/manual-log", {
        method: "POST",
        body: new FormData(e.currentTarget),
      });
      if (!res.ok) {
        const p = await res.json().catch(() => null);
        showToast(p?.message ?? "No se pudo guardar.", "error");
        return;
      }
      e.currentTarget.reset();
      setShowMore(false);
      showToast("Registro guardado ✓", "success");
      router.refresh();
    } catch {
      showToast("Error de conexión.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="log-form-panel" style={{ animation: "fade-up 0.4s var(--ease-out-cubic) both" }}>
        <div className="panel-header" style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--line)" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ink)" }}>
            Registrar hoy
          </h2>
        </div>

        <form onSubmit={handleLogSubmit} className="log-form-body">
          <input type="hidden" name="local_date" value={new Date().toLocaleDateString("en-CA")} />

          {/* Main fields */}
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
            <label className="log-label">
              Energía
              <input name="energy_score" type="number" inputMode="numeric" min="1" max="5" placeholder="4" className="control-input" />
              <span className="log-helper">1 (baja) a 5 (excelente)</span>
            </label>
            <label className="log-label">
              Ánimo
              <input name="mood_score" type="number" inputMode="numeric" min="1" max="5" placeholder="4" className="control-input" />
              <span className="log-helper">1 (malo) a 5 (excelente)</span>
            </label>
          </div>

          {/* Quick toggles */}
          <div className="log-chip-group">
            <label className="log-chip-label">
              <input name="caffeine_consumed" type="checkbox" value="true" />
              <div className="log-chip caffeine-chip">
                <Coffee size={14} aria-hidden /> Cafeína
              </div>
            </label>
            <label className="log-chip-label">
              <input name="pain_present" type="checkbox" value="true" />
              <div className="log-chip pain-chip">
                <Activity size={14} aria-hidden /> Molestia
              </div>
            </label>
          </div>

          {/* Expand toggle */}
          <button
            type="button"
            className="log-expand-btn"
            onClick={() => setShowMore(!showMore)}
          >
            {showMore ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {showMore ? "Menos detalles" : "Más detalles"}
          </button>

          {/* Expanded section */}
          {showMore && (
            <div className="log-more-section">
              <div className="log-field-grid">
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
              <div className="log-chip-group">
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
          )}

          <textarea
            name="notes"
            rows={2}
            placeholder="Notas del día o síntomas..."
            className="control-textarea"
          />

          <button type="submit" disabled={isSaving} className="log-submit-btn">
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
