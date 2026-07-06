import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSession } from "./auth";
import { type Product, useProducts, useSimilarProducts } from "./api";
import { useRecentlyViewed } from "./recentlyViewed";
import { supabase } from "./supabase";

// Personalized home feed (recs Phase 2.4). Each module is generated server-side by an RPC
// that returns product ids; here we map ids → the already-loaded catalog and compose the
// feed with client-side rules: priority order, dedup across modules, hide thin modules,
// cap rail length. Personalized modules need a signed-in user; Trending is the universal
// fallback (works cold-start). Nothing here blanks the home — worst case it's just Trending.

const RAIL = 12; // max items per module rail
const MIN_ITEMS = 3; // hide a module below this (avoids lonely rails)

async function rpcRows(fn: string, params: Record<string, unknown> = {}) {
  const { data, error } = await supabase.rpc(fn, params);
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []) as any[];
}

function useIds(key: string, fn: string, enabled: boolean) {
  return useQuery<string[]>({
    queryKey: [key],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await rpcRows(fn, { p_limit: RAIL })).map((r) => r.product_id as string),
  });
}

export function usePickedForYou(enabled: boolean) {
  return useIds("picked_for_you", "fn_picked_for_you", enabled);
}
export function useBackInStock(enabled: boolean) {
  return useIds("back_in_stock", "fn_back_in_stock", enabled);
}
export function useStillThinking(enabled: boolean) {
  return useIds("still_thinking", "fn_still_thinking", enabled);
}
export function useTrending() {
  return useIds("trending", "fn_trending", true); // universal fallback
}
export function useCfPicks(enabled: boolean) {
  return useIds("cf_picks", "fn_cf_picks", enabled); // collaborative filtering (data-gated; empty until enough users)
}
export function useBecauseYouViewed(enabled: boolean) {
  return useQuery<{ anchorId?: string; ids: string[] }>({
    queryKey: ["because_you_viewed"],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const rows = await rpcRows("fn_because_you_viewed", { p_limit: RAIL });
      return { anchorId: rows[0]?.anchor_id as string | undefined, ids: rows.map((r) => r.product_id as string) };
    },
  });
}
export function useNewInFamily(enabled: boolean) {
  return useQuery<{ family?: string; ids: string[] }>({
    queryKey: ["new_in_family"],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const rows = await rpcRows("fn_new_in_family", { p_limit: RAIL });
      return { family: rows[0]?.family as string | undefined, ids: rows.map((r) => r.product_id as string) };
    },
  });
}

// --- Home-algo RPCs (personalization + hybrid search; see HOME_ALGO_IMPLEMENTATION_PLAN §2) ---

export type TopFamily = { family: string; score: number };

/** The caller's weighted top scent families (fn_my_top_families). Drives the Shop-by-note order;
 *  anon/cold-start → [] (the home then falls back to the admin family order). */
export function useMyTopFamilies(enabled: boolean) {
  return useQuery<TopFamily[]>({
    queryKey: ["my_top_families"],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () =>
      (await rpcRows("fn_my_top_families")).map((r) => ({ family: r.family as string, score: Number(r.score) })),
  });
}

export type RankedCollection = { slug: string; affinity: number };

/** Per-user affinity for the curated featured collections (fn_rank_collections). The home picks
 *  the top-affinity collection for the banner slot; anon → [] → keep the admin order. */
export function useRankedCollections(slugs: string[], enabled: boolean) {
  return useQuery<RankedCollection[]>({
    queryKey: ["rank_collections", slugs.join(",")],
    enabled: enabled && slugs.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () =>
      (await rpcRows("fn_rank_collections", { p_slugs: slugs })).map((r) => ({ slug: r.slug as string, affinity: Number(r.affinity) })),
  });
}

/** The shop "For you" default sort — product ids in personalized order (fn_shop_ranked). Works for
 *  anon too (popularity + reviews). The shop maps these onto the already-loaded catalog. */
export function useShopRanked(enabled = true) {
  return useQuery<string[]>({
    queryKey: ["shop_ranked"],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await rpcRows("fn_shop_ranked", { p_limit: 200, p_offset: 0 })).map((r) => r.product_id as string),
  });
}

/** Hybrid natural-language search (fn_search_products) — ordered product ids for a query. Keeps the
 *  previous results in place while a new query loads, so the list doesn't flash empty. */
export function useSearchResults(term: string) {
  const q = term.trim();
  return useQuery<string[]>({
    queryKey: ["search_products", q],
    enabled: q.length > 0,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
    queryFn: async () => (await rpcRows("fn_search_products", { p_query: q, p_limit: 60 })).map((r) => r.product_id as string),
  });
}

/** Seed a cold-start taste vector from the 3-tap quiz. Returns how many products matched. */
export async function seedTasteFromQuiz(family: string | null, concentration: string | null, maxPrice: number | null) {
  const { data, error } = await supabase.rpc("fn_seed_taste_from_quiz", {
    p_family: family,
    p_concentration: concentration,
    p_max_price: maxPrice,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

export type FeedModule = { key: string; title: string; products: Product[] };

/** The assembled, deduped, ordered personalized feed. */
export function useHomeFeed(): { modules: FeedModule[]; isSignedIn: boolean } {
  const session = useSession();
  const signedIn = !!session;
  const { data: products } = useProducts();
  const recents = useRecentlyViewed();

  const picked = usePickedForYou(signedIn);
  const cf = useCfPicks(signedIn);
  const because = useBecauseYouViewed(signedIn);
  const back = useBackInStock(signedIn);
  const thinking = useStillThinking(signedIn);
  const newIn = useNewInFamily(signedIn);
  const trending = useTrending();

  // Signed-out homes still diverge after the first view: "More like you've browsed" runs the
  // newest recently-viewed product through fn_similar_products. (Signed-in users get the
  // server-side because_you_viewed rail instead, so this is anon-only.)
  const bySlug = useMemo(() => new Map((products ?? []).map((p) => [p.slug, p])), [products]);
  const browsedAnchorId = !signedIn ? bySlug.get(recents[0] ?? "")?.id : undefined;
  const browsed = useSimilarProducts(browsedAnchorId, RAIL);

  const modules = useMemo(() => {
    const byId = new Map((products ?? []).map((p) => [p.id, p]));
    const used = new Set<string>();
    const out: FeedModule[] = [];
    const take = (key: string, title: string, ids?: string[]) => {
      const items = (ids ?? [])
        .map((id) => byId.get(id))
        .filter((p): p is Product => !!p && !used.has(p.id));
      if (items.length < MIN_ITEMS) return;
      items.forEach((p) => used.add(p.id));
      out.push({ key, title, products: items.slice(0, RAIL) });
    };

    if (signedIn) {
      take("picked_for_you", "Picked for you", picked.data);
      take("cf_picks", "Recommended for you", cf.data); // collaborative filtering — data-gated
      const anchor = because.data?.anchorId ? byId.get(because.data.anchorId) : undefined;
      take("because_you_viewed", anchor ? `Because you viewed ${anchor.name}` : "More like what you viewed", because.data?.ids);
      take("back_in_stock", "Back in stock for you", back.data);
      take("still_thinking", "Still thinking about it", thinking.data);
      take("new_in_family", newIn.data?.family ? `New in ${newIn.data.family}` : "New arrivals", newIn.data?.ids);
    } else {
      take("more_like_browsed", "More like you've browsed", browsed.data);
    }
    take("trending", "Trending now", trending.data);
    return out;
  }, [products, signedIn, picked.data, cf.data, because.data, back.data, thinking.data, newIn.data, browsed.data, trending.data]);

  return { modules, isSignedIn: signedIn };
}
