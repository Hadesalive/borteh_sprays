import type { Product } from "./api";

// Real product photos live in Supabase Storage (loaded with their original backgrounds by
// scripts/load-product-images.mjs) and always win. Products without one yet fall back to a
// fitting stand-in from this small pool of real perfume photos, matched by scent family.
const A = {
  asad: require("../assets/products/asad.jpg"), // dark / oud
  yara: require("../assets/products/yara.jpg"), // pink / floral-sweet
  khamrah: require("../assets/products/khamrah.jpg"), // amber / oriental
  badee: require("../assets/products/badee-al-oud-amethyst.jpg"), // gold / oud-rose
  fakhar: require("../assets/products/fakhar-black.jpg"), // dark / fresh masc
  club: require("../assets/products/club-de-nuit-intense-man.jpg"), // dark velvet
  tres: require("../assets/products/tres-nuit.jpg"), // clear / fresh
  kismet: require("../assets/products/kismet-angel.jpg"), // coral / gourmand
};

const BY_FAMILY: Record<string, number[]> = {
  woody: [A.asad, A.club, A.badee],
  oriental: [A.khamrah, A.badee, A.asad],
  spicy: [A.khamrah, A.badee],
  sweet: [A.kismet, A.yara],
  gourmand: [A.kismet, A.khamrah],
  floral: [A.yara, A.kismet],
  fruity: [A.yara, A.kismet],
  citrus: [A.tres, A.fakhar],
  fresh: [A.tres, A.fakhar],
  aromatic: [A.fakhar, A.tres],
  musky: [A.fakhar, A.club],
  leather: [A.club, A.asad],
};
const ALL = Object.values(A);

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

/** Real Storage photo when present, else a family-matched stand-in. */
export function productImage(p: Product): number | string | undefined {
  if (p.imageUrl) return p.imageUrl;
  const famNote = p.notes.find((n) => n.family && BY_FAMILY[n.family]);
  const pool = (famNote?.family && BY_FAMILY[famNote.family]) || ALL;
  return pool[hash(p.slug) % pool.length];
}
