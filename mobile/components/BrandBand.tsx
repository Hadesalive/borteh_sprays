import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import { useBrands, useProducts } from "@/lib/api";
import { brandLogo } from "@/lib/brandLogo";
import { imageUrl } from "@/lib/supabase";
import { colors, font, radius, space } from "@/lib/theme";
import { AppText } from "./Text";

/** Brand row — each logo in a soft, uniform chip so the mismatched set reads organized. */
export function BrandBand() {
  const router = useRouter();
  // Curated order from the brand table (featured first); falls back to the
  // brands derived from the catalog if curation isn't available yet.
  const { data: curated, error } = useBrands();
  const { data: products } = useProducts();

  const derived = useMemo(() => {
    const m = new Map<string, string>();
    (products ?? []).forEach((p) => {
      if (p.brandSlug) m.set(p.brandSlug, p.brand);
    });
    return [...m.entries()]
      .map(([slug, name]) => ({ slug, name, logoPath: null as string | null }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const brands = !error && curated && curated.length ? curated : derived;

  if (!brands.length) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
      {brands.map((b) => {
        const remote = b.logoPath ? imageUrl(b.logoPath) : null;
        const logo = remote ? { uri: remote } : brandLogo(b.slug);
        return (
          <Pressable
            key={b.slug}
            onPress={() => router.push({ pathname: "/shop", params: { brand: b.slug } })}
            style={({ pressed }) => [s.chip, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel={`Shop ${b.name}`}
          >
            {logo ? (
              <Image source={logo} style={s.logo} contentFit="contain" cachePolicy="memory-disk" />
            ) : (
              <AppText style={s.name} numberOfLines={1}>
                {b.name}
              </AppText>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  rail: { paddingHorizontal: space.xl, gap: space.md, alignItems: "center", paddingVertical: space.sm },
  chip: {
    width: 116,
    height: 76,
    borderRadius: radius.md,
    backgroundColor: colors.plinth,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
  },
  logo: { width: "82%", height: "58%" },
  name: { fontFamily: font.semibold, fontSize: 14, color: colors.ink, letterSpacing: -0.2, textAlign: "center" },
});
