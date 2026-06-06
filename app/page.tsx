import { Dumbbell, Info } from "lucide-react";
import { DashboardControlCenter } from "@/components/dashboard-control-center";
import { DashboardTabs } from "@/components/dashboard-tabs";
import { getDashboardData } from "@/lib/dashboard-data";
import { getAppUserContext } from "@/lib/app-user";
import { LandingAuthPage } from "@/components/landing-auth-page";
import type { ScoreResult } from "@/lib/scoring";

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

function PillarCard({
  title,
  pillar,
  colorClass,
  svgColor
}: {
  title: string;
  pillar: ScoreResult;
  colorClass: string;
  svgColor: string;
}) {
  const R_MINI = 22;
  const CIRC_MINI = 2 * Math.PI * R_MINI;
  const score = pillar.score;
  const off = CIRC_MINI - (CIRC_MINI * (score ?? 0)) / 100;
  
  const algoLabel = pillar.algorithmUsed === "baseline_personalizado" 
    ? "Baseline" 
    : "Por reglas";
  
  const confLabels: Record<string, string> = {
    alta: "Confianza Alta",
    media: "Confianza Media",
    baja: "Confianza Baja",
    insuficiente: "Sin datos suf."
  };

  return (
    <div className={`pillar-card theme-${colorClass}`}>
      <div className="pillar-header-row">
        <h3>{title}</h3>
        <span className={`conf-tag conf-${pillar.confidence}`}>
          {confLabels[pillar.confidence] || pillar.confidence}
        </span>
      </div>
      
      <div className="pillar-content-row">
        <div className="mini-ring-wrap" style={{ position: "relative", width: "50px", height: "50px" }}>
          <svg viewBox="0 0 50 50" aria-hidden style={{ width: "100%", height: "100%" }}>
            <circle className="mini-ring-track" cx="25" cy="25" r={R_MINI} style={{ stroke: "var(--line)" }} />
            <circle
              className="mini-ring-fill"
              cx="25"
              cy="25"
              r={R_MINI}
              strokeDasharray={CIRC_MINI}
              strokeDashoffset={off}
              stroke={svgColor}
              style={{ filter: `drop-shadow(0 0 3px ${svgColor}66)`, transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
            />
          </svg>
          <span className="mini-ring-val" style={{ fontSize: "0.85rem", fontWeight: 700 }}>
            {score !== null && score !== undefined ? score : "--"}
          </span>
        </div>

        <div className="pillar-details">
          <span className="pillar-algo">Modo: {algoLabel}</span>
          <p className="pillar-desc-text">{pillar.explanation}</p>
        </div>
      </div>
    </div>
  );
}

export default async function Home() {
  const appUser = await getAppUserContext();

  if (!appUser) {
    return <LandingAuthPage />;
  }

  const dashboard = await getDashboardData(appUser);
  const { day, sectorCards, weeklySummary, experiments = [], advancedScores } = dashboard;

  const recoveryScore = sectorCards.find(s => s.name === "Recuperacion")?.score ?? null;
  const sleepScore    = sectorCards.find(s => s.name === "Sueno")?.score ?? null;
  const cardioScore   = sectorCards.find(s => s.name === "Cardiovascular")?.score ?? null;

  const generalScoreObj = advancedScores?.generalScore || { score: day.overall, confidence: "media", explanation: "" };
  const generalScore = generalScoreObj.score;
  const generalConf = generalScoreObj.confidence;
  const generalExpl = generalScoreObj.explanation;

  const tone = generalScore !== null && generalScore !== undefined
    ? (generalScore >= 75 ? "good" : generalScore >= 50 ? "watch" : "care")
    : "muted";
    
  const prepText = generalScore !== null && generalScore !== undefined
    ? (generalScore >= 75 ? "Preparación alta" : generalScore >= 50 ? "Preparación media" : "Necesita recuperación")
    : "Sin datos de preparación";

  const trainingChipTone = trainingTone[day.trainingRecommendation] ?? "watch";

  // Combine standard anomalies with Advanced Scoring engine alerts
  const allAlerts = [
    ...(advancedScores?.alerts || []).map((alert) => ({
      title: alert.title,
      body: alert.message,
      severity: alert.severity === "critical" ? "danger" as const : (alert.severity === "warning" ? "warning" as const : "info" as const),
      category: alert.category
    })),
    ...(dashboard.anomalies || []).map((anomaly) => ({
      title: anomaly.title,
      body: anomaly.body,
      severity: anomaly.severity,
      category: "anomaly"
    }))
  ];

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

      {/* ─── Alertas / Red Flags (Clinical Alerts) ────────────────── */}
      {allAlerts.length > 0 && (
        <section aria-label="Alertas y Notificaciones de Salud" style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
          {allAlerts.map((alert, i) => {
            const isDanger = alert.severity === "danger";
            const isWarning = alert.severity === "warning";
            const emoji = isDanger ? "🔴" : (isWarning ? "🟡" : "ℹ️");
            return (
              <div
                key={i}
                className={`anomaly-banner ${alert.severity}`}
              >
                <span style={{ fontSize: "1.2rem", lineHeight: 1, marginRight: "4px" }}>
                  {emoji}
                </span>
                <div>
                  <strong>{alert.title}</strong>
                  <p>{alert.body}</p>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* ─── Advanced Scores: Pillars ────────────────────────────── */}
      <section className="pillars-section" aria-label="Pilares de Salud y Rendimiento" style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "12px", color: "var(--ink)" }}>Puntuación del Día</h2>
        
        {advancedScores ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <PillarCard 
              title="Disponibilidad Diaria" 
              pillar={advancedScores.dailyReadiness} 
              colorClass="readiness" 
              svgColor="var(--green)"
            />
            <PillarCard 
              title="Índice de Salud General" 
              pillar={advancedScores.healthIndex} 
              colorClass="health-index" 
              svgColor="var(--accent)"
            />
            <PillarCard 
              title="Progreso Corporal" 
              pillar={advancedScores.bodyProgress} 
              colorClass="body-progress" 
              svgColor="var(--purple)"
            />
          </div>
        ) : (
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Cargando puntuaciones avanzadas...</p>
        )}
      </section>

      {/* ─── Combined General Score Row ───────────────────────────── */}
      <section className="score-hero" aria-label="Score diario general" style={{ padding: "16px", borderRadius: "var(--radius-lg)", background: "var(--panel)", border: "1px solid var(--line)", marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <div>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)" }}>
              Puntuación General Integrada
            </span>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--ink)", marginTop: "4px" }}>{prepText}</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
            <div className="ring-label" style={{ display: "inline-flex", alignItems: "baseline", gap: "2px" }}>
              <span className="num" style={{ fontSize: "1.8rem", fontWeight: 900, color: `var(--${tone === 'good' ? 'green' : (tone === 'watch' ? 'amber' : 'red')})` }}>
                {generalScore !== null && generalScore !== undefined ? generalScore : "--"}
              </span>
              <span className="unit" style={{ fontSize: "0.8rem", color: "var(--muted)" }}>/100</span>
            </div>
            <span className={`conf-tag conf-${generalConf}`} style={{ fontSize: "0.65rem", padding: "2px 6px" }}>
              Confianza {generalConf}
            </span>
          </div>
        </div>

        {generalExpl && (
          <p style={{ fontSize: "0.82rem", color: "var(--ink-2)", lineHeight: 1.4, margin: "8px 0 12px 0" }}>
            {generalExpl}
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--line)", paddingTop: "12px", marginTop: "8px" }}>
          <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
            Actividad de hoy
          </span>
          <div className={`training-chip ${trainingChipTone}`}>
            <Dumbbell size={13} aria-hidden />
            {day.trainingRecommendation}
          </div>
        </div>
      </section>

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
        advancedScores={advancedScores}
      />
    </main>
  );
}

