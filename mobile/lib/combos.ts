import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { type Product, type ProductVariant, useProducts } from "./api";
import { addComboClaim, addToBag, type CartItem, type ComboClaim } from "./cart";
import { supabase } from "./supabase";
import { track } from "./track";

// Combos — curated perfume pairings (see HOME_ALGO_IMPLEMENTATION_PLAN §5). The RPCs return each
// combo with its items as [{variant_id, qty}]; we resolve the rest (name, image, price) from the
// already-loaded catalog, and only keep combos whose full pair resolves. Pricing is the honest
// live sum of the items in 3a — deal pricing (combo_price_minor) + checkout land in 3b.

type ComboItemRow = { variant_id: string; qty: number };
type ComboRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_path: string | null;
  combo_price_minor: number | null;
  items: ComboItemRow[];
};

export type ComboLineItem = { product: Product; variant: ProductVariant; qty: number };
export type Combo = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imagePath: string | null;
  items: ComboLineItem[];
  sumMinor: number; // live sum of the items' prices — what the pair costs today
  priceMinor: number; // what the customer pays (3a: === sumMinor; 3b: the owner's deal price)
};

function variantIndex(products: Product[]) {
  const map = new Map<string, { product: Product; variant: ProductVariant }>();
  for (const p of products) for (const v of p.variants) map.set(v.id, { product: p, variant: v });
  return map;
}

function resolve(rows: ComboRow[], products: Product[]): Combo[] {
  const idx = variantIndex(products);
  return rows
    .map((r): Combo | null => {
      const items: ComboLineItem[] = [];
      for (const it of r.items ?? []) {
        const hit = idx.get(it.variant_id);
        if (hit) items.push({ product: hit.product, variant: hit.variant, qty: it.qty });
      }
      if (items.length < 2) return null; // only surface a fully-resolvable pair
      const sumMinor = items.reduce((s, i) => s + i.variant.priceMinor * i.qty, 0);
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        description: r.description,
        imagePath: r.image_path,
        items,
        sumMinor,
        priceMinor: r.combo_price_minor ?? sumMinor,
      };
    })
    .filter((c): c is Combo => c != null);
}

function useActiveComboRows() {
  return useQuery<ComboRow[]>({
    queryKey: ["active_combos"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_active_combos", { p_limit: 20 });
      if (error) throw error;
      return (data ?? []) as ComboRow[];
    },
  });
}

function useComboRowsForProduct(productId?: string) {
  return useQuery<ComboRow[]>({
    queryKey: ["combos_for_product", productId],
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_combos_for_product", { p_product_id: productId, p_limit: 10 });
      if (error) throw error;
      return (data ?? []) as ComboRow[];
    },
  });
}

/** All active, fully-available combos ("Perfect pairs"). */
export function useCombos(): Combo[] {
  const { data: products } = useProducts();
  const { data: rows } = useActiveComboRows();
  return useMemo(() => resolve(rows ?? [], products ?? []), [rows, products]);
}

/** Combos that include the given product ("Complete the pair"). */
export function useCombosForProduct(productId?: string): Combo[] {
  const { data: products } = useProducts();
  const { data: rows } = useComboRowsForProduct(productId);
  return useMemo(() => resolve(rows ?? [], products ?? []), [rows, products]);
}

/** One combo by slug (from the active set). */
export function useCombo(slug?: string): Combo | undefined {
  const combos = useCombos();
  return useMemo(() => combos.find((c) => c.slug === slug), [combos, slug]);
}

/** Add every item of a combo to the bag, and record the pair so checkout can claim the deal. */
export function addComboToBag(combo: Combo) {
  for (const it of combo.items) {
    addToBag(
      { productId: it.product.id, variantId: it.variant.id, slug: it.product.slug, sizeMl: it.variant.sizeMl, priceMinor: it.variant.priceMinor },
      it.qty,
    );
  }
  addComboClaim(combo.id, combo.slug, 1);
  track("module_tap", { module: "combo_add", metadata: { comboId: combo.id, slug: combo.slug, items: combo.items.length } });
}

export type ComboCheckout = {
  savingsMinor: number; // deal discount the bag currently qualifies for
  payload: { combo_id: string; qty: number }[]; // what we send as p_combos
};

/**
 * Turn the shopper's combo claims into a deal discount + the checkout payload,
 * mirroring fn_place_order EXACTLY: a pair is only awarded when the bag actually
 * holds its bottles, consuming them so one bottle can't fund two pairs. The
 * server re-derives this authoritatively — this is the honest preview + payload.
 */
export function resolveComboClaims(items: CartItem[], claims: ComboClaim[], combos: Combo[]): ComboCheckout {
  const bag = new Map<string, number>();
  for (const it of items) bag.set(it.variantId, (bag.get(it.variantId) ?? 0) + it.qty);

  let savingsMinor = 0;
  const payload: { combo_id: string; qty: number }[] = [];
  for (const claim of claims) {
    const combo = combos.find((c) => c.id === claim.comboId);
    if (!combo) continue;
    const perUnit = combo.sumMinor - combo.priceMinor;
    if (perUnit <= 0) continue; // no deal set

    let units = claim.qty;
    for (const li of combo.items) units = Math.min(units, Math.floor((bag.get(li.variant.id) ?? 0) / li.qty));
    if (units <= 0) continue;

    for (const li of combo.items) bag.set(li.variant.id, (bag.get(li.variant.id) ?? 0) - li.qty * units);
    savingsMinor += perUnit * units;
    payload.push({ combo_id: combo.id, qty: units });
  }
  return { savingsMinor, payload };
}
