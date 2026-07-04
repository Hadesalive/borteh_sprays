#!/usr/bin/env bash
# Upload the home/storefront images (hero, collection covers, scent tiles, brand
# logos) from the mobile bundle into the `product-images` Storage bucket under a
# `home/` prefix. seed_storefront.sql then points each row's *_path column here.
#
# Usage (service_role key bypasses Storage RLS — keep it local, never ship it):
#   SUPABASE_URL=https://oltuvavkssvgmqnduxvh.supabase.co \
#   SUPABASE_SERVICE_ROLE_KEY=<service_role key> \
#   bash scripts/load-home-images.sh
set -euo pipefail

URL="${SUPABASE_URL:?set SUPABASE_URL}"
SK="${SUPABASE_SERVICE_ROLE_KEY:?set SUPABASE_SERVICE_ROLE_KEY}"
A="$(cd "$(dirname "$0")/../mobile/assets" && pwd)"
BUCKET="product-images"

up() { # src key ctype
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    "$URL/storage/v1/object/$BUCKET/$2" \
    -H "Authorization: Bearer $SK" -H "apikey: $SK" \
    -H "x-upsert: true" -H "Content-Type: $3" \
    --data-binary "@$A/$1")
  printf "  %s  %s\n" "$code" "$2"
}

echo "hero:"
up home/hero-oud.jpg  home/hero/oud.jpg  image/jpeg
up home/hero-gold.jpg home/hero/gold.jpg image/jpeg
up home/hero-rose.jpg home/hero/rose.jpg image/jpeg

echo "collections:"
up home/collections/summer.jpg     home/collections/summer.jpg         image/jpeg
up home/collections/date-night.jpg home/collections/date-night.jpg     image/jpeg
up home/scent/woody.jpg            home/collections/oud-lovers.jpg     image/jpeg
up home/collections/gourmand.jpg   home/collections/gourmand-sweet.jpg image/jpeg
up home/collections/office.jpg     home/collections/office.jpg         image/jpeg
up home/collections/signature.jpg  home/collections/signature.jpg      image/jpeg

echo "scent:"
for f in woody floral oriental spicy citrus sweet; do up "home/scent/$f.jpg" "home/scent/$f.jpg" image/jpeg; done

echo "brand logos:"
for s in afnan al-haramain ard-al-zaafaran armaf french-avenue lattafa maison-alhambra paris-corner rasasi swiss-arabian; do
  up "brands/$s.png" "home/brands/$s.png" image/png
done

echo "done — now run: psql \"\$DATABASE_URL\" -f supabase/seed_storefront.sql"
