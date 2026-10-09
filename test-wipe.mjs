import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = "/Users/adarshacharya/Documents/Clients/Fishy-Fishy";
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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

const envFile = parseEnvFile(fs.readFileSync(envPath, "utf8"));
const url = envFile.NEXT_PUBLIC_SUPABASE_URL;
const key = envFile.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

console.log("URL:", url);
const supabase = createClient(url, key);

// Try deleting journeys directly using supabase-js client
const { data, error } = await supabase.from("journeys").delete().neq("id", "00000000-0000-0000-0000-000000000000").select();
console.log("Delete result:", { data, error });
