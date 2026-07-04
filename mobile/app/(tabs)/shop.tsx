import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GenderFemale, GenderIntersex, GenderMale, SquaresFour, X } from "phosphor-react-native";
import { type ComponentType, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProductCard } from "@/components/ProductCard";
import { TAB_BAR_BODY } from "@/components/TabBar";
import { AppText } from "@/components/Text";
import { CategoryChip, SearchBar } from "@/components/ui";
import { discountPct, type Gender, type Product, useProducts } from "@/lib/api";
import { colors, font, radius, space } from "@/lib/theme";

type Glyph = ComponentType<{ size?: number; color?: string; weight?: any }>;
const CATS: { label: string; value: "all" | Gender; Icon: Glyph }[] = [
  { label: "All", value: "all", Icon: SquaresFour },
  { label: "Women", value: "female", Icon: GenderFemale },
  { label: "Men", value: "male", Icon: GenderMale },
  { label: "Unisex", value: "unisex", Icon: GenderIntersex },
];
const isGender = (v?: string): v is Gender => v === "male" || v === "female" || v === "unisex";
const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

export default function Shop() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { data } = useProducts();
  const params = useLocalSearchParams<{ family?: string; gender?: string; sale?: string; brand?: string; collection?: string }>();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"all" | Gender>(isGender(params.gender) ? params.gender : "all");
  const [family, setFamily] = useState<string | null>(params.family ?? null);
  const [brand, setBrand] = useState<string | null>(params.brand ?? null);
  const [collection, setCollection] = useState<string | null>(params.collection ?? null);
  const sale = params.sale === "1";

  // sync from deep-links (Home → Shop by scent / brand / collection, etc.)
  useEffect(() => {
    if (params.family !== undefined) setFamily(params.family || null);
  }, [params.family]);
  useEffect(() => {
    if (params.brand !== undefined) setBrand(params.brand || null);
  }, [params.brand]);
  useEffect(() => {
    if (params.collection !== undefined) setCollection(params.collection || null);
  }, [params.collection]);
  useEffect(() => {
    if (isGender(params.gender)) setCat(params.gender);
  }, [params.gender]);

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

  const GUTTER = space.xl;
  const COL_GAP = space.md;
  const cardW = Math.floor((width - GUTTER * 2 - COL_GAP) / 2);
  const imgH = Math.round(cardW * 1.28);
  const left = products.filter((_, i) => i % 2 === 0);
  const right = products.filter((_, i) => i % 2 === 1);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + TAB_BAR_BODY + space["3xl"] }}
      >
        <View style={s.head}>
          <AppText variant="name">Shop</AppText>
          <AppText variant="greeting" style={{ marginTop: 3 }}>
            {products.length} {products.length === 1 ? "fragrance" : "fragrances"}
          </AppText>
        </View>

        <View style={s.block}>
          <SearchBar value={q} onChangeText={setQ} onFilter={() => router.push({ pathname: "/filter", params: { family: family ?? "" } })} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.cats}>
          {CATS.map((c) => {
            const active = cat === c.value;
            return (
              <CategoryChip
                key={c.value}
                label={c.label}
                active={active}
                onPress={() => setCat(c.value)}
                icon={<c.Icon size={15} color={active ? colors.onInk : colors.ink} weight="regular" />}
              />
            );
          })}
        </ScrollView>

        {family || sale || brand || collection ? (
          <View style={s.activeRow}>
            {sale ? (
              <Pressable style={s.activeChip} onPress={() => router.setParams({ sale: "" })} accessibilityRole="button" accessibilityLabel="Clear on sale filter">
                <AppText style={s.activeChipTxt}>On sale</AppText>
                <X size={13} color={colors.onInk} weight="bold" />
              </Pressable>
            ) : null}
            {brand ? (
              <Pressable style={s.activeChip} onPress={() => setBrand(null)} accessibilityRole="button" accessibilityLabel={`Clear ${brandName} filter`}>
                <AppText style={s.activeChipTxt}>{brandName}</AppText>
                <X size={13} color={colors.onInk} weight="bold" />
              </Pressable>
            ) : null}
            {collection ? (
              <Pressable style={s.activeChip} onPress={() => setCollection(null)} accessibilityRole="button" accessibilityLabel={`Clear ${collectionName} filter`}>
                <AppText style={s.activeChipTxt}>{collectionName}</AppText>
                <X size={13} color={colors.onInk} weight="bold" />
              </Pressable>
            ) : null}
            {family ? (
              <Pressable style={s.activeChip} onPress={() => setFamily(null)} accessibilityRole="button" accessibilityLabel={`Clear ${family} filter`}>
                <AppText style={s.activeChipTxt}>{cap(family)}</AppText>
                <X size={13} color={colors.onInk} weight="bold" />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {products.length === 0 ? (
          <View style={s.empty}>
            <AppText variant="label" style={{ textAlign: "center" }}>
              No fragrances found
            </AppText>
            <AppText variant="body" style={{ textAlign: "center", marginTop: 4 }}>
              Try another search or filter.
            </AppText>
          </View>
        ) : (
          <View style={[s.grid, { paddingHorizontal: GUTTER, gap: COL_GAP }]}>
            <View style={{ width: cardW, gap: space.xl }}>
              {left.map((p) => (
                <ProductCard key={p.id} product={p} width={cardW} imageHeight={imgH} />
              ))}
            </View>
            <View style={{ width: cardW, gap: space.xl, marginTop: 28 }}>
              {right.map((p) => (
                <ProductCard key={p.id} product={p} width={cardW} imageHeight={imgH} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  head: { paddingHorizontal: space.xl, marginBottom: space.lg },
  block: { paddingHorizontal: space.xl },
  cats: { paddingHorizontal: space.xl, gap: space.sm, paddingVertical: space.lg },
  activeRow: { paddingHorizontal: space.xl, marginBottom: space.md, flexDirection: "row", gap: space.sm },
  activeChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.accent, paddingHorizontal: space.md, height: 34, borderRadius: radius.pill },
  activeChipTxt: { fontFamily: font.semibold, fontSize: 12, color: colors.onInk },
  grid: { flexDirection: "row", justifyContent: "space-between" },
  empty: { paddingTop: space["3xl"], paddingHorizontal: space.xl, alignItems: "center" },
});
