import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import { useFeaturedCollections } from "@/lib/api";
import { imageUrl } from "@/lib/supabase";
import { colors, font, radius, space } from "@/lib/theme";
import { AppText } from "./Text";

// Local cover art keyed by the seeded category slugs — the fallback, and used
// when a featured collection has no uploaded cover yet.
const LOCAL: Record<string, number> = {
  summer: require("../assets/home/collections/summer.jpg"),
  "date-night": require("../assets/home/collections/date-night.jpg"),
  "oud-lovers": require("../assets/home/scent/woody.jpg"),
  "gourmand-sweet": require("../assets/home/collections/gourmand.jpg"),
  office: require("../assets/home/collections/office.jpg"),
  signature: require("../assets/home/collections/signature.jpg"),
};

const FALLBACK = [
  { slug: "summer", name: "Summer" },
  { slug: "date-night", name: "Date night" },
  { slug: "oud-lovers", name: "Oud lovers" },
  { slug: "gourmand-sweet", name: "Gourmand" },
  { slug: "office", name: "Office" },
  { slug: "signature", name: "Signature" },
];

type Tile = { slug: string; name: string; source: number | { uri: string } | undefined };

export function CollectionBand() {
  const router = useRouter();
  // Owner-curated featured collections; falls back to the seeded set if curation
  // isn't available yet (pre-migration or nothing featured).
  const { data: curated, error } = useFeaturedCollections();

  const items: Tile[] =
    !error && curated && curated.length
      ? curated.map((c) => {
          const remote = c.coverPath ? imageUrl(c.coverPath) : null;
          return { slug: c.slug, name: c.name, source: remote ? { uri: remote } : LOCAL[c.slug] };
        })
      : FALLBACK.map((c) => ({ slug: c.slug, name: c.name, source: LOCAL[c.slug] }));

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
      {items.map((c) => (
        <Pressable
          key={c.slug}
          onPress={() => router.push({ pathname: "/shop", params: { collection: c.slug } })}
          style={({ pressed }) => [s.card, pressed && { opacity: 0.92 }]}
          accessibilityRole="button"
          accessibilityLabel={`Shop ${c.name} collection`}
        >
          {c.source ? (
            <Image source={c.source} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={200} />
          ) : null}
          <LinearGradient colors={["rgba(15,11,8,0.05)", "rgba(15,11,8,0.7)"]} style={StyleSheet.absoluteFill} />
          <AppText style={s.label}>{c.name}</AppText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  rail: { paddingHorizontal: space.xl, gap: space.md },
  card: {
    width: 156,
    height: 112,
    borderRadius: radius.lg,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: space.md,
    backgroundColor: colors.plinth,
  },
  label: { fontFamily: font.bold, fontSize: 16, color: "#FFFFFF", letterSpacing: -0.2 },
});
