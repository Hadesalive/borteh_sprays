import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { X } from "phosphor-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { GlassCircle } from "@/components/Glass";
import { AppText } from "@/components/Text";
import { CategoryChip } from "@/components/ui";
import { useProducts } from "@/lib/api";
import { colors, font, radius, space } from "@/lib/theme";

const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

export default function FilterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ family?: string }>();
  const { data } = useProducts();
  const [family, setFamily] = useState<string | null>(params.family || null);

  const families = useMemo(() => {
    const map = new Map<string, number>();
    (data ?? []).forEach((p) => {
      const fams = new Set(p.notes.map((n) => n.family).filter((f): f is string => !!f));
      fams.forEach((f) => map.set(f, (map.get(f) ?? 0) + 1));
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([f, count]) => ({ family: f, count }));
  }, [data]);

  const apply = () => router.navigate({ pathname: "/shop", params: { family: family ?? "" } });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <StatusBar style="dark" />
      <View style={s.head}>
        <AppText variant="name">Filters</AppText>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close filters">
          <GlassCircle size={40}>
            <X size={18} color={colors.ink} weight="bold" />
          </GlassCircle>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space["3xl"] }}>
        <View style={s.section}>
          <AppText variant="title">Scent family</AppText>
          <AppText variant="small" style={{ marginTop: 4 }}>
            Choose a scent profile to narrow the catalog.
          </AppText>
          <View style={s.wrap}>
            {families.map((f) => (
              <CategoryChip
                key={f.family}
                label={cap(f.family)}
                active={family === f.family}
                onPress={() => setFamily((cur) => (cur === f.family ? null : f.family))}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[s.bar, { paddingBottom: insets.bottom + space.lg }]}>
        <Pressable onPress={() => setFamily(null)} hitSlop={8} disabled={!family} style={{ opacity: family ? 1 : 0.4 }}>
          <AppText style={s.clear}>Clear all</AppText>
        </Pressable>
        <Button title="Show results" onPress={apply} full={false} size="md" />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.xl, height: 56 },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.field },
  section: { paddingHorizontal: space.xl, paddingTop: space.lg },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.lg },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.xl, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg },
  clear: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  apply: { height: 52, paddingHorizontal: space["2xl"], borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  applyTxt: { fontFamily: font.semibold, fontSize: 15, color: colors.onAccent },
});
