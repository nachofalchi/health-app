"use client";

import { useMemo } from "react";

type SleepStagesProps = {
  deep: number;
  rem: number;
  light: number;
  awake: number;
};

function formatMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return hours ? `${hours} h ${minutes} m` : `${minutes} m`;
}

export function SleepStages({ deep, rem, light, awake }: SleepStagesProps) {
  const total = deep + rem + light + awake;

  const stages = useMemo(() => {
    if (total === 0) return [];
    
    return [
      {
        name: "Profundo",
        value: deep,
        pct: (deep / total) * 100,
        color: "var(--purple)",
        bg: "#f3e5f5",
        targetRange: "10% - 20%",
        assessment: deep / total >= 0.1 && deep / total <= 0.20 ? "Óptimo" : deep / total < 0.1 ? "Bajo" : "Excelente",
        assessmentColor: deep / total >= 0.1 ? "var(--green)" : "var(--amber)"
      },
      {
        name: "REM",
        value: rem,
        pct: (rem / total) * 100,
        color: "#c084fc",
        bg: "#fae8ff",
        targetRange: "15% - 25%",
        assessment: rem / total >= 0.15 && rem / total <= 0.25 ? "Óptimo" : rem / total < 0.15 ? "Bajo" : "Alto",
        assessmentColor: rem / total >= 0.15 && rem / total <= 0.25 ? "var(--green)" : "var(--amber)"
      },
      {
        name: "Ligero",
        value: light,
        pct: (light / total) * 100,
        color: "#818cf8",
        bg: "#e0e7ff",
        targetRange: "50% - 60%",
        assessment: light / total >= 0.5 && light / total <= 0.6 ? "Óptimo" : light / total < 0.5 ? "Bajo" : "Alto",
        assessmentColor: "var(--muted)"
      },
      {
        name: "Despierto",
        value: awake,
        pct: (awake / total) * 100,
        color: "#f87171",
        bg: "#fee2e2",
        targetRange: "< 10%",
        assessment: awake / total < 0.1 ? "Normal" : "Elevado",
        assessmentColor: awake / total < 0.1 ? "var(--green)" : "var(--red)"
      }
    ];
  }, [deep, rem, light, awake, total]);

  if (total === 0) return null;

  return (
    <div
      className="sleep-stages-container"
      style={{
        padding: "24px",
        backgroundColor: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow)",
        marginTop: "16px"
      }}
    >
      <h3 style={{ margin: "0 0 16px 0", fontSize: "1.1rem", fontWeight: 700, color: "var(--ink)" }}>
        Fases del Sueño de Anoche
      </h3>

      {/* Barra apilada horizontal */}
      <div
        className="sleep-stacked-bar"
        style={{
          display: "flex",
          height: "28px",
          width: "100%",
          borderRadius: "14px",
          overflow: "hidden",
          backgroundColor: "var(--line-light)",
          marginBottom: "20px"
        }}
      >
        {stages.map((stage) => (
          <div
            key={stage.name}
            style={{
              width: `${stage.pct}%`,
              backgroundColor: stage.color,
              height: "100%",
              transition: "width 0.5s ease-out"
            }}
            title={`${stage.name}: ${formatMinutes(stage.value)} (${stage.pct.toFixed(0)}%)`}
          />
        ))}
      </div>

      {/* Grid de leyendas y comparación */}
      <div
        className="sleep-stages-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "14px"
        }}
      >
        {stages.map((stage) => (
          <div
            key={stage.name}
            style={{
              padding: "12px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--line-light)",
              border: "1px solid var(--line)",
              display: "flex",
              flexDirection: "column",
              gap: "4px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  display: "inline-block",
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: stage.color
                }}
              />
              <strong style={{ fontSize: "0.85rem", color: "var(--ink)", fontWeight: 700 }}>
                {stage.name}
              </strong>
            </div>
            <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--ink)" }}>
              {formatMinutes(stage.value)}
            </span>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 500 }}>
                {stage.pct.toFixed(0)}% <span style={{ fontSize: "0.65rem" }}>(meta {stage.targetRange})</span>
              </span>
              <span
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  color: stage.assessmentColor,
                  textTransform: "uppercase"
                }}
              >
                {stage.assessment}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
