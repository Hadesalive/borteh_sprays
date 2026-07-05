import { Image } from "expo-image";
import { Redirect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ArrowRight } from "phosphor-react-native";
import { useMemo } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProductCard } from "@/components/ProductCard";
import { HomeSkeleton } from "@/components/Skeleton";
import { AppText } from "@/components/Text";
import { Avatar, BellButton, LinkLabel, SectionHeader } from "@/components/ui";
import { useFeaturedCollections, useHomeCarousel, useProducts, useScentFamilies } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { useOnboarded } from "@/lib/onboarding";
import { imageUrl } from "@/lib/supabase";
import { colors, space } from "@/lib/theme";

// Local art shown until the owner curates the home in the admin (mirrors the bands' fallbacks).
const HERO_FALLBACK = require("../../assets/home/hero-gold.jpg");
const SCENT_FALLBACK: Record<string, number> = {
  woody: require("../../assets/home/scent/woody.jpg"),
  floral: require("../../assets/home/scent/floral.jpg"),
  oriental: require("../../assets/home/scent/oriental.jpg"),
  spicy: require("../../assets/home/scent/spicy.jpg"),
  citrus: require("../../assets/home/scent/citrus.jpg"),
  sweet: require("../../assets/home/scent/sweet.jpg"),
};
const COLLECTION_FALLBACK: Record<string, number> = {
  summer: require("../../assets/home/collections/summer.jpg"),
  "date-night": require("../../assets/home/collections/date-night.jpg"),
  "gourmand-sweet": require("../../assets/home/collections/gourmand.jpg"),
  office: require("../../assets/home/collections/office.jpg"),
  signature: require("../../assets/home/collections/signature.jpg"),
};

function greeting(name?: string) {
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name}` : part;
}

function initialsOf(name?: string) {
  if (!name) return undefined;
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || undefined;
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const session = useSession();
  const onboarded = useOnboarded();

  const { data, isLoading, refetch, isRefetching } = useProducts();
  const { data: carousel } = useHomeCarousel();
  const { data: families } = useScentFamilies();
  const { data: collections } = useFeaturedCollections();

  const products = data ?? [];
  const best = useMemo(() => products.slice(0, 8), [products]); // query already sorts by popularity

  const displayName = (session?.user?.user_metadata?.display_name as string | undefined)?.trim() || undefined;
  const firstName = displayName?.split(/\s+/)[0];

  const heroH = Math.min(420, Math.max(300, Math.round(width * 0.9)));

  // Hero content = first curated slide (admin) or a calm editorial fallback.
  const heroSlide = carousel?.[0];
  const heroSource = heroSlide?.imagePath ? { uri: imageUrl(heroSlide.imagePath)! } : HERO_FALLBACK;
  const heroLabel = heroSlide?.label || "The signature edit";
  const heroTitle = heroSlide?.title || "Scents that stay with you.";
  const heroCta = heroSlide?.cta || "Shop the edit";
  const heroTo = (heroSlide?.link as any) || "/shop";

  // Scent families with a best-effort product count.
  const noteRows = useMemo(() => {
    const list = families?.length ? families : [];
    return list.map((f) => {
      const key = f.family.toLowerCase();
      const count = products.filter(
        (p) =>
          (p.scentFamily ?? "").toLowerCase().includes(key) ||
          p.accords.some((a) => a.toLowerCase().includes(key)) ||
          p.notes.some((n) => (n.family ?? "").toLowerCase() === key),
      ).length;
      const source = f.imagePath ? { uri: imageUrl(f.imagePath)! } : SCENT_FALLBACK[f.family];
      return { family: f.family, label: f.label, count, source };
    });
  }, [families, products]);

  const collection = collections?.[0];
  const collectionCount = collection ? products.filter((p) => p.collection === collection.slug).length : 0;
  const collectionSource = collection?.coverPath
    ? { uri: imageUrl(collection.coverPath)! }
    : collection
      ? COLLECTION_FALLBACK[collection.slug]
      : undefined;

  if (onboarded === false) return <Redirect href="/onboarding" />;

  if (isLoading && products.length === 0) {
    return (
      <View style={s.screen}>
        <StatusBar style="dark" />
        <HomeSkeleton topInset={insets.top} heroW={width} />
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: space["3xl"] }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.ink40} colors={[colors.accent]} />}
      >
        {/* header */}
        <View style={s.header}>
          <AppText variant="heading" numberOfLines={1} style={{ flex: 1 }}>
            {greeting(firstName)}
          </AppText>
          <View style={s.actions}>
            <BellButton onPress={() => router.push("/orders")} />
            <Pressable onPress={() => router.push("/profile")} accessibilityRole="button" accessibilityLabel="Account">
              <Avatar initials={initialsOf(displayName)} />
            </Pressable>
          </View>
        </View>

        {/* hero image */}
        <Pressable onPress={() => router.push(heroTo)} accessibilityRole="button" accessibilityLabel={heroCta}>
          <View style={[s.hero, { height: heroH }]}>
            <Image source={heroSource} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={300} />
          </View>
        </Pressable>

        {/* editorial block */}
        <View style={s.editorial}>
          <AppText variant="label" style={{ color: colors.ink60 }}>
            {heroLabel}
          </AppText>
          <AppText variant="display" style={{ marginTop: space.sm }}>
            {heroTitle}
          </AppText>
          <View style={{ marginTop: space.md }}>
            <LinkLabel label={heroCta} onPress={() => router.push(heroTo)} />
          </View>
        </View>

        {/* best sellers */}
        {best.length > 0 ? (
          <View style={{ marginTop: space["5xl"] }}>
            <SectionHeader title="Best sellers" trailing="View all" onPressTrailing={() => router.push("/shop")} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
              {best.map((p) => (
                <ProductCard key={p.id} product={p} width={160} imageHeight={200} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* shop by note */}
        {noteRows.length > 0 ? (
          <View style={{ marginTop: space["5xl"] }}>
            <View style={s.gutter}>
              <AppText variant="heading">Shop by note</AppText>
            </View>
            <View style={[s.gutter, { marginTop: space.sm }]}>
              {noteRows.map((n) => (
                <Pressable
                  key={n.family}
                  onPress={() => router.push({ pathname: "/shop", params: { family: n.family } })}
                  style={s.noteRow}
                  accessibilityRole="button"
                  accessibilityLabel={`Shop ${n.label}`}
                >
                  <View style={s.noteThumb}>{n.source ? <Image source={n.source} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" /> : null}</View>
                  <AppText variant="bodyLg" style={{ flex: 1 }}>
                    {n.label}
                  </AppText>
                  {n.count > 0 ? <AppText variant="caption">{n.count} scents</AppText> : null}
                  <ArrowRight size={20} color={colors.ink} weight="regular" />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* collection */}
        {collection ? (
          <View style={{ marginTop: space["5xl"] }}>
            <Pressable
              onPress={() => router.push({ pathname: "/shop", params: { collection: collection.slug } })}
              accessibilityRole="button"
              accessibilityLabel={`Shop ${collection.name}`}
            >
              <View style={s.collectionImg}>{collectionSource ? <Image source={collectionSource} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={200} /> : null}</View>
            </Pressable>
            <View style={[s.gutter, { marginTop: space.lg }]}>
              <AppText variant="label" style={{ color: colors.ink60 }}>
                Collection
              </AppText>
              <View style={s.collectionRow}>
                <AppText variant="heading">{collection.name}</AppText>
                <LinkLabel label="Explore" onPress={() => router.push({ pathname: "/shop", params: { collection: collection.slug } })} />
              </View>
              {collectionCount > 0 ? (
                <AppText variant="bodySoft" style={{ marginTop: space.xs }}>
                  {collectionCount} {collectionCount === 1 ? "fragrance" : "fragrances"} in the edit.
                </AppText>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* browse all */}
        {products.length > 0 ? (
          <Pressable style={[s.gutter, s.browse]} onPress={() => router.push("/shop")} accessibilityRole="button" accessibilityLabel="Browse all fragrances">
            <AppText variant="body">Browse all {products.length} fragrances</AppText>
            <ArrowRight size={20} color={colors.ink} weight="regular" />
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  header: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.gutter, paddingVertical: space.md },
  actions: { flexDirection: "row", alignItems: "center", gap: space.lg },
  hero: { backgroundColor: colors.surface, marginTop: space.sm },
  editorial: { paddingHorizontal: space.gutter, marginTop: space["2xl"] },
  rail: { paddingHorizontal: space.gutter, gap: space.lg, paddingTop: space.lg },
  gutter: { paddingHorizontal: space.gutter },
  noteRow: { flexDirection: "row", alignItems: "center", gap: space.lg, height: 64, borderBottomWidth: 1, borderBottomColor: colors.line },
  noteThumb: { width: 44, height: 44, backgroundColor: colors.surface, overflow: "hidden" },
  collectionImg: { height: 240, backgroundColor: colors.surface },
  collectionRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: space.sm },
  browse: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space["5xl"], paddingVertical: space.lg, borderTopWidth: 1, borderTopColor: colors.line },
});
