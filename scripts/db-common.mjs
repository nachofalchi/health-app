import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadEnvFile(path = resolve(process.cwd(), ".env.local")) {
  try {
    const content = readFileSync(path, "utf8");

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Real process env vars are enough when .env.local is absent.
  }
}

export function getDatabaseUrl() {
  loadEnvFile();
  return process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
}

export function assertDatabaseUrl() {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    console.error("Missing SUPABASE_DB_URL or DATABASE_URL in .env.local.");
    console.error("Use Supabase Project Settings > Database > Connection string.");
    process.exit(1);
  }

  return databaseUrl;
}

export function createPgClientOptions(connectionString) {
  return {
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  };
}
