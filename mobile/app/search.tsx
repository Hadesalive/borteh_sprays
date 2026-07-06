import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { CaretDown, ClockCounterClockwise, MagnifyingGlass, SlidersHorizontal, X } from "phosphor-react-native";
import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProductCard } from "@/components/ProductCard";
import { Skel } from "@/components/Skeleton";
import { SortSheet } from "@/components/SortSheet";
import { AppText } from "@/components/Text";
import { LinkLabel } from "@/components/ui";
import { type Product, productSubline, useProducts } from "@/lib/api";
import { useSearchResults } from "@/lib/feed";
import { formatLe } from "@/lib/format";
import { productImage } from "@/lib/productImage";
import {
  activeFilterCount,
  addRecentSearch,
  filterProducts,
  isRelevanceSort,
  removeRecentSearch,
  setFilters,
  sortLabel,
  sortProducts,
  useFilters,
  useRecentSearches,
} from "@/lib/search";
import { track } from "@/lib/track";
import { colors, font, space } from "@/lib/theme";

const POPULAR = ["Oud", "Vanilla", "Rose", "Amber", "Fresh", "Lattafa", "Khamrah"];

function ResultRow({ product, onPress }: { product: Product; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.result} accessibilityRole="button" accessibilityLabel={product.name}>
      <View style={s.resultThumb}>
        <Image source={productImage(product)} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={product.id} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="serif20" numberOfLines={1}>{product.name}</AppText>
        <AppText variant="caption" numberOfLines={1}>{productSubline(product)}</AppText>
      </View>
      <AppText variant="price">{formatLe(product.fromPriceMinor)}</AppText>
    </Pressable>
  );
}

export default function Search() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data } = useProducts();
  const filters = useFilters();
  const recents = useRecentSearches();
  const [q, setQ] = useState("");
  const [sortOpen, setSortOpen] = useState(false);

  const term = q.trim();
  // Hybrid NL search runs server-side (fn_search_products → ordered ids); we map onto the loaded
  // catalog and apply any explicit filter/sort on top. Empty query → no request.
  const searchIds = useSearchResults(term);
  const results = useMemo(() => {
    if (!term) return [] as Product[];
    const byId = new Map((data ?? []).map((p) => [p.id, p]));
    const ranked = (searchIds.data ?? []).map((id) => byId.get(id)).filter((p): p is Product => !!p);
    const filtered = filterProducts(ranked, filters);
    return isRelevanceSort(filters.sort) ? filtered : sortProducts(filtered, filters.sort);
  }, [data, term, filters, searchIds.data]);
  const loadingResults = !!term && searchIds.isLoading;

  const trending = useMemo(() => (data ?? []).slice(0, 6), [data]);
  const filterCount = activeFilterCount(filters);

  const open = (slug: string) => router.push({ pathname: "/product/[slug]", params: { slug } });

  const lastLogged = useRef("");
  const commit = (value: string) => {
    const v = value.trim();
    if (!v) return;
    addRecentSearch(v);
    if (lastLogged.current === v.toLowerCase()) return; // submit + result-tap = one event
    lastLogged.current = v.toLowerCase();
    track("search", { metadata: { query: v, results: results.length } });
  };

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />

      {/* search bar */}
      <View style={[s.bar, { paddingTop: insets.top + space.md }]}>
        <View style={s.field}>
          <MagnifyingGlass size={20} color={colors.ink} />
          <TextInput
            autoFocus
            value={q}
            onChangeText={setQ}
            placeholder="Fragrances, notes, brands"
            placeholderTextColor={colors.ink40}
            style={s.input}
            returnKeyType="search"
            autoCorrect={false}
            onSubmitEditing={() => commit(q)}
          />
          {q.length > 0 ? (
            <Pressable onPress={() => setQ("")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear">
              <X size={20} color={colors.ink40} weight="regular" />
            </Pressable>
          ) : null}
        </View>
        {term ? (
          <Pressable onPress={() => router.push("/filter")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Filters">
            <SlidersHorizontal size={24} color={colors.ink} weight="regular" />
            {filterCount > 0 ? <View style={s.filterDot} /> : null}
          </Pressable>
        ) : (
          <LinkLabel label="Cancel" onPress={() => router.back()} />
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + space["4xl"] }}>
        {!term ? (
          <>
            {/* recent */}
            {recents.length > 0 ? (
              <View style={s.gutter}>
                <AppText variant="label" style={s.eyebrow}>Recent</AppText>
                <View style={{ marginTop: space.sm }}>
                  {recents.map((r) => (
                    <View key={r} style={s.recentRow}>
                      <ClockCounterClockwise size={20} color={colors.ink40} weight="regular" />
                      <Pressable style={{ flex: 1 }} onPress={() => setQ(r)} accessibilityRole="button" accessibilityLabel={`Search ${r}`}>
                        <AppText variant="bodyLg" numberOfLines={1}>{r}</AppText>
                      </Pressable>
                      <Pressable onPress={() => removeRecentSearch(r)} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Remove ${r}`}>
                        <X size={20} color={colors.ink40} weight="regular" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={s.gutter}>
              <AppText variant="label" style={s.eyebrow}>Popular searches</AppText>
              <View style={s.chips}>
                {POPULAR.map((p) => (
                  <Pressable key={p} onPress={() => { setQ(p); commit(p); }} style={s.chip} accessibilityRole="button">
                    <AppText variant="label">{p}</AppText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={s.gutter}>
              <AppText variant="label" style={s.eyebrow}>Trending now</AppText>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
              {trending.map((p) => (
                <ProductCard key={p.id} product={p} width={120} imageHeight={148} />
              ))}
            </ScrollView>
          </>
        ) : loadingResults ? (
          <View style={s.gutter}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={s.skelRow}>
                <Skel w={56} h={64} />
                <View style={{ flex: 1, gap: space.sm }}>
                  <Skel w={160} h={20} />
                  <Skel w={110} h={14} />
                </View>
              </View>
            ))}
          </View>
        ) : results.length === 0 ? (
          <View style={s.gutter}>
            <AppText variant="heading" style={{ marginTop: space["2xl"] }}>Nothing on the shelf for that.</AppText>
            <AppText variant="bodySoft" style={{ marginTop: space.sm }}>
              Try fewer words{filterCount > 0 ? ", or remove a filter" : ", or a different note or brand"}. These come closest:
            </AppText>
            {filterCount > 0 ? (
              <View style={{ marginTop: space.md }}>
                <LinkLabel label="Clear all filters" onPress={() => setFilters({ families: [], brands: [], sizes: [], priceMin: null, priceMax: null, inStockOnly: false, minRating: null })} color={colors.accent} />
              </View>
            ) : null}
            <View style={{ marginTop: space.lg }}>
              {trending.slice(0, 3).map((p) => (
                <ResultRow key={p.id} product={p} onPress={() => open(p.slug)} />
              ))}
            </View>
          </View>
        ) : (
          <View style={s.gutter}>
            <View style={s.countRow}>
              <AppText variant="caption">
                {results.length} {results.length === 1 ? "result" : "results"}
                {filterCount > 0 ? ` · ${filterCount} ${filterCount === 1 ? "filter" : "filters"}` : ""}
              </AppText>
              <Pressable onPress={() => setSortOpen(true)} style={s.sortBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Sort">
                <AppText variant="label">{sortLabel(filters.sort)}</AppText>
                <CaretDown size={16} color={colors.ink} weight="regular" />
              </Pressable>
            </View>
            {results.map((p) => (
              <ResultRow key={p.id} product={p} onPress={() => { commit(term); open(p.slug); }} />
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
  bar: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingHorizontal: space.gutter, paddingBottom: space.md },
  field: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.md, height: 52, paddingHorizontal: space.lg, borderWidth: 1, borderColor: colors.ink },
  input: { flex: 1, fontFamily: font.regular, fontSize: 14, color: colors.ink, padding: 0 },
  filterDot: { position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: 999, backgroundColor: colors.accent },
  gutter: { paddingHorizontal: space.gutter },
  eyebrow: { color: colors.ink60, marginTop: space["2xl"] },
  recentRow: { flexDirection: "row", alignItems: "center", gap: space.md, height: 56, borderBottomWidth: 1, borderBottomColor: colors.line },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
  chip: { borderWidth: 1, borderColor: colors.line, paddingHorizontal: space.md, paddingVertical: space.sm },
  rail: { paddingHorizontal: space.gutter, gap: space.lg, paddingTop: space.md },
  countRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.lg, paddingBottom: space.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  sortBtn: { flexDirection: "row", alignItems: "center", gap: space.sm },
  result: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  resultThumb: { width: 56, height: 64, backgroundColor: colors.surface, overflow: "hidden" },
  skelRow: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingVertical: space.md, marginTop: space.sm },
});
