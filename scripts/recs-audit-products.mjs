// recs-audit-products.mjs
// Phase 0 catalog-quality gate for the recommendation system (RECS_IMPLEMENTATION_PLAN.md).
// The content model is only as good as this data: every ACTIVE product must have a
// fragrance family, top+heart+base notes, brand, description, and a priced active variant.
// Reads over the anon REST API (RLS-scoped, i.e. exactly what the recommender will see),
// so it runs from anywhere with no DB credentials — just the public anon key.
//
// Exit code 0 = clean (gate passes). Exit code 1 = gaps found or config/query error;
// the failing products are printed. This is a BLOCKING GATE — do not proceed past Phase 0
// while it is non-zero.
//
// Run:
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/recs-audit-products.mjs
// (also accepts EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY and the NEXT_PUBLIC_* pair)

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

// Auto-load env from the first co-located .env found (script dir, then mobile/, then repo
// root), without overwriting anything already exported. Lets you just run the script.
function loadEnvFiles() {
  const candidates = [join(HERE, ".env"), join(HERE, "..", "mobile", ".env"), join(HERE, "..", ".env")];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (/^\s*#/.test(line)) continue;
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      let val = m[2].trim();
      if (/^(".*"|'.*')$/.test(val)) val = val.slice(1, -1);
      if (!(m[1] in process.env)) process.env[m[1]] = val;
    }
  }
}
loadEnvFiles();

const BASE_URL = (
  process.env.SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
).replace(/\/$/, "");
const ANON =
  process.env.SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!BASE_URL || !ANON) {
  console.error(
    "Missing env. Set SUPABASE_URL and SUPABASE_ANON_KEY (or the EXPO_PUBLIC_* / NEXT_PUBLIC_* equivalents)."
  );
  process.exit(1);
}

const PAGE = 1000;
// Required note positions. Loosen here if the catalog policy ever changes.
const REQUIRED_POSITIONS = ["top", "heart", "base"];

const nonEmpty = (s) => typeof s === "string" && s.trim().length > 0;

function auditProduct(p) {
  const missing = [];

  if (!nonEmpty(p.scent_family)) missing.push("scent_family");
  if (!nonEmpty(p.description)) missing.push("description");
  if (!p.brand_id) missing.push("brand");

  const positions = new Set((p.product_scent_note || []).map((n) => n.position));
  for (const pos of REQUIRED_POSITIONS) {
    if (!positions.has(pos)) missing.push(`${pos}_note`);
  }

  // anon RLS already returns only active, non-deleted variants; require ≥1 with a price.
  const priced = (p.product_variant || []).some(
    (v) => v.is_active !== false && !v.deleted_at && Number.isFinite(v.price_minor)
  );
  if (!priced) missing.push("priced_variant");

  return missing;
}

const SELECT =
  "id,name,slug,scent_family,description,brand_id," +
  "product_scent_note(position)," +
  "product_variant(price_minor,is_active,deleted_at)";

async function fetchAllProducts() {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const params = new URLSearchParams({
      select: SELECT,
      is_active: "eq.true",
      deleted_at: "is.null",
      order: "name.asc",
      limit: String(PAGE),
      offset: String(offset),
    });
    const res = await fetch(`${BASE_URL}/rest/v1/product?${params}`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    });
    if (!res.ok) throw new Error(`REST ${res.status}: ${await res.text()}`);
    const data = await res.json();
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

async function main() {
  const products = await fetchAllProducts();

  const failures = [];
  const reasonCounts = {};
  for (const p of products) {
    const missing = auditProduct(p);
    if (missing.length) {
      failures.push({ name: p.name, slug: p.slug, missing });
      for (const r of missing) reasonCounts[r] = (reasonCounts[r] || 0) + 1;
    }
  }

  console.log(`\nPhase 0 catalog audit — ${products.length} active products checked.`);

  if (failures.length === 0) {
    console.log("PASS ✓  Every active product has family, top/heart/base notes, brand, description, and a priced variant.\n");
    process.exit(0);
  }

  console.log(`FAIL ✗  ${failures.length} product(s) with gaps:\n`);
  for (const f of failures) {
    console.log(`  • ${f.name}  (${f.slug})`);
    console.log(`      missing: ${f.missing.join(", ")}`);
  }
  console.log("\n  gap totals:");
  for (const [reason, count] of Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${reason.padEnd(16)} ${count}`);
  }
  console.log("\nBLOCKING GATE: backfill the above in the admin before continuing past Phase 0.\n");
  process.exit(1);
}

main().catch((err) => {
  console.error(`\nAudit could not run: ${err.message}\n`);
  process.exit(1);
});
