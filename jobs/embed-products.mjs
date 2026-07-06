// embed-products.mjs
// Phase 2.1 embedding job. Builds a text doc per active product (name, brand, family,
// concentration, top/heart/base notes, accords, description), embeds it with
// all-MiniLM-L6-v2 (384-dim, local, free) via transformers.js, and writes the vector into
// public.product.embedding. Idempotent + re-runnable; by default only (re)embeds products
// that are new or changed since their last embedding (embedded_at null or stale).
//
// NEVER run at request time — this is an offline/cron job (weekly full refresh + after
// catalog edits). Writes via the Supabase REST API using the SERVICE key, so it reuses the
// same credentials as scripts/ (auto-loaded from scripts/.env) — no DATABASE_URL needed.
//
// Setup:
//   cd jobs && npm install          # first run downloads the ~90MB model
//   # Uses SUPABASE_URL + SUPABASE_SECRET_KEY (service role). Already present in scripts/.env;
//   # nothing else to configure. (Falls back to EXPO_PUBLIC_/NEXT_PUBLIC_ URL + SERVICE_ROLE key.)
// Run:
//   node embed-products.mjs           # only new/changed products
//   node embed-products.mjs --all     # re-embed every active product

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "@huggingface/transformers";

const HERE = dirname(fileURLToPath(import.meta.url));

// Load env from the first co-located .env found, without overwriting real env.
for (const rel of [".env", "../scripts/.env", "../.env"]) {
  const path = join(HERE, rel);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (/^\s*#/.test(line)) continue;
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^(".*"|'.*')$/, (s) => s.slice(1, -1));
  }
}

const BASE = (
  process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ""
).replace(/\/$/, "");
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) {
  console.error("Missing SUPABASE_URL and SUPABASE_SECRET_KEY (service role). They live in scripts/.env — run from the repo, or set them.");
  process.exit(1);
}

const ALL = process.argv.includes("--all");
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const one = (v) => (Array.isArray(v) ? v[0] : v);
const clean = (s) => (s ?? "").replace(/\s+/g, " ").trim();
const listStr = (a) => (a && a.length ? a.join(", ") : null);

const notesAt = (p, pos) =>
  (p.product_scent_note || []).filter((n) => n.position === pos).map((n) => one(n.scent_note)?.name).filter(Boolean).sort();
const concentrations = (p) =>
  [...new Set((p.product_variant || []).filter((v) => v.is_active && !v.deleted_at).map((v) => v.concentration).filter(Boolean))];

function buildDoc(p) {
  return [
    clean(p.name),
    one(p.brand)?.name ? `by ${clean(one(p.brand).name)}` : null,
    p.scent_family ? `Family: ${clean(p.scent_family)}` : null,
    concentrations(p).length ? `Concentration: ${listStr(concentrations(p))}` : null,
    notesAt(p, "top").length ? `Top notes: ${listStr(notesAt(p, "top"))}` : null,
    notesAt(p, "heart").length ? `Heart notes: ${listStr(notesAt(p, "heart"))}` : null,
    notesAt(p, "base").length ? `Base notes: ${listStr(notesAt(p, "base"))}` : null,
    p.main_accords?.length ? `Accords: ${listStr(p.main_accords)}` : null,
    clean(p.description) || null,
  ].filter(Boolean).join(". ");
}

// pgvector over PostgREST: try the JSON-array form (Supabase's documented way); if the
// deployment prefers the text form, fall back to "[...]". One of them always works.
async function writeEmbedding(id, vec) {
  const url = `${BASE}/rest/v1/product?id=eq.${id}`;
  const at = new Date().toISOString();
  let lastErr = "";
  for (const value of [vec, `[${vec.join(",")}]`]) {
    const r = await fetch(url, {
      method: "PATCH",
      headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ embedding: value, embedded_at: at }),
    });
    if (r.ok) return;
    lastErr = `${r.status} ${(await r.text()).slice(0, 140)}`;
  }
  throw new Error(`write embedding failed for ${id}: ${lastErr}`);
}

async function main() {
  const select =
    "id,name,scent_family,description,main_accords,updated_at,embedded_at," +
    "brand(name),product_variant(concentration,is_active,deleted_at),product_scent_note(position,scent_note(name))";
  const res = await fetch(
    `${BASE}/rest/v1/product?select=${encodeURIComponent(select)}&is_active=eq.true&deleted_at=is.null&order=name.asc`,
    { headers: H },
  );
  if (!res.ok) throw new Error(`fetch products failed: ${res.status} ${await res.text()}`);
  const products = await res.json();

  const stale = products.filter(
    (p) => ALL || !p.embedded_at || (p.updated_at && new Date(p.updated_at) > new Date(p.embedded_at)),
  );
  if (stale.length === 0) {
    console.log(`Nothing to embed — all ${products.length} active products are up to date. (Use --all to force.)`);
    return;
  }

  console.log(`Embedding ${stale.length} of ${products.length} active products. Loading all-MiniLM-L6-v2 (first run downloads it)…`);
  const extract = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

  let done = 0;
  for (const p of stale) {
    const out = await extract(buildDoc(p), { pooling: "mean", normalize: true });
    await writeEmbedding(p.id, Array.from(out.data));
    done += 1;
    process.stdout.write(`\r  embedded ${done}/${stale.length}  ${clean(p.name).slice(0, 40).padEnd(40)}`);
  }
  console.log(`\nDone. Embedded ${done} product(s).`);
}

main().catch((e) => {
  console.error(`\nEmbed job failed: ${e.message}`);
  process.exit(1);
});
