export const demoDay = {
  overall: 72,
  status: "Buen estado general",
  summary:
    "Estás funcional, con recuperación moderada. La app prioriza tendencias personales y evita conclusiones médicas automáticas.",
  trainingRecommendation: "Moderado",
  insights: [
    {
      title: "Recuperación algo justa",
      body:
        "HRV bajo baseline y frecuencia en reposo algo elevada suelen sugerir fatiga o estrés fisiológico. Hoy conviene evitar máximos.",
      confidence: "media"
    },
    {
      title: "Presión pendiente",
      body:
        "No hay medición reciente cargada. Una toma en condiciones similares mejora mucho el score cardiovascular semanal.",
      confidence: "baja"
    },
    {
      title: "Baseline en aprendizaje",
      body:
        "Durante las primeras 4 a 6 semanas los promedios móviles pesan más que los patrones complejos.",
      confidence: "alta"
    }
  ]
};

export const sectorCards = [
  { name: "Recuperación", score: 64, state: "moderada", tone: "watch", history: [58, 62, 60, 65, 63, 62, 64] },
  { name: "Sueño", score: 78, state: "bueno", tone: "good", history: [70, 72, 75, 68, 74, 80, 78] },
  { name: "Entrenamiento", score: 70, state: "estable", tone: "good", history: [65, 68, 70, 72, 68, 69, 70] },
  { name: "Cardiovascular", score: 82, state: "bien", tone: "good", history: [80, 81, 80, 83, 82, 81, 82] },
  { name: "Composición", score: 68, state: "estable", tone: "watch", history: [68, 68, 68, 68, 68, 68, 68] }
];

export const weeklySummary = [
  { label: "Recuperación promedio", value: "68" },
  { label: "Sueño promedio", value: "7 h 12 m" },
  { label: "Pasos promedio", value: "7.840" },
  { label: "Presión reciente", value: "sin dato" }
];
