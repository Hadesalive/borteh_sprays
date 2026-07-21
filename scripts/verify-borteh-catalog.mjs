// verify-borteh-catalog.mjs
// Post-seed verification: reads back what the app will actually see and reports anything that
// would render wrong — missing images, stale images, stock that is not the flat target, note
// pyramids that failed to link, retired products still visible.
//
// Run: node scripts/verify-borteh-catalog.mjs

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import WebSocketImpl from "ws";
if (!globalThis.WebSocket) globalThis.WebSocket = WebSocketImpl;

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET_STOCK = 20;
const SEED_DAY = "2026-07-20"; // objects older than this predate the owner-photo upload

const raw = await readFile(join(HERE, ".env"), "utf8");
const env = {};
for (const l of raw.split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim(); }
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const catalog = JSON.parse(await readFile(join(HERE, "borteh-catalog.json"), "utf8"));

const problems = [];
const ok = (label, detail = "") => console.log(`  ✓ ${label}${detail ? `  ${detail}` : ""}`);
const bad = (label, detail = "") => { console.log(`  ✖ ${label}${detail ? `  ${detail}` : ""}`); problems.push(label); };

console.log("\n▸ Verifying seeded catalog\n");

// ---- products live vs retired
const { data: live, error: liveErr } = await db
  .from("product").select("id,slug,name,is_active,description,scent_family,main_accords,release_year,category_id")
  .is("deleted_at", null).eq("is_active", true);
if (liveErr) { console.error(liveErr); process.exit(1); }
const catSlugs = new Set(catalog.map((p) => p.slug));
const liveSlugs = new Set(live.map((p) => p.slug));

console.log(`Products (${live.length} live)`);
live.length === catalog.length
  ? ok(`live count matches catalog (${catalog.length})`)
  : bad(`live count ${live.length} != catalog ${catalog.length}`);
const strays = live.filter((p) => !catSlugs.has(p.slug));
strays.length ? bad(`${strays.length} live products are not in the catalog`, strays.slice(0, 5).map((p) => p.slug).join(", ")) : ok("no stray products still visible");
const absent = catalog.filter((p) => !liveSlugs.has(p.slug));
absent.length ? bad(`${absent.length} catalog products missing/inactive`, absent.slice(0, 5).map((p) => p.slug).join(", ")) : ok("every catalog product is live");
const noDesc = live.filter((p) => !p.description);
noDesc.length ? bad(`${noDesc.length} live products have no description`) : ok("all have descriptions");
const noCat = live.filter((p) => !p.category_id);
noCat.length ? bad(`${noCat.length} live products have no category`) : ok("all have a category");
const noAcc = live.filter((p) => !p.main_accords?.length);
noAcc.length ? bad(`${noAcc.length} live products have no accords`) : ok("all have main accords");

// ---- note pyramids
const prodIds = live.map((p) => p.id);
const noteCount = {};
for (let i = 0; i < prodIds.length; i += 100) {
  const { data } = await db.from("product_scent_note").select("product_id,position").in("product_id", prodIds.slice(i, i + 100));
  (data || []).forEach((r) => (noteCount[r.product_id] = (noteCount[r.product_id] || 0) + 1));
}
const totalLinks = Object.values(noteCount).reduce((a, b) => a + b, 0);
const noNotes = live.filter((p) => !noteCount[p.id]);
console.log(`\nScent notes (${totalLinks} links)`);
noNotes.length ? bad(`${noNotes.length} products have no note pyramid`, noNotes.slice(0, 5).map((p) => p.slug).join(", ")) : ok("every product has a note pyramid");

// ---- variants + stock
const { data: variants } = await db.from("product_variant").select("id,sku,product_id,price_minor,is_active").is("deleted_at", null).eq("is_active", true);
const liveIds = new Set(prodIds);
const catVariants = (variants || []).filter((v) => liveIds.has(v.product_id));
console.log(`\nVariants (${catVariants.length} live)`);
const expectedVariants = catalog.reduce((n, p) => n + p.variants.length, 0);
catVariants.length === expectedVariants ? ok(`variant count matches catalog (${expectedVariants})`) : bad(`variant count ${catVariants.length} != expected ${expectedVariants}`);
const freeVariants = catVariants.filter((v) => !v.price_minor || v.price_minor <= 0);
freeVariants.length ? bad(`${freeVariants.length} variants priced at zero`) : ok("all variants priced");

const inv = {};
const vIds = catVariants.map((v) => v.id);
for (let i = 0; i < vIds.length; i += 200) {
  const { data } = await db.from("inventory_item").select("variant_id,qty_on_hand,qty_reserved,qty_available").in("variant_id", vIds.slice(i, i + 200));
  (data || []).forEach((r) => (inv[r.variant_id] = r));
}
const missingInv = catVariants.filter((v) => !inv[v.id]);
const offTarget = catVariants.filter((v) => inv[v.id] && inv[v.id].qty_on_hand !== TARGET_STOCK);
console.log(`\nStock (target ${TARGET_STOCK}/variant)`);
missingInv.length ? bad(`${missingInv.length} variants have no inventory row`) : ok("every variant has an inventory row");
offTarget.length
  ? bad(`${offTarget.length} variants not at ${TARGET_STOCK}`, offTarget.slice(0, 5).map((v) => `${v.sku}=${inv[v.id].qty_on_hand}`).join(", "))
  : ok(`all ${catVariants.length} variants at exactly ${TARGET_STOCK}`);

// ---- images
const { data: objects } = await db.storage.from("product-images").list("", { limit: 1000 });
const objByName = new Map((objects || []).map((f) => [f.name, f]));
const { data: imgRows } = await db.from("product_image").select("product_id,storage_path,is_primary");
const imgByProduct = {};
(imgRows || []).forEach((r) => { if (liveIds.has(r.product_id)) (imgByProduct[r.product_id] = imgByProduct[r.product_id] || []).push(r); });

const withPhoto = catalog.filter((p) => p.image_file);
const slugToId = Object.fromEntries(live.map((p) => [p.slug, p.id]));
console.log(`\nImages (${withPhoto.length} products have an owner photo)`);
const unlinked = withPhoto.filter((p) => !imgByProduct[slugToId[p.slug]]?.length);
unlinked.length ? bad(`${unlinked.length} photographed products have no product_image row`, unlinked.slice(0, 5).map((p) => p.slug).join(", ")) : ok("all photographed products linked");
const missingObj = withPhoto.filter((p) => !objByName.has(`${p.slug}.jpg`));
missingObj.length ? bad(`${missingObj.length} storage objects missing`, missingObj.slice(0, 5).map((p) => p.slug).join(", ")) : ok("all storage objects present");
// Compare the stored object's byte size to the owner's source photo. created_at is not usable
// here: overwriting an object preserves it, so a re-uploaded file still looks "old". Size is a
// direct check on the content actually being served.
const stale = [];
for (const p of withPhoto) {
  const f = objByName.get(`${p.slug}.jpg`);
  if (!f) continue;
  const localBytes = (await readFile(join(HERE, "..", "images", p.image_file))).length;
  const storedBytes = Number(f.metadata?.size ?? -1);
  if (storedBytes !== localBytes) stale.push(`${p.slug} (stored ${storedBytes}b vs photo ${localBytes}b)`);
}
stale.length
  ? bad(`${stale.length} products do not serve the owner's photo`, stale.slice(0, 6).join(", "))
  : ok(`all ${withPhoto.length} linked images byte-match the owner's photos`);
const multiPrimary = Object.entries(imgByProduct).filter(([, v]) => v.filter((r) => r.is_primary).length > 1);
multiPrimary.length ? bad(`${multiPrimary.length} products have >1 primary image`) : ok("one primary image per product");

// ---- a public fetch, exactly as the app would do it
const sample = withPhoto[0];
if (sample) {
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${sample.slug}.jpg`;
  const resp = await fetch(url);
  const len = resp.headers.get("content-length");
  console.log("\nPublic CDN read");
  resp.ok ? ok(`${sample.slug}.jpg fetches anonymously`, `HTTP ${resp.status}, ${len}b, ${resp.headers.get("content-type")}`)
          : bad(`public image fetch failed`, `HTTP ${resp.status}`);
}

// ---- combos referencing retired stock
const { data: activeCombos } = await db.from("combo").select("id,name").is("deleted_at", null).eq("is_active", true);
const comboIds = (activeCombos || []).map((c) => c.id);
let brokenCombos = 0;
if (comboIds.length) {
  const { data: items } = await db.from("combo_item").select("combo_id,variant_id").in("combo_id", comboIds);
  const liveVarIds = new Set(catVariants.map((v) => v.id));
  brokenCombos = [...new Set((items || []).filter((i) => !liveVarIds.has(i.variant_id)).map((i) => i.combo_id))].length;
}
console.log(`\nCombos (${comboIds.length} active)`);
brokenCombos ? bad(`${brokenCombos} active combos point at retired stock`) : ok("no active combo references retired stock");

console.log(problems.length ? `\n✖ ${problems.length} problem(s) found\n` : "\n✓ All checks passed\n");
process.exit(problems.length ? 1 : 0);
