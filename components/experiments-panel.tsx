"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Beaker, Plus, Trash2, Calendar, Check, AlertCircle } from "lucide-react";

type Experiment = {
  id: string;
  title: string;
  hypothesis: string;
  metric: string;
  baseline_start: string;
  intervention_start: string;
  intervention_end: string | null;
  avgBaseline: number | null;
  avgIntervention: number | null;
  pctChange: number;
  summary: string;
  status: "positive" | "negative" | "neutral";
  active: boolean;
};

type ExperimentsPanelProps = {
  experiments: Experiment[];
};

const TEMPLATES = [
  {
    title: "Sin cafeína por la tarde",
    hypothesis: "Al evitar café después de las 2 PM, la duración total de mi sueño de hoy aumentará.",
    metric: "sleep_minutes",
    durationDays: 7
  },
  {
    title: "Caminar 10,000 pasos diarios",
    hypothesis: "Aumentar mi nivel de actividad cardiovascular bajará mi frecuencia cardíaca en reposo.",
    metric: "resting_hr",
    durationDays: 7
  },
  {
    title: "Meditación de respiración nocturna",
    hypothesis: "Calmar el sistema nervioso antes de dormir subirá mi HRV (variabilidad cardíaca).",
    metric: "hrv",
    durationDays: 7
  },
  {
    title: "Cena ligera 3h antes de acostarse",
    hypothesis: "Reducir la carga digestiva nocturna aumentará la calidad de mi sueño y mi HRV.",
    metric: "hrv",
    durationDays: 7
  }
];

export function ExperimentsPanel({ experiments }: ExperimentsPanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [metric, setMetric] = useState("sleep_minutes");

  const selectTemplate = (index: number) => {
    setSelectedTemplate(index);
    const tmpl = TEMPLATES[index];
    setTitle(tmpl.title);
    setHypothesis(tmpl.hypothesis);
    setMetric(tmpl.metric);
  };

  const handleStartCustom = () => {
    setSelectedTemplate(null);
    setTitle("");
    setHypothesis("");
    setMetric("sleep_minutes");
    setShowForm(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !metric) return;

    setLoading(true);

    const todayStr = new Date().toISOString().slice(0, 10);
    const sevenDaysAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const sevenDaysLaterStr = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    try {
      const res = await fetch("/api/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          hypothesis,
          metric,
          baseline_start: sevenDaysAgoStr,
          intervention_start: todayStr,
          intervention_end: sevenDaysLaterStr
        })
      });

      if (res.ok) {
        setShowForm(false);
        setSelectedTemplate(null);
        router.refresh();
      } else {
        const data = await res.json();
        alert(`Error: ${data.message}`);
      }
    } catch (err: any) {
      alert(`Error de conexión: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Seguro que deseas eliminar este experimento?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/experiments?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(`Error: ${data.message}`);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const displayMetricName = (slug: string) => {
    if (slug === "sleep_minutes") return "Minutos de Sueño";
    if (slug === "resting_hr") return "Frecuencia Cardíaca Reposo";
    if (slug === "hrv") return "HRV (Variabilidad Cardíaca)";
    if (slug === "steps") return "Pasos";
    return slug;
  };

  return (
    <article
      className="experiments-panel"
      style={{
        backgroundColor: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow)",
        padding: "24px",
        marginTop: "16px"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Beaker size={22} style={{ color: "var(--purple)" }} />
          <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>Salud A/B Experiments Hub</h2>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              border: "1px solid var(--line)",
              borderRadius: "16px",
              padding: "6px 14px",
              fontSize: "0.85rem",
              fontWeight: 600,
              backgroundColor: "var(--panel-2)",
              color: "var(--blue)",
              cursor: "pointer"
            }}
          >
            <Plus size={14} /> Nuevo Test
          </button>
        )}
      </div>

      <p style={{ fontSize: "0.88rem", color: "var(--muted)", margin: "0 0 20px 0", lineHeight: 1.4 }}>
        Diseña pruebas individuales cortas para verificar científicamente el impacto de tus hábitos sobre tus signos vitales y tu sueño.
      </p>

      {/* Creación de nuevo experimento */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          style={{
            background: "var(--line-light)",
            padding: "16px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--line)",
            marginBottom: "20px"
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "0.95rem", fontWeight: 700 }}>Crear Experimento A/B</h3>

          {!selectedTemplate && (
            <div style={{ display: "grid", gap: "8px", marginBottom: "16px" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--muted)" }}>Elige una plantilla:</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => selectTemplate(idx)}
                    style={{
                      fontSize: "0.8rem",
                      padding: "6px 12px",
                      borderRadius: "12px",
                      border: "1px solid var(--line)",
                      backgroundColor: "var(--panel)",
                      cursor: "pointer",
                      fontWeight: 500
                    }}
                  >
                    {tmpl.title}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleStartCustom}
                  style={{
                    fontSize: "0.8rem",
                    padding: "6px 12px",
                    borderRadius: "12px",
                    border: "1px dashed var(--blue)",
                    backgroundColor: "transparent",
                    color: "var(--blue)",
                    cursor: "pointer",
                    fontWeight: 600
                  }}
                >
                  Personalizado +
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "grid", gap: "10px" }}>
            <label style={{ display: "grid", gap: "4px" }}>
              <span>Nombre del Experimento</span>
              <input
                type="text"
                required
                placeholder="Ej. Evitar pantallas de noche"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{
                  height: "38px",
                  padding: "0 10px",
                  fontSize: "0.88rem",
                  borderRadius: "8px",
                  border: "1px solid var(--line)"
                }}
              />
            </label>

            <label style={{ display: "grid", gap: "4px" }}>
              <span>Hipótesis</span>
              <textarea
                required
                placeholder="Ej. Apagar la TV 1h antes mejorará mis minutos de sueño profundo."
                value={hypothesis}
                onChange={(e) => setHypothesis(e.target.value)}
                style={{
                  minHeight: "50px",
                  padding: "10px",
                  fontSize: "0.88rem",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  fontFamily: "inherit"
                }}
              />
            </label>

            <label style={{ display: "grid", gap: "4px" }}>
              <span>Métrica a evaluar</span>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                style={{
                  height: "38px",
                  padding: "0 10px",
                  fontSize: "0.88rem",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  backgroundColor: "var(--panel)"
                }}
              >
                <option value="sleep_minutes">Duración del sueño</option>
                <option value="resting_hr">Frecuencia cardíaca en reposo</option>
                <option value="hrv">Variabilidad cardíaca (HRV)</option>
                <option value="steps">Pasos diarios</option>
              </select>
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "14px" }}>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setSelectedTemplate(null);
              }}
              style={{
                fontSize: "0.85rem",
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid var(--line)",
                backgroundColor: "transparent",
                cursor: "pointer"
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                fontSize: "0.85rem",
                padding: "6px 16px",
                borderRadius: "8px",
                border: "0",
                backgroundColor: "var(--ink)",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 600
              }}
            >
              {loading ? "Iniciando..." : "Iniciar Experimento (7d)"}
            </button>
          </div>
        </form>
      )}

      {/* Listado de experimentos activos o pasados */}
      <div style={{ display: "grid", gap: "12px" }}>
        {experiments.length === 0 ? (
          <div
            style={{
              padding: "20px",
              textAlign: "center",
              color: "var(--muted)",
              background: "var(--line-light)",
              borderRadius: "var(--radius-md)",
              border: "1px dashed var(--line)",
              fontSize: "0.88rem"
            }}
          >
            No hay experimentos registrados. ¡Inicia una prueba A/B para optimizar tu salud!
          </div>
        ) : (
          experiments.map((exp) => {
            const hasData = exp.avgBaseline !== null && exp.avgIntervention !== null;
            const diff = exp.avgIntervention && exp.avgBaseline ? exp.avgIntervention - exp.avgBaseline : 0;
            const colorTone =
              exp.status === "positive"
                ? "var(--green)"
                : exp.status === "negative"
                ? "var(--red)"
                : "var(--muted)";
            const bgTone =
              exp.status === "positive"
                ? "rgba(30, 142, 62, 0.06)"
                : exp.status === "negative"
                ? "rgba(217, 48, 37, 0.06)"
                : "var(--line-light)";

            return (
              <div
                key={exp.id}
                style={{
                  backgroundColor: bgTone,
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-md)",
                  padding: "16px",
                  position: "relative"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        backgroundColor: exp.active ? "rgba(26, 115, 232, 0.15)" : "var(--line)",
                        color: exp.active ? "var(--blue)" : "var(--muted)",
                        padding: "2px 8px",
                        borderRadius: "10px",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em"
                      }}
                    >
                      {exp.active ? "En progreso" : "Completado"}
                    </span>
                    <h3
                      style={{ margin: "6px 0 2px 0", fontSize: "1rem", fontWeight: 700, color: "var(--ink)" }}
                    >
                      {exp.title}
                    </h3>
                  </div>
                  <button
                    disabled={loading}
                    onClick={() => handleDelete(exp.id)}
                    style={{
                      border: 0,
                      backgroundColor: "transparent",
                      color: "var(--muted)",
                      cursor: "pointer",
                      padding: "4px"
                    }}
                    title="Eliminar experimento"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <p style={{ margin: "6px 0 10px 0", fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.4 }}>
                  <strong>Hipótesis:</strong> {exp.hypothesis}
                </p>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "10px",
                    borderTop: "1px solid var(--line)",
                    paddingTop: "10px",
                    marginTop: "10px"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "0.8rem" }}>
                    <div>
                      <span style={{ color: "var(--muted)" }}>Línea Base:</span>{" "}
                      <strong style={{ color: "var(--ink)" }}>
                        {exp.avgBaseline !== null ? Math.round(exp.avgBaseline) : "---"}{" "}
                        {exp.metric === "sleep_minutes" ? "m" : ""}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--muted)" }}>Intervención:</span>{" "}
                      <strong style={{ color: "var(--ink)" }}>
                        {exp.avgIntervention !== null ? Math.round(exp.avgIntervention) : "---"}{" "}
                        {exp.metric === "sleep_minutes" ? "m" : ""}
                      </strong>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {hasData ? (
                      <>
                        <span
                          style={{
                            fontSize: "0.82rem",
                            fontWeight: 800,
                            color: colorTone,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px"
                          }}
                        >
                          {exp.pctChange > 0 ? "+" : ""}
                          {exp.pctChange.toFixed(1)}%
                        </span>
                        <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>({exp.summary})</span>
                      </>
                    ) : (
                      <span
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--muted)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        <AlertCircle size={12} />
                        Sincronizando datos...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </article>
  );
}
