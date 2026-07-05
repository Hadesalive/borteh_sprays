import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { X } from "phosphor-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProductCard } from "@/components/ProductCard";
import { AppText } from "@/components/Text";
import { Avatar, BellButton, LinkLabel, SearchBar } from "@/components/ui";
import { discountPct, type Gender, type Product, useProducts } from "@/lib/api";
import { useSession } from "@/lib/auth";
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
  const session = useSession();
  const params = useLocalSearchParams<{ family?: string; gender?: string; sale?: string; brand?: string; collection?: string }>();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"all" | Gender>(isGender(params.gender) ? params.gender : "all");
  const [family, setFamily] = useState<string | null>(params.family ?? null);
  const [brand, setBrand] = useState<string | null>(params.brand ?? null);
  const [collection, setCollection] = useState<string | null>(params.collection ?? null);
  const sale = params.sale === "1";

  useEffect(() => { if (params.family !== undefined) setFamily(params.family || null); }, [params.family]);
  useEffect(() => { if (params.brand !== undefined) setBrand(params.brand || null); }, [params.brand]);
  useEffect(() => { if (params.collection !== undefined) setCollection(params.collection || null); }, [params.collection]);
  useEffect(() => { if (isGender(params.gender)) setCat(params.gender); }, [params.gender]);

  const term = q.trim().toLowerCase();
  const products = useMemo(() => {
    let list: Product[] = data ?? [];
    if (cat !== "all") list = list.filter((p) => p.gender === cat);
    if (brand) list = list.filter((p) => p.brandSlug === brand);
    if (collection) list = list.filter((p) => p.collection === collection);
    if (family) list = list.filter((p) => p.notes.some((n) => n.family === family));
    if (sale) list = list.filter((p) => discountPct(p) > 0);
    if (term) list = list.filter((p) => p.name.toLowerCase().includes(term) || p.brand.toLowerCase().includes(term) || p.notes.some((n) => n.name.toLowerCase().includes(term)));
    return list;
  }, [data, cat, brand, collection, family, sale, term]);

  const brandName = (data ?? []).find((p) => p.brandSlug === brand)?.brand ?? brand;
  const collectionName = (data ?? []).find((p) => p.collection === collection)?.collectionName ?? collection;
  const displayName = (session?.user?.user_metadata?.display_name as string | undefined)?.trim() || undefined;
  const initials = displayName?.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || undefined;

  const cardW = Math.floor((width - space.gutter * 2 - space.lg) / 2);
  const imgH = Math.round(cardW * 1.3);
  const activeFilters = [
    sale && { key: "sale", label: "On sale", clear: () => router.setParams({ sale: "" }) },
    brand && { key: "brand", label: brandName ?? "", clear: () => setBrand(null) },
    collection && { key: "collection", label: collectionName ?? "", clear: () => setCollection(null) },
    family && { key: "family", label: cap(family), clear: () => setFamily(null) },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];
  const clearAll = () => { setBrand(null); setCollection(null); setFamily(null); router.setParams({ sale: "" }); };

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag" contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: space["3xl"] }}>
        <View style={s.gutter}>
          <View style={s.headerRow}>
            <AppText variant="heading">Shop</AppText>
            <View style={s.actions}>
              <BellButton onPress={() => router.push("/orders")} />
              <Pressable onPress={() => router.push("/profile")} accessibilityRole="button" accessibilityLabel="Account">
                <Avatar initials={initials} />
              </Pressable>
            </View>
          </View>
          <AppText variant="caption" style={{ marginTop: space.xs }}>
            {products.length} {products.length === 1 ? "fragrance" : "fragrances"}
          </AppText>
          <View style={{ marginTop: space.lg }}>
            <SearchBar value={q} onChangeText={setQ} onFilter={() => router.push({ pathname: "/filter", params: { family: family ?? "" } })} />
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

        {/* applied filters */}
        {activeFilters.length > 0 ? (
          <View style={[s.gutter, s.filterRow]}>
            {activeFilters.map((f) => (
              <Pressable key={f.key} onPress={f.clear} style={s.filterChip} accessibilityRole="button" accessibilityLabel={`Clear ${f.label}`}>
                <AppText variant="label">{f.label}</AppText>
                <X size={16} color={colors.ink} weight="regular" />
              </Pressable>
            ))}
            <LinkLabel label="Clear all" onPress={clearAll} color={colors.accent} />
          </View>
        ) : null}

        {products.length === 0 ? (
          <View style={s.empty}>
            <AppText variant="heading" style={{ textAlign: "center" }}>Nothing on the shelf for that.</AppText>
            <AppText variant="bodySoft" style={{ textAlign: "center", marginTop: space.sm }}>Try another search or clear a filter.</AppText>
          </View>
        ) : (
          <View style={[s.grid, { marginTop: space.lg }]}>
            {products.map((p) => (
              <ProductCard key={p.id} product={p} width={cardW} imageHeight={imgH} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  gutter: { paddingHorizontal: space.gutter },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  actions: { flexDirection: "row", alignItems: "center", gap: space.lg },
  tabs: { flexDirection: "row", gap: space["2xl"], paddingHorizontal: space.gutter, marginTop: space["2xl"], borderBottomWidth: 1, borderBottomColor: colors.line },
  tab: { paddingBottom: space.md },
  tabOn: { borderBottomWidth: 1, borderBottomColor: colors.ink, marginBottom: -1 },
  filterRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm, marginTop: space.lg },
  filterChip: { flexDirection: "row", alignItems: "center", gap: space.sm, borderWidth: 1, borderColor: colors.ink, paddingHorizontal: space.md, paddingVertical: space.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", paddingHorizontal: space.gutter, rowGap: space["2xl"] },
  empty: { paddingTop: space["4xl"], paddingHorizontal: space.gutter, alignItems: "center" },
});
