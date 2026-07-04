import { useQuery } from "@tanstack/react-query";
import { imageUrl, supabase } from "./supabase";

export type Band = "in_stock" | "low" | "out";
export type Gender = "male" | "female" | "unisex";
export type NotePos = "top" | "heart" | "base";
export type Concentration = "EDC" | "EDT" | "EDP" | "Parfum" | "Extrait";
export type ScentNote = { name: string; family: string | null; position: NotePos };
export type ProductVariant = {
  id: string;
  sizeMl: number;
  priceMinor: number;
  compareMinor: number | null; // was-price when on sale, else null
  concentration: Concentration;
  band: Band;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  gender: Gender;
  createdAt: string | null; // catalog add date — drives "New arrivals"
  brand: string;
  brandSlug: string;
  collection: string | null; // category slug, e.g. "date-night"
  collectionName: string | null;
  isFeatured: boolean;
  popularity: number;
  rating: number;
  reviews: number;
  fromPriceMinor: number | null;
  fromCompareMinor: number | null; // was-price for the "from" variant, when on sale
  band: Band;
  imageUrl: string | null;
  concentration: Concentration | null;
  releaseYear: number | null; // from Fragrantica enrichment
  scentFamily: string | null; // e.g. "Oriental", "Woody Spicy"
  accords: string[]; // main accords, strongest first
  notes: ScentNote[];
  variants: ProductVariant[]; // every purchasable size, cheapest first
};

const one = <T>(v: T | T[] | null | undefined): T | undefined =>
  Array.isArray(v) ? v[0] : (v ?? undefined);

type NoteRow = { position: NotePos; scent_note: { name: string; note_family: string | null } | { name: string; note_family: string | null }[] | null };

type Row = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  gender: Gender;
  created_at: string | null;
  release_year: number | null;
  scent_family: string | null;
  main_accords: string[] | null;
  is_featured: boolean;
  popularity_score: number;
  avg_rating: number;
  review_count: number;
  brand: { name: string; slug: string } | { name: string; slug: string }[] | null;
  category: { name: string; slug: string } | { name: string; slug: string }[] | null;
  product_variant: { id: string; size_ml: number; price_minor: number; compare_at_price_minor: number | null; concentration: Concentration; availability_signal: { band: Band } | { band: Band }[] | null }[];
  product_scent_note: NoteRow[];
  product_image: { storage_path: string; is_primary: boolean }[];
};

const NOTE_ORDER: Record<NotePos, number> = { top: 0, heart: 1, base: 2 };
const CONC_RANK: Concentration[] = ["EDC", "EDT", "EDP", "Parfum", "Extrait"];

function normalize(r: Row): Product {
  const priced = (r.product_variant ?? []).filter((v) => v.price_minor != null);
  // The "from" price is the cheapest variant; its compare-at drives the strikethrough,
  // so the was-price always matches the price we actually display.
  const cheapest = priced.length ? priced.reduce((a, b) => (b.price_minor < a.price_minor ? b : a)) : null;
  const fromPriceMinor = cheapest?.price_minor ?? null;
  const compare = cheapest?.compare_at_price_minor ?? null;
  const fromCompareMinor = compare != null && fromPriceMinor != null && compare > fromPriceMinor ? compare : null;
  const bands = (r.product_variant ?? []).map((v) => one(v.availability_signal)?.band ?? "out");
  const band: Band = bands.includes("in_stock") ? "in_stock" : bands.includes("low") ? "low" : "out";
  const primary = (r.product_image ?? []).find((i) => i.is_primary) ?? (r.product_image ?? [])[0];

  // Strongest concentration carried by any variant — the headline strength.
  // Every priced size, cheapest first — drives the detail-page size selector.
  const variants: ProductVariant[] = priced
    .map((v) => ({
      id: v.id,
      sizeMl: v.size_ml,
      priceMinor: v.price_minor,
      compareMinor: v.compare_at_price_minor != null && v.compare_at_price_minor > v.price_minor ? v.compare_at_price_minor : null,
      concentration: v.concentration,
      band: one(v.availability_signal)?.band ?? "out",
    }))
    .sort((a, b) => a.priceMinor - b.priceMinor);

  const concs = (r.product_variant ?? []).map((v) => v.concentration).filter(Boolean);
  const concentration = concs.length
    ? concs.slice().sort((a, b) => CONC_RANK.indexOf(b) - CONC_RANK.indexOf(a))[0]
    : null;

  // Scent pyramid, ordered top → heart → base.
  const notes: ScentNote[] = (r.product_scent_note ?? [])
    .map((n) => ({ name: one(n.scent_note)?.name ?? "", family: one(n.scent_note)?.note_family ?? null, position: n.position }))
    .filter((n) => n.name)
    .sort((a, b) => NOTE_ORDER[a.position] - NOTE_ORDER[b.position]);

  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description ?? null,
    gender: r.gender,
    createdAt: r.created_at ?? null,
    brand: one(r.brand)?.name ?? "",
    brandSlug: one(r.brand)?.slug ?? "",
    collection: one(r.category)?.slug ?? null,
    collectionName: one(r.category)?.name ?? null,
    isFeatured: r.is_featured,
    popularity: r.popularity_score,
    rating: Number(r.avg_rating ?? 0),
    reviews: r.review_count ?? 0,
    fromPriceMinor,
    fromCompareMinor,
    band,
    imageUrl: imageUrl(primary?.storage_path),
    concentration,
    releaseYear: r.release_year ?? null,
    scentFamily: r.scent_family ?? null,
    accords: r.main_accords ?? [],
    notes,
    variants,
  };
}

const SELECT =
  "id, slug, name, description, gender, created_at, release_year, scent_family, main_accords, is_featured, popularity_score, avg_rating, review_count, " +
  "brand:brand_id(name, slug), " +
  "category:category_id(name, slug), " +
  "product_variant(id, size_ml, price_minor, compare_at_price_minor, concentration, availability_signal(band)), " +
  "product_scent_note(position, scent_note(name, note_family)), " +
  "product_image(storage_path, is_primary)";

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("product")
    .select(SELECT)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("popularity_score", { ascending: false })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data as unknown as Row[]).map(normalize);
}

/** Top notes only, e.g. "Bergamot". Falls back to the first note. */
export const topNotes = (p: Product) => p.notes.filter((n) => n.position === "top");

/** The scent signature line, e.g. "Bergamot · Amber · Oud". */
export const noteLine = (p: Product) => p.notes.map((n) => n.name).join("  ·  ");

/** Whole-percent discount off the "from" price, or 0 when not on sale. */
export const discountPct = (p: Product) =>
  p.fromCompareMinor && p.fromPriceMinor ? Math.round((1 - p.fromPriceMinor / p.fromCompareMinor) * 100) : 0;

/** All products (catalog). Cached 5 min — data-frugal on metered connections (ADR-003). */
export function useProducts() {
  return useQuery<Product[]>({ queryKey: ["products"], queryFn: fetchProducts, staleTime: 5 * 60 * 1000 });
}

// --- Storefront curation (admin-managed home rails) -------------------------

export type BrandLite = { slug: string; name: string; logoPath: string | null };

/** Active brands in the owner's curated order (featured first). Drives "Shop by brand". */
export async function fetchBrands(): Promise<BrandLite[]> {
  const { data, error } = await supabase
    .from("brand")
    .select("name, slug, logo_path")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("is_featured_home", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((b) => ({
    slug: b.slug as string,
    name: b.name as string,
    logoPath: (b.logo_path as string | null) ?? null,
  }));
}

export function useBrands() {
  return useQuery<BrandLite[]>({ queryKey: ["brands"], queryFn: fetchBrands, staleTime: 5 * 60 * 1000 });
}

export type CollectionLite = { slug: string; name: string; coverPath: string | null };

/** Collections the owner has featured on the home, in curated order. */
export async function fetchFeaturedCollections(): Promise<CollectionLite[]> {
  const { data, error } = await supabase
    .from("category")
    .select("name, slug, cover_image_path")
    .eq("is_active", true)
    .eq("is_featured_home", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((c) => ({
    slug: c.slug as string,
    name: c.name as string,
    coverPath: (c.cover_image_path as string | null) ?? null,
  }));
}

export function useFeaturedCollections() {
  return useQuery<CollectionLite[]>({
    queryKey: ["featured-collections"],
    queryFn: fetchFeaturedCollections,
    staleTime: 5 * 60 * 1000,
  });
}

export type HeroSlideRow = {
  id: string;
  label: string | null;
  title: string;
  cta: string | null;
  link: string | null;
  imagePath: string | null;
};

/** Active hero-carousel slides in curated order. Drives the home hero. */
export async function fetchHomeCarousel(): Promise<HeroSlideRow[]> {
  const { data, error } = await supabase
    .from("home_carousel")
    .select("id, label, title, cta_text, link_url, image_path")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    label: (r.label as string | null) ?? null,
    title: r.title as string,
    cta: (r.cta_text as string | null) ?? null,
    link: (r.link_url as string | null) ?? null,
    imagePath: (r.image_path as string | null) ?? null,
  }));
}

export function useHomeCarousel() {
  return useQuery<HeroSlideRow[]>({
    queryKey: ["home-carousel"],
    queryFn: fetchHomeCarousel,
    staleTime: 5 * 60 * 1000,
  });
}

export type ScentFamily = { family: string; label: string; imagePath: string | null };

/** Curated "Shop by scent" families in order. Drives the home scent rail. */
export async function fetchScentFamilies(): Promise<ScentFamily[]> {
  const { data, error } = await supabase
    .from("home_scent_family")
    .select("family, label, image_path")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    family: r.family as string,
    label: r.label as string,
    imagePath: (r.image_path as string | null) ?? null,
  }));
}

export function useScentFamilies() {
  return useQuery<ScentFamily[]>({
    queryKey: ["scent-families"],
    queryFn: fetchScentFamilies,
    staleTime: 5 * 60 * 1000,
  });
}
