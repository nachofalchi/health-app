import { decryptToken, encryptToken } from "@/lib/token-crypto";
import { calculateScoresAndInsights } from "@/lib/scoring";
import type { SupabaseClient } from "@supabase/supabase-js";

const rollupConfigs = [
  { dataType: "steps", column: "steps" },
  { dataType: "distance", column: "distance_meters" },
  { dataType: "total-calories", column: "calories_kcal" },
  { dataType: "active-minutes", column: "active_minutes" }
] as const;

const pointDataTypes = [
  "exercise",
  "sleep",
  "weight",
  "body-fat",
  "daily-resting-heart-rate",
  "heart-rate-variability",
  "daily-oxygen-saturation",
  "daily-respiratory-rate",
  "run-vo2-max"
] as const;

export const googleHealthDataTypes = {
  rollups: rollupConfigs.map((config) => config.dataType),
  points: [...pointDataTypes]
} as const;

type StoredToken = {
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  expires_at: string | null;
};

type GoogleRefreshResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

type DataPointsResponse = {
  dataPoints?: Array<Record<string, unknown>>;
  nextPageToken?: string;
};

type SyncError = {
  dataType: string;
  operation: string;
  message: string;
};

type SyncCounters = {
  dailyMetrics: number;
  rawDatapoints: number;
  exercises: number;
  sleepSessions: number;
  bodyMeasurements: number;
  scores: number;
  insights: number;
  emptyResponses: number;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function parseDurationSeconds(value: unknown) {
  const text = readString(value);
  if (!text?.endsWith("s")) return undefined;
  return readNumber(text.slice(0, -1));
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateFromTimestamp(value?: string) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function civilDateToIso(date?: { year?: number; month?: number; day?: number }) {
  if (!date?.year || !date.month || !date.day) return null;
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function extractSource(point: Record<string, unknown>) {
  const source = asRecord(point.dataSource);
  const application = asRecord(source?.application);

  return {
    platform: readString(source?.platform),
    applicationPackageName: readString(application?.packageName),
    recordingMethod: readString(source?.recordingMethod)
  };
}

function extractPointTimes(dataType: string, point: Record<string, unknown>) {
  const weight = asRecord(point.weight);
  const bodyFat = asRecord(point.bodyFat);
  const exercise = asRecord(point.exercise);
  const sleep = asRecord(point.sleep);
  const interval = asRecord(exercise?.interval) || asRecord(sleep?.interval) || asRecord(point.interval);
  const sampleTime = asRecord(weight?.sampleTime) || asRecord(bodyFat?.sampleTime) || asRecord(point.sampleTime);
  const physicalTime = readString(sampleTime?.physicalTime);
  const startTime = readString(interval?.startTime) || physicalTime;
  const endTime = readString(interval?.endTime) || physicalTime;

  return {
    sampleTime: dataType === "exercise" || dataType === "sleep" ? startTime : physicalTime,
    intervalStart: startTime,
    intervalEnd: endTime
  };
}

function measurementGroupKey(measuredAt: string, sourcePlatform?: string, sourceApplication?: string) {
  const minute = measuredAt.slice(0, 16);
  return [minute, sourcePlatform ?? "", sourceApplication ?? ""].join("|");
}

function externalNameFor(dataType: string, point: Record<string, unknown>, times: ReturnType<typeof extractPointTimes>) {
  return (
    readString(point.name) ??
    [dataType, times.sampleTime ?? times.intervalStart ?? times.intervalEnd ?? "unknown", JSON.stringify(point).slice(0, 120)].join(":")
  );
}

function extractRollupValue(dataType: string, point: Record<string, unknown>) {
  if (dataType === "steps") return readNumber(asRecord(point.steps)?.countSum);
  if (dataType === "distance") {
    return (
      readNumber(asRecord(point.distance)?.meters) ??
      readNumber(asRecord(point.distance)?.distanceMeters) ??
      readNumber(asRecord(point.distance)?.distanceSumMeters)
    );
  }
  if (dataType === "total-calories") {
    const totalCalories = asRecord(point.totalCalories);
    return (
      readNumber(totalCalories?.kcalSum) ??
      readNumber(totalCalories?.kilocalories) ??
      readNumber(totalCalories?.caloriesKcal) ??
      readNumber(asRecord(point.caloriesBurned)?.kilocalories) ??
      readNumber(asRecord(point.caloriesBurned)?.caloriesKcal) ??
      readNumber(asRecord(point.calories)?.kilocalories)
    );
  }
  if (dataType === "active-minutes") {
    const activeMinutes = asRecord(point.activeMinutes);
    const durationMinutes = parseDurationSeconds(activeMinutes?.duration);
    return (
      readNumber(activeMinutes?.minutes) ??
      readNumber(activeMinutes?.durationMinutes) ??
      (durationMinutes !== undefined ? Math.round(durationMinutes / 60) : undefined)
    );
  }
  return undefined;
}

async function refreshAccessToken(supabase: SupabaseClient, userId: string, token: StoredToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret || !token.refresh_token_encrypted) {
    throw new Error("Google OAuth is not configured for refresh.");
  }

  const refreshToken = decryptToken(token.refresh_token_encrypted);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });

  const refreshed = (await response.json()) as GoogleRefreshResponse;

  if (!response.ok || !refreshed.access_token) {
    throw new Error(refreshed.error_description || refreshed.error || "Could not refresh Google token.");
  }

  const expiresAt = refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString() : null;

  await supabase
    .from("oauth_tokens")
    .update({
      access_token_encrypted: encryptToken(refreshed.access_token),
      expires_at: expiresAt,
      scopes: refreshed.scope?.split(" ") ?? undefined,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", userId)
    .eq("provider", "google_health");

  return refreshed.access_token;
}

async function getAccessToken(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("oauth_tokens")
    .select("access_token_encrypted, refresh_token_encrypted, expires_at")
    .eq("user_id", userId)
    .eq("provider", "google_health")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.access_token_encrypted) throw new Error("Google Health is not connected for this user.");

  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;

  if (expiresAt - Date.now() < 2 * 60 * 1000) {
    return refreshAccessToken(supabase, userId, data as StoredToken);
  }

  return decryptToken(data.access_token_encrypted);
}

async function googleHealthFetch<T>(accessToken: string, path: string, init?: RequestInit) {
  const response = await fetch(`https://health.googleapis.com/v4${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...init?.headers
    }
  });

  const payload = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };

  if (!response.ok) {
    throw new Error(payload.error?.message || `Google Health request failed: ${response.status}`);
  }

  return payload as T;
}

async function upsertRawDatapoint(
  supabase: SupabaseClient,
  userId: string,
  dataType: string,
  point: Record<string, unknown>
) {
  const source = extractSource(point);
  const times = extractPointTimes(dataType, point);
  const externalName = externalNameFor(dataType, point, times);
  const { error } = await supabase.from("raw_health_datapoints").upsert(
    {
      user_id: userId,
      provider: "google_health",
      data_type: dataType,
      external_name: externalName,
      payload_json: point,
      source_platform: source.platform ?? null,
      recording_method: source.recordingMethod ?? null,
      sample_time: times.sampleTime ?? null,
      interval_start: times.intervalStart ?? null,
      interval_end: times.intervalEnd ?? null
    },
    { onConflict: "user_id,external_name" }
  );

  if (error) throw new Error(error.message);
}

async function normalizeBodyMeasurement(
  supabase: SupabaseClient,
  userId: string,
  dataType: string,
  point: Record<string, unknown>
) {
  const externalName = readString(point.name);
  const source = extractSource(point);
  const times = extractPointTimes(dataType, point);

  if (!externalName || !times.sampleTime) return false;

  const record: Record<string, unknown> = {
    user_id: userId,
    external_name: null,
    measurement_group_key: measurementGroupKey(times.sampleTime, source.platform, source.applicationPackageName),
    measured_at: times.sampleTime,
    source_platform: source.platform ?? null,
    source_application: source.applicationPackageName ?? null,
    raw_payload_json: point,
    source_external_names: [externalName]
  };

  if (dataType === "weight") {
    const weightGrams = readNumber(asRecord(point.weight)?.weightGrams);
    if (weightGrams === undefined) return false;
    record.weight_kg = weightGrams / 1000;
  } else if (dataType === "body-fat") {
    const percentage = readNumber(asRecord(point.bodyFat)?.percentage);
    if (percentage === undefined) return false;
    record.body_fat_percentage = percentage;
  } else {
    return false;
  }

  const { error } = await supabase.from("body_measurements").upsert(record, {
    onConflict: "user_id,measurement_group_key"
  });

  if (error) throw new Error(error.message);
  return true;
}

async function normalizeExercise(supabase: SupabaseClient, userId: string, point: Record<string, unknown>) {
  const externalName = readString(point.name);
  const exercise = asRecord(point.exercise);
  const summary = asRecord(exercise?.metricsSummary);
  const source = extractSource(point);
  const times = extractPointTimes("exercise", point);

  if (!externalName || !times.intervalStart) return false;

  const { error } = await supabase.from("exercises").upsert(
    {
      user_id: userId,
      external_name: externalName,
      start_time: times.intervalStart,
      end_time: times.intervalEnd ?? null,
      display_name: readString(exercise?.displayName) ?? null,
      exercise_type: readString(exercise?.exerciseType) ?? null,
      active_duration_seconds: parseDurationSeconds(exercise?.activeDuration) ?? null,
      steps: readNumber(summary?.steps) ?? null,
      distance_meters: readNumber(summary?.distanceMillimeters)
        ? (readNumber(summary?.distanceMillimeters) as number) / 1000
        : null,
      calories_kcal: readNumber(summary?.caloriesKcal) ?? null,
      average_heart_rate: readNumber(summary?.averageHeartRateBeatsPerMinute) ?? null,
      source_platform: source.platform ?? null,
      recording_method: source.recordingMethod ?? null,
      raw_payload_json: point,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id,external_name" }
  );

  if (error) throw new Error(error.message);
  return true;
}

async function normalizeSleep(supabase: SupabaseClient, userId: string, point: Record<string, unknown>) {
  const externalName = readString(point.name);
  const sleep = asRecord(point.sleep);
  const source = extractSource(point);
  const times = extractPointTimes("sleep", point);

  if (!externalName || !times.intervalStart) return false;

  const startMs = Date.parse(times.intervalStart);
  const endMs = times.intervalEnd ? Date.parse(times.intervalEnd) : NaN;
  const durationMinutes = Number.isFinite(startMs) && Number.isFinite(endMs) ? Math.round((endMs - startMs) / 60000) : null;

  let deepMinutes: number | null = null;
  let remMinutes: number | null = null;
  let lightMinutes: number | null = null;
  let awakeMinutes: number | null = null;

  const summary = asRecord(sleep?.summary);
  if (Array.isArray(summary?.stagesSummary)) {
    for (const stage of summary.stagesSummary) {
      const stageRec = asRecord(stage);
      if (!stageRec) continue;
      const type = readString(stageRec.type);
      const mins = readNumber(stageRec.minutes) ?? readNumber(stageRec.durationMinutes);
      if (mins === undefined) continue;

      if (type === "DEEP") deepMinutes = mins;
      else if (type === "REM") remMinutes = mins;
      else if (type === "LIGHT") lightMinutes = mins;
      else if (type === "AWAKE") awakeMinutes = mins;
    }
  }

  const { error } = await supabase.from("sleep_sessions").upsert(
    {
      user_id: userId,
      external_name: externalName,
      start_time: times.intervalStart,
      end_time: times.intervalEnd ?? null,
      duration_minutes: durationMinutes,
      deep_sleep_minutes: deepMinutes,
      rem_sleep_minutes: remMinutes,
      light_sleep_minutes: lightMinutes,
      awake_minutes: awakeMinutes,
      source_platform: source.platform ?? null,
      recording_method: source.recordingMethod ?? null,
      raw_payload_json: point,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id,external_name" }
  );

  if (error) throw new Error(error.message);

  if (durationMinutes) {
    const date = dateFromTimestamp(times.intervalEnd ?? times.intervalStart);
    if (date) {
      await supabase.from("daily_metrics").upsert(
        {
          user_id: userId,
          date,
          sleep_minutes: durationMinutes,
          deep_sleep_minutes: deepMinutes,
          rem_sleep_minutes: remMinutes,
          light_sleep_minutes: lightMinutes,
          awake_minutes: awakeMinutes,
          updated_at: new Date().toISOString()
        },
        { onConflict: "user_id,date" }
      );
    }
  }

  return true;
}

async function normalizeVitals(
  supabase: SupabaseClient,
  userId: string,
  dataType: string,
  point: Record<string, unknown>
) {
  const oxygenSaturation = asRecord(point.dailyOxygenSaturation);
  const respiratoryRate = asRecord(point.dailyRespiratoryRate);
  const restingHeartRate = asRecord(point.dailyRestingHeartRate) || asRecord(point.restingHeartRate);
  const hrvObj = asRecord(point.heartRateVariability) || asRecord(point.hrv);

  let date: string | null = null;
  if (oxygenSaturation?.date) {
    date = civilDateToIso(asRecord(oxygenSaturation.date) as any);
  } else if (respiratoryRate?.date) {
    date = civilDateToIso(asRecord(respiratoryRate.date) as any);
  } else if (restingHeartRate?.date) {
    date = civilDateToIso(asRecord(restingHeartRate.date) as any);
  } else if (hrvObj?.sampleTime) {
    const sampleTime = asRecord(hrvObj.sampleTime);
    const physicalTime = readString(sampleTime?.physicalTime);
    date = dateFromTimestamp(physicalTime);
  } else {
    const times = extractPointTimes(dataType, point);
    date = dateFromTimestamp(times.sampleTime ?? times.intervalStart);
  }

  if (!date) return false;

  let column: "resting_hr" | "hrv" | "spo2" | "respiratory_rate" | "vo2max" | null = null;
  let value: number | undefined;

  if (dataType === "daily-resting-heart-rate") {
    column = "resting_hr";
    value =
      readNumber(asRecord(point.dailyRestingHeartRate)?.beatsPerMinute) ??
      readNumber(asRecord(point.restingHeartRate)?.beatsPerMinute) ??
      readNumber(point.beatsPerMinute);
  }

  if (dataType === "heart-rate-variability") {
    column = "hrv";
    value =
      readNumber(asRecord(point.heartRateVariability)?.rootMeanSquareOfSuccessiveDifferencesMilliseconds) ??
      readNumber(asRecord(point.heartRateVariability)?.rmssdMillis) ??
      readNumber(asRecord(point.hrv)?.rmssdMillis) ??
      readNumber(point.rmssdMillis);
  }

  if (dataType === "daily-oxygen-saturation") {
    column = "spo2";
    const oxygenSaturation = asRecord(point.dailyOxygenSaturation);
    value =
      readNumber(oxygenSaturation?.average_percentage) ??
      readNumber(oxygenSaturation?.averagePercentage);
  }

  if (dataType === "daily-respiratory-rate") {
    column = "respiratory_rate";
    const respiratoryRate = asRecord(point.dailyRespiratoryRate);
    value =
      readNumber(respiratoryRate?.breaths_per_minute) ??
      readNumber(respiratoryRate?.breathsPerMinute);
  }

  if (dataType === "run-vo2-max") {
    column = "vo2max";
    const runVo2Max = asRecord(point.runVo2Max);
    value =
      readNumber(runVo2Max?.runVo2Max) ??
      readNumber(runVo2Max?.vo2Max) ??
      readNumber(runVo2Max?.value);
  }

  if (!column || value === undefined) return false;

  const { error } = await supabase.from("daily_metrics").upsert(
    {
      user_id: userId,
      date,
      [column]: value,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id,date" }
  );

  if (error) throw new Error(error.message);
  return true;
}

async function syncRollup(
  supabase: SupabaseClient,
  accessToken: string,
  userId: string,
  config: (typeof rollupConfigs)[number],
  start: Date,
  end: Date
) {
  const payload = await googleHealthFetch<{ rollupDataPoints?: Array<Record<string, unknown>> }>(
    accessToken,
    `/users/me/dataTypes/${config.dataType}/dataPoints:dailyRollUp`,
    {
      method: "POST",
      body: JSON.stringify({
        range: {
          start: { date: { year: start.getUTCFullYear(), month: start.getUTCMonth() + 1, day: start.getUTCDate() } },
          end: { date: { year: end.getUTCFullYear(), month: end.getUTCMonth() + 1, day: end.getUTCDate() } }
        },
        windowSizeDays: 1
      })
    }
  );

  let count = 0;

  for (const point of payload.rollupDataPoints ?? []) {
    const date = civilDateToIso(asRecord(asRecord(point.civilStartTime)?.date) as { year?: number; month?: number; day?: number });
    const value = extractRollupValue(config.dataType, point);

    if (!date || value === undefined) continue;

    const { error } = await supabase.from("daily_metrics").upsert(
      {
        user_id: userId,
        date,
        [config.column]: value,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id,date" }
    );

    if (error) throw new Error(error.message);
    count += 1;
  }

  return { count, empty: !payload.rollupDataPoints?.length };
}

async function syncPointDataType(
  supabase: SupabaseClient,
  accessToken: string,
  userId: string,
  dataType: string
) {
  let pageToken: string | undefined;
  let pageCount = 0;
  const counters = { raw: 0, body: 0, exercises: 0, sleep: 0, vitals: 0, empty: 0 };

  do {
    const query = new URLSearchParams({ pageSize: "100" });
    if (pageToken) query.set("pageToken", pageToken);

    const payload = await googleHealthFetch<DataPointsResponse>(
      accessToken,
      `/users/me/dataTypes/${dataType}/dataPoints?${query.toString()}`
    );

    if (!payload.dataPoints?.length) counters.empty += 1;

    for (const point of payload.dataPoints ?? []) {
      await upsertRawDatapoint(supabase, userId, dataType, point);
      counters.raw += 1;

      if ((dataType === "weight" || dataType === "body-fat") && (await normalizeBodyMeasurement(supabase, userId, dataType, point))) {
        counters.body += 1;
      }
      if (dataType === "exercise" && (await normalizeExercise(supabase, userId, point))) counters.exercises += 1;
      if (dataType === "sleep" && (await normalizeSleep(supabase, userId, point))) counters.sleep += 1;
      if (
        (dataType === "daily-resting-heart-rate" ||
          dataType === "heart-rate-variability" ||
          dataType === "daily-oxygen-saturation" ||
          dataType === "daily-respiratory-rate" ||
          dataType === "run-vo2-max") &&
        (await normalizeVitals(supabase, userId, dataType, point))
      ) {
        counters.vitals += 1;
      }
    }

    pageToken = payload.nextPageToken;
    pageCount += 1;
  } while (pageToken && pageCount < 10);

  return counters;
}

export async function syncGoogleHealth(supabase: SupabaseClient, userId: string) {
  const startedAt = new Date();
  const end = new Date();
  const rollupEnd = new Date(end);
  rollupEnd.setUTCDate(rollupEnd.getUTCDate() + 1);
  const start = new Date(end);
  start.setDate(end.getDate() - 7);
  const counters: SyncCounters = {
    dailyMetrics: 0,
    rawDatapoints: 0,
    exercises: 0,
    sleepSessions: 0,
    bodyMeasurements: 0,
    scores: 0,
    insights: 0,
    emptyResponses: 0
  };
  const errors: SyncError[] = [];

  try {
    const accessToken = await getAccessToken(supabase, userId);

    for (const config of rollupConfigs) {
      try {
        const result = await syncRollup(supabase, accessToken, userId, config, start, rollupEnd);
        counters.dailyMetrics += result.count;
        if (result.empty) counters.emptyResponses += 1;
      } catch (error) {
        errors.push({
          dataType: config.dataType,
          operation: "dailyRollUp",
          message: error instanceof Error ? error.message : "Unknown rollup error"
        });
      }
    }

    for (const dataType of pointDataTypes) {
      try {
        const result = await syncPointDataType(supabase, accessToken, userId, dataType);
        counters.rawDatapoints += result.raw;
        counters.bodyMeasurements += result.body;
        counters.exercises += result.exercises;
        counters.sleepSessions += result.sleep;
        counters.dailyMetrics += result.vitals;
        counters.emptyResponses += result.empty;
      } catch (error) {
        errors.push({
          dataType,
          operation: "dataPoints",
          message: error instanceof Error ? error.message : "Unknown dataPoints error"
        });
      }
    }

    try {
      const derived = await calculateScoresAndInsights(supabase, userId);
      counters.scores += derived.scores;
      counters.insights += derived.insights;
    } catch (error) {
      errors.push({
        dataType: "derived",
        operation: "scores_and_insights",
        message: error instanceof Error ? error.message : "Unknown derived error"
      });
    }

    const status = errors.length ? "partial" : "success";
    await supabase.from("sync_runs").insert({
      user_id: userId,
      provider: "google_health",
      status,
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      date_start: isoDate(start),
      date_end: isoDate(rollupEnd),
      daily_metrics_upserted: counters.dailyMetrics,
      raw_datapoints_upserted: counters.rawDatapoints,
      exercises_upserted: counters.exercises,
      sleep_sessions_upserted: counters.sleepSessions,
      body_measurements_upserted: counters.bodyMeasurements,
      scores_upserted: counters.scores,
      insights_upserted: counters.insights,
      empty_responses: counters.emptyResponses,
      results_json: {
        dataTypes: [...googleHealthDataTypes.rollups, ...googleHealthDataTypes.points],
        counters
      },
      errors_json: errors
    });

    return {
      status,
      dateRange: {
        start: isoDate(start),
        end: isoDate(rollupEnd)
      },
      dataTypes: [...googleHealthDataTypes.rollups, ...googleHealthDataTypes.points],
      errors,
      ...counters
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync failure";
    await supabase.from("sync_runs").insert({
      user_id: userId,
      provider: "google_health",
      status: "failed",
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      date_start: isoDate(start),
      date_end: isoDate(rollupEnd),
      errors_json: [{ dataType: "auth", operation: "sync", message }]
    });
    throw error;
  }
}
