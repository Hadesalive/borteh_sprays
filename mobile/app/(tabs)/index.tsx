import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ArrowRight } from "phosphor-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ComboRail } from "@/components/ComboRail";
import { FeedRail } from "@/components/FeedRail";
import { LeaderboardBand } from "@/components/LeaderboardBand";
import { HomeSkeleton } from "@/components/Skeleton";
import { AppText } from "@/components/Text";
import { TrackImpression, reportScroll, resetImpressionRegistry } from "@/components/TrackImpression";
import { Guilloche } from "@/components/Guilloche";
import { HeaderActions, SearchButton } from "@/components/ui";
import { useFeaturedCollections, useHomeCarousel, useProducts, useScentFamilies } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { useCombos } from "@/lib/combos";
import { useHomeFeed, useMyTopFamilies, useRankedCollections } from "@/lib/feed";
import { useOnboarded } from "@/lib/onboarding";
import { imageUrl } from "@/lib/supabase";
import { colors, space } from "@/lib/theme";
import { track } from "@/lib/track";

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
const PAPER = "rgba(250,248,245,0.86)"; // legible label-on-photo
const SCRIM_BOTTOM = ["transparent", "rgba(24,20,16,0.85)"] as const;

function greeting(name?: string) {
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name}` : part;
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const session = useSession();
  const signedIn = !!session;
  const onboarded = useOnboarded();

  const { data, isLoading, refetch, isRefetching } = useProducts();
  const { data: carousel } = useHomeCarousel();
  const { data: families } = useScentFamilies();
  const { data: collections } = useFeaturedCollections();

  const products = data ?? [];
  const { modules } = useHomeFeed();
  const topFamilies = useMyTopFamilies(signedIn);
  const combos = useCombos();

  const viewportH = useRef(0);
  const [headerH, setHeaderH] = useState(insets.top + 52); // measured on layout; estimate avoids first-frame jump
  useEffect(() => {
    resetImpressionRegistry();
  }, []);

  const displayName = (session?.user?.user_metadata?.display_name as string | undefined)?.trim() || undefined;
  const firstName = displayName?.split(/\s+/)[0];

  // Bounded editorial hero (~340) — image + bottom scrim + a real paper button. No longer runs
  // under the status bar; the header sits above it on paper (stable ink-on-paper chrome).
  const heroH = Math.min(380, Math.max(300, Math.round(width * 0.86)));
  const heroSlide = carousel?.[0];
  const heroSource = heroSlide?.imagePath ? { uri: imageUrl(heroSlide.imagePath)! } : HERO_FALLBACK;
  const heroLabel = heroSlide?.label || "The signature edit";
  const heroTitle = heroSlide?.title || "Scents that stay with you.";
  const heroCta = heroSlide?.cta || "Shop the edit";
  const heroTo = (heroSlide?.link as any) || "/shop";

  // Shop-by-note cards, ordered by the caller's taste (fn_my_top_families) when signed in;
  // families the user engages with float to the front, the rest keep the admin order.
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

  const orderedNotes = useMemo(() => {
    const tops = topFamilies.data;
    if (!tops?.length) return noteRows;
    const rankOf = (key: string) => {
      const k = key.toLowerCase();
      for (let i = 0; i < tops.length; i++) {
        const f = tops[i].family.toLowerCase();
        if (f.includes(k) || k.includes(f)) return i;
      }
      return Number.POSITIVE_INFINITY;
    };
    return [...noteRows].sort((a, b) => rankOf(a.family) - rankOf(b.family));
  }, [noteRows, topFamilies.data]);

  // All featured collections as a swipeable shelf, ordered by per-user affinity
  // (fn_rank_collections) so the strongest match leads; anon / no taste → the admin order.
  const featured = collections ?? [];
  const rankedCols = useRankedCollections(featured.map((c) => c.slug), signedIn);
  const orderedCollections = useMemo(() => {
    if (!featured.length) return [];
    const aff = new Map((rankedCols.data ?? []).map((r) => [r.slug, r.affinity]));
    return [...featured].sort((a, b) => (aff.get(b.slug) ?? -1) - (aff.get(a.slug) ?? -1));
  }, [featured, rankedCols.data]);
  const colCardW = Math.round(width * 0.78); // cards peek so the shelf reads as swipeable

  // Products above the fold: the first personalized rail sits directly under Shop-by-note,
  // the editorial collection banner comes after it, then the remaining rails.
  const firstRail = modules[0];
  const restRails = modules.slice(1);

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
        contentContainerStyle={{ paddingTop: headerH, paddingBottom: space["3xl"] }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.ink40} colors={[colors.accent]} progressViewOffset={headerH} />}
        scrollEventThrottle={16}
        onScroll={(e) => reportScroll(e.nativeEvent.contentOffset.y, viewportH.current)}
        onLayout={(e) => {
          viewportH.current = e.nativeEvent.layout.height;
          reportScroll(0, e.nativeEvent.layout.height);
        }}
      >
        {/* search pill — the high-intent path to full search */}
        <View style={s.searchWrap}>
          <SearchButton onPress={() => router.push("/search")} onFilter={() => router.push("/shop")} placeholder="Fragrances, notes, brands" />
        </View>

        {/* hero — bounded image with a real paper button */}
        <TrackImpression module="hero" position={0}>
          <Pressable
            onPress={() => {
              track("module_tap", { module: "hero", position: 0, metadata: { to: String(heroTo) } });
              router.push(heroTo);
            }}
            accessibilityRole="button"
            accessibilityLabel={heroCta}
          >
            <View style={[s.hero, { height: heroH }]}>
              <Image source={heroSource} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={300} />
              <LinearGradient colors={SCRIM_BOTTOM} style={s.scrimBottom} pointerEvents="none" />
              <View style={s.heroCaption} pointerEvents="none">
                <AppText variant="label" style={{ color: PAPER }}>{heroLabel}</AppText>
                <AppText variant="display" numberOfLines={2} style={[s.onPhoto, { marginTop: space.xs }]}>{heroTitle}</AppText>
                <View style={s.heroBtn}>
                  <AppText variant="label" style={{ color: colors.ink }}>{heroCta}</AppText>
                </View>
              </View>
            </View>
          </Pressable>
        </TrackImpression>

        {/* shop by note — horizontal rail, ordered by taste */}
        {orderedNotes.length > 0 ? (
          <TrackImpression module="shop_by_note" position={1}>
            <View style={{ marginTop: space["4xl"] }}>
              <View style={s.gutter}>
                <AppText variant="heading">Shop by note</AppText>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
                {orderedNotes.map((n, i) => (
                  <Pressable
                    key={n.family}
                    onPress={() => {
                      track("module_tap", { module: "shop_by_note", position: i, metadata: { family: n.family } });
                      router.push({ pathname: "/shop", params: { family: n.family } });
                    }}
                    style={s.noteCard}
                    accessibilityRole="button"
                    accessibilityLabel={`Shop ${n.label}`}
                  >
                    <View style={s.noteCardBed}>
                      <View style={s.noteCardClip}>
                        {n.source ? <Image source={n.source} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" /> : null}
                        {/* engraved swirl over the top — the maison's guilloche, tying these to the loyalty card */}
                        <Guilloche w={120} h={140} origin="topLeft" ringGap={13} start={8} base="rgba(250,248,245,0.16)" accent="rgba(138,83,39,0.42)" />
                      </View>
                    </View>
                    <AppText variant="bodyLg" numberOfLines={1} style={{ marginTop: space.sm }}>{n.label}</AppText>
                    {n.count > 0 ? <AppText variant="caption">{n.count} scents</AppText> : null}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </TrackImpression>
        ) : null}

        {/* first personalized product rail — products above the fold */}
        {firstRail ? <FeedRail key={firstRail.key} module={firstRail.key} title={firstRail.title} products={firstRail.products} position={2} /> : null}

        {/* leaderboard teaser — top buyers + your standing; self-hides until there's a board */}
        <LeaderboardBand position={3} />

        {/* collections — swipeable shelf of rounded text-on-image cards, ordered per user */}
        {orderedCollections.length > 0 ? (
          <TrackImpression module="collection" position={3}>
            <View style={{ marginTop: space["4xl"] }}>
              <View style={s.gutter}>
                <AppText variant="heading">Collections</AppText>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.colRail}>
                {orderedCollections.map((c, i) => {
                  const count = products.filter((p) => p.collection === c.slug).length;
                  const src = c.coverPath ? { uri: imageUrl(c.coverPath)! } : COLLECTION_FALLBACK[c.slug];
                  return (
                    <Pressable
                      key={c.slug}
                      style={[s.colCard, { width: colCardW }]}
                      onPress={() => {
                        track("module_tap", { module: "collection", position: i, metadata: { slug: c.slug } });
                        router.push({ pathname: "/shop", params: { collection: c.slug } });
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Shop ${c.name}`}
                    >
                      {src ? <Image source={src} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={200} /> : null}
                      <LinearGradient colors={SCRIM_BOTTOM} style={s.collectionScrim} pointerEvents="none" />
                      <View style={s.collectionCaption} pointerEvents="none">
                        <AppText variant="label" style={{ color: PAPER }}>Collection</AppText>
                        <AppText variant="heading" numberOfLines={1} style={[s.onPhoto, { marginTop: 2 }]}>{c.name}</AppText>
                        {count > 0 ? (
                          <AppText variant="caption" style={{ color: PAPER, marginTop: 2 }}>
                            {count} {count === 1 ? "fragrance" : "fragrances"}
                          </AppText>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </TrackImpression>
        ) : null}

        {/* perfect pairs — curated combos */}
        <ComboRail title="Perfect pairs" combos={combos} onOpen={(slug) => router.push({ pathname: "/combo/[slug]", params: { slug } })} onSeeAll={() => router.push("/pairs")} />

        {/* remaining personalized rails */}
        {restRails.map((m, i) => (
          <FeedRail key={m.key} module={m.key} title={m.title} products={m.products} position={i + 4} />
        ))}

        {/* browse all */}
        {products.length > 0 ? (
          <Pressable style={[s.gutter, s.browse]} onPress={() => router.push("/shop")} accessibilityRole="button" accessibilityLabel="Browse all fragrances">
            <AppText variant="body">Browse all {products.length} fragrances</AppText>
            <ArrowRight size={20} color={colors.ink} weight="regular" />
          </Pressable>
        ) : null}
      </ScrollView>

      {/* frosted glass header — content scrolls under it; a light paper tint keeps the dark
          status-bar icons + greeting legible even when the hero photo passes beneath */}
      <View style={s.headerAbs} onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)} pointerEvents="box-none">
        <BlurView intensity={40} tint="light" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, s.headerTint]} pointerEvents="none" />
        <View style={s.headerLine} pointerEvents="none" />
        <View style={[s.header, { paddingTop: insets.top + space.xs }]} pointerEvents="box-none">
          <AppText variant="heading" numberOfLines={1} style={{ flex: 1 }}>{greeting(firstName)}</AppText>
          <HeaderActions />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  headerAbs: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, overflow: "hidden" },
  headerTint: { backgroundColor: "rgba(250,248,245,0.6)" },
  headerLine: { position: "absolute", bottom: 0, left: 0, right: 0, height: 1, backgroundColor: "rgba(228,223,214,0.7)" },
  header: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.gutter, paddingBottom: space.md },
  searchWrap: { paddingHorizontal: space.gutter, paddingTop: space.lg },
  hero: { backgroundColor: colors.surface, overflow: "hidden", marginTop: space.xl },
  scrimBottom: { position: "absolute", bottom: 0, left: 0, right: 0, height: 220 },
  heroCaption: { position: "absolute", left: space.gutter, right: space.gutter, bottom: space.xl },
  onPhoto: { color: colors.paper },
  heroBtn: { alignSelf: "flex-start", marginTop: space.lg, height: 44, paddingHorizontal: space.xl, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center" },
  rail: { paddingHorizontal: space.gutter, gap: space.lg, paddingTop: space.lg },
  gutter: { paddingHorizontal: space.gutter },
  noteCard: { width: 120 },
  noteCardBed: { width: 120, height: 140, borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: colors.surface, shadowColor: "#1A140E", shadowOpacity: 0.14, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  noteCardClip: { ...StyleSheet.absoluteFillObject, borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: "hidden" },
  colRail: { paddingHorizontal: space.gutter, gap: space.lg, paddingTop: space.lg },
  colCard: { aspectRatio: 16 / 10, borderRadius: 16, backgroundColor: colors.surface, overflow: "hidden" },
  collectionScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "58%" },
  collectionCaption: { position: "absolute", left: space.lg, right: space.lg, bottom: space.lg },
  browse: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space["5xl"], paddingVertical: space.lg, borderTopWidth: 1, borderTopColor: colors.line },
});
