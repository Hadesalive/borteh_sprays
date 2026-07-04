// enrich-from-fragrantica.mjs
// Pulls richer detail (release year, scent family, main accords + strengths, a factual
// description, and the note pyramid) for every catalogued perfume straight from its
// Fragrantica page — via the r.jina.ai reader proxy, which renders past Cloudflare where a
// plain fetch gets a 403. Fragrantica resolves by ID alone, and the loader already maps every
// slug → Fragrantica id, so no per-perfume URL slugs are needed.
//
// Output (no DB credentials required — this only reads the web and writes local files):
//   scripts/fragrantica-enrichment.json   — structured data, one entry per perfume
//   supabase/seed_fragrantica.sql          — self-contained: adds columns + UPDATEs per slug
// Raw reader responses are cached under scripts/.frag-cache/ so re-runs resume / cost nothing.
//
// Run:  node enrich-from-fragrantica.mjs           (all)
//       ONLY=asad,khamrah node enrich-from-fragrantica.mjs   (a few)

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, ".frag-cache");
const LOADER = join(HERE, "load-product-images.mjs");
const OUT_JSON = join(HERE, "fragrantica-enrichment.json");
const OUT_SQL = join(HERE, "..", "supabase", "seed_fragrantica.sql");
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",").map((s) => s.trim())) : null;
const DELAY_MS = Number(process.env.DELAY_MS || 2500);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// slug → Fragrantica id, lifted from the image loader so the two never drift apart.
async function loadProducts() {
  const src = await readFile(LOADER, "utf8");
  const out = [];
  const re = /\{\s*slug:\s*"([^"]+)"[^}]*?\bid:\s*(\d+|null)\s*\}/g;
  let m;
  while ((m = re.exec(src))) if (m[2] !== "null") out.push({ slug: m[1], id: Number(m[2]) });
  return out;
}

async function fetchReader(id) {
  const cacheFile = join(CACHE, `${id}.md`);
  if (existsSync(cacheFile)) return readFile(cacheFile, "utf8");
  const url = `https://r.jina.ai/https://www.fragrantica.com/perfume/x/x-${id}.html`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", "X-Return-Format": "markdown" }, signal: AbortSignal.timeout(60000) });
      if (resp.status === 429 || resp.status === 503) {
        const wait = attempt * 8000;
        process.stdout.write(`(rate-limited, waiting ${wait / 1000}s) `);
        await sleep(wait);
        continue;
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      if (text.length < 1500 || /just a moment/i.test(text)) throw new Error("challenge/short");
      await writeFile(cacheFile, text);
      return text;
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(attempt * 5000);
    }
  }
}

const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const splitNotes = (s) =>
  s
    ? s
        .replace(/\s+and\s+/gi, ", ")
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean)
    : [];

function parse(md, id) {
  const out = { id, year: null, family: null, audience: null, accords: [], top: [], heart: [], base: [], description: null, perfumer: null };

  // The summary line (all one line in the reader output) carries family, year and the pyramid.
  const summary = md.match(/\*\*[^*\n]+\*\* by \*\*[^*\n]+\*\* is an? [^\n]+/);
  if (summary) {
    const line = summary[0].replace(/\*\*/g, "").trim();
    out.description = line;
    const fam = line.match(/ is an? ([A-Za-z ]+?) fragrance for (\w+(?: and \w+)?)/);
    if (fam) {
      out.family = fam[1].trim();
      out.audience = fam[2].trim();
    }
    const yr = line.match(/launched in (\d{4})/);
    if (yr) out.year = Number(yr[1]);
    const top = line.match(/[Tt]op notes? (?:are|is) ([^;.]+)/);
    const mid = line.match(/middle notes? (?:are|is) ([^;.]+)/);
    const base = line.match(/base notes? (?:are|is) ([^;.]+)/);
    out.top = splitNotes(top?.[1]);
    out.heart = splitNotes(mid?.[1]);
    out.base = splitNotes(base?.[1]);
  }

  // Accords + strengths come straight off the "Search by accords" query string.
  const accUrl = md.match(/accords-search\/\?([^)]+)/);
  if (accUrl) {
    out.accords = accUrl[1]
      .split("&")
      .map((kv) => kv.split("="))
      .filter(([k]) => !k.startsWith("f_"))
      .map(([k, v]) => ({ name: decodeURIComponent(k.replace(/\+/g, " ")), strength: Number(v) }))
      .filter((a) => a.name && Number.isFinite(a.strength))
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 6);
  }

  const nose = md.match(/The nose[s]? behind this fragrance (?:is|are) ([^.]+)\./);
  if (nose) out.perfumer = nose[1].replace(/\*\*/g, "").trim();

  return out;
}

const sqlStr = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const sqlArr = (a) => (a && a.length ? `array[${a.map((x) => sqlStr(x)).join(",")}]` : "null");

function toSql(rows) {
  const lines = [
    "-- Generated by scripts/enrich-from-fragrantica.mjs — richer detail sourced from Fragrantica.",
    "-- Idempotent: adds columns if missing, then updates each product by slug.",
    "alter table public.product add column if not exists release_year   int;",
    "alter table public.product add column if not exists scent_family    text;",
    "alter table public.product add column if not exists main_accords    text[];",
    "alter table public.product add column if not exists perfumer        text;",
    "",
  ];
  for (const r of rows) {
    if (!r.ok) continue;
    const d = r.data;
    const accords = d.accords.map((a) => a.name);
    lines.push(
      `update public.product set ` +
        `release_year = ${d.year ?? "null"}, ` +
        `scent_family = ${sqlStr(d.family)}, ` +
        `main_accords = ${sqlArr(accords)}, ` +
        `perfumer = ${sqlStr(d.perfumer)}, ` +
        `description = coalesce(${sqlStr(d.description)}, description) ` +
        `where slug = ${sqlStr(r.slug)};`,
    );
  }
  return lines.join("\n") + "\n";
}

async function main() {
  await mkdir(CACHE, { recursive: true });
  let products = await loadProducts();
  if (ONLY) products = products.filter((p) => ONLY.has(p.slug));
  console.log(`Enriching ${products.length} perfumes via Fragrantica (jina reader)\n`);

  const rows = [];
  let ok = 0, fail = 0;
  for (const p of products) {
    process.stdout.write(`• ${p.slug} (#${p.id}) … `);
    try {
      const md = await fetchReader(p.id);
      const data = parse(md, p.id);
      const accords = data.accords.map((a) => a.name).join(", ") || "—";
      console.log(`${data.year ?? "?"} · ${data.family ?? "?"} · accords: ${accords}`);
      rows.push({ slug: p.slug, ok: true, data });
      ok++;
    } catch (e) {
      console.log(`FAILED: ${e.message}`);
      rows.push({ slug: p.slug, ok: false, error: e.message });
      fail++;
    }
    await sleep(DELAY_MS);
  }

  await writeFile(OUT_JSON, JSON.stringify(rows, null, 2));
  await writeFile(OUT_SQL, toSql(rows));
  console.log(`\nDone: ${ok} enriched, ${fail} failed.`);
  console.log(`  → ${OUT_JSON}`);
  console.log(`  → ${OUT_SQL}  (apply with: psql "$DATABASE_URL" -f supabase/seed_fragrantica.sql)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
