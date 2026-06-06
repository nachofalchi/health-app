import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvValue(key) {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      if (line.trim().startsWith(`${key}=`)) {
        return line.split("=")[1].trim();
      }
    }
  } catch {}
  return null;
}

async function run() {
  const secret = loadEnvValue("SYNC_SECRET");
  console.log("Triggering sync via API...");
  
  const headers = {
    "content-type": "application/json"
  };
  if (secret) {
    headers["authorization"] = `Bearer ${secret}`;
  }

  try {
    const response = await fetch("http://localhost:3000/api/sync/google-health", {
      method: "POST",
      headers
    });
    
    const payload = await response.json();
    console.log("Response Status:", response.status);
    console.dir(payload, { depth: null });
  } catch (error) {
    console.error("Fetch error:", error.message);
  }
}

run();
