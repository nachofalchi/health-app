import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Activity, ArrowLeft, BatteryCharging, HeartPulse, Moon, Scale, Smile, TrendingUp } from "lucide-react";
import { getCategoryDetail, type CategorySlug } from "@/lib/category-data";
import { TrendChart } from "@/components/trend-chart";
import { ThemeToggle } from "@/components/theme-toggle";
import { SleepStages } from "@/components/sleep-stages";
import { getAppUserContext } from "@/lib/app-user";

export const dynamic = "force-dynamic";

const icons = {
  recuperacion: BatteryCharging,
  sueno: Moon,
  entrenamiento: Activity,
  cardiovascular: HeartPulse,
  composicion: Scale,
  bienestar: Smile
};

export default async function CategoryPage({ params }: { params: Promise<{ category?: string; nxtPcategory?: string }> }) {
  const appUser = await getAppUserContext();
  if (!appUser) {
    redirect("/");
  }

  const resolvedParams = await params;
  const category = resolvedParams.category ?? resolvedParams.nxtPcategory;
  const detail = await getCategoryDetail(category);

  if (!detail) notFound();

  const Icon = icons[detail.slug as CategorySlug];

  return (
    <main className={`shell theme-${detail.slug}`}>
      <header className="category-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <Link className="back-link" href="/">
            <ArrowLeft size={18} aria-hidden />
            Dashboard
          </Link>
          <ThemeToggle />
        </div>
        <div className="category-title">
          <Icon size={34} aria-hidden />
          <div>
            <p className="eyebrow">{detail.isReal ? "Datos reales" : "Modo demo"}</p>
            <h1>{detail.title}</h1>
          </div>
        </div>
      </header>

      {detail.anomalies && detail.anomalies.length > 0 && (
        <section className="anomalies-section" style={{ marginBottom: "20px" }}>
          {detail.anomalies.map((anomaly, index) => (
            <article key={index} style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              padding: "16px",
              borderRadius: "var(--radius-md)",
              backgroundColor: anomaly.severity === "danger" ? "rgba(217, 30, 25, 0.08)" : "rgba(176, 96, 0, 0.08)",
              border: `1px solid ${anomaly.severity === "danger" ? "rgba(217, 30, 25, 0.2)" : "rgba(176, 96, 0, 0.2)"}`,
              color: "var(--ink)",
              marginBottom: "10px"
            }}>
              <span style={{
                fontSize: "1.2rem",
                lineHeight: 1,
                color: anomaly.severity === "danger" ? "var(--red)" : "var(--amber)"
              }}>⚠️</span>
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "0.95rem", fontWeight: 700 }}>{anomaly.title}</h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.4 }}>{anomaly.body}</p>
              </div>
            </article>
          ))}
        </section>
      )}

      <section className="category-hero" aria-label={`Resumen de ${detail.title}`}>
        <article className="category-score-panel">
          <div className="score-ring-container category-ring" aria-label={`Score ${detail.score} de 100`}>
            <svg className="score-ring-svg" viewBox="0 0 100 100">
              <circle className="score-ring-bg" cx="50" cy="50" r="42" />
              <circle
                className="score-ring-fill"
                cx="50"
                cy="50"
                r="42"
                strokeDasharray="263.89"
                strokeDashoffset={263.89 - (263.89 * detail.score) / 100}
              />
            </svg>
            <div className="score-ring-text">
              <span>{detail.score}</span>
              <small>Score</small>
            </div>
          </div>
          <div>
            <p className="label">{detail.status}</p>
            <h2>{detail.primaryMetric.value}</h2>
            <p>{detail.summary}</p>
          </div>
        </article>

        <aside className="category-metrics" aria-label="Métricas principales">
          {detail.metrics.map((metric) => (
            <div key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </aside>
      </section>

      <section className="category-layout">
        <article className="chart-panel">
          <div className="section-title">
            <TrendingUp size={22} aria-hidden />
            <h2>Tendencia</h2>
          </div>
          {detail.trend.length ? (
            <TrendChart points={detail.trend} category={detail.slug} />
          ) : (
            <p className="empty-state">Todavía no hay suficientes datos para graficar esta categoría.</p>
          )}
        </article>

        <article className="projection-panel">
          <p className="label">{detail.projection.title}</p>
          <strong>{detail.projection.value}</strong>
          <p>{detail.projection.body}</p>
        </article>

        {detail.slug === "sueno" && detail.sleepStages && (
          <div style={{ gridColumn: "1 / -1" }}>
            <SleepStages
              deep={detail.sleepStages.deep}
              rem={detail.sleepStages.rem}
              light={detail.sleepStages.light}
              awake={detail.sleepStages.awake}
            />
          </div>
        )}

        {detail.slug === "bienestar" && detail.habitsCorrelation && (
          <article className="chart-panel" style={{ gridColumn: "1 / -1", padding: "24px" }}>
            <div className="section-title">
              <TrendingUp size={22} aria-hidden />
              <h2>Análisis de Correlaciones de Hábitos</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginTop: "16px" }}>
              {detail.habitsCorrelation.map((h, i) => (
                <div key={i} style={{
                  padding: "16px",
                  borderRadius: "var(--radius-md)",
                  background: h.type === "positive" ? "rgba(30, 142, 62, 0.08)" : h.type === "negative" ? "rgba(217, 48, 37, 0.08)" : "var(--line-light)",
                  border: `1px solid ${h.type === "positive" ? "rgba(30, 142, 62, 0.2)" : h.type === "negative" ? "rgba(217, 48, 37, 0.2)" : "var(--line)"}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, color: "var(--ink)" }}>{h.title}</h3>
                    <span style={{
                      fontSize: "0.85rem",
                      fontWeight: 800,
                      color: h.type === "positive" ? "var(--green)" : h.type === "negative" ? "var(--red)" : "var(--muted)",
                      background: "var(--panel)",
                      padding: "2px 8px",
                      borderRadius: "12px",
                      border: "1px solid var(--line)"
                    }}>{h.value}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--muted)", lineHeight: 1.4 }}>{h.description}</p>
                </div>
              ))}
            </div>
          </article>
        )}

        {detail.slug === "entrenamiento" && detail.exercises && detail.exercises.length > 0 && (
          <article className="chart-panel" style={{ gridColumn: "1 / -1", padding: "24px" }}>
            <div className="section-title">
              <TrendingUp size={22} aria-hidden />
              <h2>Historial de Entrenamientos (Carga Cardio TRIMP)</h2>
            </div>
            <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
              {detail.exercises.map((ex, i) => (
                <div key={i} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 20px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--panel-2)",
                  border: "1px solid var(--line)",
                  flexWrap: "wrap",
                  gap: "10px"
                }}>
                  <div>
                    <strong style={{ fontSize: "0.95rem", color: "var(--ink)" }}>
                      {ex.display_name ?? ex.exercise_type ?? "Ejercicio"}
                    </strong>
                    <span style={{ fontSize: "0.8rem", color: "var(--muted)", marginLeft: "12px" }}>
                      {new Date(ex.start_time).toLocaleDateString("es-AR", { day: "numeric", month: "long" })}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    {ex.average_heart_rate && (
                      <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                        {Math.round(ex.average_heart_rate)} bpm prom.
                      </span>
                    )}
                    {ex.active_duration_seconds && (
                      <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                        {Math.round(ex.active_duration_seconds / 60)} min
                      </span>
                    )}
                    <span style={{
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      color: ex.cardioLoadLabel === "Alta" ? "var(--red)" : ex.cardioLoadLabel === "Media" ? "var(--amber)" : "var(--green)",
                      backgroundColor: ex.cardioLoadLabel === "Alta" ? "rgba(217, 48, 37, 0.1)" : ex.cardioLoadLabel === "Media" ? "rgba(176, 96, 0, 0.1)" : "rgba(30, 142, 62, 0.1)",
                      padding: "4px 10px",
                      borderRadius: "12px"
                    }}>
                      Carga: {ex.cardioLoad} ({ex.cardioLoadLabel})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        )}
      </section>

      <section className="recommendation-grid" aria-label="Recomendaciones">
        {detail.recommendations.map((recommendation, index) => (
          <article className="recommendation-card" key={`${recommendation.title}-${index}`}>
            <div>
              <h2>{recommendation.title}</h2>
              <p>{recommendation.body}</p>
            </div>
            <span>{recommendation.confidence}</span>
          </article>
        ))}
      </section>
    </main>
  );
}
