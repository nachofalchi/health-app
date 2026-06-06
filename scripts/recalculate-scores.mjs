import { Client } from "pg";
import { assertDatabaseUrl, createPgClientOptions } from "./db-common.mjs";

// Import math/scoring logic directly to avoid server-only next.js import errors
function scoreFromSteps(steps) {
  if (steps === null || steps === undefined) return null;
  return Math.max(35, Math.min(95, Math.round((steps / 10000) * 82)));
}

function scoreFromSleep(minutes) {
  if (minutes === null || minutes === undefined) return null;
  if (minutes >= 420 && minutes <= 540) return 82;
  if (minutes >= 360) return 68;
  return 48;
}

function scoreFromHRV(hrv) {
  if (hrv === null || hrv === undefined) return null;
  if (hrv >= 60) return 88;
  if (hrv >= 40) return 72;
  if (hrv >= 25) return 58;
  return 42;
}

function scoreFromRestingHR(hr) {
  if (hr === null || hr === undefined) return null;
  if (hr <= 55) return 85;
  if (hr <= 65) return 72;
  if (hr <= 75) return 58;
  return 42;
}

function calculateOverallScore(scores) {
  const valid = scores.filter((s) => typeof s === "number" && s !== null && !isNaN(s));
  if (!valid.length) return null;
  return Math.round(valid.reduce((sum, s) => sum + s, 0) / valid.length);
}

async function run() {
  const dbUrl = assertDatabaseUrl();
  const client = new Client(createPgClientOptions(dbUrl));
  await client.connect();
  console.log("Connected to PostgreSQL database!");

  // Get user Nacho
  const userQuery = await client.query("select id, email from profiles order by created_at limit 1");
  if (userQuery.rows.length === 0) {
    console.error("No profiles found.");
    process.exit(1);
  }
  const userId = userQuery.rows[0].id;
  const email = userQuery.rows[0].email;
  console.log(`Recalculating scores for user ${email} (${userId})`);

  // Fetch all daily metrics for the user to know which dates to score
  const metricsResult = await client.query(
    "select date, steps, sleep_minutes, resting_hr, hrv from daily_metrics where user_id = $1 order by date asc",
    [userId]
  );
  console.log(`Found ${metricsResult.rows.length} dates with metrics.`);

  for (let i = 0; i < metricsResult.rows.length; i++) {
    const targetRow = metricsResult.rows[i];
    // format date to YYYY-MM-DD
    const targetDateObj = new Date(targetRow.date);
    const targetDate = targetDateObj.toISOString().slice(0, 10);

    const latest = targetRow;

    // Get latest body measurement up to targetDate
    const bodyResult = await client.query(
      "select measured_at, weight_kg, body_fat_percentage from body_measurements where user_id = $1 and measured_at <= $2 order by measured_at desc limit 1",
      [userId, targetDate + "T23:59:59Z"]
    );
    const bodyRows = bodyResult.rows;

    // Get latest manual log up to targetDate
    const manualResult = await client.query(
      "select date, energy_score, mood_score, stress_score from manual_daily_logs where user_id = $1 and date <= $2 order by date desc limit 1",
      [userId, targetDate]
    );
    const manualLogs = manualResult.rows;

    const activityScore = scoreFromSteps(latest.steps);
    const sleepScore = scoreFromSleep(latest.sleep_minutes);
    const compositionScore = bodyRows.length ? 70 : null;
    const cardiovascularScore = scoreFromRestingHR(latest.resting_hr);
    const hrvScore = scoreFromHRV(latest.hrv);

    const recoveryParts = [sleepScore, hrvScore].filter((v) => v !== null);
    const recoveryScore = recoveryParts.length > 0
      ? Math.round(recoveryParts.reduce((a, b) => a + b, 0) / recoveryParts.length)
      : null;

    const latestManual = manualLogs[0];
    const subjectiveScore =
      latestManual?.energy_score && latestManual?.mood_score
        ? Math.round(((latestManual.energy_score + latestManual.mood_score) / 2) * 20)
        : null;
    const stressModifier =
      latestManual?.stress_score && latestManual.stress_score >= 4 ? -10 : 0;
    const wellbeingScore = subjectiveScore !== null
      ? Math.max(25, Math.min(90, subjectiveScore + stressModifier))
      : null;

    const overallScore = calculateOverallScore([
      activityScore,
      sleepScore,
      compositionScore,
      cardiovascularScore,
      recoveryScore,
      wellbeingScore
    ]);

    console.log(`Date: ${targetDate} | overall: ${overallScore} | sleep: ${sleepScore} | recovery: ${recoveryScore} | cardio: ${cardiovascularScore}`);

    // Upsert score
    await client.query(`
      insert into scores (
        user_id, date, recovery_score, sleep_score, training_score,
        cardiovascular_score, body_composition_score, wellbeing_score, overall_score,
        calculation_version, explanation_json
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'v1_nullsafe', $10)
      on conflict (user_id, date) do update
      set recovery_score = $3,
          sleep_score = $4,
          training_score = $5,
          cardiovascular_score = $6,
          body_composition_score = $7,
          wellbeing_score = $8,
          overall_score = $9,
          calculation_version = 'v1_nullsafe',
          explanation_json = $10
    `, [
      userId,
      targetDate,
      recoveryScore,
      sleepScore,
      activityScore,
      cardiovascularScore,
      compositionScore,
      wellbeingScore,
      overallScore,
      JSON.stringify({
        steps: latest.steps,
        sleep_minutes: latest.sleep_minutes,
        resting_hr: latest.resting_hr,
        hrv: latest.hrv,
        energy_score: latestManual?.energy_score,
        mood_score: latestManual?.mood_score,
        stress_score: latestManual?.stress_score
      })
    ]);
  }

  console.log("Scores recalculation complete!");
  await client.end();
}

run().catch(console.error);
