import { useLocalSearchParams, useRouter } from "expo-router";
import { CaretDown, X } from "phosphor-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProductCard } from "@/components/ProductCard";
import { Skel } from "@/components/Skeleton";
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
import { Colors, radius, space } from "@/lib/theme";
import { ThemedStatusBar, useTheme, useThemedStyles } from "@/lib/theme-context";

// Track padding for the segmented control's sliding pill — inset from the
// track's own rounded edge so the pill never touches it.
const SEG_PAD = 3;
const GRID_BATCH = 12; // progressive reveal batch size, matches Home's own grid

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
  const { data, isLoading } = useProducts();
  const shopRanked = useShopRanked();
  const params = useLocalSearchParams<{ family?: string; gender?: string; sale?: string; brand?: string; collection?: string }>();
  const filters = useFilters();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"all" | Gender>(isGender(params.gender) ? params.gender : "all");
  const [collection, setCollection] = useState<string | null>(params.collection ?? null);
  const [sortOpen, setSortOpen] = useState(false);
  const sale = params.sale === "1";
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);

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

  // Progressive reveal: mounting all N ProductCards synchronously on entry is
  // what made navigating here feel heavy. Start with one batch, grow it as the
  // user scrolls near the bottom (same pattern as Home's "more to explore"
  // grid), and reset back to one batch whenever the filtered set itself changes.
  const [visibleCount, setVisibleCount] = useState(GRID_BATCH);
  useEffect(() => {
    setVisibleCount(GRID_BATCH);
  }, [cat, collection, sale, filters, term]);
  const visibleProducts = products.slice(0, visibleCount);

  // Apple-style segmented control: one sliding ink pill behind plain-text
  // segments, not the old underline-tab row. Track width is measured on
  // layout so the pill's width/position derive from real pixels, not a guess.
  const [tabsTrackW, setTabsTrackW] = useState(0);
  const activeTabIdx = CATS.findIndex((c) => c.value === cat);
  const segW = tabsTrackW > 0 ? (tabsTrackW - SEG_PAD * 2) / CATS.length : 0;
  const tabIndicatorX = useSharedValue(0);
  useEffect(() => {
    if (segW > 0) tabIndicatorX.value = withSpring(activeTabIdx * segW, { duration: 400, dampingRatio: 0.85 });
  }, [activeTabIdx, segW, tabIndicatorX]);
  const tabIndicatorStyle = useAnimatedStyle(() => ({
    width: segW,
    transform: [{ translateX: tabIndicatorX.value }],
  }));

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
          label: `${formatLe(filters.priceMin ?? facets.priceMin)} - ${formatLe(filters.priceMax ?? facets.priceMax)}`,
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
      <ThemedStatusBar />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: space["3xl"] }}
        scrollEventThrottle={100}
        onScroll={(e) => {
          const { contentSize, layoutMeasurement, contentOffset } = e.nativeEvent;
          if (contentSize.height - contentOffset.y - layoutMeasurement.height < 600) {
            setVisibleCount((n) => Math.min(products.length, n + GRID_BATCH));
          }
        }}
      >
        <View style={s.gutter}>
          <View style={s.headerRow}>
            <AppText variant="heading">Shop</AppText>
            <HeaderActions />
          </View>
          <View style={{ marginTop: space.lg }}>
            <SearchBar value={q} onChangeText={setQ} onFilter={() => router.push("/filter")} />
          </View>
        </View>

        {/* gender segmented control — Apple's own structure (one sliding pill
            behind plain segments in a track), not an underline-tab row */}
        <View style={s.tabs} onLayout={(e) => setTabsTrackW(e.nativeEvent.layout.width)}>
          {tabsTrackW > 0 ? <Animated.View style={[s.tabIndicator, tabIndicatorStyle]} /> : null}
          {CATS.map((c) => {
            const active = cat === c.value;
            return (
              <Pressable key={c.value} onPress={() => setCat(c.value)} style={s.tab} accessibilityRole="button" accessibilityState={{ selected: active }}>
                <AppText variant="label" style={{ color: active ? colors.onInk : colors.ink60 }}>
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

        {/* applied filters — tinted capsule tokens, the same "smart filter" pill
            language Apple uses for removable search/filter criteria */}
        {chips.length > 0 ? (
          <View style={[s.gutter, s.filterRow]}>
            {chips.map((c) => (
              <Pressable key={c.key} onPress={c.clear} style={s.filterChip} accessibilityRole="button" accessibilityLabel={`Clear ${c.label}`}>
                <AppText variant="label" style={{ color: colors.accent }}>{c.label}</AppText>
                <X size={14} color={colors.accent} weight="bold" />
              </Pressable>
            ))}
            <LinkLabel label="Clear all" onPress={clearEverything} color={colors.accent} />
          </View>
        ) : null}

        {isLoading && !data ? (
          <View style={[s.grid, { marginTop: space.lg }]}>
            {Array.from({ length: 6 }, (_, i) => (
              <View key={i} style={{ width: cardW }}>
                <Skel h={imgH} />
                <Skel w={cardW * 0.7} h={18} style={{ marginTop: space.sm }} />
                <Skel w={cardW * 0.4} h={14} style={{ marginTop: space.xs }} />
              </View>
            ))}
          </View>
        ) : products.length === 0 ? (
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
            {visibleProducts.map((p, i) => (
              // mirror the petal across the pair: left column tears top-left→bottom-right, right column the other diagonal
              <ProductCard key={p.id} product={p} width={cardW} imageHeight={imgH} shape={i % 2 === 0 ? "tearLeft" : "tearRight"} />
            ))}
          </View>
        )}
      </ScrollView>

      <SortSheet visible={sortOpen} current={filters.sort} onSelect={(k) => setFilters({ sort: k })} onClose={() => setSortOpen(false)} />
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  gutter: { paddingHorizontal: space.gutter },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  // segmented control: one sliding ink pill in a rounded track
  tabs: { flexDirection: "row", position: "relative", backgroundColor: colors.surface, borderRadius: radius.pill, padding: SEG_PAD, marginTop: space["2xl"], marginHorizontal: space.gutter },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: space.sm },
  tabIndicator: { position: "absolute", top: SEG_PAD, bottom: SEG_PAD, left: 0, backgroundColor: colors.ink, borderRadius: radius.pill },
  countRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.lg },
  sortBtn: { flexDirection: "row", alignItems: "center", gap: space.sm },
  filterRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
  filterChip: { flexDirection: "row", alignItems: "center", gap: space.xs, backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", paddingHorizontal: space.gutter, rowGap: space["2xl"] },
  empty: { paddingTop: space["4xl"], paddingHorizontal: space.gutter, alignItems: "center" },
});
