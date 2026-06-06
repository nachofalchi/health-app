import { Client } from "pg";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { assertDatabaseUrl, createPgClientOptions } from "./db-common.mjs";

function usage() {
  console.log("Usage:");
  console.log('  npm.cmd run db:query -- --sql "select now()"');
  console.log("  npm.cmd run db:query -- --file supabase/queries/example.sql");
}

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function readQueryFromFile(filePath) {
  const fullPath = resolve(process.cwd(), filePath);
  const queriesRoot = resolve(process.cwd(), "supabase", "queries");
  const relativeToQueries = relative(queriesRoot, fullPath);

  if (relativeToQueries.startsWith("..") || relativeToQueries === "") {
    throw new Error("Query files must live inside supabase/queries.");
  }

  if (!fullPath.endsWith(".sql")) {
    throw new Error("Query file must end with .sql.");
  }

  return readFileSync(fullPath, "utf8");
}

function assertReadOnlySql(sql) {
  const cleaned = sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--.*$/gm, "")
    .trim()
    .toLowerCase();

  if (!/^(select|with|explain)\b/.test(cleaned)) {
    throw new Error("db:query only allows SELECT, WITH, or EXPLAIN. Use db:migrate for SQL changes.");
  }

  if (/;[\s\S]*\S/.test(cleaned.replace(/;\s*$/, ""))) {
    throw new Error("db:query only allows one read-only SQL statement.");
  }

  if (/\b(insert|update|delete|merge|alter|create|drop|truncate|grant|revoke|vacuum|analyze|call)\b/.test(cleaned)) {
    throw new Error("db:query rejected a write or administrative SQL keyword.");
  }
}

const inlineSql = getArgValue("--sql");
const filePath = getArgValue("--file");

if ((!inlineSql && !filePath) || (inlineSql && filePath)) {
  usage();
  process.exit(1);
}

const sql = inlineSql || readQueryFromFile(filePath);
assertReadOnlySql(sql);

const client = new Client(createPgClientOptions(assertDatabaseUrl()));

try {
  await client.connect();
  const result = await client.query(sql);

  console.log(`Rows: ${result.rowCount ?? result.rows.length}`);
  console.table(result.rows);
} finally {
  await client.end();
}
