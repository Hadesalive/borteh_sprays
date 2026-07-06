import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import type { Product } from "./api";

// One search + filter engine for Shop and Search: a shared in-memory filter store
// (same singleton idiom as cart/wishlist), pure filter/sort/rank functions, and a
// persisted recent-searches list. Screens stay thin; the logic lives here.

// ── Sort ────────────────────────────────────────────────────────────────────

export type SortKey = "for_you" | "featured" | "price_asc" | "price_desc" | "rating" | "newest";

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "for_you", label: "For you" },
  { key: "featured", label: "Best selling" },
  { key: "price_asc", label: "Price: low to high" },
  { key: "price_desc", label: "Price: high to low" },
  { key: "rating", label: "Top rated" },
  { key: "newest", label: "Newest" },
];

export const sortLabel = (k: SortKey) => SORT_OPTIONS.find((o) => o.key === k)?.label ?? "For you";

/** Sorts that preserve an upstream relevance order (server search / personalized rank) rather than
 *  re-ordering client-side. Shop & Search use this to know when NOT to override the ranked list. */
export const isRelevanceSort = (k: SortKey) => k === "for_you" || k === "featured";

// ── Filter state (shared between Shop, Search and the Filter sheet) ─────────

export type Filters = {
  families: string[]; // note families, e.g. "woody"
  brands: string[]; // brand slugs
  sizes: number[]; // ml
  priceMin: number | null; // minor units, on the displayed "from" price
  priceMax: number | null;
  inStockOnly: boolean;
  minRating: number | null; // e.g. 4 or 4.5
  sort: SortKey;
};

export const DEFAULT_FILTERS: Filters = {
  families: [],
  brands: [],
  sizes: [],
  priceMin: null,
  priceMax: null,
  inStockOnly: false,
  minRating: null,
  sort: "for_you",
};

let filters: Filters = { ...DEFAULT_FILTERS };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useFilters = () => useSyncExternalStore(subscribe, () => filters, () => filters);
export const getFilters = () => filters;

export function setFilters(patch: Partial<Filters>) {
  filters = { ...filters, ...patch };
  emit();
}

export function resetFilters() {
  filters = { ...DEFAULT_FILTERS, sort: filters.sort }; // sort is a view preference, not a filter
  emit();
}

/** How many filter criteria are active (sort excluded) — drives badges and "Clear all". */
export function activeFilterCount(f: Filters = filters): number {
  return (
    f.families.length +
    f.brands.length +
    f.sizes.length +
    (f.priceMin != null || f.priceMax != null ? 1 : 0) +
    (f.inStockOnly ? 1 : 0) +
    (f.minRating != null ? 1 : 0)
  );
}

// ── Facets (what the filter sheet offers, derived from the live catalog) ────

export type Facets = {
  families: { key: string; count: number }[];
  brands: { slug: string; name: string; count: number }[];
  sizes: number[];
  priceMin: number; // minor, floored to step
  priceMax: number; // minor, ceiled to step
};

export const PRICE_STEP = 5000; // Le 50

export function buildFacets(products: Product[]): Facets {
  const fam = new Map<string, number>();
  const brand = new Map<string, { name: string; count: number }>();
  const sizes = new Set<number>();
  let lo = Number.POSITIVE_INFINITY;
  let hi = 0;
  for (const p of products) {
    for (const f of new Set(p.notes.map((n) => n.family).filter((x): x is string => !!x))) fam.set(f, (fam.get(f) ?? 0) + 1);
    if (p.brandSlug) {
      const cur = brand.get(p.brandSlug) ?? { name: p.brand, count: 0 };
      brand.set(p.brandSlug, { name: cur.name, count: cur.count + 1 });
    }
    for (const v of p.variants) sizes.add(v.sizeMl);
    if (p.fromPriceMinor != null) {
      lo = Math.min(lo, p.fromPriceMinor);
      hi = Math.max(hi, p.fromPriceMinor);
    }
  }
  return {
    families: [...fam.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, count })),
    brands: [...brand.entries()].sort((a, b) => b[1].count - a[1].count).map(([slug, v]) => ({ slug, name: v.name, count: v.count })),
    sizes: [...sizes].sort((a, b) => a - b),
    priceMin: Number.isFinite(lo) ? Math.floor(lo / PRICE_STEP) * PRICE_STEP : 0,
    priceMax: hi > 0 ? Math.ceil(hi / PRICE_STEP) * PRICE_STEP : PRICE_STEP,
  };
}

// ── Filtering · sorting · ranked search (pure) ──────────────────────────────

const familyMatch = (p: Product, fam: string) =>
  p.notes.some((n) => n.family === fam) || (p.scentFamily ?? "").toLowerCase().includes(fam.toLowerCase());

export function filterProducts(products: Product[], f: Filters): Product[] {
  return products.filter((p) => {
    if (f.families.length && !f.families.some((fam) => familyMatch(p, fam))) return false;
    if (f.brands.length && !f.brands.includes(p.brandSlug)) return false;
    if (f.sizes.length && !p.variants.some((v) => f.sizes.includes(v.sizeMl))) return false;
    if (f.priceMin != null && (p.fromPriceMinor == null || p.fromPriceMinor < f.priceMin)) return false;
    if (f.priceMax != null && (p.fromPriceMinor == null || p.fromPriceMinor > f.priceMax)) return false;
    if (f.inStockOnly && p.band === "out") return false;
    if (f.minRating != null && p.rating < f.minRating) return false;
    return true;
  });
}

export function sortProducts(products: Product[], sort: SortKey): Product[] {
  const list = [...products];
  switch (sort) {
    case "price_asc":
      return list.sort((a, b) => (a.fromPriceMinor ?? Number.MAX_SAFE_INTEGER) - (b.fromPriceMinor ?? Number.MAX_SAFE_INTEGER));
    case "price_desc":
      return list.sort((a, b) => (b.fromPriceMinor ?? 0) - (a.fromPriceMinor ?? 0));
    case "rating":
      return list.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
    case "newest":
      return list.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || (b.releaseYear ?? 0) - (a.releaseYear ?? 0));
    default:
      return list.sort((a, b) => b.popularity - a.popularity);
  }
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Ranked search: every query token must match somewhere; fields are weighted
 *  (name prefix > name > brand > family/accords > notes) and popularity breaks ties. */
export function searchProducts(products: Product[], term: string): Product[] {
  const tokens = norm(term).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const scored: { p: Product; score: number }[] = [];
  for (const p of products) {
    const name = norm(p.name);
    const brand = norm(p.brand);
    const fams = norm([p.scentFamily ?? "", ...p.accords].join(" "));
    const notes = norm(p.notes.map((n) => n.name).join(" "));
    let score = 0;
    let allHit = true;
    for (const t of tokens) {
      let hit = 0;
      if (name.startsWith(t)) hit = 5;
      else if (name.includes(t)) hit = 3;
      if (brand.includes(t)) hit = Math.max(hit, 2.5);
      if (fams.includes(t)) hit = Math.max(hit, 2);
      if (notes.includes(t)) hit = Math.max(hit, 1.5);
      if (!hit) {
        allHit = false;
        break;
      }
      score += hit;
    }
    if (allHit) scored.push({ p, score: score + p.popularity * 0.001 });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.p);
}

// ── Recent searches (persisted) ─────────────────────────────────────────────

const RECENTS_KEY = "borteh.recent-searches.v1";
const RECENTS_MAX = 8;

let recents: string[] = [];
const rListeners = new Set<() => void>();
const rEmit = () => {
  rListeners.forEach((l) => l());
  AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(recents)).catch(() => {});
};

AsyncStorage.getItem(RECENTS_KEY)
  .then((raw) => {
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) {
      recents = parsed.filter((x): x is string => typeof x === "string");
      rListeners.forEach((l) => l());
    }
  })
  .catch(() => {});

const rSubscribe = (l: () => void) => {
  rListeners.add(l);
  return () => rListeners.delete(l);
};

export const useRecentSearches = () => useSyncExternalStore(rSubscribe, () => recents, () => recents);

export function addRecentSearch(term: string) {
  const t = term.trim();
  if (t.length < 2) return;
  recents = [t, ...recents.filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, RECENTS_MAX);
  rEmit();
}

export function removeRecentSearch(term: string) {
  recents = recents.filter((r) => r !== term);
  rEmit();
}
