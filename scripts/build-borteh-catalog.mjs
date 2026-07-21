// build-borteh-catalog.mjs
// Merges the perfume research (scent pyramids, accords, years) with the owner's photo
// identifications into scripts/borteh-catalog.json — the single input the seeder consumes.
//
// Deliberate choices worth knowing before you edit:
//   * Slugs are REUSED from the live DB whenever a product already exists there, so the seed
//     updates that row in place instead of retiring it and orphaning its order history.
//   * Prices are PLACEHOLDERS derived from a brand tier + a stable per-slug jitter. They exist
//     so the app has something sane to render during testing; the owner sets real prices in admin.
//   * Category is inferred from accords/notes because the source data has no category.
//
// Run: node scripts/build-borteh-catalog.mjs

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
// Research + photo-identification inputs, checked in so this is reproducible.
const SRC = join(HERE, "catalog-source");
const OUT = join(HERE, "borteh-catalog.json");

// ---------------------------------------------------------------- brand normalisation
// Research agents recorded brands with parenthetical parentage ("Rayhaan (by Afnan)") and
// folded some sub-lines inconsistently. Collapse to the name a customer would recognise.
const BRAND_ALIAS = {
  "arabiyat prestige (my perfumes)": "Arabiyat Prestige",
  "my perfumes": "Arabiyat Prestige",
  "rayhaan (by afnan)": "Rayhaan",
  "asdaaf (by lattafa)": "Asdaaf",
  "lattafa pride": "Lattafa",
  "lattafa perfumes": "Lattafa",
  "niche emarati (by lattafa)": "Niche Emarati",
  "ahmed al maghribi perfumes": "Ahmed Al Maghribi",
  "habib perfume": "Habib",
  "reef": "Reef Perfumes",
  "riffs": "Riiffs",
  "al haramain perfumes": "Al Haramain",
  "swiss arabian perfumes": "Swiss Arabian",
  "rave (by lattafa)": "Rave",
};
const normBrand = (b) => {
  const k = (b || "").trim().toLowerCase();
  return BRAND_ALIAS[k] || (b || "").trim();
};

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’`]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// ---------------------------------------------------------------- category inference
// Maps onto the categories already seeded in the DB.
//
// Weighting matters here: almost every Middle-Eastern fragrance has vanilla or amber somewhere
// in its base, so matching against the full note list files ~70% of the catalog under
// "gourmand-sweet" and makes browsing useless. Fragrantica ranks main_accords by strength, so
// the DOMINANT accords (the first three) decide the shelf; the full note list is only a
// tie-breaker for signals the accords missed.
const OUDY = /\boud|agarwood|oudh/;

// Accord → character group. "sweet" is deliberately weak: it rides along with almost every
// accord in this market and describes intensity more than character, so on its own it must not
// outvote the accord that actually defines the scent (woody, fruity, spicy...).
const ACCORD_GROUP = [
  [/aquatic|marine|ozon|salty|watery/, "aqua", 1],
  [/vanilla|caramel|chocolate|cocoa|candy|marshmallow|honey|coffee|praline|toffee|creamy|milky|nutty|almond|coconut|pistachio|whipped|sugar|boozy|cherry/, "gourmand", 1],
  [/sweet/, "gourmand", 0.35],
  [/citrus|fresh|green|aromatic|herbal|lavender|mint|ozonic/, "fresh", 1],
  [/white floral|floral|rose|jasmine|tuberose|peony|violet|iris|powdery|ylang|blossom/, "floral", 1],
  [/fruity|tropical|berry/, "fruity", 1],
  [/leather|tobacco|smoky|smoke|incense|woody|amber|animalic|balsamic|earthy|resin|warm spicy|spicy|musky|patchouli/, "deep", 1],
];

function inferCategory(p) {
  const accords = (p.main_accords || []).map((a) => a.toLowerCase());
  const family = (p.scent_family || "").toLowerCase();
  const pname = (p.canonical_name || p.name || "").toLowerCase();

  // Oud is a shopping category in its own right here — honour it wherever it shows up strongly.
  if (accords.slice(0, 3).some((a) => OUDY.test(a)) || OUDY.test(family) || OUDY.test(pname)) return "oud-lovers";

  // Rank-weighted vote: the first accord defines the scent, the third merely tints it.
  const RANK = [3, 2, 1];
  const score = {};
  accords.slice(0, 3).forEach((accord, i) => {
    for (const [re, group, weight] of ACCORD_GROUP) {
      if (re.test(accord)) { score[group] = (score[group] || 0) + RANK[i] * weight; break; }
    }
  });
  if (!Object.keys(score).length) return "everyday";

  const winner = Object.entries(score).sort((a, b) => b[1] - a[1])[0][0];
  const female = p.gender === "female";
  switch (winner) {
    case "aqua":     return "fresh-aquatic";
    case "gourmand": return "gourmand-sweet";
    case "floral":   return female ? "date-night" : "everyday";
    case "fruity":   return "summer";
    case "fresh":    return female ? "summer" : "office";
    case "deep":     return female ? "date-night" : "signature";
    default:         return "everyday";
  }
}

// ---------------------------------------------------------------- placeholder pricing
// Le (SLE) minor units — Le 1.00 = 100. Bands sit in the same range the store already used.
const PREMIUM = /club de nuit|hawas|amber oud|supremacy|khamrah|fakhar|musamam|9 ?pm|asad|liquid brun|falak|imperial|impériale/i;
const VALUE_BRANDS = new Set(["Gulf Orchid", "Matin Martin", "Ahmed Al Maghribi", "Habib", "Atralia", "Fragrance World", "Asdaaf", "Rave"]);

function priceFor(entry, brand, sizeMl, concentration) {
  // Stable hash so a given product keeps its price across rebuilds.
  let h = 0;
  for (const c of entry.slug) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const jitter = h % 9; // 0..8

  let base;
  if (PREMIUM.test(entry.name) || PREMIUM.test(brand)) base = 62000 + jitter * 1500;      // Le 620–740
  else if (VALUE_BRANDS.has(brand)) base = 29000 + jitter * 1200;                          // Le 290–386
  else base = 42000 + jitter * 1400;                                                       // Le 420–532

  if (concentration === "Extrait" || concentration === "Parfum") base = Math.round(base * 1.15);

  // Smaller bottles are cheaper per unit but not proportionally.
  if (sizeMl <= 30) base = Math.round(base * 0.42);
  else if (sizeMl <= 60) base = Math.round(base * 0.66);
  else if (sizeMl >= 120) base = Math.round(base * 1.12);

  return Math.round(base / 500) * 500; // tidy to Le 5
}

// ---------------------------------------------------------------- load inputs
async function loadJson(p) {
  if (!existsSync(p)) return null;
  try { return JSON.parse(await readFile(p, "utf8")); }
  catch (e) { console.warn(`   ! ${p} is not valid JSON (${e.message}) — skipped`); return null; }
}

const research = [];
for (const n of [1, 2, 3, 4, 5, 6, 7]) {
  const d = await loadJson(join(SRC, `research-${n}.json`));
  if (d) research.push(...d);
  else console.warn(`   ! research-${n}.json missing`);
}
const images = (await loadJson(join(SRC, "images-all.json"))) || [];
const existing = (await loadJson(join(SRC, "existing-products.json"))) || [];

console.log(`research entries: ${research.length}, photos: ${images.length}, existing DB products: ${existing.length}`);

// ---------------------------------------------------------------- photo → product
// On-list photos carry the list_number directly. Off-list photos were researched under
// synthetic numbers 201+ in the order they were handed to the research agent.
const OFF_LIST_ORDER = [
  "Armaf Club de Nuit Intense Man",
  "Al Haramain Amber Oud Gold Edition Extreme (Extrait de Parfum)",
  "Al Haramain Amber Oud Ruby Edition (120ml)",
  "Fragrance World Intense Noir Le Parfum",
  "Lattafa Ajayeb Dubai",
  "Ard Al Zaafaran Jazzab (rose gold)",
  "Lattafa Yara",
  "Khadlaj Nuha Cherry Blush",
  "Khadlaj Nuha (pink pearlescent — likely Nuha Rose)",
  "Khadlaj Panache Bon Bon",
  "Khadlaj Nuha Bonbon",
  "Niche Emarati Lujain",
  "Lattafa Qimmah Men",
  "Lattafa Pride Awaan",
  "Lattafa Eclaire Pistache",
  "Afnan Lynked Gold",
  "Lattafa Eclaire Banoffi",
  "Lattafa Dalal",
  "Niche Emarati Taraf",
  "Khadlaj Ria",
  "Lattafa (Pride) Fire on Ice",
];
const offListNumber = Object.fromEntries(OFF_LIST_ORDER.map((name, i) => [name, 201 + i]));

// One photo per product; if the same product was shot twice, keep the first.
const photoFor = {};
for (const img of images) {
  const num = img.list_number ?? offListNumber[img.matched_name];
  if (num == null) {
    console.warn(`   ! photo not mapped to any research item: ${img.matched_name} (${img.file})`);
    continue;
  }
  if (!photoFor[num]) photoFor[num] = img.file;
}

// ---------------------------------------------------------------- existing-slug reuse
// Match a researched product to a live DB row by brand + a loose name comparison, so the
// seeder updates that row (keeping its id, reviews and order history) instead of retiring it.
const normName = (s) => slugify(s).replace(/-/g, "");
const existingByKey = {};
for (const e of existing) {
  const key = `${normBrand(e.brand?.name || "")}|${normName(e.name)}`;
  existingByKey[key] = e.slug;
}

// ---------------------------------------------------------------- build
const catalog = [];
const usedSlugs = new Set();
const skipped = [];

for (const r of research) {
  if (!r.canonical_name || !r.brand) { skipped.push(r.input_name || "(unnamed)"); continue; }

  const brand = normBrand(r.brand);
  const name = r.canonical_name.trim();

  let slug = existingByKey[`${brand}|${normName(name)}`] || slugify(name);
  // Distinct products can share a name across houses (Gulf Orchid Marshmallow vs Paris Corner
  // Marshmallow Blush); qualify with the brand rather than silently dropping one.
  if (usedSlugs.has(slug)) slug = `${slugify(brand)}-${slugify(name)}`;
  if (usedSlugs.has(slug)) slug = `${slugify(brand)}-${slugify(name)}-${r.list_number}`;
  usedSlugs.add(slug);

  const gender = ["male", "female", "unisex"].includes(r.gender) ? r.gender : "unisex";
  const concentration = ["EDC", "EDT", "EDP", "Parfum", "Extrait"].includes(r.concentration) ? r.concentration : "EDP";

  const entry = {
    slug,
    name,
    brand,
    brand_slug: slugify(brand),
    category_slug: inferCategory(r),
    gender,
    description: r.description || null,
    release_year: Number.isInteger(r.release_year) ? r.release_year : null,
    scent_family: r.scent_family || null,
    main_accords: (r.main_accords || []).slice(0, 6),
    top: r.top || [],
    heart: r.heart || [],
    base: r.base || [],
    image_file: photoFor[r.list_number] || null,
    source_url: r.fragrantica_url || null,
    research_note: r.identification_note || null,
    variants: [],
  };

  const sizes = (r.sizes_ml || []).filter((s) => Number.isInteger(s) && s > 0);
  const useSizes = sizes.length ? [...new Set(sizes)] : [100];
  for (const size of useSizes) {
    entry.variants.push({
      size_ml: size,
      concentration,
      sku: `${slug}-${size}ml`,
      price_minor: priceFor(entry, brand, size, concentration),
    });
  }

  catalog.push(entry);
}

// Feature the products the owner actually photographed — those are the ones in the shop window.
const photographed = catalog.filter((p) => p.image_file);
photographed.slice(0, 12).forEach((p) => (p.is_featured = true));

await writeFile(OUT, JSON.stringify(catalog, null, 2));

// ---------------------------------------------------------------- report
console.log(`\n✓ wrote ${OUT}`);
console.log(`  products:        ${catalog.length}`);
console.log(`  with owner photo:${photographed.length}`);
console.log(`  variants:        ${catalog.reduce((n, p) => n + p.variants.length, 0)}`);
console.log(`  reusing DB slug: ${catalog.filter((p) => existing.some((e) => e.slug === p.slug)).length}`);
if (skipped.length) console.log(`  skipped (no name/brand): ${skipped.join(", ")}`);

const byCat = {};
catalog.forEach((p) => (byCat[p.category_slug] = (byCat[p.category_slug] || 0) + 1));
console.log(`  categories:      ${Object.entries(byCat).map(([k, v]) => `${k}=${v}`).join(", ")}`);

const byBrand = {};
catalog.forEach((p) => (byBrand[p.brand] = (byBrand[p.brand] || 0) + 1));
console.log(`  brands:          ${Object.entries(byBrand).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}(${v})`).join(", ")}`);

const noNotes = catalog.filter((p) => !p.top.length && !p.heart.length && !p.base.length);
if (noNotes.length) console.log(`  ! no note pyramid: ${noNotes.map((p) => p.slug).join(", ")}`);
