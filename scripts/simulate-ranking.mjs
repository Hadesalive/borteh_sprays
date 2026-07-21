// simulate-ranking.mjs
// Dry-runs the proposed cold-start ranking against the REAL live catalog before any of it is
// committed to SQL. The migration cannot be tested locally (no Docker), so the scoring design
// is validated here — on real rows — and the SQL is then written to match this exactly.
//
// Run: node scripts/simulate-ranking.mjs

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const raw = await readFile(join(HERE, ".env"), "utf8");
const env = {};
for (const l of raw.split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim(); }
const B = env.NEXT_PUBLIC_SUPABASE_URL + "/rest/v1";
const H = { apikey: env.SUPABASE_SECRET_KEY, Authorization: "Bearer " + env.SUPABASE_SECRET_KEY };

const rows = await (await fetch(
  B + "/product?select=id,slug,name,is_featured,release_year,avg_rating,review_count,popularity_score," +
      "scent_family,brand:brand_id(name),category:category_id(slug),product_image(id)" +
      "&is_active=eq.true&deleted_at=is.null", { headers: H })).json();

console.log(`live products: ${rows.length}\n`);

// ---- prior weights (must mirror the SQL exactly) -----------------------------------------
const W_PHOTO = 0.40, W_FEATURED = 0.20, W_RECENCY = 0.25, W_RATING = 0.15;
const W_ENGAGEMENT = 0.70, W_PRIOR = 0.30;
const DIVERSITY_STEP = 0.04, DIVERSITY_CAP = 0.20;

const years = rows.map((p) => p.release_year).filter((y) => Number.isInteger(y));
const minY = Math.min(...years), maxY = Math.max(...years);
const span = Math.max(maxY - minY, 1);

// No events exist for this catalog yet, so engagement is 0 across the board. Keep the term so
// the simulation matches the SQL shape and shows what happens once traffic arrives.
const engagement = Object.fromEntries(rows.map((p) => [p.id, 0]));
const maxEng = Math.max(1, ...Object.values(engagement));

const scored = rows.map((p) => {
  const hasPhoto = p.product_image.length > 0 ? 1 : 0;
  const featured = p.is_featured ? 1 : 0;
  const recency = Number.isInteger(p.release_year) ? (p.release_year - minY) / span : 0.5;
  const rating = (p.avg_rating || 0) / 5;
  const prior = W_PHOTO * hasPhoto + W_FEATURED * featured + W_RECENCY * recency + W_RATING * rating;
  const normEng = engagement[p.id] / maxEng;
  const popularity = Math.round(1000 * (W_ENGAGEMENT * normEng + W_PRIOR * prior));
  return { ...p, brandName: p.brand?.name || "?", hasPhoto, prior, popularity };
});

// ---- what the shop feed does with it ------------------------------------------------------
// base score mirrors fn_shop_ranked at zero traffic: taste=0, reviews=0 → popularity only.
const maxPop = Math.max(1, ...scored.map((p) => p.popularity));
scored.forEach((p) => (p.base = p.popularity / maxPop));

// brand-diversity penalty, applied by rank within brand
const byBrand = {};
[...scored].sort((a, b) => b.base - a.base || a.id.localeCompare(b.id)).forEach((p) => {
  byBrand[p.brandName] = (byBrand[p.brandName] || 0) + 1;
  p.brandRank = byBrand[p.brandName];
  p.penalty = Math.min(DIVERSITY_STEP * (p.brandRank - 1), DIVERSITY_CAP);
  p.final = p.base - p.penalty;
});

const ranked = [...scored].sort((a, b) => b.final - a.final || a.id.localeCompare(b.id));

console.log("=== TOP 25 (what a shopper sees first) ===");
ranked.slice(0, 25).forEach((p, i) => {
  console.log(
    `${String(i + 1).padStart(3)}. ${p.name.slice(0, 30).padEnd(31)}${p.brandName.slice(0, 14).padEnd(15)}` +
    `pop ${String(p.popularity).padStart(3)}  ${p.hasPhoto ? "photo" : "     "}  ${p.release_year || "----"}  final ${p.final.toFixed(3)}`);
});

console.log("\n=== BOTTOM 8 ===");
ranked.slice(-8).forEach((p) => console.log(`     ${p.name.slice(0, 30).padEnd(31)}${p.brandName.slice(0, 14).padEnd(15)}pop ${String(p.popularity).padStart(3)}  ${p.hasPhoto ? "photo" : "     "}  ${p.release_year || "----"}`));

// ---- health checks -------------------------------------------------------------------------
const pops = scored.map((p) => p.popularity);
const distinct = new Set(pops).size;
const zero = pops.filter((v) => v === 0).length;
console.log(`\n=== HEALTH ===`);
console.log(`popularity spread: min ${Math.min(...pops)}  max ${Math.max(...pops)}  distinct values ${distinct}/${rows.length}`);
console.log(`products still at exactly 0: ${zero}   (was 125 before)`);
const top20Brands = {};
ranked.slice(0, 20).forEach((p) => (top20Brands[p.brandName] = (top20Brands[p.brandName] || 0) + 1));
console.log(`brands in top 20: ${Object.entries(top20Brands).map(([k, v]) => `${k}(${v})`).join(", ")}`);
const top20Photo = ranked.slice(0, 20).filter((p) => p.hasPhoto).length;
console.log(`top 20 with a real owner photo: ${top20Photo}/20`);
const cats = {};
ranked.slice(0, 20).forEach((p) => (cats[p.category?.slug || "none"] = (cats[p.category?.slug || "none"] || 0) + 1));
console.log(`categories in top 20: ${Object.entries(cats).map(([k, v]) => `${k}(${v})`).join(", ")}`);
