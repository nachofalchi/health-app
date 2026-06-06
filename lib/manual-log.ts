export type ManualLogInput = {
  local_date?: string;
  systolic?: number;
  diastolic?: number;
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
