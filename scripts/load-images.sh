#!/usr/bin/env bash
# Loads the product images. Prompts for your Supabase service_role key at runtime —
# nothing is hardcoded or saved. Run:  bash scripts/load-images.sh
set -euo pipefail
cd "$(dirname "$0")"

# install deps once
[ -d node_modules ] || npm install

: "${SUPABASE_URL:=https://oltuvavkssvgmqnduxvh.supabase.co}"

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  read -rsp "Paste your Supabase service_role key (hidden): " SUPABASE_SERVICE_ROLE_KEY
  echo
fi

export SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY
node load-product-images.mjs
