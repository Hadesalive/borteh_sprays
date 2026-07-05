import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { MagnifyingGlass, X } from "phosphor-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProductCard } from "@/components/ProductCard";
import { AppText } from "@/components/Text";
import { LinkLabel } from "@/components/ui";
import { type Product, productSubline, useProducts } from "@/lib/api";
import { formatLe } from "@/lib/format";
import { productImage } from "@/lib/productImage";
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
  const [q, setQ] = useState("");

  const term = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (!term) return [] as Product[];
    return (data ?? []).filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.brand.toLowerCase().includes(term) ||
        (p.scentFamily ?? "").toLowerCase().includes(term) ||
        p.accords.some((a) => a.toLowerCase().includes(term)) ||
        p.notes.some((n) => n.name.toLowerCase().includes(term)),
    );
  }, [data, term]);
  const trending = useMemo(() => (data ?? []).slice(0, 6), [data]);

  const open = (slug: string) => router.push({ pathname: "/product/[slug]", params: { slug } });

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
          />
          {q.length > 0 ? (
            <Pressable onPress={() => setQ("")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear">
              <X size={20} color={colors.ink40} weight="regular" />
            </Pressable>
          ) : null}
        </View>
        <LinkLabel label="Cancel" onPress={() => router.back()} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: insets.bottom + space["4xl"] }}>
        {!term ? (
          <>
            <View style={s.gutter}>
              <AppText variant="label" style={s.eyebrow}>Popular searches</AppText>
              <View style={s.chips}>
                {POPULAR.map((p) => (
                  <Pressable key={p} onPress={() => setQ(p)} style={s.chip} accessibilityRole="button">
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
        ) : results.length === 0 ? (
          <View style={s.gutter}>
            <AppText variant="heading" style={{ marginTop: space["2xl"] }}>Nothing on the shelf for that.</AppText>
            <AppText variant="bodySoft" style={{ marginTop: space.sm }}>Try fewer words, or a different note or brand. These come closest:</AppText>
            <View style={{ marginTop: space.lg }}>
              {trending.slice(0, 3).map((p) => (
                <ResultRow key={p.id} product={p} onPress={() => open(p.slug)} />
              ))}
            </View>
          </View>
        ) : (
          <View style={s.gutter}>
            <AppText variant="caption" style={{ marginTop: space.lg, paddingBottom: space.sm, borderBottomWidth: 1, borderBottomColor: colors.line }}>
              {results.length} {results.length === 1 ? "result" : "results"}
            </AppText>
            {results.map((p) => (
              <ResultRow key={p.id} product={p} onPress={() => open(p.slug)} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  bar: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingHorizontal: space.gutter, paddingBottom: space.md },
  field: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.md, height: 52, paddingHorizontal: space.lg, borderWidth: 1, borderColor: colors.ink },
  input: { flex: 1, fontFamily: font.regular, fontSize: 14, color: colors.ink, padding: 0 },
  gutter: { paddingHorizontal: space.gutter },
  eyebrow: { color: colors.ink60, marginTop: space["2xl"] },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
  chip: { borderWidth: 1, borderColor: colors.line, paddingHorizontal: space.md, paddingVertical: space.sm },
  rail: { paddingHorizontal: space.gutter, gap: space.lg, paddingTop: space.md },
  result: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  resultThumb: { width: 56, height: 64, backgroundColor: colors.surface, overflow: "hidden" },
});
