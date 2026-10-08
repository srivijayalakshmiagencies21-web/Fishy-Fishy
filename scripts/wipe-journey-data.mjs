import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");

function parseEnvFile(contents) {
  const vars = {};
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

if (!fs.existsSync(envPath)) {
  console.error("Missing .env.local with NEXT_PUBLIC_SUPABASE_URL.");
  process.exit(1);
}

const envFile = parseEnvFile(fs.readFileSync(envPath, "utf8"));
const url = envFile.NEXT_PUBLIC_SUPABASE_URL?.trim();
const dbPassword = (process.env.SUPABASE_DB_PASSWORD ?? envFile.SUPABASE_DB_PASSWORD)?.trim();

if (!url || !dbPassword) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD in .env.local.");
  process.exit(1);
}

const refMatch = url.match(/https:\/\/([^.]+)\.supabase\.co/);
if (!refMatch) {
  console.error("Could not parse project ref from NEXT_PUBLIC_SUPABASE_URL.");
  process.exit(1);
}

const projectRef = refMatch[1];
const dbUrl = `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`;

const sql = "TRUNCATE TABLE public.journeys CASCADE;";

console.log(`Wiping journey data on project ${projectRef}…`);

const result = spawnSync(
  "npx",
  ["-y", "supabase", "db", "query", "--db-url", dbUrl, sql.trim()],
  { cwd: root, stdio: "inherit", env: process.env },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const count = spawnSync(
  "npx",
  [
    "-y",
    "supabase",
    "db",
    "query",
    "--db-url",
    dbUrl,
    "SELECT (SELECT count(*) FROM public.journeys) AS journeys, (SELECT count(*) FROM public.journey_trucks) AS trucks;",
  ],
  { cwd: root, encoding: "utf8", env: process.env },
);

if (count.stdout) console.log(count.stdout.trim());
console.log("Done. Clear browser localStorage keys: journey_draft, transfer_drafts, final_unload_drafts.");
