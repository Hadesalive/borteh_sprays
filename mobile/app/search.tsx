import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { MagnifyingGlass, X } from "phosphor-react-native";
import { useMemo, useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProductCard } from "@/components/ProductCard";
import { AppText } from "@/components/Text";
import { type Product, useProducts } from "@/lib/api";
import { colors, font, radius, space } from "@/lib/theme";

const SUGGESTIONS = ["Oud", "Vanilla", "Rose", "Amber", "Fresh", "Lattafa", "Khamrah"];

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

  const left = results.filter((_, i) => i % 2 === 0);
  const right = results.filter((_, i) => i % 2 === 1);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="dark" />

      {/* Search bar with autofocus + cancel */}
      <View style={[s.bar, { paddingTop: insets.top + space.sm }]}>
        <View style={s.field}>
          <MagnifyingGlass size={19} color={colors.inkMute} />
          <TextInput
            autoFocus
            value={q}
            onChangeText={setQ}
            placeholder="Search fragrances, notes, brands…"
            placeholderTextColor={colors.placeholder}
            style={s.input}
            returnKeyType="search"
            autoCorrect={false}
          />
          {q.length > 0 ? (
            <Pressable onPress={() => setQ("")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear">
              <X size={16} color={colors.inkMute} weight="bold" />
            </Pressable>
          ) : null}
        </View>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel">
          <AppText style={s.cancel}>Cancel</AppText>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: insets.bottom + space["4xl"] }}>
        {!term ? (
          <View style={s.suggest}>
            <AppText style={s.suggestLabel}>Popular searches</AppText>
            <View style={s.chips}>
              {SUGGESTIONS.map((sug) => (
                <Pressable key={sug} onPress={() => setQ(sug)} style={s.chip} accessibilityRole="button">
                  <AppText style={s.chipTxt}>{sug}</AppText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : results.length === 0 ? (
          <View style={s.empty}>
            <AppText variant="label" style={{ textAlign: "center" }}>
              No matches for “{q.trim()}”
            </AppText>
            <AppText variant="body" style={{ textAlign: "center", marginTop: 4 }}>
              Try a note, a brand, or a scent family.
            </AppText>
          </View>
        ) : (
          <>
            <AppText style={s.count}>
              {results.length} {results.length === 1 ? "result" : "results"}
            </AppText>
            <View style={s.grid}>
              <View style={s.col}>
                {left.map((p) => (
                  <ProductCard key={p.id} product={p} width={CARD_W} imageHeight={IMG_H} />
                ))}
              </View>
              <View style={[s.col, { marginTop: 28 }]}>
                {right.map((p) => (
                  <ProductCard key={p.id} product={p} width={CARD_W} imageHeight={IMG_H} />
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const W = Dimensions.get("window").width;
const CARD_W = Math.floor((W - space.xl * 2 - space.md) / 2);
const IMG_H = Math.round(CARD_W * 1.28);

const s = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.xl, paddingBottom: space.md },
  field: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.sm, height: 48, paddingHorizontal: space.lg, borderRadius: radius.md, backgroundColor: colors.field },
  input: { flex: 1, fontFamily: font.regular, fontSize: 15, color: colors.ink, padding: 0 },
  cancel: { fontFamily: font.semibold, fontSize: 15, color: colors.accentInk },
  suggest: { paddingHorizontal: space.xl, paddingTop: space.lg },
  suggestLabel: { fontFamily: font.semibold, fontSize: 13, color: colors.inkSoft, letterSpacing: 0.2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
  chip: { height: 40, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: colors.field, alignItems: "center", justifyContent: "center" },
  chipTxt: { fontFamily: font.medium, fontSize: 14, color: colors.ink },
  empty: { paddingTop: space["4xl"], paddingHorizontal: space.xl, alignItems: "center" },
  count: { fontFamily: font.regular, fontSize: 13, color: colors.inkSoft, paddingHorizontal: space.xl, marginBottom: space.md },
  grid: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: space.xl, gap: space.md },
  col: { width: CARD_W, gap: space.xl },
});
