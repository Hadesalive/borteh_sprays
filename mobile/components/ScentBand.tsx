import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useScentFamilies } from "@/lib/api";
import { imageUrl } from "@/lib/supabase";
import { colors, font, space } from "@/lib/theme";
import { AppText } from "./Text";

// Ingredient photography keyed by scent family — the fallback art and used when
// a curated family has no uploaded cover yet.
const SCENT: Record<string, number> = {
  woody: require("../assets/home/scent/woody.jpg"),
  floral: require("../assets/home/scent/floral.jpg"),
  oriental: require("../assets/home/scent/oriental.jpg"),
  spicy: require("../assets/home/scent/spicy.jpg"),
  citrus: require("../assets/home/scent/citrus.jpg"),
  sweet: require("../assets/home/scent/sweet.jpg"),
};
const ORDER = ["woody", "floral", "oriental", "spicy", "citrus", "sweet"];
const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

type Item = { family: string; label: string; source: number | { uri: string } | undefined };

export function ScentBand() {
  const router = useRouter();
  // Owner-curated families; falls back to the bundled set (pre-migration or none).
  const { data: families, error } = useScentFamilies();

  const items: Item[] =
    !error && families && families.length
      ? families.map((f) => {
          const remote = f.imagePath ? imageUrl(f.imagePath) : null;
          return { family: f.family, label: f.label, source: remote ? { uri: remote } : SCENT[f.family] };
        })
      : ORDER.map((family) => ({ family, label: cap(family), source: SCENT[family] }));

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
      {items.map((it) => (
        <Pressable
          key={it.family}
          onPress={() => router.push({ pathname: "/shop", params: { family: it.family } })}
          style={({ pressed }) => [s.item, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel={`Shop ${it.label} scents`}
        >
          <View style={s.ring}>
            {it.source ? (
              <Image source={it.source} style={s.img} contentFit="cover" cachePolicy="memory-disk" transition={200} />
            ) : null}
          </View>
          <AppText style={s.label}>{it.label}</AppText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  rail: { paddingHorizontal: space.xl, gap: space.lg, paddingVertical: space.xs },
  item: { alignItems: "center", gap: space.sm, width: 78 },
  ring: { width: 78, height: 78, borderRadius: 39, overflow: "hidden", backgroundColor: colors.plinth, borderWidth: 1, borderColor: colors.line },
  img: { width: "100%", height: "100%" },
  label: { fontFamily: font.medium, fontSize: 13, color: colors.ink },
});
