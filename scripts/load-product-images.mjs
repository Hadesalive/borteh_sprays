// load-product-images.mjs
// Downloads each perfume's image, strips the white studio background to a transparent PNG
// (CUTOUT=0 keeps the original JPG), uploads it to the `product-images` Storage bucket, then
// attaches it as the product's primary image. Idempotent — safe to re-run.
//
// Test a few first (glass bottles are the hard case):
//   ONLY=asad,khamrah,club-de-nuit-intense-man node load-product-images.mjs
// Then run the whole set with no ONLY.
//
// NOTE: these are brand-owned images, used as DEV placeholders. Replace with the owner's own
// bottle photography or licensed images before a public launch.
//
// Prereqs (run from the project root, in your own Terminal):
//   1. supabase db push --include-seed   # applies the product-images bucket (0005) + seeds the products
//   2. cd scripts && npm install
// Run:
//   SUPABASE_URL=https://oltuvavkssvgmqnduxvh.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service_role key: Dashboard → Settings → API> \
//   node load-product-images.mjs
//
// The service_role key bypasses RLS for the upload/link; keep it local (never ship it in the app).

import { removeBackground } from "@imgly/background-removal-node";
import { createClient } from "@supabase/supabase-js";
// supabase-js v2 eagerly constructs a Realtime client that needs a global WebSocket.
// Node < 22 has none, so polyfill via 'ws' (this script never uses realtime).
import WebSocketImpl from "ws";
if (!globalThis.WebSocket) globalThis.WebSocket = WebSocketImpl;

const SUPABASE_URL = process.env.SUPABASE_URL || "https://oltuvavkssvgmqnduxvh.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "product-images";

// Cut out the white studio background → transparent PNG (default on; set CUTOUT=0 to keep originals).
// Glass/clear bottles are the hard case, so test a few first:  ONLY=asad,khamrah node load-product-images.mjs
const CUTOUT = process.env.CUTOUT !== "0";
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",").map((s) => s.trim())) : null;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// slug (must match seed.sql) -> Fragrantica perfume id (image at fimgs.net/mdimg/perfume/375x500.<id>.jpg)
const PRODUCTS = [
  { slug: "asad",                     name: "Lattafa Asad",                   id: 72821 },
  { slug: "yara",                     name: "Lattafa Yara",                   id: 76880 },
  { slug: "khamrah",                  name: "Lattafa Khamrah",                id: 75805 },
  { slug: "badee-al-oud-amethyst",    name: "Lattafa Bade'e Al Oud Amethyst", id: 68214 },
  { slug: "fakhar-black",             name: "Lattafa Fakhar Black",           id: 70465 },
  { slug: "club-de-nuit-intense-man", name: "Armaf Club de Nuit Intense Man", id: 34696 },
  { slug: "tres-nuit",                name: "Armaf Tres Nuit",                id: 27711 },
  { slug: "kismet-angel",             name: "Maison Alhambra Kismet Angel",   id: 79015 },

  // --- catalogue from seed_catalog.sql — fill each Fragrantica id (fragrantica.com → the
  //     perfume page URL ends in "-<id>.html"), then re-run. Entries with id: null are skipped. ---
  { slug: "fakhar-lattafa-rose",           name: "Lattafa Fakhar Lattafa",                   id: 70466 },
  { slug: "asad-zanzibar",                 name: "Lattafa Asad Zanzibar",                    id: 90713 },
  { slug: "yara-moi",                      name: "Lattafa Yara Moi",                         id: 80722 },
  { slug: "yara-tous",                     name: "Lattafa Yara Tous",                        id: 83320 },
  { slug: "khamrah-qahwa",                 name: "Lattafa Khamrah Qahwa",                    id: 88175 },
  { slug: "ana-abiyedh-rouge",             name: "Lattafa Ana Abiyedh Rouge",                id: 63062 },
  { slug: "raghba",                        name: "Lattafa Raghba",                           id: 25807 },
  { slug: "ramz-lattafa-gold",             name: "Lattafa Ramz Lattafa Gold",                id: 70368 },
  { slug: "mayar",                         name: "Lattafa Mayar",                            id: 84309 },
  { slug: "mayar-chocolate",               name: "Lattafa Mayar Chocolate",                  id: null },
  { slug: "oud-mood",                      name: "Lattafa Oud Mood",                         id: 46814 },
  { slug: "velvet-oud",                    name: "Lattafa Velvet Oud",                       id: 60262 },
  { slug: "his-confession",                name: "Lattafa His Confession",                   id: 96866 },
  { slug: "maahir",                        name: "Lattafa Maahir",                           id: 64950 },
  { slug: "maahir-legacy",                 name: "Lattafa Maahir Legacy",                    id: 82727 },
  { slug: "opulent-musk",                  name: "Lattafa Opulent Musk",                     id: 67940 },
  { slug: "qaed-al-fursan",                name: "Lattafa Qaed Al Fursan",                   id: 67996 },
  { slug: "qaed-al-fursan-unlimited",      name: "Lattafa Qaed Al Fursan Unlimited",         id: 82590 },
  { slug: "najdia",                        name: "Lattafa Najdia",                           id: 66011 },
  { slug: "ajwad",                         name: "Lattafa Ajwad",                            id: 75099 },
  { slug: "haya",                          name: "Lattafa Haya",                             id: 85031 },
  { slug: "nebras",                        name: "Lattafa Nebras",                           id: 78560 },
  { slug: "teriaq",                        name: "Lattafa Teriaq",                           id: 89850 },
  { slug: "badee-al-oud-sublime",          name: "Lattafa Bade'e Al Oud Sublime",            id: 83309 },
  { slug: "pride-al-nashama",              name: "Lattafa Pride Al Nashama",                 id: 89762 },
  { slug: "fae",                           name: "Lattafa Fae",                              id: null },
  { slug: "eclaire",                       name: "Lattafa Eclaire",                          id: 93628 },
  { slug: "hayaati",                       name: "Lattafa Hayaati",                          id: 75902 },
  { slug: "club-de-nuit-sillage",          name: "Armaf Club de Nuit Sillage",               id: 64105 },
  { slug: "club-de-nuit-untold",           name: "Armaf Club de Nuit Untold",                id: 78476 },
  { slug: "club-de-nuit-urban-man-elixir", name: "Armaf Club de Nuit Urban Man Elixir",      id: 77860 },
  { slug: "club-de-nuit-woman",            name: "Armaf Club de Nuit Woman",                 id: 27655 },
  { slug: "ventana",                       name: "Armaf Ventana",                            id: 50265 },
  { slug: "derby-club-house",              name: "Armaf Derby Club House",                   id: 27690 },
  { slug: "hunter-armaf",                  name: "Armaf Hunter",                             id: 27665 },
  { slug: "le-parfait",                    name: "Armaf Le Parfait",                         id: 45124 },
  { slug: "odyssey-mandarin-sky",          name: "Armaf Odyssey Mandarin Sky",               id: 83132 },
  { slug: "odyssey-aoud",                  name: "Armaf Odyssey Aoud",                       id: 83136 },
  { slug: "bucephalus-xi",                 name: "Armaf Bucephalus XI",                      id: 64457 },
  { slug: "tag-him",                       name: "Armaf Tag Him",                            id: 27708 },
  { slug: "barakkat-rouge-540",            name: "Maison Alhambra Barakkat Rouge 540",       id: 107710 },
  { slug: "barakkat-satin-oud",            name: "Maison Alhambra Barakkat Satin Oud",       id: 107711 },
  { slug: "jean-lowe-immortal",            name: "Maison Alhambra Jean Lowe Immortal",       id: 83666 },
  { slug: "le-de-blanc",                   name: "Maison Alhambra Le De Blanc",              id: null },
  { slug: "salvo",                         name: "Maison Alhambra Salvo",                    id: 93538 },
  { slug: "raved",                         name: "Maison Alhambra Raved",                    id: null },
  { slug: "the-tux",                       name: "Maison Alhambra The Tux",                  id: 78559 },
  { slug: "olympic-man",                   name: "Maison Alhambra Olympic Man",              id: null },
  { slug: "versatile-cardinal",            name: "Maison Alhambra Versatile Cardinal",       id: null },
  { slug: "philos-aexclusif",              name: "Maison Alhambra Philos Aexclusif",         id: null },
  { slug: "amber-oud-gold-edition",        name: "Al Haramain Amber Oud Gold Edition",       id: 51816 },
  { slug: "amber-oud-rouge-edition",       name: "Al Haramain Amber Oud Rouge Edition",      id: 66100 },
  { slug: "amber-oud-carbon-edition",      name: "Al Haramain Amber Oud Carbon Edition",     id: 73207 },
  { slug: "laventure",                     name: "Al Haramain L'Aventure",                   id: 40405 },
  { slug: "laventure-knight",              name: "Al Haramain L'Aventure Knight",            id: 51824 },
  { slug: "junoon",                        name: "Al Haramain Junoon",                       id: 42649 },
  { slug: "manificent",                    name: "Al Haramain Manificent",                   id: null },
  { slug: "musk-tahara",                   name: "Al Haramain Musk Tahara",                  id: null },
  { slug: "hawas-for-him",                 name: "Rasasi Hawas for Him",                     id: 46890 },
  { slug: "hawas-ice",                     name: "Rasasi Hawas Ice",                         id: 89050 },
  { slug: "hawas-for-her",                 name: "Rasasi Hawas for Her",                     id: 67146 },
  { slug: "daarej",                        name: "Rasasi Daarej",                            id: 19688 },
  { slug: "la-yuqawam",                    name: "Rasasi La Yuqawam",                        id: 19668 },
  { slug: "shuhrah",                       name: "Rasasi Shuhrah",                           id: 53578 },
  { slug: "royale-blue",                   name: "Rasasi Royale Blue",                       id: 22379 },
  { slug: "9pm",                           name: "Afnan 9 PM",                               id: 65414 },
  { slug: "9am",                           name: "Afnan 9 AM",                               id: 70706 },
  { slug: "9pm-femme",                     name: "Afnan 9 PM Femme",                         id: 78544 },
  { slug: "supremacy-not-only-intense",    name: "Afnan Supremacy Not Only Intense",         id: 68271 },
  { slug: "supremacy-silver",              name: "Afnan Supremacy Silver",                   id: 27352 },
  { slug: "turathi-blue",                  name: "Afnan Turathi Blue",                       id: 70839 },
  { slug: "rare-carbon",                   name: "Afnan Rare Carbon",                        id: 66627 },
  { slug: "482-avant-garde",               name: "Afnan 482 Avant Garde",                    id: null },
  { slug: "zimaya-francesca",              name: "Afnan Zimaya Francesca",                   id: null },
  { slug: "shaghaf-oud",                   name: "Swiss Arabian Shaghaf Oud",                id: 50582 },
  { slug: "layali",                        name: "Swiss Arabian Layali",                     id: 56235 },
  { slug: "musk-malaki",                   name: "Swiss Arabian Musk Malaki",                id: 54148 },
  { slug: "casablanca-sa",                 name: "Swiss Arabian Casablanca",                 id: 42181 },
  { slug: "edge-sa",                       name: "Swiss Arabian Edge",                       id: 22991 },
  { slug: "mukhallat-malaki",              name: "Swiss Arabian Mukhallat Malaki",           id: 10849 },
  { slug: "emir-ageratum",                 name: "Paris Corner Emir Ageratum",               id: null },
  { slug: "emir-iris-harlww",              name: "Paris Corner Emir Iris Harlww",            id: null },
  { slug: "emir-laverne-immortal",         name: "Paris Corner Emir Laverne Immortal",       id: null },
  { slug: "emir-botafok",                  name: "Paris Corner Emir Bota'fok",               id: null },
  { slug: "jazzab-gold",                   name: "Ard Al Zaafaran Jazzab Gold",              id: 124587 },
  { slug: "romancea",                      name: "Ard Al Zaafaran Romancea",                 id: 59147 },
  { slug: "dukhan",                        name: "Ard Al Zaafaran Dukhan",                   id: null },
  { slug: "liquid-brun",                   name: "French Avenue Liquid Brun",                id: 94713 },
  { slug: "oud-experience",                name: "French Avenue Oud Experience",             id: null },
];

if (!SERVICE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY (Dashboard → Settings → API → service_role key).");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function run() {
  console.log(`Loading ${PRODUCTS.length} product images → ${SUPABASE_URL} (bucket: ${BUCKET})\n`);
  let ok = 0, skipped = 0;

  for (const p of PRODUCTS) {
    if (ONLY && !ONLY.has(p.slug)) continue;
    process.stdout.write(`• ${p.name} … `);
    if (!p.id) { console.log("no Fragrantica id yet — skipped"); skipped++; continue; }
    try {
      // 1) download source image (browser UA + referer so the CDN serves it)
      const url = `https://fimgs.net/mdimg/perfume/375x500.${p.id}.jpg`;
      const resp = await fetch(url, { headers: { "User-Agent": UA, Referer: "https://www.fragrantica.com/" } });
      if (!resp.ok) { console.log(`download HTTP ${resp.status} — skipped`); skipped++; continue; }
      let imgBuf = Buffer.from(await resp.arrayBuffer());
      let ext = "jpg", contentType = "image/jpeg";

      // 2) optionally strip the white studio background → transparent PNG
      if (CUTOUT) {
        process.stdout.write("cutout … ");
        const blob = await removeBackground(imgBuf, { output: { format: "image/png" } });
        imgBuf = Buffer.from(await blob.arrayBuffer());
        ext = "png";
        contentType = "image/png";
      }

      // 3) upload — upsert so re-runs replace cleanly
      const objectKey = `${p.slug}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(objectKey, imgBuf, {
        contentType, upsert: true,
      });
      if (upErr) { console.log(`upload failed: ${upErr.message}`); skipped++; continue; }

      // 3) attach as the product's primary image (idempotent: clear existing primary first)
      const { data: prod, error: pErr } = await supabase
        .from("product").select("id").eq("slug", p.slug).maybeSingle();
      if (pErr || !prod) { console.log(`no product for slug '${p.slug}' (run the seed first) — skipped`); skipped++; continue; }

      await supabase.from("product_image").delete().eq("product_id", prod.id).eq("is_primary", true);
      const { error: insErr } = await supabase.from("product_image").insert({
        product_id: prod.id, storage_path: objectKey, alt_text: p.name, is_primary: true, sort_order: 0,
      });
      if (insErr) { console.log(`link failed: ${insErr.message}`); skipped++; continue; }

      const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(objectKey).data.publicUrl;
      console.log(`done → ${publicUrl}`);
      ok++;
    } catch (e) {
      console.log(`error: ${e?.message || e}`);
      skipped++;
    }
  }
  console.log(`\nFinished: ${ok} images loaded, ${skipped} skipped.`);
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
