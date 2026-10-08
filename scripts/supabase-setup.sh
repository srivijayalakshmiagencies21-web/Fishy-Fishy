#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo ""
echo "=== Step 1/2: Supabase CLI login ==="
echo "Press Enter → Microsoft Edge opens → complete login → paste verification code here."
echo ""
BROWSER='open -a "Microsoft Edge"' npx supabase login

echo ""
echo "=== Step 2/2: Link + push migrations ==="
echo "When prompted, type your database password (input is hidden)."
echo ""
node scripts/supabase-db-push.mjs
