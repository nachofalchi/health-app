export type ManualLogInput = {
  local_date?: string;
  systolic?: number;
  diastolic?: number;
  pulse?: number;
  weight_kg?: number;
  body_fat_percentage?: number;
  muscle_mass_kg?: number;
  water_percentage?: number;
  neck_cm?: number;
  shoulders_chest_cm?: number;
  arm_right_relaxed_cm?: number;
  arm_right_contracted_cm?: number;
  arm_left_relaxed_cm?: number;
  arm_left_contracted_cm?: number;
  waist_cm?: number;
  abdomen_cm?: number;
  hips_cm?: number;
  thigh_right_cm?: number;
  thigh_left_cm?: number;
  calf_right_cm?: number;
  calf_left_cm?: number;
  energy_score?: number;
  mood_score?: number;
  stress_score?: number;
  caffeine_consumed: boolean;
  caffeine_amount?: number;
  last_caffeine_time?: string;
  alcohol_level?: string;
  keto_adherence: boolean;
  heavy_meal_at_night: boolean;
  pain_present: boolean;
  notes?: string;
};

function optionalNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalString(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  return value.trim();
}

export function parseManualLog(formData: FormData): ManualLogInput {
  return {
    local_date: optionalString(formData.get("local_date")),
    systolic: optionalNumber(formData.get("systolic")),
    diastolic: optionalNumber(formData.get("diastolic")),
    pulse: optionalNumber(formData.get("pulse")),
    weight_kg: optionalNumber(formData.get("weight_kg")),
    body_fat_percentage: optionalNumber(formData.get("body_fat_percentage")),
    muscle_mass_kg: optionalNumber(formData.get("muscle_mass_kg")),
    water_percentage: optionalNumber(formData.get("water_percentage")),
    neck_cm: optionalNumber(formData.get("neck_cm")),
    shoulders_chest_cm: optionalNumber(formData.get("shoulders_chest_cm")),
    arm_right_relaxed_cm: optionalNumber(formData.get("arm_right_relaxed_cm")),
    arm_right_contracted_cm: optionalNumber(formData.get("arm_right_contracted_cm")),
    arm_left_relaxed_cm: optionalNumber(formData.get("arm_left_relaxed_cm")),
    arm_left_contracted_cm: optionalNumber(formData.get("arm_left_contracted_cm")),
    waist_cm: optionalNumber(formData.get("waist_cm")),
    abdomen_cm: optionalNumber(formData.get("abdomen_cm")),
    hips_cm: optionalNumber(formData.get("hips_cm")),
    thigh_right_cm: optionalNumber(formData.get("thigh_right_cm")),
    thigh_left_cm: optionalNumber(formData.get("thigh_left_cm")),
    calf_right_cm: optionalNumber(formData.get("calf_right_cm")),
    calf_left_cm: optionalNumber(formData.get("calf_left_cm")),
    energy_score: optionalNumber(formData.get("energy_score")),
    mood_score: optionalNumber(formData.get("mood_score")),
    stress_score: optionalNumber(formData.get("stress_score")),
    caffeine_consumed: formData.get("caffeine_consumed") === "true",
    caffeine_amount: optionalNumber(formData.get("caffeine_amount")),
    last_caffeine_time: optionalString(formData.get("last_caffeine_time")),
    alcohol_level: optionalString(formData.get("alcohol_level")) ?? "none",
    keto_adherence: formData.get("keto_adherence") === "true",
    heavy_meal_at_night: formData.get("heavy_meal_at_night") === "true",
    pain_present: formData.get("pain_present") === "true",
    notes: typeof formData.get("notes") === "string" ? String(formData.get("notes")).trim() : undefined
  };
}

