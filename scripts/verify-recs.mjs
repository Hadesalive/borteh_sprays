// verify-recs.mjs
// Run AFTER `supabase db push` applies 20260720221809_recs_cold_start_correctness.sql.
// Proves the recommendation stack is healthy on a real catalog with no traffic yet: popularity
// is no longer a 125-way tie, no rail comes back empty, the first page is not one brand, and
// nothing retired can leak to a shopper.
//
// Run: node scripts/verify-recs.mjs

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const raw = await readFile(join(HERE, ".env"), "utf8");
const env = {};
for (const l of raw.split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim(); }
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, SVC = env.SUPABASE_SECRET_KEY, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const svc = { apikey: SVC, Authorization: "Bearer " + SVC, "Content-Type": "application/json" };
const anon = { apikey: ANON, Authorization: "Bearer " + ANON, "Content-Type": "application/json" };

const problems = [];
const ok = (l, d = "") => console.log(`  ✓ ${l}${d ? "  " + d : ""}`);
const bad = (l, d = "") => { console.log(`  ✖ ${l}${d ? "  " + d : ""}`); problems.push(l); };
const rpc = async (fn, body, h = anon) =>
  fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: "POST", headers: h, body: JSON.stringify(body || {}) });

console.log("\n▸ Verifying the recommendation stack\n");

// ---- 1. migration applied ------------------------------------------------------------------
console.log("Migration");
const colRes = await fetch(`${URL_}/rest/v1/product?select=content_updated_at&limit=1`, { headers: svc });
if (!colRes.ok) {
  bad("content_updated_at missing — migration not applied yet", "run: supabase db push");
  console.log("\nStopping: nothing below can pass until the migration is pushed.\n");
  process.exit(1);
}
ok("content_updated_at present");

// ---- 2. popularity writer ------------------------------------------------------------------
console.log("\nPopularity");
const refresh = await rpc("fn_refresh_popularity", {}, svc);
refresh.ok ? ok(`fn_refresh_popularity ran`, `rows updated: ${await refresh.text()}`)
           : bad("fn_refresh_popularity failed", (await refresh.text()).slice(0, 200));

const prods = await (await fetch(
  `${URL_}/rest/v1/product?select=id,name,popularity_score,brand:brand_id(name),product_image(id)` +
  `&is_active=eq.true&deleted_at=is.null`, { headers: svc })).json();
const scores = prods.map((p) => p.popularity_score);
const zeros = scores.filter((s) => s === 0).length;
const distinct = new Set(scores).size;
zeros > prods.length * 0.1
  ? bad(`${zeros}/${prods.length} products still at exactly 0`, "cold-start prior is not differentiating")
  : ok(`only ${zeros}/${prods.length} at zero`, `min ${Math.min(...scores)}, max ${Math.max(...scores)}, ${distinct} distinct values`);
distinct < 10 ? bad(`only ${distinct} distinct popularity values — ranking will still tie heavily`)
              : ok(`${distinct} distinct values — ties are rare`);

// ---- 3. no rail may be empty ---------------------------------------------------------------
console.log("\nFeed rails (must never be empty)");
const trend = await rpc("fn_trending", { p_limit: 12 });
const trendRows = trend.ok ? await trend.json() : [];
Array.isArray(trendRows) && trendRows.length
  ? ok(`fn_trending returns ${trendRows.length} rows`, "falls back to popularity when no events exist")
  : bad("fn_trending STILL returns an empty rail", JSON.stringify(trendRows).slice(0, 160));

const shop = await rpc("fn_shop_ranked", { p_limit: 24, p_offset: 0 });
const shopRows = shop.ok ? await shop.json() : [];
Array.isArray(shopRows) && shopRows.length
  ? ok(`fn_shop_ranked returns ${shopRows.length} rows`)
  : bad("fn_shop_ranked returned nothing", JSON.stringify(shopRows).slice(0, 160));

// ---- 4. first page diversity ---------------------------------------------------------------
console.log("\nFirst-page quality");
const byId = Object.fromEntries(prods.map((p) => [p.id, p]));
const page1 = shopRows.map((r) => byId[r.product_id]).filter(Boolean);
if (page1.length) {
  const brands = {};
  page1.forEach((p) => (brands[p.brand?.name || "?"] = (brands[p.brand?.name || "?"] || 0) + 1));
  const top = Object.entries(brands).sort((a, b) => b[1] - a[1]);
  const share = top[0][1] / page1.length;
  share > 0.5
    ? bad(`${top[0][0]} occupies ${Math.round(share * 100)}% of page 1`, "diversity penalty not effective")
    : ok(`${Object.keys(brands).length} brands on page 1`, `largest: ${top[0][0]} ${top[0][1]}/${page1.length}`);
  const photos = page1.filter((p) => p.product_image.length).length;
  ok(`${photos}/${page1.length} of page 1 shows a real owner photo`);
}

// ---- 5. pagination stability ---------------------------------------------------------------
console.log("\nPagination");
const p1 = (await (await rpc("fn_shop_ranked", { p_limit: 20, p_offset: 0 })).json()).map((r) => r.product_id);
const p2 = (await (await rpc("fn_shop_ranked", { p_limit: 20, p_offset: 20 })).json()).map((r) => r.product_id);
const overlap = p1.filter((id) => p2.includes(id));
overlap.length ? bad(`${overlap.length} products repeat across page 1 and 2`) : ok("no product repeats across pages");
const p1again = (await (await rpc("fn_shop_ranked", { p_limit: 20, p_offset: 0 })).json()).map((r) => r.product_id);
JSON.stringify(p1) === JSON.stringify(p1again) ? ok("page 1 is stable across repeated calls")
                                               : bad("page 1 order changes between identical calls");

// ---- 6. nothing retired may surface --------------------------------------------------------
console.log("\nLeak check");
const liveIds = new Set(prods.map((p) => p.id));
const leaked = [...trendRows, ...shopRows].map((r) => r.product_id).filter((id) => !liveIds.has(id));
leaked.length ? bad(`${leaked.length} retired products surfaced in a rail`) : ok("no retired product appears in any rail");

// ---- 7. content-based recs still sane ------------------------------------------------------
console.log("\nSimilar scents");
const sample = prods.find((p) => /khamrah$/i.test(p.name)) || prods[0];
const sim = await rpc("fn_similar_products", { p_product_id: sample.id, p_limit: 4 }, svc);
const simRows = sim.ok ? await sim.json() : [];
Array.isArray(simRows) && simRows.length
  ? ok(`${sample.name} → ${simRows.map((r) => byId[r.product_id]?.name).filter(Boolean).join(", ")}`)
  : bad("fn_similar_products returned nothing", JSON.stringify(simRows).slice(0, 160));

console.log(problems.length ? `\n✖ ${problems.length} problem(s)\n` : "\n✓ Recommendation stack healthy\n");
process.exit(problems.length ? 1 : 0);
