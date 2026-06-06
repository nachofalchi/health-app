/**
 * Shared TypeScript types for the Salud Nacho health app.
 * Import from this file instead of defining types inline in individual modules.
 */

export type DailyMetric = {
  date: string;
  steps: number | null;
  distance_meters: number | null;
  calories_kcal: number | null;
  active_minutes: number | null;
  sleep_minutes: number | null;
  resting_hr: number | null;
  hrv: number | null;
  spo2: number | null;
  respiratory_rate: number | null;
  deep_sleep_minutes: number | null;
  rem_sleep_minutes: number | null;
  light_sleep_minutes: number | null;
  awake_minutes: number | null;
  vo2max: number | null;
};

export type BodyMeasurement = {
  measured_at: string;
  weight_kg: number | null;
  body_fat_percentage: number | null;
  muscle_mass_kg: number | null;
  water_percentage: number | null;
  neck_cm: number | null;
  shoulders_chest_cm: number | null;
  arm_right_relaxed_cm: number | null;
  arm_right_contracted_cm: number | null;
  arm_left_relaxed_cm: number | null;
  arm_left_contracted_cm: number | null;
  waist_cm: number | null;
  abdomen_cm: number | null;
  hips_cm: number | null;
  thigh_right_cm: number | null;
  thigh_left_cm: number | null;
  calf_right_cm: number | null;
  calf_left_cm: number | null;
  source_platform: string | null;
};

export type Exercise = {
  start_time: string;
  end_time: string | null;
  display_name: string | null;
  exercise_type: string | null;
  active_duration_seconds: number | null;
  steps: number | null;
  distance_meters: number | null;
  calories_kcal: number | null;
  average_heart_rate: number | null;
  source_platform: string | null;
};

export type SleepSession = {
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  deep_sleep_minutes: number | null;
  rem_sleep_minutes: number | null;
  light_sleep_minutes: number | null;
  awake_minutes: number | null;
  source_platform: string | null;
};

export type ManualLog = {
  date: string;
  energy_score: number | null;
  mood_score: number | null;
  stress_score: number | null;
  caffeine_consumed: boolean | null;
  caffeine_amount: number | null;
  last_caffeine_time: string | null;
  alcohol_level: string | null;
  keto_adherence: string | null;
  heavy_meal_at_night: boolean | null;
  notes: string | null;
};

export type BloodPressure = {
  measured_at: string;
  systolic: number;
  diastolic: number;
  pulse: number | null;
};

export type ScoreRow = {
  date: string;
  recovery_score: number | null;
  sleep_score: number | null;
  training_score: number | null;
  cardiovascular_score: number | null;
  body_composition_score: number | null;
  wellbeing_score: number | null;
  overall_score: number | null;
  calculation_version?: string | null;
  explanation_json?: any | null;
  health_index?: number | null;
  daily_readiness?: number | null;
  body_progress?: number | null;
};

export type InsightRow = {
  title: string;
  explanation: string;
  recommendation: string | null;
  confidence: "low" | "medium" | "high";
  category?: string;
  date?: string;
};

export type SyncRun = {
  id?: string;
  provider?: string;
  status: string;
  started_at?: string | null;
  finished_at: string | null;
  date_start?: string | null;
  date_end?: string | null;
  daily_metrics_upserted: number;
  raw_datapoints_upserted: number;
  exercises_upserted: number;
  sleep_sessions_upserted: number;
  body_measurements_upserted: number;
  scores_upserted?: number;
  insights_upserted?: number;
  empty_responses: number;
  errors_json: Array<{ dataType?: string; operation?: string; message?: string }> | null;
};

export type Experiment = {
  id: string;
  title: string;
  hypothesis: string | null;
  metric: string;
  baseline_start: string;
  intervention_start: string;
  intervention_end: string | null;
  result_json: unknown;
  confidence: string | null;
  avgBaseline: number | null;
  avgIntervention: number | null;
  pctChange: number;
  summary: string;
  status: "positive" | "negative" | "neutral";
  active: boolean;
};

export type SectorCard = {
  name: string;
  score: number;
  state: string;
  tone: string;
  history?: number[];
};

export type DashboardDay = {
  overall: number;
  status: string;
  summary: string;
  trainingRecommendation: string;
  insights: Array<{ title: string; body: string; confidence: string }>;
};

export type Anomaly = {
  title: string;
  body: string;
  severity: "warning" | "danger";
};
