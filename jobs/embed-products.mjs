// embed-products.mjs
// Phase 2.1 embedding job. Builds a text doc per active product (name, brand, family,
// concentration, top/heart/base notes, accords, description), embeds it with
// all-MiniLM-L6-v2 (384-dim, local, free) via transformers.js, and writes the vector into
// public.product.embedding. Idempotent + re-runnable; by default only (re)embeds products
// that are new or changed since their last embedding (embedded_at is null or stale).
//
// NEVER run at request time — this is an offline/cron job (weekly full refresh + after
// catalog edits). Uses a DIRECT Postgres connection so pgvector `::vector` casts are exact.
//
// Setup:
//   cd jobs && npm install
//   # DATABASE_URL from Supabase: Project Settings -> Database -> Connection string (URI).
//   echo 'DATABASE_URL=postgres://postgres:...@db.<ref>.supabase.co:5432/postgres' > jobs/.env
// Run:
//   node embed-products.mjs           # only new/changed products
//   node embed-products.mjs --all     # re-embed every active product

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
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

const DB_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!DB_URL) {
  console.error("Missing DATABASE_URL. Set it (Supabase → Settings → Database → Connection string) in jobs/.env.");
  process.exit(1);
}

const ALL = process.argv.includes("--all");
const clean = (s) => (s ?? "").replace(/\s+/g, " ").trim();
const list = (arr) => (arr && arr.length ? arr.filter(Boolean).join(", ") : null);

// The text doc the model embeds. Order/labels are stable so re-embeds are deterministic.
function buildDoc(r) {
  return [
    clean(r.name),
    r.brand ? `by ${clean(r.brand)}` : null,
    r.scent_family ? `Family: ${clean(r.scent_family)}` : null,
    r.concentrations ? `Concentration: ${list(r.concentrations)}` : null,
    r.top_notes ? `Top notes: ${list(r.top_notes)}` : null,
    r.heart_notes ? `Heart notes: ${list(r.heart_notes)}` : null,
    r.base_notes ? `Base notes: ${list(r.base_notes)}` : null,
    r.main_accords ? `Accords: ${list(r.main_accords)}` : null,
    clean(r.description) || null,
  ].filter(Boolean).join(". ");
}

async function main() {
  const sql = postgres(DB_URL, { ssl: "require" });
  try {
    const rows = await sql`
      select
        p.id, p.name, p.scent_family, p.description, p.main_accords,
        b.name as brand,
        (select array_agg(distinct pv.concentration) from product_variant pv
           where pv.product_id = p.id and pv.is_active and pv.deleted_at is null) as concentrations,
        (select array_agg(sn.name order by sn.name) from product_scent_note psn
           join scent_note sn on sn.id = psn.scent_note_id
          where psn.product_id = p.id and psn.position = 'top')   as top_notes,
        (select array_agg(sn.name order by sn.name) from product_scent_note psn
           join scent_note sn on sn.id = psn.scent_note_id
          where psn.product_id = p.id and psn.position = 'heart') as heart_notes,
        (select array_agg(sn.name order by sn.name) from product_scent_note psn
           join scent_note sn on sn.id = psn.scent_note_id
          where psn.product_id = p.id and psn.position = 'base')  as base_notes
      from product p
      join brand b on b.id = p.brand_id
      where p.is_active and p.deleted_at is null
        and (${ALL} or p.embedded_at is null or p.updated_at > p.embedded_at)
      order by p.name`;

    if (rows.length === 0) {
      console.log("Nothing to embed — all active products are up to date. (Use --all to force.)");
      return;
    }

    console.log(`Loading all-MiniLM-L6-v2 (first run downloads the model)…`);
    const extract = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

    let done = 0;
    for (const r of rows) {
      const doc = buildDoc(r);
      const out = await extract(doc, { pooling: "mean", normalize: true });
      const vec = Array.from(out.data); // 384-dim unit vector
      await sql`update product set embedding = ${"[" + vec.join(",") + "]"}::vector, embedded_at = now() where id = ${r.id}`;
      done += 1;
      process.stdout.write(`\r  embedded ${done}/${rows.length}  ${r.name.slice(0, 40).padEnd(40)}`);
    }
    console.log(`\nDone. Embedded ${done} product(s).`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(`\nEmbed job failed: ${e.message}`);
  process.exit(1);
});
