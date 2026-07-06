import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { CaretDown, X } from "phosphor-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProductCard } from "@/components/ProductCard";
import { SortSheet } from "@/components/SortSheet";
import { AppText } from "@/components/Text";
import { HeaderActions, LinkLabel, SearchBar } from "@/components/ui";
import { discountPct, type Gender, type Product, useProducts } from "@/lib/api";
import { useShopRanked } from "@/lib/feed";
import { formatLe } from "@/lib/format";
import {
  activeFilterCount,
  buildFacets,
  filterProducts,
  isRelevanceSort,
  resetFilters,
  searchProducts,
  setFilters,
  sortLabel,
  sortProducts,
  useFilters,
} from "@/lib/search";
import { colors, space } from "@/lib/theme";

const CATS: { label: string; value: "all" | Gender }[] = [
  { label: "All", value: "all" },
  { label: "Women", value: "female" },
  { label: "Men", value: "male" },
  { label: "Unisex", value: "unisex" },
];
const isGender = (v?: string): v is Gender => v === "male" || v === "female" || v === "unisex";
const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

export default function Shop() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { data } = useProducts();
  const shopRanked = useShopRanked();
  const params = useLocalSearchParams<{ family?: string; gender?: string; sale?: string; brand?: string; collection?: string }>();
  const filters = useFilters();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"all" | Gender>(isGender(params.gender) ? params.gender : "all");
  const [collection, setCollection] = useState<string | null>(params.collection ?? null);
  const [sortOpen, setSortOpen] = useState(false);
  const sale = params.sale === "1";

  // Deep links (Home → shop by note / brand / collection) land in the shared filter store.
  useEffect(() => {
    if (params.family !== undefined) setFilters({ families: params.family ? [params.family] : [] });
  }, [params.family]);
  useEffect(() => {
    if (params.brand !== undefined) setFilters({ brands: params.brand ? [params.brand] : [] });
  }, [params.brand]);
  useEffect(() => {
    if (params.collection !== undefined) setCollection(params.collection || null);
  }, [params.collection]);
  useEffect(() => {
    if (isGender(params.gender)) setCat(params.gender);
  }, [params.gender]);

  const facets = useMemo(() => buildFacets(data ?? []), [data]);
  const term = q.trim();

  const products = useMemo(() => {
    let list: Product[] = data ?? [];
    if (cat !== "all") list = list.filter((p) => p.gender === cat);
    if (collection) list = list.filter((p) => p.collection === collection);
    if (sale) list = list.filter((p) => discountPct(p) > 0);
    list = filterProducts(list, filters);
    if (term) {
      const ranked = searchProducts(list, term);
      // relevance order for the default sort; explicit sorts still win
      return isRelevanceSort(filters.sort) ? ranked : sortProducts(ranked, filters.sort);
    }
    // "For you" default with no narrowing → personalized order from fn_shop_ranked. Any explicit
    // sort, filter, gender, collection or search drops back to the client path (intent always wins).
    const noNarrowing = cat === "all" && !collection && !sale && activeFilterCount(filters) === 0;
    if (filters.sort === "for_you" && noNarrowing && shopRanked.data?.length) {
      const byId = new Map(list.map((p) => [p.id, p]));
      const ranked = shopRanked.data.map((id) => byId.get(id)).filter((p): p is Product => !!p);
      const seen = new Set(ranked.map((p) => p.id));
      return [...ranked, ...list.filter((p) => !seen.has(p.id))]; // any un-ranked product tails the list
    }
    return sortProducts(list, filters.sort);
  }, [data, cat, collection, sale, filters, term, shopRanked.data]);

  const brandName = (slug: string) => facets.brands.find((b) => b.slug === slug)?.name ?? slug;
  const collectionName = (data ?? []).find((p) => p.collection === collection)?.collectionName ?? collection;

  const cardW = Math.floor((width - space.gutter * 2 - space.lg) / 2);
  const imgH = Math.round(cardW * 1.3);

  // Applied-filter chips — one removable chip per criterion, mirroring the store.
  const chips: { key: string; label: string; clear: () => void }[] = [
    ...(sale ? [{ key: "sale", label: "On sale", clear: () => router.setParams({ sale: "" }) }] : []),
    ...(collection ? [{ key: "collection", label: collectionName ?? "", clear: () => setCollection(null) }] : []),
    ...filters.families.map((f) => ({ key: `fam:${f}`, label: cap(f), clear: () => setFilters({ families: filters.families.filter((x) => x !== f) }) })),
    ...filters.brands.map((b) => ({ key: `brand:${b}`, label: brandName(b), clear: () => setFilters({ brands: filters.brands.filter((x) => x !== b) }) })),
    ...filters.sizes.map((ml) => ({ key: `size:${ml}`, label: `${ml} ml`, clear: () => setFilters({ sizes: filters.sizes.filter((x) => x !== ml) }) })),
    ...(filters.priceMin != null || filters.priceMax != null
      ? [{
          key: "price",
          label: `${formatLe(filters.priceMin ?? facets.priceMin)} — ${formatLe(filters.priceMax ?? facets.priceMax)}`,
          clear: () => setFilters({ priceMin: null, priceMax: null }),
        }]
      : []),
    ...(filters.minRating != null ? [{ key: "rating", label: `${filters.minRating}+`, clear: () => setFilters({ minRating: null }) }] : []),
    ...(filters.inStockOnly ? [{ key: "stock", label: "In stock", clear: () => setFilters({ inStockOnly: false }) }] : []),
  ];

  const clearEverything = () => {
    resetFilters();
    setCollection(null);
    router.setParams({ sale: "" });
  };

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag" contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: space["3xl"] }}>
        <View style={s.gutter}>
          <View style={s.headerRow}>
            <AppText variant="heading">Shop</AppText>
            <HeaderActions />
          </View>
          <View style={{ marginTop: space.lg }}>
            <SearchBar value={q} onChangeText={setQ} onFilter={() => router.push("/filter")} />
          </View>
        </View>

        {/* gender tabs */}
        <View style={s.tabs}>
          {CATS.map((c) => {
            const active = cat === c.value;
            return (
              <Pressable key={c.value} onPress={() => setCat(c.value)} style={[s.tab, active && s.tabOn]} accessibilityRole="button" accessibilityState={{ selected: active }}>
                <AppText variant="label" style={{ color: active ? colors.ink : colors.ink40 }}>
                  {c.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {/* count + sort */}
        <View style={[s.gutter, s.countRow]}>
          <AppText variant="caption">
            {products.length} {products.length === 1 ? "fragrance" : "fragrances"}
          </AppText>
          <Pressable onPress={() => setSortOpen(true)} style={s.sortBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Sort">
            <AppText variant="label">{sortLabel(filters.sort)}</AppText>
            <CaretDown size={16} color={colors.ink} weight="regular" />
          </Pressable>
        </View>

        {/* applied filters */}
        {chips.length > 0 ? (
          <View style={[s.gutter, s.filterRow]}>
            {chips.map((c) => (
              <Pressable key={c.key} onPress={c.clear} style={s.filterChip} accessibilityRole="button" accessibilityLabel={`Clear ${c.label}`}>
                <AppText variant="label">{c.label}</AppText>
                <X size={16} color={colors.ink} weight="regular" />
              </Pressable>
            ))}
            <LinkLabel label="Clear all" onPress={clearEverything} color={colors.accent} />
          </View>
        ) : null}

        {products.length === 0 ? (
          <View style={s.empty}>
            <AppText variant="heading" style={{ textAlign: "center" }}>Nothing on the shelf for that.</AppText>
            <AppText variant="bodySoft" style={{ textAlign: "center", marginTop: space.sm }}>
              Try another search, or {activeFilterCount(filters) > 0 || chips.length > 0 ? "clear a filter." : "a different word."}
            </AppText>
            {chips.length > 0 ? (
              <View style={{ marginTop: space.lg }}>
                <LinkLabel label="Clear all filters" onPress={clearEverything} color={colors.accent} />
              </View>
            ) : null}
          </View>
        ) : (
          <View style={[s.grid, { marginTop: space.lg }]}>
            {products.map((p) => (
              <ProductCard key={p.id} product={p} width={cardW} imageHeight={imgH} />
            ))}
          </View>
        )}
      </ScrollView>

      <SortSheet visible={sortOpen} current={filters.sort} onSelect={(k) => setFilters({ sort: k })} onClose={() => setSortOpen(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  gutter: { paddingHorizontal: space.gutter },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tabs: { flexDirection: "row", gap: space["2xl"], paddingHorizontal: space.gutter, marginTop: space["2xl"], borderBottomWidth: 1, borderBottomColor: colors.line },
  tab: { paddingBottom: space.md },
  tabOn: { borderBottomWidth: 1, borderBottomColor: colors.ink, marginBottom: -1 },
  countRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.lg },
  sortBtn: { flexDirection: "row", alignItems: "center", gap: space.sm },
  filterRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
  filterChip: { flexDirection: "row", alignItems: "center", gap: space.sm, borderWidth: 1, borderColor: colors.ink, paddingHorizontal: space.md, paddingVertical: space.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", paddingHorizontal: space.gutter, rowGap: space["2xl"] },
  empty: { paddingTop: space["4xl"], paddingHorizontal: space.gutter, alignItems: "center" },
});
