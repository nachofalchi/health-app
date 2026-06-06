import { Client } from "pg";
import { assertDatabaseUrl, createPgClientOptions } from "./db-common.mjs";

function civilDateToIso(date) {
  if (!date?.year || !date.month || !date.day) return null;
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function dateFromTimestamp(value) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

async function run() {
  const dbUrl = assertDatabaseUrl();
  const client = new Client(createPgClientOptions(dbUrl));
  await client.connect();
  console.log("Connected to PostgreSQL database!");

  // Fetch raw daily-resting-heart-rate and heart-rate-variability points
  const query = `
    select id, user_id, data_type, payload_json
    from raw_health_datapoints
    where data_type in ('daily-resting-heart-rate', 'heart-rate-variability')
  `;
  const result = await client.query(query);
  console.log(`Found ${result.rows.length} raw datapoints.`);

  // Group by user_id and date
  const groups = {}; // key: "userId|date", value: { restingHrs: [], hrvs: [] }

  for (const row of result.rows) {
    const { user_id, data_type, payload_json } = row;
    let date = null;
    let value = null;

    if (data_type === "daily-resting-heart-rate") {
      const resting = payload_json.dailyRestingHeartRate || payload_json.restingHeartRate;
      if (resting?.date) {
        date = civilDateToIso(resting.date);
      }
      value = Number(resting?.beatsPerMinute || payload_json.beatsPerMinute);
      
      if (date && value && !isNaN(value)) {
        const key = `${user_id}|${date}`;
        if (!groups[key]) groups[key] = { restingHrs: [], hrvs: [] };
        groups[key].restingHrs.push(value);
      }
    } else if (data_type === "heart-rate-variability") {
      const hrvObj = payload_json.heartRateVariability || payload_json.hrv;
      if (hrvObj?.sampleTime?.physicalTime) {
        date = dateFromTimestamp(hrvObj.sampleTime.physicalTime);
      }
      value = Number(hrvObj?.rootMeanSquareOfSuccessiveDifferencesMilliseconds || hrvObj?.rmssdMillis || payload_json.rmssdMillis);

      if (date && value && !isNaN(value)) {
        const key = `${user_id}|${date}`;
        if (!groups[key]) groups[key] = { restingHrs: [], hrvs: [] };
        groups[key].hrvs.push(value);
      }
    }
  }

  let upsertCount = 0;
  for (const [key, data] of Object.entries(groups)) {
    const [user_id, date] = key.split("|");
    const avgRestingHr = data.restingHrs.length > 0
      ? Math.round(data.restingHrs.reduce((a, b) => a + b, 0) / data.restingHrs.length)
      : null;
    const avgHrv = data.hrvs.length > 0
      ? Math.round(data.hrvs.reduce((a, b) => a + b, 0) / data.hrvs.length)
      : null;

    console.log(`Aggregated date ${date} for user ${user_id}: resting_hr=${avgRestingHr}, hrv=${avgHrv}`);

    if (avgRestingHr !== null && avgHrv !== null) {
      await client.query(`
        insert into daily_metrics (user_id, date, resting_hr, hrv, updated_at)
        values ($1, $2, $3, $4, now())
        on conflict (user_id, date) do update
        set resting_hr = $3, hrv = $4, updated_at = now()
      `, [user_id, date, avgRestingHr, avgHrv]);
    } else if (avgRestingHr !== null) {
      await client.query(`
        insert into daily_metrics (user_id, date, resting_hr, updated_at)
        values ($1, $2, $3, now())
        on conflict (user_id, date) do update
        set resting_hr = $3, updated_at = now()
      `, [user_id, date, avgRestingHr]);
    } else if (avgHrv !== null) {
      await client.query(`
        insert into daily_metrics (user_id, date, hrv, updated_at)
        values ($1, $2, $3, now())
        on conflict (user_id, date) do update
        set hrv = $3, updated_at = now()
      `, [user_id, date, avgHrv]);
    }
    upsertCount++;
  }

  console.log(`Successfully backfilled and aggregated ${upsertCount} daily metric rows!`);
  await client.end();
}

run().catch(console.error);
