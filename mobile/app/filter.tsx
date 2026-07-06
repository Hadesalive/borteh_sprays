import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { X } from "phosphor-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { RangeSlider } from "@/components/RangeSlider";
import { AppText } from "@/components/Text";
import { CategoryChip, ToggleSwitch } from "@/components/ui";
import { useProducts } from "@/lib/api";
import { formatLe } from "@/lib/format";
import { buildFacets, DEFAULT_FILTERS, type Filters, filterProducts, getFilters, PRICE_STEP, setFilters } from "@/lib/search";
import { track } from "@/lib/track";
import { colors, space } from "@/lib/theme";

const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);
const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

const RATINGS: { label: string; value: number | null }[] = [
  { label: "Any", value: null },
  { label: "4.0+", value: 4 },
  { label: "4.5+", value: 4.5 },
];

export default function FilterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data } = useProducts();
  const products = data ?? [];
  const facets = useMemo(() => buildFacets(products), [products]);

  // Draft edits locally; the shared store only changes on Apply.
  const [draft, setDraft] = useState<Filters>(() => ({ ...getFilters() }));
  const patch = (p: Partial<Filters>) => setDraft((d) => ({ ...d, ...p }));

  const low = draft.priceMin ?? facets.priceMin;
  const high = draft.priceMax ?? facets.priceMax;
  const count = useMemo(() => filterProducts(products, { ...draft, priceMin: low, priceMax: high }).length, [products, draft, low, high]);

  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  }, [enter]);
  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });

  const apply = () => {
    // Full-range price = no price filter
    const priceMin = low <= facets.priceMin ? null : low;
    const priceMax = high >= facets.priceMax ? null : high;
    const next = { ...draft, priceMin, priceMax };
    setFilters(next);
    track("filter", {
      metadata: {
        families: next.families,
        brands: next.brands,
        sizes: next.sizes,
        price_min: priceMin,
        price_max: priceMax,
        in_stock_only: next.inStockOnly,
        min_rating: next.minRating,
        results: count,
      },
    });
    router.back();
  };

  const clearAll = () => setDraft({ ...DEFAULT_FILTERS, sort: draft.sort });

  return (
    <View style={s.screen}>
      <StatusBar style="light" />
      <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} accessibilityLabel="Close" />
      <Animated.View style={[s.sheet, { transform: [{ translateY }] }]}>
        <View style={s.header}>
          <AppText variant="heading">Filters</AppText>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close filters">
            <X size={24} color={colors.ink} weight="regular" />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, paddingBottom: space.lg }}>
          {/* fragrance family */}
          <AppText variant="label" style={s.eyebrow}>Fragrance family</AppText>
          <View style={s.wrap}>
            {facets.families.map((f) => (
              <CategoryChip key={f.key} label={cap(f.key)} active={draft.families.includes(f.key)} onPress={() => patch({ families: toggleIn(draft.families, f.key) })} />
            ))}
          </View>

          {/* brand */}
          {facets.brands.length > 0 ? (
            <>
              <AppText variant="label" style={s.eyebrow}>Brand</AppText>
              <View style={s.wrap}>
                {facets.brands.map((b) => (
                  <CategoryChip key={b.slug} label={b.name} active={draft.brands.includes(b.slug)} onPress={() => patch({ brands: toggleIn(draft.brands, b.slug) })} />
                ))}
              </View>
            </>
          ) : null}

          {/* price */}
          {facets.priceMax > facets.priceMin ? (
            <>
              <View style={s.priceHead}>
                <AppText variant="label" style={{ color: colors.ink60 }}>Price</AppText>
                <AppText variant="caption" style={{ color: colors.ink }}>
                  {formatLe(low)} — {formatLe(high)}
                </AppText>
              </View>
              <View style={{ marginTop: space.md }}>
                <RangeSlider min={facets.priceMin} max={facets.priceMax} step={PRICE_STEP} low={low} high={high} onChange={(lo, hi) => patch({ priceMin: lo, priceMax: hi })} />
              </View>
            </>
          ) : null}

          {/* size */}
          {facets.sizes.length > 1 ? (
            <>
              <AppText variant="label" style={s.eyebrow}>Size</AppText>
              <View style={s.wrap}>
                {facets.sizes.map((ml) => {
                  const key = String(ml);
                  const active = draft.sizes.includes(ml);
                  return <CategoryChip key={key} label={`${ml} ml`} active={active} onPress={() => patch({ sizes: active ? draft.sizes.filter((x) => x !== ml) : [...draft.sizes, ml] })} />;
                })}
              </View>
            </>
          ) : null}

          {/* minimum rating */}
          <AppText variant="label" style={s.eyebrow}>Minimum rating</AppText>
          <View style={s.wrap}>
            {RATINGS.map((r) => (
              <CategoryChip key={r.label} label={r.label} active={draft.minRating === r.value} onPress={() => patch({ minRating: r.value })} />
            ))}
          </View>

          {/* in stock */}
          <View style={s.stockRow}>
            <AppText variant="body">In stock only</AppText>
            <ToggleSwitch value={draft.inStockOnly} onToggle={(v) => patch({ inStockOnly: v })} />
          </View>
        </ScrollView>

        <View style={[s.footer, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={{ flex: 1 }}>
            <Button title="Clear all" variant="secondary" onPress={clearAll} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title={count === 1 ? "Show 1 result" : `Show ${count} results`} onPress={apply} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(34,30,25,0.4)" },
  sheet: { maxHeight: "88%", backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.gutter, paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  eyebrow: { color: colors.ink60, marginTop: space["2xl"] },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
  priceHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: space["2xl"] },
  stockRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 56, borderTopWidth: 1, borderTopColor: colors.line, marginTop: space["2xl"] },
  footer: { flexDirection: "row", gap: space.md, paddingHorizontal: space.gutter, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: colors.line },
});
