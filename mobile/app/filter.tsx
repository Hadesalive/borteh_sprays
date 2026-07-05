import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { X } from "phosphor-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { AppText } from "@/components/Text";
import { CategoryChip } from "@/components/ui";
import { useProducts } from "@/lib/api";
import { colors, space } from "@/lib/theme";

const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

export default function FilterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ family?: string; brand?: string }>();
  const { data } = useProducts();
  const [family, setFamily] = useState<string | null>(params.family || null);
  const [brand, setBrand] = useState<string | null>(params.brand || null);

  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  }, [enter]);
  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });

  const families = useMemo(() => {
    const map = new Map<string, number>();
    (data ?? []).forEach((p) => {
      new Set(p.notes.map((n) => n.family).filter((f): f is string => !!f)).forEach((f) => map.set(f, (map.get(f) ?? 0) + 1));
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f);
  }, [data]);

  const brands = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    (data ?? []).forEach((p) => {
      if (!p.brandSlug) return;
      const cur = map.get(p.brandSlug) ?? { name: p.brand, count: 0 };
      map.set(p.brandSlug, { name: p.brand, count: cur.count + 1 });
    });
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count).map(([slug, v]) => ({ slug, name: v.name }));
  }, [data]);

  const clearAll = () => { setFamily(null); setBrand(null); };
  const apply = () => router.navigate({ pathname: "/shop", params: { family: family ?? "", brand: brand ?? "" } });

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
          <AppText variant="label" style={s.eyebrow}>Fragrance family</AppText>
          <View style={s.wrap}>
            {families.map((f) => (
              <CategoryChip key={f} label={cap(f)} active={family === f} onPress={() => setFamily((cur) => (cur === f ? null : f))} />
            ))}
          </View>

          {brands.length > 0 ? (
            <>
              <AppText variant="label" style={s.eyebrow}>Brand</AppText>
              <View style={s.wrap}>
                {brands.map((b) => (
                  <CategoryChip key={b.slug} label={b.name} active={brand === b.slug} onPress={() => setBrand((cur) => (cur === b.slug ? null : b.slug))} />
                ))}
              </View>
            </>
          ) : null}
        </ScrollView>

        <View style={[s.footer, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={{ flex: 1 }}>
            <Button title="Clear all" variant="secondary" disabled={!family && !brand} onPress={clearAll} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Show results" onPress={apply} />
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
  footer: { flexDirection: "row", gap: space.md, paddingHorizontal: space.gutter, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: colors.line },
});
