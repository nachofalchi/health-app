import { Client } from "pg";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { assertDatabaseUrl, createPgClientOptions } from "./db-common.mjs";

function usage() {
  console.log("Usage:");
  console.log("  npm.cmd run db:migrate -- supabase/005_cleanup_sync_quality.sql");
}

const filePath = process.argv[2];

if (!filePath) {
  usage();
  process.exit(1);
}

const fullPath = resolve(process.cwd(), filePath);
const migrationsRoot = resolve(process.cwd(), "supabase");
const relativeToMigrations = relative(migrationsRoot, fullPath);

if (relativeToMigrations.startsWith("..") || relativeToMigrations === "") {
  throw new Error("Migration files must live inside supabase/.");
}

if (!fullPath.endsWith(".sql")) {
  throw new Error("Migration file must end with .sql.");
}

const sql = readFileSync(fullPath, "utf8");
const client = new Client(createPgClientOptions(assertDatabaseUrl()));

try {
  console.log(`Applying ${relativeToMigrations}...`);
  await client.connect();
  await client.query(sql);
  console.log("Migration applied.");
} finally {
  await client.end();
}
