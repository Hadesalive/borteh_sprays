// seed-borteh-catalog.mjs
// Replaces the whole product catalog with the owner's real Borteh stock: brands, products,
// scent-note pyramids, variants, a flat 20-unit stock per variant, and the owner's own
// bottle photography from /images.
//
// Replacement is by SOFT DELETE, never DROP: live orders (order_item) and combos reference
// product_variant with ON DELETE RESTRICT, so removing rows outright would either fail or
// destroy order history. Products absent from the catalog file get deleted_at + is_active=false,
// which every read path already filters on.
//
// Idempotent: re-running converges to the same state (upsert by slug/sku, stock set to exactly
// TARGET_STOCK via a ledger adjustment, images skipped when already uploaded).
//
// Run:
//   node scripts/seed-borteh-catalog.mjs --dry-run     # report the plan, touch nothing
//   node scripts/seed-borteh-catalog.mjs               # apply
//   node scripts/seed-borteh-catalog.mjs --skip-images # catalog only, no Storage uploads
//
// Credentials come from scripts/.env (SUPABASE_SECRET_KEY = service_role; bypasses RLS).

import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
// supabase-js v2 eagerly builds a Realtime client that needs a global WebSocket; Node <22 has
// none, so polyfill it. This script never opens a realtime channel.
import WebSocketImpl from "ws";
if (!globalThis.WebSocket) globalThis.WebSocket = WebSocketImpl;

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const CATALOG = join(HERE, "borteh-catalog.json");
const IMAGES_DIR = join(ROOT, "images");
const BUCKET = "product-images";
const TARGET_STOCK = 20;

const DRY = process.argv.includes("--dry-run");
const SKIP_IMAGES = process.argv.includes("--skip-images");

// ---------------------------------------------------------------- credentials
async function loadEnv() {
  const raw = await readFile(join(HERE, ".env"), "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}
const env = await loadEnv();
const URL_ = process.env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
if (!URL_ || !KEY) {
  console.error("Missing SUPABASE_URL / service-role key (scripts/.env).");
  process.exit(1);
}
const db = createClient(URL_, KEY, { auth: { persistSession: false } });

const log = (...a) => console.log(...a);
const die = (msg, err) => {
  console.error(`\n✖ ${msg}`, err?.message || err || "");
  process.exit(1);
};

// ---------------------------------------------------------------- note families
// Drives scent_note.note_family, which the recs/scent-preference features group on.
const NOTE_FAMILY = [
  [/oud|agarwood|oudh/i, "woody"],
  [/sandalwood|cedar|patchouli|vetiver|guaiac|papyrus|wood|birch|cypress|pine/i, "woody"],
  [/vanilla|caramel|toffee|chocolate|cocoa|praline|honey|sugar|candy|marshmallow|cotton candy|whipped|cream|milk|custard|pistachio|hazelnut|almond|coconut|coffee|mocha|biscuit|cake|meringue|nougat|butter|maple/i, "gourmand"],
  [/rose|jasmine|tuberose|orange blossom|neroli|ylang|violet|lily|peony|freesia|magnolia|gardenia|iris|orris|lavender flower|osmanthus|mimosa|narcissus|floral|blossom/i, "floral"],
  [/bergamot|lemon|lime|orange|mandarin|grapefruit|citrus|neroli oil|yuzu|petitgrain/i, "citrus"],
  [/apple|pear|peach|plum|raspberry|strawberry|cherry|blackcurrant|black currant|lychee|pineapple|mango|melon|banana|berry|fig|grape|passion|coconut water|apricot|nectarine|fruit/i, "fruity"],
  [/saffron|cardamom|cinnamon|nutmeg|clove|ginger|pepper|pimento|anise|coriander|cumin|spic/i, "spicy"],
  [/amber|ambergris|labdanum|benzoin|incense|frankincense|myrrh|resin|opoponax|styrax|tonka|balsam/i, "oriental"],
  [/musk|ambrette|ambroxan|cashmeran|iso e/i, "musky"],
  [/leather|suede|tobacco|birch tar/i, "leather"],
  [/lavender|rosemary|sage|basil|mint|thyme|eucalyptus|aromatic|geranium|herb/i, "aromatic"],
  [/marine|sea|aquatic|ozon|water|salt|calone/i, "fresh"],
  [/green|grass|leaf|moss|oakmoss|bamboo|tea|vetyver/i, "green"],
];
const noteFamily = (name) => NOTE_FAMILY.find(([re]) => re.test(name))?.[1] ?? "other";

// ---------------------------------------------------------------- helpers
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const titleNote = (s) =>
  s.trim().replace(/\s+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Upsert keyed on a natural key (slug / sku) that is enforced by a PARTIAL unique index
// ("... where deleted_at is null"). Postgres cannot infer ON CONFLICT from a partial index, so
// resolve the key to the primary key first and conflict on `id`, which is a real constraint.
// Rows whose key is not present yet are plain inserts.
async function upsertByNaturalKey(table, rows, keyCol) {
  if (!rows.length) return;
  const keys = rows.map((r) => r[keyCol]);
  const found = {};
  for (const batch of chunk(keys, 200)) {
    const { data, error } = await db.from(table).select(`id,${keyCol}`).in(keyCol, batch);
    if (error) die(`${table} key lookup failed`, error);
    data.forEach((r) => (found[r[keyCol]] = r.id));
  }
  const updates = rows.filter((r) => found[r[keyCol]]).map((r) => ({ ...r, id: found[r[keyCol]] }));
  const inserts = rows.filter((r) => !found[r[keyCol]]);

  for (const batch of chunk(updates, 100)) {
    const { error } = await db.from(table).upsert(batch, { onConflict: "id" });
    if (error) die(`${table} update failed`, error);
  }
  for (const batch of chunk(inserts, 100)) {
    const { error } = await db.from(table).insert(batch);
    if (error) die(`${table} insert failed`, error);
  }
  return { updated: updates.length, inserted: inserts.length };
}

async function main() {
  if (!existsSync(CATALOG)) die(`Catalog not found: ${CATALOG}`);
  const catalog = JSON.parse(await readFile(CATALOG, "utf8"));
  log(`\n▸ Catalog: ${catalog.length} products${DRY ? "   (DRY RUN — no writes)" : ""}\n`);

  // Fail fast on a malformed catalog rather than half-seeding the store.
  const slugs = new Set();
  for (const p of catalog) {
    for (const f of ["slug", "name", "brand", "brand_slug", "gender", "variants"]) {
      if (!p[f]) die(`Catalog entry missing "${f}": ${JSON.stringify(p).slice(0, 160)}`);
    }
    if (slugs.has(p.slug)) die(`Duplicate slug in catalog: ${p.slug}`);
    slugs.add(p.slug);
    if (!["male", "female", "unisex"].includes(p.gender)) die(`Bad gender "${p.gender}" on ${p.slug}`);
    if (!p.variants.length) die(`No variants on ${p.slug}`);
  }

  // ---------------------------------------------------------- 1. brands
  const brands = [...new Map(catalog.map((p) => [p.brand_slug, p.brand])).entries()]
    .map(([slug, name]) => ({ slug, name }));
  log(`1. Brands: ${brands.length} in catalog`);
  if (!DRY) {
    const r = await upsertByNaturalKey("brand", brands, "slug");
    log(`   ${r.inserted} new, ${r.updated} existing`);
  }
  const { data: brandRows, error: brandErr } = await db.from("brand").select("id,slug").is("deleted_at", null);
  if (brandErr) die("brand fetch failed", brandErr);
  const brandId = Object.fromEntries(brandRows.map((b) => [b.slug, b.id]));

  // ---------------------------------------------------------- 2. categories
  const cats = [...new Set(catalog.map((p) => p.category_slug).filter(Boolean))];
  const { data: catRows, error: catErr } = await db.from("category").select("id,slug").is("deleted_at", null);
  if (catErr) die("category fetch failed", catErr);
  const catId = Object.fromEntries(catRows.map((c) => [c.slug, c.id]));
  const missingCats = cats.filter((c) => !catId[c]);
  if (missingCats.length) log(`   ! categories not in DB (products will be uncategorised): ${missingCats.join(", ")}`);
  log(`2. Categories: ${cats.length} used, ${cats.length - missingCats.length} resolved`);

  // ---------------------------------------------------------- 3. scent notes
  const allNotes = new Set();
  for (const p of catalog) for (const pos of ["top", "heart", "base"]) (p[pos] || []).forEach((n) => allNotes.add(titleNote(n)));
  const noteRows = [...allNotes].map((name) => ({ name, note_family: noteFamily(name) }));
  log(`3. Scent notes: ${noteRows.length} unique`);
  if (!DRY) {
    for (const batch of chunk(noteRows, 200)) {
      const { error } = await db.from("scent_note").upsert(batch, { onConflict: "name", ignoreDuplicates: false });
      if (error) die("scent_note upsert failed", error);
    }
  }
  const { data: noteDbRows, error: noteErr } = await db.from("scent_note").select("id,name");
  if (noteErr) die("scent_note fetch failed", noteErr);
  const noteId = Object.fromEntries(noteDbRows.map((n) => [n.name, n.id]));

  // ---------------------------------------------------------- 4. products
  const productRows = catalog.map((p) => ({
    brand_id: brandId[p.brand_slug],
    category_id: catId[p.category_slug] ?? null,
    name: p.name,
    slug: p.slug,
    description: p.description ?? null,
    gender: p.gender,
    release_year: p.release_year ?? null,
    scent_family: p.scent_family ?? null,
    main_accords: p.main_accords?.length ? p.main_accords : null,
    is_active: true,
    is_featured: !!p.is_featured,
    deleted_at: null, // resurrect anything previously soft-deleted under the same slug
  }));
  log(`4. Products: upserting ${productRows.length}`);
  if (!DRY) {
    const r = await upsertByNaturalKey("product", productRows, "slug");
    log(`   ${r.inserted} new, ${r.updated} updated in place`);
  }
  const { data: prodRows, error: prodErr } = await db.from("product").select("id,slug").is("deleted_at", null);
  if (prodErr) die("product fetch failed", prodErr);
  const prodId = Object.fromEntries(prodRows.map((p) => [p.slug, p.id]));
  // On a dry run nothing was written, so only pre-existing products have ids. Stand in a
  // placeholder for the rest — otherwise the counts below silently report just the overlap
  // and read as though the seed would do far less work than it will.
  if (DRY) for (const p of catalog) if (!prodId[p.slug]) prodId[p.slug] = `dry-${p.slug}`;

  // ---------------------------------------------------------- 5. note pyramids
  const links = [];
  for (const p of catalog) {
    const pid = prodId[p.slug];
    if (!pid) continue;
    for (const position of ["top", "heart", "base"]) {
      for (const raw of p[position] || []) {
        const nid = noteId[titleNote(raw)];
        if (nid) links.push({ product_id: pid, scent_note_id: nid, position });
      }
    }
  }
  // Dedupe on the composite PK — a note repeated within one position would 409 the batch.
  const seenLink = new Set();
  const uniqueLinks = links.filter((l) => {
    const k = `${l.product_id}|${l.scent_note_id}|${l.position}`;
    if (seenLink.has(k)) return false;
    seenLink.add(k);
    return true;
  });
  log(`5. Note pyramid links: ${uniqueLinks.length}`);
  if (!DRY) {
    // Clear this catalog's existing links first so a re-run reflects corrected pyramids
    // instead of accumulating stale notes.
    const pids = catalog.map((p) => prodId[p.slug]).filter(Boolean);
    for (const batch of chunk(pids, 100)) {
      const { error } = await db.from("product_scent_note").delete().in("product_id", batch);
      if (error) die("product_scent_note clear failed", error);
    }
    for (const batch of chunk(uniqueLinks, 500)) {
      const { error } = await db.from("product_scent_note").insert(batch);
      if (error) die("product_scent_note insert failed", error);
    }
  }

  // ---------------------------------------------------------- 6. variants
  const variantRows = [];
  for (const p of catalog) {
    const pid = prodId[p.slug];
    if (!pid) continue;
    for (const v of p.variants) {
      variantRows.push({
        product_id: pid,
        size_ml: v.size_ml,
        concentration: v.concentration,
        sku: v.sku,
        price_minor: v.price_minor,
        compare_at_price_minor: v.compare_at_price_minor ?? null,
        currency: "SLE",
        is_active: true,
        deleted_at: null,
      });
    }
  }
  log(`6. Variants: upserting ${variantRows.length}`);
  if (!DRY) {
    const r = await upsertByNaturalKey("product_variant", variantRows, "sku");
    log(`   ${r.inserted} new, ${r.updated} updated in place`);
  }
  const catalogSkus = new Set(variantRows.map((v) => v.sku));
  const { data: varRows, error: varErr } = await db
    .from("product_variant")
    .select("id,sku,product_id")
    .is("deleted_at", null);
  if (varErr) die("variant fetch failed", varErr);
  const catalogVariants = varRows.filter((v) => catalogSkus.has(v.sku));

  // A product whose slug was reused keeps whatever variants it had before. Any size the owner
  // no longer stocks (an old 50ml sibling, say) would otherwise stay buyable at its old stock
  // level, so retire the sizes this catalog does not list.
  const keptProductIds = new Set(catalog.map((p) => prodId[p.slug]).filter(Boolean));
  const orphanVariants = varRows.filter((v) => keptProductIds.has(v.product_id) && !catalogSkus.has(v.sku));
  if (orphanVariants.length) {
    log(`   retiring ${orphanVariants.length} superseded size(s): ${orphanVariants.slice(0, 6).map((v) => v.sku).join(", ")}${orphanVariants.length > 6 ? "…" : ""}`);
    if (!DRY) {
      const now = new Date().toISOString();
      for (const batch of chunk(orphanVariants.map((v) => v.id), 100)) {
        const { error } = await db.from("product_variant").update({ is_active: false, deleted_at: now }).in("id", batch);
        if (error) die("orphan variant retire failed", error);
      }
    }
  }

  // ---------------------------------------------------------- 7. flat stock
  // inventory_item is created by a trigger on variant insert. Set on-hand to exactly
  // TARGET_STOCK through fn_adjust_stock so the ledger stays the source of truth
  // (the admin inventory screen reads it).
  log(`7. Stock: levelling ${catalogVariants.length} variants to ${TARGET_STOCK}`);
  if (!DRY) {
    const ids = catalogVariants.map((v) => v.id);
    const invByVariant = {};
    for (const batch of chunk(ids, 200)) {
      const { data, error } = await db.from("inventory_item").select("variant_id,qty_on_hand,qty_reserved").in("variant_id", batch);
      if (error) die("inventory fetch failed", error);
      data.forEach((r) => (invByVariant[r.variant_id] = r));
    }
    let adjusted = 0, skipped = 0, blocked = 0;
    for (const v of catalogVariants) {
      const inv = invByVariant[v.id];
      if (!inv) { log(`   ! no inventory_item for ${v.sku} — trigger did not fire`); continue; }
      // Never drop on-hand below what is already reserved for live orders.
      const floor = inv.qty_reserved ?? 0;
      const target = Math.max(TARGET_STOCK, floor);
      if (target !== TARGET_STOCK) blocked++;
      const delta = target - inv.qty_on_hand;
      if (delta === 0) { skipped++; continue; }
      const { error } = await db.rpc("fn_adjust_stock", {
        p_variant: v.id, p_delta: delta, p_actor: null, p_reason: "catalog reseed",
      });
      if (error) die(`fn_adjust_stock failed for ${v.sku}`, error);
      adjusted++;
    }
    log(`   ${adjusted} adjusted, ${skipped} already at target${blocked ? `, ${blocked} held above target by reservations` : ""}`);
  }

  // ---------------------------------------------------------- 8. retire old catalog
  const keepSlugs = new Set(catalog.map((p) => p.slug));
  const stale = prodRows.filter((p) => !keepSlugs.has(p.slug));
  log(`8. Retiring ${stale.length} products no longer stocked (soft delete)`);
  if (!DRY && stale.length) {
    const staleIds = stale.map((p) => p.id);
    const now = new Date().toISOString();
    for (const batch of chunk(staleIds, 100)) {
      const { error } = await db.from("product").update({ is_active: false, deleted_at: now }).in("id", batch);
      if (error) die("stale product soft-delete failed", error);
      const { error: vErr } = await db.from("product_variant").update({ is_active: false, deleted_at: now }).in("product_id", batch);
      if (vErr) die("stale variant soft-delete failed", vErr);
    }
    // Combos pointing at retired variants would render as broken pairs on the app home.
    const { data: staleVars } = await db.from("product_variant").select("id").in("product_id", staleIds.slice(0, 100));
    if (staleVars?.length) {
      const { data: badItems } = await db.from("combo_item").select("combo_id").in("variant_id", staleVars.map((v) => v.id));
      const badCombos = [...new Set((badItems || []).map((c) => c.combo_id))];
      if (badCombos.length) {
        const { error } = await db.from("combo").update({ is_active: false, deleted_at: now }).in("id", badCombos);
        if (error) die("combo deactivate failed", error);
        log(`   ${badCombos.length} combos deactivated (referenced retired stock)`);
      }
    }
  }

  // ---------------------------------------------------------- 9. images
  if (SKIP_IMAGES) {
    log("9. Images: skipped (--skip-images)");
  } else {
    const withImages = catalog.filter((p) => p.image_file);
    log(`9. Images: ${withImages.length} products have an owner photo`);
    if (!DRY) {
      // Always re-upload rather than skipping when the object name already exists: for a reused
      // slug that name holds the OLD catalogue's stock photo, and skipping would leave the
      // product showing someone else's bottle instead of the owner's.
      let uploaded = 0, linked = 0, missing = 0;
      for (const p of withImages) {
        const pid = prodId[p.slug];
        if (!pid) continue;
        const src = join(IMAGES_DIR, p.image_file);
        if (!existsSync(src)) { log(`   ! missing file for ${p.slug}: ${p.image_file}`); missing++; continue; }
        const objectName = `${p.slug}${extname(p.image_file).toLowerCase()}`;
        const bytes = await readFile(src);
        const { error } = await db.storage.from(BUCKET).upload(objectName, bytes, {
          contentType: "image/jpeg", upsert: true,
        });
        if (error) die(`upload failed for ${p.slug}`, error);
        uploaded++;
        // One primary image per product (uq_image_primary): replace rather than accumulate.
        const { error: delErr } = await db.from("product_image").delete().eq("product_id", pid);
        if (delErr) die(`product_image clear failed for ${p.slug}`, delErr);
        const { error: insErr } = await db.from("product_image").insert({
          product_id: pid,
          storage_path: objectName,
          alt_text: `${p.brand} ${p.name}`,
          sort_order: 0,
          is_primary: true,
        });
        if (insErr) die(`product_image insert failed for ${p.slug}`, insErr);
        linked++;
      }
      log(`   ${uploaded} uploaded, ${linked} linked${missing ? `, ${missing} source files missing` : ""}`);
    }
  }

  log(`\n✓ ${DRY ? "Dry run complete — nothing written." : "Catalog seeded."}\n`);
}

main().catch((e) => die("Unhandled error", e));
