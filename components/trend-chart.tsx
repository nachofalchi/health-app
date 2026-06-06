"use client";

import { useMemo, useState, useRef } from "react";

type TrendPoint = {
  label: string;
  value: number | null;
  display: string;
};

type TrendChartProps = {
  points: TrendPoint[];
  category: string;
};

export function TrendChart({ points, category }: TrendChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Configuración de rango saludable y etiquetas según categoría
  const config = useMemo(() => {
    switch (category) {
      case "sueno":
        return {
          title: "Sueño",
          unit: "min",
          optMin: 420, // 7 horas
          optMax: 540, // 9 horas
          fallbackMin: 300,
          fallbackMax: 600
        };
      case "entrenamiento":
        return {
          title: "Pasos",
          unit: "pasos",
          optMin: 8000,
          optMax: 12000,
          fallbackMin: 2000,
          fallbackMax: 15000
        };
      case "cardiovascular":
        return {
          title: "FC Reposo",
          unit: "bpm",
          optMin: 55,
          optMax: 72,
          fallbackMin: 45,
          fallbackMax: 90
        };
      case "bienestar":
        return {
          title: "Bienestar",
          unit: "/5",
          optMin: 3.5,
          optMax: 5.0,
          fallbackMin: 1.0,
          fallbackMax: 5.0
        };
      case "recuperacion":
        return {
          title: "Recuperación",
          unit: "%",
          optMin: 70,
          optMax: 100,
          fallbackMin: 30,
          fallbackMax: 100
        };
      case "composicion":
      default: {
        // Para composición (peso) calculamos un rango saludable dinámico basado en la media de los datos
        const validValues = points.map((p) => p.value).filter((v): v is number => v !== null);
        const avg = validValues.length ? validValues.reduce((sum, v) => sum + v, 0) / validValues.length : 70;
        return {
          title: "Peso",
          unit: "kg",
          optMin: avg * 0.97, // rango de variación de ±3% como saludable
          optMax: avg * 1.03,
          fallbackMin: avg * 0.9,
          fallbackMax: avg * 1.1
        };
      }
    }
  }, [category, points]);

  // Filtramos los datos válidos para calcular mínimos/máximos del eje Y
  const validPoints = useMemo(() => points.filter((p) => p.value !== null), [points]);

  // Dimensiones del SVG
  const width = 600;
  const height = 250;
  const padding = { top: 30, right: 30, bottom: 40, left: 50 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // 2. Límites del eje Y
  const yBounds = useMemo(() => {
    if (validPoints.length === 0) {
      return { min: config.fallbackMin, max: config.fallbackMax };
    }
    const values = validPoints.map((p) => p.value as number);
    const minVal = Math.min(...values, config.optMin);
    const maxVal = Math.max(...values, config.optMax);
    const diff = maxVal - minVal;
    
    // Margen de 10% arriba y abajo para que el gráfico no toque los bordes
    const margin = diff === 0 ? 10 : diff * 0.15;
    return {
      min: Math.max(0, minVal - margin),
      max: maxVal + margin
    };
  }, [validPoints, config]);

  // 3. Mapeo de coordenadas
  const stepX = points.length > 1 ? chartWidth / (points.length - 1) : chartWidth;

  const getCoordinates = useMemo(() => {
    return points.map((p, index) => {
      if (p.value === null) return { x: padding.left + index * stepX, y: null, value: null, label: p.label, display: p.display };
      
      // Mapeo Y lineal inverso (y=0 arriba en SVG)
      const ratio = (p.value - yBounds.min) / (yBounds.max - yBounds.min || 1);
      const y = padding.top + chartHeight - ratio * chartHeight;
      return {
        x: padding.left + index * stepX,
        y,
        value: p.value,
        label: p.label,
        display: p.display
      };
    });
  }, [points, yBounds, stepX, padding.left, padding.top, chartHeight]);

  const activePoint = activeIndex !== null ? getCoordinates[activeIndex] : null;

  // Mapear alturas de rango óptimo
  const optRangeY = useMemo(() => {
    const minRatio = (config.optMin - yBounds.min) / (yBounds.max - yBounds.min || 1);
    const maxRatio = (config.optMax - yBounds.min) / (yBounds.max - yBounds.min || 1);
    
    const yOptMin = padding.top + chartHeight - maxRatio * chartHeight;
    const yOptMax = padding.top + chartHeight - minRatio * chartHeight;

    return {
      top: Math.max(padding.top, yOptMin),
      height: Math.min(chartHeight, yOptMax - yOptMin)
    };
  }, [config, yBounds, padding.top, chartHeight]);

  // 4. Calcular el Path Bézier suavizado
  const bezierPaths = useMemo(() => {
    const pts = getCoordinates.filter((p): p is { x: number; y: number; value: number; label: string; display: string } => p.y !== null);
    if (pts.length === 0) return { line: "", area: "" };

    let dLine = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const curr = pts[i];
      const next = pts[i + 1];
      // Puntos de control intermedios para una curva Bézier cúbica suave
      const cp1x = curr.x + (next.x - curr.x) / 3;
      const cp1y = curr.y;
      const cp2x = curr.x + (2 * (next.x - curr.x)) / 3;
      const cp2y = next.y;
      dLine += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
    }

    // Para el área cerrada, conectamos el final con la base del gráfico y volvemos al inicio
    const baseY = padding.top + chartHeight;
    const dArea = `${dLine} L ${pts[pts.length - 1].x} ${baseY} L ${pts[0].x} ${baseY} Z`;

    return { line: dLine, area: dArea };
  }, [getCoordinates, padding.top, chartHeight]);

  // Manejo de eventos interactivos
  const handlePointer = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const pctX = relativeX / rect.width;
    
    // Mapeamos de vuelta al ancho del viewBox (600px)
    const svgX = pctX * width;
    
    // Encontramos el índice del punto más cercano
    let closestIndex = 0;
    let minDiff = Infinity;
    
    getCoordinates.forEach((p, idx) => {
      const diff = Math.abs(p.x - svgX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = idx;
      }
    });

    setActiveIndex(closestIndex);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    handlePointer(e.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches[0]) {
      handlePointer(e.touches[0].clientX);
    }
  };

  // Eje Y ticks (tres valores: min, medio, max)
  const yTicks = useMemo(() => {
    const mid = yBounds.min + (yBounds.max - yBounds.min) / 2;
    return [yBounds.min, mid, yBounds.max].map((val) => ({
      value: val,
      display: category === "sueno" 
        ? `${Math.floor(val / 60)}h` 
        : category === "composicion"
          ? `${val.toFixed(1)}`
          : `${Math.round(val)}`,
      y: padding.top + chartHeight - ((val - yBounds.min) / (yBounds.max - yBounds.min || 1)) * chartHeight
    }));
  }, [yBounds, padding.top, chartHeight, category]);

  if (validPoints.length === 0) {
    return (
      <div className="empty-chart-state" style={{ padding: "40px 20px", textAlign: "center", color: "var(--muted)" }}>
        Todavía no hay suficientes datos para graficar esta categoría.
      </div>
    );
  }

  return (
    <div className="trend-chart-wrapper" ref={containerRef} style={{ position: "relative", width: "100%" }}>
      {/* Tooltip flotante interactivo */}
      {activePoint && activePoint.y !== null && (
        <div
          className="trend-tooltip"
          style={{
            position: "absolute",
            left: `${((activePoint.x - padding.left) / chartWidth) * 100}%`,
            top: `${Math.max(5, activePoint.y - 65)}px`,
            transform: "translateX(-50%)",
            backgroundColor: "var(--panel)",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow-hover)",
            borderRadius: "var(--radius-sm)",
            padding: "8px 12px",
            pointerEvents: "none",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "2px",
            minWidth: "90px",
            transition: "left 0.15s ease-out, top 0.15s ease-out"
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
            {activePoint.label}
          </span>
          <strong style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--ink)" }}>
            {activePoint.display}
          </strong>
          {activePoint.value !== null && (
            <span
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                color: activePoint.value >= config.optMin && activePoint.value <= config.optMax ? "var(--green)" : "var(--amber)",
                backgroundColor: activePoint.value >= config.optMin && activePoint.value <= config.optMax ? "#e6f4ea" : "#fef7e0",
                padding: "2px 6px",
                borderRadius: "4px"
              }}
            >
              {activePoint.value >= config.optMin && activePoint.value <= config.optMax ? "Saludable" : "Fuera de rango"}
            </span>
          )}
        </div>
      )}

      {/* SVG Principal */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="100%"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setActiveIndex(null)}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => setActiveIndex(null)}
        style={{ overflow: "visible", cursor: "crosshair" }}
      >
        <defs>
          {/* Degradado para el área bajo la curva */}
          <linearGradient id={`gradient-${category}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--c-primary)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--c-primary)" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* 1. Franja de Rango Saludable */}
        <rect
          x={padding.left}
          y={optRangeY.top}
          width={chartWidth}
          height={optRangeY.height}
          fill="var(--c-bg)"
          opacity="0.5"
          rx="4"
        />

        {/* Eje horizontal óptimo de referencia */}
        <line
          x1={padding.left}
          y1={optRangeY.top}
          x2={padding.left + chartWidth}
          y2={optRangeY.top}
          stroke="var(--c-primary)"
          strokeDasharray="2 4"
          opacity="0.3"
        />
        <line
          x1={padding.left}
          y1={optRangeY.top + optRangeY.height}
          x2={padding.left + chartWidth}
          y2={optRangeY.top + optRangeY.height}
          stroke="var(--c-primary)"
          strokeDasharray="2 4"
          opacity="0.3"
        />

        {/* Texto del Rango Saludable */}
        <text
          x={padding.left + 8}
          y={optRangeY.top + 14}
          fill="var(--c-text)"
          fontSize="9px"
          fontWeight="bold"
          opacity="0.8"
        >
          RANGO SALUDABLE
        </text>

        {/* 2. Líneas de guía horizontales del Eje Y */}
        {yTicks.map((tick, index) => (
          <g key={index}>
            <line
              x1={padding.left}
              y1={tick.y}
              x2={padding.left + chartWidth}
              y2={tick.y}
              stroke="var(--line-light)"
              strokeWidth="1"
            />
            <text
              x={padding.left - 10}
              y={tick.y + 4}
              textAnchor="end"
              fill="var(--muted)"
              fontSize="10px"
              fontWeight="600"
            >
              {tick.display}
            </text>
          </g>
        ))}

        {/* 3. Renderizar Área Degradada y Línea Bézier */}
        {bezierPaths.area && (
          <path d={bezierPaths.area} fill={`url(#gradient-${category})`} />
        )}
        {bezierPaths.line && (
          <path
            d={bezierPaths.line}
            fill="none"
            stroke="var(--c-primary)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        )}

        {/* 4. Nodos (Círculos) para puntos de datos individuales */}
        {getCoordinates.map((point, index) => {
          if (point.y === null) return null;
          const isActive = activeIndex === index;
          return (
            <g key={index}>
              {/* Círculo base */}
              <circle
                cx={point.x}
                cy={point.y}
                r={isActive ? "6" : "4"}
                fill={isActive ? "var(--c-primary)" : "var(--panel)"}
                stroke="var(--c-primary)"
                strokeWidth={isActive ? "3" : "2"}
                style={{ transition: "all 0.1s ease-out" }}
              />
            </g>
          );
        })}

        {/* 5. Etiquetas del Eje X (Fechas) */}
        {points.map((point, index) => {
          // Mostramos fechas intercaladas para evitar colisiones si son muchos puntos
          const shouldShowLabel = points.length <= 7 || index % 2 === 0 || index === points.length - 1;
          if (!shouldShowLabel) return null;

          return (
            <text
              key={index}
              x={padding.left + index * stepX}
              y={height - padding.bottom + 18}
              textAnchor="middle"
              fill="var(--muted)"
              fontSize="9px"
              fontWeight="700"
            >
              {point.label}
            </text>
          );
        })}

        {/* 6. Indicador vertical y punto interactivo en Hover */}
        {activePoint && activePoint.y !== null && (
          <g>
            {/* Línea vertical de guía */}
            <line
              x1={activePoint.x}
              y1={padding.top}
              x2={activePoint.x}
              y2={padding.top + chartHeight}
              stroke="var(--c-primary)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              opacity="0.6"
            />
            {/* Punto indicador deslizante */}
            <circle
              cx={activePoint.x}
              cy={activePoint.y}
              r="8"
              fill="var(--c-primary)"
              stroke="var(--panel)"
              strokeWidth="2.5"
              style={{ filter: "drop-shadow(0px 2px 4px rgba(0,0,0,0.15))" }}
            />
          </g>
        )}
      </svg>
    </div>
  );
}
