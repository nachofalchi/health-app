import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path) {
  try {
    const content = readFileSync(path, "utf8");

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // The script can still work with real process env vars.
  }
}

function mask(value) {
  if (!value) return "missing";
  if (value.length <= 12) return "set";
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

async function countRows(supabase, table) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });

  if (error) {
    return { table, ok: false, error: error.message };
  }

  return { table, ok: true, count };
}

async function latestRows(supabase, table, columns, orderBy = "created_at") {
  const { data, error } = await supabase.from(table).select(columns).order(orderBy, { ascending: false }).limit(5);

  if (error) {
    return { table, ok: false, error: error.message };
  }

  return { table, ok: true, rows: data };
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

console.log("Supabase diagnostics");
console.log(`- URL: ${supabaseUrl || "missing"}`);
console.log(`- Service key: ${mask(serviceKey)}`);

if (!supabaseUrl || !serviceKey) {
  console.log("\nMissing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY in .env.local.");
  console.log("Add the Supabase secret/service-role key locally, then rerun: npm.cmd run db:check");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const tables = [
  "profiles",
  "oauth_tokens",
  "daily_metrics",
  "raw_health_datapoints",
  "body_measurements",
  "exercises",
  "sleep_sessions",
  "blood_pressure_measurements",
  "manual_daily_logs",
  "symptoms",
  "scores",
  "insights",
  "sync_runs"
];

console.log("\nTable counts");
for (const result of await Promise.all(tables.map((table) => countRows(supabase, table)))) {
  if (result.ok) {
    console.log(`- ${result.table}: ${result.count}`);
  } else {
    console.log(`- ${result.table}: ERROR ${result.error}`);
  }
}

console.log("\nLatest daily metrics");
console.dir(await latestRows(supabase, "daily_metrics", "date,steps,resting_hr,hrv,sleep_minutes,spo2,respiratory_rate,vo2max,deep_sleep_minutes,rem_sleep_minutes,light_sleep_minutes,awake_minutes,updated_at", "date"), {
  depth: null
});

console.log("\nLatest raw datapoints");
console.dir(await latestRows(supabase, "raw_health_datapoints", "data_type,external_name,source_platform,recording_method,sample_time,interval_start,interval_end,created_at"), {
  depth: null
});

console.log("\nLatest body measurements");
const bodyMeasurementResult = await latestRows(
  supabase,
  "body_measurements",
  "measured_at,weight_kg,body_fat_percentage,source_platform,source_application,measurement_group_key,source_external_names,created_at",
  "measured_at"
);

if (bodyMeasurementResult.ok) {
  console.dir(bodyMeasurementResult, { depth: null });
} else {
  console.dir(
    await latestRows(
      supabase,
      "body_measurements",
      "measured_at,weight_kg,body_fat_percentage,source_platform,source_application,created_at",
      "measured_at"
    ),
    { depth: null }
  );
}

console.log("\nLatest exercises");
console.dir(
  await latestRows(
    supabase,
    "exercises",
    "start_time,display_name,exercise_type,active_duration_seconds,steps,distance_meters,calories_kcal,average_heart_rate,source_platform",
    "start_time"
  ),
  { depth: null }
);

console.log("\nLatest sync runs");
console.dir(
  await latestRows(
    supabase,
    "sync_runs",
    "status,finished_at,daily_metrics_upserted,raw_datapoints_upserted,exercises_upserted,sleep_sessions_upserted,body_measurements_upserted,scores_upserted,insights_upserted,empty_responses,errors_json",
    "started_at"
  ),
  { depth: null }
);
