"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Beaker,
  ClipboardList,
  User,
  BatteryCharging,
  Moon,
  Activity,
  HeartPulse,
  Scale,
  Smile,
  ChevronRight,
  Brain,
  TrendingUp,
  Dumbbell,
  ArrowRight,
  RefreshCw,
  LogIn,
  Settings,
} from "lucide-react";
import { ExperimentsPanel } from "@/components/experiments-panel";
import { DashboardControlCenter } from "@/components/dashboard-control-center";
import { ThemeToggle } from "@/components/theme-toggle";

// ─── Types ──────────────────────────────────────────────────────────────────
type DayInsight = { title: string; body: string; confidence: string };

type SectorCard = {
  name: string;
  score: number;
  state: string;
  tone: string;
  history?: number[];
};

type Exercise = {
  start_time: string;
  display_name: string | null;
  exercise_type: string | null;
  active_duration_seconds: number | null;
  distance_meters: number | null;
  calories_kcal: number | null;
  average_heart_rate: number | null;
  cardioLoad?: number;
  cardioLoadLabel?: "Baja" | "Media" | "Alta";
};

type StepsPoint = { date: string; label: string; steps: number; intensity: number };
type DataCard = { label: string; value: string };
type WeeklySummaryMetric = { label: string; value: string };

type DashboardTabsProps = {
  day: {
    overall: number | null;
    status: string;
    summary: string;
    insights: DayInsight[];
  };
  sectorCards: SectorCard[];
  latestExercise: Exercise | null;
  stepsSeries: StepsPoint[];
  dataCards: DataCard[];
  weeklySummary: WeeklySummaryMetric[];
  experiments: any[];
  syncSummary: {
    status: string;
    finishedAt: string | null;
    summary: string;
    errors: any[];
  } | null;
  profile: {
    height_cm: number | null;
    target_weight_kg: number | null;
    age: number | null;
    gender: string | null;
    activity_level: string | null;
  } | null;
  isGoogleHealthConnected: boolean;
};

// ─── Icon Map ────────────────────────────────────────────────────────────────
const iconMap: Record<string, any> = {
  Recuperacion: BatteryCharging,
  Sueno: Moon,
  Entrenamiento: Activity,
  Cardiovascular: HeartPulse,
  Composicion: Scale,
  Bienestar: Smile,
};

function categorySlug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function generateSparklinePath(points: number[], width = 44, height = 18): string {
  if (points.length < 2) return "";
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min === 0 ? 1 : max - min;
  return points
    .map((val, idx) => {
      const x = (idx / (points.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

// ─── Toast ────────────────────────────────────────────────────────────────────
type ToastType = "success" | "error" | "info" | "warning";
interface Toast { id: number; message: string; type: ToastType; icon: string }
const TOAST_ICONS: Record<ToastType, string> = {
  success: "✅", error: "❌", info: "🔄", warning: "⚠️",
};

type TabId = "summary" | "experiments" | "log" | "profile";

// ─── Component ────────────────────────────────────────────────────────────────
export function DashboardTabs({
  day,
  sectorCards,
  latestExercise,
  stepsSeries,
  dataCards,
  weeklySummary,
  experiments,
  syncSummary,
  profile,
  isGoogleHealthConnected,
}: DashboardTabsProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("summary");

  // Profile form
  const [height, setHeight] = useState(
    profile?.height_cm != null ? profile.height_cm.toString() : ""
  );
  const [targetWeight, setTargetWeight] = useState(
    profile?.target_weight_kg != null ? profile.target_weight_kg.toString() : ""
  );
  const [age, setAge] = useState(profile?.age != null ? profile.age.toString() : "");
  const [gender, setGender] = useState(profile?.gender ?? "");
  const [activityLevel, setActivityLevel] = useState(profile?.activity_level ?? "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Settings
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [settingsSection, setSettingsSection] = useState<"main" | "settings">("main");

  // Toast
  const [toasts, setToasts] = useState<Toast[]>([]);
  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type, icon: TOAST_ICONS[type] }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          height_cm: height ? Number(height) : null,
          target_weight_kg: targetWeight ? Number(targetWeight) : null,
          age: age ? Number(age) : null,
          gender: gender || null,
          activity_level: activityLevel || null,
        }),
      });
      if (!res.ok) {
        const p = await res.json().catch(() => null);
        showToast(p?.message ?? "Error al guardar el perfil.", "error");
        return;
      }
      showToast("Perfil guardado ✓", "success");
      router.refresh();
    } catch {
      showToast("Error de conexión.", "error");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function connectGoogleHealth() {
    setIsConnecting(true);
    showToast("Abriendo conexión con Google...", "info");
    try {
      const res = await fetch("/api/google-health/connect", { method: "POST" });
      const p = (await res.json().catch(() => null)) as { url?: string; message?: string } | null;
      if (!res.ok || !p?.url) {
        showToast(p?.message ?? "Iniciá sesión primero.", "error");
        return;
      }
      window.location.href = p.url;
    } catch {
      showToast("No se pudo conectar.", "error");
    } finally {
      setIsConnecting(false);
    }
  }

  async function syncGoogleHealth() {
    setIsSyncing(true);
    showToast("Sincronizando...", "info");
    try {
      const res = await fetch("/api/sync/google-health", { method: "POST" });
      const p = (await res.json().catch(() => null)) as {
        result?: { dailyMetrics?: number; rawDatapoints?: number };
        message?: string;
      } | null;
      if (!res.ok) {
        showToast(p?.message ?? "No se pudo sincronizar.", "error");
        return;
      }
      const m = p?.result?.dailyMetrics ?? 0;
      const r = p?.result?.rawDatapoints ?? 0;
      showToast(`Sync completo: +${m} métricas, +${r} datapoints`, "success");
      router.refresh();
    } catch {
      showToast("Error de conexión.", "error");
    } finally {
      setIsSyncing(false);
    }
  }

  async function disconnectGoogleHealth() {
    setIsDisconnecting(true);
    showToast("Desvinculando...", "info");
    try {
      const res = await fetch("/api/google-health/disconnect", { method: "POST" });
      if (!res.ok) {
        const p = await res.json().catch(() => null);
        showToast(p?.message ?? "No se pudo desvincular.", "error");
        return;
      }
      showToast("Google Health desvinculado ✓", "success");
      router.refresh();
    } catch {
      showToast("Error de conexión.", "error");
    } finally {
      setIsDisconnecting(false);
    }
  }

  // ─── Tab content ────────────────────────────────────────────────────────
  const renderSummary = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Sector list */}
      <section className="sector-list" aria-label="Pilares de salud">
        <div className="sector-list-header">
          <h2>Pilares de Salud</h2>
        </div>
        {sectorCards.map((sector) => {
          const Icon = iconMap[sector.name] || Smile;
          const slug = categorySlug(sector.name);
          return (
            <Link
              key={sector.name}
              className={`sector-row theme-${slug}`}
              href={`/categorias/${slug}`}
              aria-label={`${sector.name}: ${sector.score !== null && sector.score !== undefined ? `${sector.score} puntos` : "sin datos"}, ${sector.state}`}
            >
              <div className="sector-icon-badge">
                <Icon size={18} aria-hidden />
              </div>
              <div className="sector-row-info">
                <div className="sector-row-name">{sector.name}</div>
                <div className="sector-row-state">{sector.state}</div>
              </div>
              <div className="sector-row-score-area">
                <span className="sector-row-score">{sector.score !== null && sector.score !== undefined ? sector.score : "--"}</span>
                {sector.history && sector.history.length > 1 && (
                  <svg
                    width="44"
                    height="18"
                    className="sector-sparkline"
                    aria-hidden
                    style={{ overflow: "visible" }}
                  >
                    <path
                      d={generateSparklinePath(sector.history, 44, 18)}
                      fill="none"
                      stroke="var(--c-primary, var(--accent))"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                <ChevronRight size={15} className="sector-chevron" aria-hidden />
              </div>
            </Link>
          );
        })}
      </section>

      {/* Insights */}
      <section className="insights-panel" aria-label="Insights de hoy">
        <div className="panel-header">
          <h2>Insights de hoy</h2>
          <Brain size={18} className="panel-icon" aria-hidden />
        </div>
        {day.insights.length === 0 ? (
          <p style={{ padding: "20px", color: "var(--muted)", fontSize: "0.85rem" }}>
            Sin insights por ahora. Seguí registrando datos.
          </p>
        ) : (
          day.insights.map((ins, i) => (
            <div
              className="insight-item"
              key={`${ins.title}-${i}`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <h3>{ins.title}</h3>
              <p>{ins.body}</p>
              <span className="confidence-chip">{ins.confidence}</span>
            </div>
          ))
        )}
      </section>

      {/* Steps chart */}
      <section className="steps-panel" aria-label="Pasos de los últimos 7 días">
        <div className="panel-header" style={{ padding: 0, border: 0, marginBottom: 0 }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>Pasos — 7 días</h2>
          <TrendingUp size={16} style={{ color: "var(--accent)" }} aria-hidden />
        </div>
        {stepsSeries.length === 0 ? (
          <p style={{ marginTop: "16px", color: "var(--muted)", fontSize: "0.85rem" }}>
            Sin pasos sincronizados todavía.
          </p>
        ) : (
          <div className="steps-chart" aria-label="Gráfico de barras de pasos">
            {stepsSeries.map((item) => (
              <div className="step-col" key={item.date}>
                <span className="step-col-val">{item.steps.toLocaleString("es-AR")}</span>
                <div
                  className="step-col-bar"
                  style={{ height: `${Math.max(item.intensity, 4)}%` }}
                  title={`${item.label}: ${item.steps.toLocaleString("es-AR")} pasos`}
                />
                <span className="step-col-label">{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Last exercise + weekly */}
      <div className="two-col-grid">
        <article className="stat-panel" aria-label="Último ejercicio">
          <p className="stat-panel-title">Último ejercicio</p>
          {latestExercise ? (
            <div>
              <div className="fact-row">
                <span>Tipo</span>
                <strong>{latestExercise.display_name ?? latestExercise.exercise_type ?? "Ejercicio"}</strong>
              </div>
              <div className="fact-row">
                <span>Distancia</span>
                <strong>
                  {latestExercise.distance_meters
                    ? `${(latestExercise.distance_meters / 1000).toFixed(2)} km`
                    : "—"}
                </strong>
              </div>
              <div className="fact-row">
                <span>Calorías</span>
                <strong>
                  {latestExercise.calories_kcal
                    ? `${Math.round(latestExercise.calories_kcal)} kcal`
                    : "—"}
                </strong>
              </div>
              <div className="fact-row">
                <span>FC prom.</span>
                <strong>
                  {latestExercise.average_heart_rate
                    ? `${Math.round(latestExercise.average_heart_rate)} bpm`
                    : "—"}
                </strong>
              </div>
              {latestExercise.cardioLoad !== undefined && (
                <div className="fact-row">
                  <span>Carga cardio</span>
                  <strong
                    style={{
                      color:
                        latestExercise.cardioLoadLabel === "Alta"
                          ? "var(--red)"
                          : latestExercise.cardioLoadLabel === "Media"
                          ? "var(--amber)"
                          : "var(--green)",
                    }}
                  >
                    {latestExercise.cardioLoad} · {latestExercise.cardioLoadLabel}
                  </strong>
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: "var(--muted)", fontSize: "0.82rem", marginTop: "8px" }}>
              Sin ejercicio registrado. Sincronizá para traer datos.
            </p>
          )}
        </article>

        <article className="stat-panel" aria-label="Resumen semanal">
          <p className="stat-panel-title">Esta semana</p>
          {weeklySummary.map((m) => (
            <div className="fact-row" key={m.label}>
              <span>{m.label}</span>
              <strong>{m.value}</strong>
            </div>
          ))}
          {syncSummary && (
            <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid var(--line)" }}>
              <p style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 600 }}>
                Último sync: {syncSummary.status}
              </p>
              <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--ink)", marginTop: "2px" }}>
                {syncSummary.summary}
              </p>
              <Link
                href="/sync-history"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                  marginTop: "6px",
                  fontSize: "0.75rem",
                  color: "var(--accent)",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Historial <ArrowRight size={11} />
              </Link>
            </div>
          )}
        </article>
      </div>

      {/* Metrics grid */}
      {dataCards.length > 0 && (
        <section className="metrics-grid-panel" aria-label="Métricas biométricas">
          <div className="panel-header" style={{ padding: 0, border: 0, marginBottom: 0 }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>Métricas clave</h2>
          </div>
          <div className="metrics-grid">
            {dataCards.map((card) => (
              <div className="metric-tile" key={card.label}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );

  const renderProfile = () => (
    <div className="profile-page">
      <div className="settings-section">
        <p className="settings-section-title">Mis datos</p>
        <form onSubmit={handleProfileSubmit} className="profile-form">
          <div className="profile-field-row">
            <label htmlFor="pf-height">Altura</label>
            <input
              id="pf-height"
              type="number"
              min="50"
              max="250"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="175 cm"
            />
          </div>
          <div className="profile-field-row">
            <label htmlFor="pf-weight">Peso objetivo</label>
            <input
              id="pf-weight"
              type="number"
              step="0.1"
              min="30"
              max="300"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
              placeholder="75.0 kg"
            />
          </div>
          <div className="profile-field-row">
            <label htmlFor="pf-age">Edad</label>
            <input
              id="pf-age"
              type="number"
              min="1"
              max="120"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="30"
            />
          </div>
          <div className="profile-field-row">
            <label htmlFor="pf-gender">Sexo biológico</label>
            <select
              id="pf-gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              style={{ appearance: "auto" }}
            >
              <option value="">—</option>
              <option value="male">Masculino</option>
              <option value="female">Femenino</option>
              <option value="other">Otro</option>
            </select>
          </div>
          <div className="profile-field-row">
            <label htmlFor="pf-activity">Nivel de actividad</label>
            <select
              id="pf-activity"
              value={activityLevel}
              onChange={(e) => setActivityLevel(e.target.value)}
              style={{ appearance: "auto" }}
            >
              <option value="">—</option>
              <option value="sedentary">Sedentario</option>
              <option value="light">Ligero</option>
              <option value="moderate">Moderado</option>
              <option value="active">Activo</option>
              <option value="very_active">Muy activo</option>
            </select>
          </div>

          <div style={{ padding: "16px 20px" }}>
            <button type="submit" disabled={isSavingProfile} className="profile-save-btn">
              {isSavingProfile && <span className="btn-spinner" />}
              {isSavingProfile ? "Guardando..." : "Guardar Perfil"}
            </button>
          </div>
        </form>
      </div>

      {/* Settings: Google Health */}
      <div className="settings-section">
        <p className="settings-section-title">Integraciones</p>
        <div className="settings-row">
          <div className="settings-row-info">
            <span className="settings-row-label">Google Health</span>
            <span className="settings-row-desc">
              {isGoogleHealthConnected
                ? "Sincroniza pasos, sueño y entrenamientos automáticamente."
                : "Vinculá tu cuenta para sincronizar datos de salud."}
            </span>
          </div>
          {isGoogleHealthConnected ? (
            <span className="settings-connected-badge">
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
              Activo
            </span>
          ) : (
            <span className="settings-disconnected-badge">Sin vincular</span>
          )}
        </div>

        {isGoogleHealthConnected ? (
          <>
            <div className="settings-row">
              <span className="settings-row-label">Sincronizar ahora</span>
              <button
                type="button"
                onClick={syncGoogleHealth}
                disabled={isSyncing}
                className="settings-action-btn primary"
                aria-label="Sincronizar datos de Google Health"
              >
                {isSyncing ? <span className="btn-spinner" /> : <RefreshCw size={14} />}
                {isSyncing ? "Sync..." : "Sync"}
              </button>
            </div>
            <div className="settings-row">
              <span className="settings-row-label" style={{ color: "var(--red)" }}>Desvincular cuenta</span>
              <button
                type="button"
                onClick={disconnectGoogleHealth}
                disabled={isDisconnecting}
                className="settings-action-btn destructive"
              >
                {isDisconnecting ? <span className="btn-spinner dark" /> : null}
                {isDisconnecting ? "..." : "Desvincular"}
              </button>
            </div>
          </>
        ) : (
          <div className="settings-row">
            <span className="settings-row-label">Vincular cuenta Google</span>
            <button
              type="button"
              onClick={connectGoogleHealth}
              disabled={isConnecting}
              className="settings-action-btn primary"
            >
              {isConnecting ? <span className="btn-spinner" /> : <LogIn size={14} />}
              {isConnecting ? "..." : "Vincular"}
            </button>
          </div>
        )}
      </div>

      {/* Theme toggle */}
      <div className="settings-section">
        <p className="settings-section-title">Apariencia</p>
        <div className="settings-row">
          <span className="settings-row-label">Modo oscuro</span>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <>
      <div style={{ paddingBottom: "4px" }}>
        {activeTab === "summary"     && renderSummary()}
        {activeTab === "experiments" && <ExperimentsPanel experiments={experiments} />}
        {activeTab === "log"         && <DashboardControlCenter />}
        {activeTab === "profile"     && renderProfile()}
      </div>

      {/* ─── Bottom Tab Bar ──────────────────────────────────────────── */}
      <nav className="bottom-tabbar" role="tablist" aria-label="Navegación principal">
        {(
          [
            { id: "summary",     Icon: Sparkles,       label: "Inicio" },
            { id: "experiments", Icon: Beaker,          label: "Tests" },
            { id: "log",         Icon: ClipboardList,   label: "Registro" },
            { id: "profile",     Icon: User,            label: "Perfil" },
          ] as { id: TabId; Icon: any; label: string }[]
        ).map(({ id, Icon, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={`tab-item${activeTab === id ? " active" : ""}`}
            onClick={() => setActiveTab(id)}
          >
            <Icon aria-hidden />
            <span className="tab-label">{label}</span>
          </button>
        ))}
      </nav>

      {/* ─── Toasts ──────────────────────────────────────────────────── */}
      <div className="toast-container" role="region" aria-live="polite" aria-label="Notificaciones">
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
