import { Dumbbell, Info } from "lucide-react";
import { DashboardControlCenter } from "@/components/dashboard-control-center";
import { DashboardTabs } from "@/components/dashboard-tabs";
import { getDashboardData } from "@/lib/dashboard-data";
import { getAppUserContext } from "@/lib/app-user";
import { LandingAuthPage } from "@/components/landing-auth-page";

const trainingTone: Record<string, string> = {
  Fuerte: "good",
  Moderado: "watch",
  Liviano: "watch",
  Recuperacion: "care",
  Descanso: "care"
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 18) return "Buenas tardes";
  return "Buenas noches";
}

function formatDate() {
  return new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
}

export default async function Home() {
  const appUser = await getAppUserContext();

  if (!appUser) {
    return <LandingAuthPage />;
  }

  const dashboard = await getDashboardData(appUser);
  const { day, sectorCards, weeklySummary, experiments = [] } = dashboard;

  const recoveryScore = sectorCards.find(s => s.name === "Recuperacion")?.score ?? null;
  const sleepScore    = sectorCards.find(s => s.name === "Sueno")?.score ?? null;
  const cardioScore   = sectorCards.find(s => s.name === "Cardiovascular")?.score ?? null;

  const tone = day.overall !== null && day.overall !== undefined
    ? (day.overall >= 75 ? "good" : day.overall >= 50 ? "watch" : "care")
    : "muted";
  const prepText = day.overall !== null && day.overall !== undefined
    ? (day.overall >= 75 ? "Preparación alta" : day.overall >= 50 ? "Preparación media" : "Necesita recuperación")
    : "Sin datos de preparación";

  const trainingChipTone = trainingTone[day.trainingRecommendation] ?? "watch";

  // Ring geometry
  const R_BIG  = 54;
  const CIRC_BIG  = 2 * Math.PI * R_BIG;
  const offset_big = CIRC_BIG - (CIRC_BIG * (day.overall ?? 0)) / 100;

  const R_MINI = 25;
  const CIRC_MINI = 2 * Math.PI * R_MINI;

  return (
    <main className="shell">
      {/* ─── Top Header ───────────────────────────────────────────── */}
      <header className="app-header">
        <div className="header-greeting">
          <span className="greeting-sub">{formatDate()}</span>
          <h1>{getGreeting()}</h1>
        </div>
        <div className="header-actions">
          <span
            className={`sync-badge-pill${dashboard.isGoogleHealthConnected ? "" : " disconnected"}`}
            aria-label={dashboard.isGoogleHealthConnected ? "Google Health conectado" : "Google Health sin vincular"}
          >
            <span className="dot" />
            {dashboard.isGoogleHealthConnected ? "Sync OK" : "Sin vincular"}
          </span>
        </div>
      </header>

      {/* ─── Anomaly Banners ──────────────────────────────────────── */}
      {dashboard.anomalies && dashboard.anomalies.length > 0 && (
        <section aria-label="Alertas de salud">
          {dashboard.anomalies.map((anomaly, i) => (
            <div
              key={i}
              className={`anomaly-banner ${anomaly.severity === "danger" ? "danger" : "warning"}`}
            >
              <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>
                {anomaly.severity === "danger" ? "🔴" : "🟡"}
              </span>
              <div>
                <strong>{anomaly.title}</strong>
                <p>{anomaly.body}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ─── Score Hero ───────────────────────────────────────────── */}
      <section className="score-hero" aria-label="Score diario general">
        <div className="score-hero-ring">
          <svg viewBox="0 0 120 120" aria-hidden>
            <circle className="ring-track" cx="60" cy="60" r={R_BIG} />
            <circle
              className={`ring-fill tone-${tone}`}
              cx="60"
              cy="60"
              r={R_BIG}
              strokeDasharray={CIRC_BIG}
              strokeDashoffset={offset_big}
            />
          </svg>
          <div className="ring-label">
            <span className="num">{day.overall !== null && day.overall !== undefined ? day.overall : "--"}</span>
            <span className="unit">/ 100</span>
          </div>
        </div>

        <div className="score-hero-info">
          <div
            className="score-tooltip-trigger score-eyebrow"
            style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "4px" }}
          >
            <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)" }}>
              HOY · {day.overall}/100
            </span>
            <Info size={12} style={{ color: "var(--muted)", flexShrink: 0 }} />
            <div className="score-tooltip-card">
              <h3>Cálculo del Score</h3>
              <ul>
                <li><strong>Recuperación:</strong> Sueño + HRV</li>
                <li><strong>Sueño:</strong> Duración y etapas</li>
                <li><strong>Entrenamiento:</strong> Pasos y actividad</li>
                <li><strong>Cardiovascular:</strong> FC en reposo</li>
                <li><strong>Composición:</strong> Peso y grasa</li>
              </ul>
            </div>
          </div>

          <h2>{prepText}</h2>

          <p className="score-summary" style={{ marginBottom: "12px" }}>
            Sueño {sleepScore !== null ? sleepScore : "--"} · Recuperación {recoveryScore !== null ? recoveryScore : "--"} · Cardio {cardioScore !== null ? cardioScore : "--"}
            {day.summary ? `. ${day.summary}` : ""}
          </p>

          <div className={`training-chip ${trainingChipTone}`}>
            <Dumbbell size={13} aria-hidden />
            {day.trainingRecommendation}
          </div>
        </div>
      </section>

      {/* ─── Mini Rings Row ───────────────────────────────────────── */}
      <div className="mini-rings-row" aria-label="Métricas clave">
        {[
          { label: "Sueño",       score: sleepScore,    color: "var(--purple)" },
          { label: "Récup.",      score: recoveryScore, color: "var(--green)" },
          { label: "Cardio",      score: cardioScore,   color: "var(--red)" },
        ].map(({ label, score, color }) => {
          const circ = 2 * Math.PI * R_MINI;
          const off  = circ - (circ * (score ?? 0)) / 100;
          return (
            <div className="mini-ring-card" key={label}>
              <div className="mini-ring-wrap">
                <svg viewBox="0 0 60 60" aria-hidden>
                  <circle className="mini-ring-track" cx="30" cy="30" r={R_MINI} />
                  <circle
                    className="mini-ring-fill"
                    cx="30"
                    cy="30"
                    r={R_MINI}
                    strokeDasharray={circ}
                    strokeDashoffset={off}
                    stroke={color}
                    style={{ filter: `drop-shadow(0 0 5px ${color}66)` }}
                  />
                </svg>
                <span className="mini-ring-val">{score !== null && score !== undefined ? score : "--"}</span>
              </div>
              <span className="mini-ring-label">{label}</span>
            </div>
          );
        })}
      </div>

      {/* ─── Dashboard Tabs (sectores, insights, form, config, perfil) ─── */}
      <DashboardTabs
        day={day}
        sectorCards={sectorCards as any}
        latestExercise={dashboard.latestExercise}
        stepsSeries={dashboard.stepsSeries}
        dataCards={dashboard.dataCards}
        weeklySummary={weeklySummary}
        experiments={experiments}
        syncSummary={dashboard.syncSummary}
        profile={dashboard.profile}
        isGoogleHealthConnected={dashboard.isGoogleHealthConnected}
      />
    </main>
  );
}
