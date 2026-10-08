import { execSync, spawnSync } from "node:child_process";
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
if (!url) {
  console.error("NEXT_PUBLIC_SUPABASE_URL not found in .env.local.");
  process.exit(1);
}

const refMatch = url.match(/https:\/\/([^.]+)\.supabase\.co/);
if (!refMatch) {
  console.error("Could not parse project ref from NEXT_PUBLIC_SUPABASE_URL.");
  process.exit(1);
}

const projectRef = refMatch[1];
const linkedRefPath = path.join(root, "supabase", ".temp", "project-ref");
const dbPassword = (process.env.SUPABASE_DB_PASSWORD ?? envFile.SUPABASE_DB_PASSWORD)?.trim();

function run(cmd) {
  execSync(cmd, { cwd: root, stdio: "inherit" });
}

function pushViaDbUrl(password) {
  const dbUrl = `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;
  console.log("Pushing migrations via direct database connection…");
  const push = spawnSync(
    "npx",
    ["supabase", "db", "push", "--db-url", dbUrl, "--yes"],
    { cwd: root, stdio: "inherit", env: process.env },
  );
  return push.status ?? 1;
}

function privilegeHint() {
  console.error(`
Link failed: your Supabase CLI login does not have dashboard access to project "${projectRef}".

Add the database password to .env.local (Project Settings → Database), then run:

  npm run db:push
`);
}

if (dbPassword) {
  process.exit(pushViaDbUrl(dbPassword));
}

try {
  execSync("npx supabase projects list", { cwd: root, stdio: "pipe" });
} catch {
  console.error(
    "\nNot logged in and no SUPABASE_DB_PASSWORD in .env.local.\n\n  Add SUPABASE_DB_PASSWORD=... to .env.local, or run: npm run supabase:login\n",
  );
  process.exit(1);
}

const linked =
  fs.existsSync(linkedRefPath) && fs.readFileSync(linkedRefPath, "utf8").trim() === projectRef;

if (!linked) {
  console.log(`Linking project ${projectRef}… (enter database password when prompted)`);
  const link = spawnSync("npx", ["supabase", "link", "--project-ref", projectRef], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (link.status !== 0) {
    privilegeHint();
    process.exit(link.status ?? 1);
  }
}

console.log("Pushing migrations…");
run("npx supabase db push");
console.log("Done.");
