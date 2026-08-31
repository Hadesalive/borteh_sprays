import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ComboRail } from "@/components/ComboRail";
import { FeedRail } from "@/components/FeedRail";
import { LeaderboardBand } from "@/components/LeaderboardBand";
import { ProductCard } from "@/components/ProductCard";
import { HomeSkeleton } from "@/components/Skeleton";
import { AppText } from "@/components/Text";
import { TrackImpression, reportScroll, resetImpressionRegistry } from "@/components/TrackImpression";
import { Guilloche } from "@/components/Guilloche";
import { HeaderActions, SearchButton } from "@/components/ui";
import { useFeaturedCollections, useHomeCarousel, useProducts, useScentFamilies } from "@/lib/api";
import { usePressScale } from "@/lib/animations";
import { useSession } from "@/lib/auth";
import { useCombos } from "@/lib/combos";
import { useHomeFeed, useMyTopFamilies, useRankedCollections } from "@/lib/feed";
import { useOnboarded } from "@/lib/onboarding";
import { imageUrl } from "@/lib/supabase";
import { Colors, lightColors, space } from "@/lib/theme";
import { ThemedStatusBar, useTheme, useThemedStyles } from "@/lib/theme-context";
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
const PAPER_DIM = "rgba(250,248,245,0.4)"; // inactive dot, same on-photo language
const SCRIM_BOTTOM = ["transparent", "rgba(24,20,16,0.85)"] as const;
const SCRIM_TOP = ["rgba(20,16,12,0.6)", "transparent"] as const; // legibility for the floating header
const HERO_ADVANCE_MS = 5200;
const COL_STACK = 8; // depth reveal behind each collection card
const GRID_BATCH = 12; // "more to explore" reveal batch size

function greeting(name?: string) {
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name}` : part;
}

type HeroSlideData = {
  key: string;
  source: any;
  label: string;
  title: string;
  cta: string;
  to: any;
};

/** One hero slide's content — image, scrims, caption. Shared by the single-slide
 *  static path and the multi-slide carousel path so the markup lives once. */
function HeroSlide({
  slide,
  w,
  h,
  insets,
  onPress,
}: {
  slide: HeroSlideData;
  w: number;
  h: number;
  insets: { top: number };
  onPress: () => void;
}) {
  const s = useThemedStyles(makeStyles);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={slide.cta} style={{ width: w, height: h }}>
      <Image source={slide.source} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={300} />
      <LinearGradient colors={SCRIM_TOP} style={[s.scrimTop, { height: insets.top + 104 }]} pointerEvents="none" />
      <LinearGradient colors={SCRIM_BOTTOM} style={s.scrimBottom} pointerEvents="none" />
      <View style={s.heroCaption} pointerEvents="none">
        <AppText variant="label" style={{ color: PAPER }}>{slide.label}</AppText>
        <AppText variant="display" numberOfLines={2} style={[s.onPhoto, { marginTop: space.xs }]}>{slide.title}</AppText>
        <View style={s.heroBtn}>
          <AppText variant="label" style={{ color: lightColors.ink }}>{slide.cta}</AppText>
        </View>
      </View>
    </Pressable>
  );
}

/** Collections shelf tile — a stacked pair (a second plate peeks from behind the
 *  top-left corner, Apple Wallet's own stacked-card convention) with a paper-fold
 *  dog-ear at bottom-left. Extracted to its own component so each card owns its
 *  own press-spring shared value (hooks can't live inside a .map callback). */
function CollectionCard({
  w,
  h,
  i,
  name,
  count,
  src,
  onPress,
}: {
  w: number;
  h: number;
  i: number;
  name: string;
  count: number;
  src: any;
  onPress: () => void;
}) {
  const s = useThemedStyles(makeStyles);
  const scale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <View style={{ width: w + COL_STACK, height: h + COL_STACK }}>
      <View style={[s.colCardBack, { width: w, height: h }]} />
      <Animated.View style={[s.colCard, { width: w, height: h }, cardStyle]}>
        <Pressable
          onPress={onPress}
          onPressIn={() => {
            scale.set(withTiming(0.95, { duration: 100 }));
          }}
          onPressOut={() => {
            // A real spring with visible bounce, not a critically-damped settle —
            // this was explicitly asked for as "spring like".
            scale.set(withSpring(1, { duration: 400, dampingRatio: 0.65 }));
          }}
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={`Shop ${name}`}
        >
          {src ? <Image source={src} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={200} /> : null}
          {/* Same engraved guilloche used on "shop by note" above — a texture this
              brand actually owns, not another photo-plus-gradient card. Alternating
              corners per card gives the shelf a little considered rhythm instead of
              every tile being visually identical. */}
          <Guilloche
            w={w}
            h={h}
            origin={i % 2 === 0 ? "topLeft" : "topRight"}
            ringGap={16}
            start={10}
            base="rgba(250,248,245,0.12)"
            accent="rgba(138,83,39,0.4)"
          />
          <LinearGradient colors={SCRIM_BOTTOM} style={s.collectionScrim} pointerEvents="none" />
          <View style={s.colFoldShadow} pointerEvents="none" />
          <View style={s.colFoldFace} pointerEvents="none" />
          <View style={s.collectionCaption} pointerEvents="none">
            {/* "Collection" dropped — redundant directly under a "Collections" heading */}
            <AppText variant="heading" numberOfLines={1} style={s.onPhoto}>{name}</AppText>
            {count > 0 ? (
              <>
                <View style={s.collectionRule} />
                <AppText variant="caption" style={{ color: PAPER }}>
                  {count} {count === 1 ? "fragrance" : "fragrances"}
                </AppText>
              </>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** Shop-by-note rail tile — same press-scale feedback as ComboCard/ListRow
 *  (usePressScale, not a bespoke animation), extracted to its own component
 *  since hooks can't live inside the rail's .map callback. */
function NoteCard({
  label,
  count,
  source,
  origin,
  onPress,
}: {
  label: string;
  count: number;
  source: any;
  origin: "topLeft" | "topRight";
  onPress: () => void;
}) {
  const s = useThemedStyles(makeStyles);
  const { pressStyle, onPressIn, onPressOut } = usePressScale();
  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={s.noteCard} accessibilityRole="button" accessibilityLabel={`Shop ${label}`}>
      <Animated.View style={pressStyle}>
        <View style={s.noteCardBed}>
          <View style={s.noteCardClip}>
            {source ? <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" /> : null}
            {/* engraved swirl over the top — the maison's guilloche, tying these to the loyalty card */}
            <Guilloche w={120} h={140} origin={origin} ringGap={13} start={8} base="rgba(250,248,245,0.16)" accent="rgba(138,83,39,0.42)" />
          </View>
        </View>
        <AppText variant="bodyLg" numberOfLines={1} style={{ marginTop: space.sm }}>{label}</AppText>
        {count > 0 ? <AppText variant="caption">{count} scents</AppText> : null}
      </Animated.View>
    </Pressable>
  );
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const { colors, mode } = useTheme();
  const s = useThemedStyles(makeStyles);
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
  const [overHero, setOverHero] = useState(true); // status bar light while the hero is in view
  useEffect(() => {
    resetImpressionRegistry();
  }, []);

  const displayName = (session?.user?.user_metadata?.display_name as string | undefined)?.trim() || undefined;
  const firstName = displayName?.split(/\s+/)[0];

  // Bounded editorial hero (~340) — image + bottom scrim + a real paper button. No longer runs
  // under the status bar; the header sits above it on paper (stable ink-on-paper chrome).
  const heroH = Math.min(380, Math.max(300, Math.round(width * 0.86)));
  const heroFullH = heroH + insets.top;

  // Every curated slide, not just the first — an auto-advancing, genuinely
  // infinite carousel. One bundled fallback slide when the admin hasn't
  // curated any yet, same copy the static hero always showed.
  const heroSlides: HeroSlideData[] = useMemo(() => {
    const list = carousel ?? [];
    if (!list.length) {
      return [
        {
          key: "fallback",
          source: HERO_FALLBACK as any,
          label: "The signature edit",
          title: "Scents that stay with you.",
          cta: "Shop the edit",
          to: "/shop" as any,
        },
      ];
    }
    return list.map((c) => ({
      key: c.id,
      source: (c.imagePath ? { uri: imageUrl(c.imagePath)! } : HERO_FALLBACK) as any,
      label: c.label || "The signature edit",
      title: c.title || "Scents that stay with you.",
      cta: c.cta || "Shop the edit",
      to: (c.link as any) || "/shop",
    }));
  }, [carousel]);
  const heroCount = heroSlides.length;

  // Infinite loop via boundary clones: [lastSlide, ...realSlides, firstSlide].
  // The clone at each end is pixel-identical to the real slide it stands in for,
  // so recentering the position across the boundary (no animation) lands on
  // content that looks exactly the same as what was just on screen — no
  // visible jump. Only built when there's more than one slide.
  const heroLoop = useMemo(() => (heroCount > 1 ? [heroSlides[heroCount - 1], ...heroSlides, heroSlides[0]] : heroSlides), [heroSlides, heroCount]);

  const [heroIndex, setHeroIndex] = useState(0); // real index, 0..heroCount-1 — drives the dots
  const heroIndexRef = useRef(0);
  heroIndexRef.current = heroIndex;
  const heroScrollRef = useRef<ScrollView>(null);
  const heroTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const reducedMotion = useReducedMotion();

  const heroStop = () => {
    if (heroTimer.current) clearInterval(heroTimer.current);
    heroTimer.current = null;
  };
  const heroStart = () => {
    heroStop();
    if (reducedMotion || heroCount <= 1 || width <= 0) return;
    heroTimer.current = setInterval(() => {
      // virtual page = real index + 1 (the clone-of-last sits at page 0);
      // advancing by one page steps to the next real slide, or off the end
      // into the clone-of-first, which onMomentumScrollEnd recenters from.
      heroScrollRef.current?.scrollTo({ x: (heroIndexRef.current + 2) * width, animated: true });
    }, HERO_ADVANCE_MS);
  };

  useEffect(() => {
    heroStart();
    return heroStop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, heroCount, reducedMotion]);

  const handleHeroMomentumEnd = (offsetX: number) => {
    if (heroCount <= 1 || width <= 0) return;
    const page = Math.round(offsetX / width);
    if (page === 0) {
      // swiped back past the first real slide onto its clone — recenter to
      // the real last slide, same pixels, no perceptible jump.
      heroScrollRef.current?.scrollTo({ x: heroCount * width, animated: false });
      setHeroIndex(heroCount - 1);
    } else if (page === heroCount + 1) {
      heroScrollRef.current?.scrollTo({ x: width, animated: false });
      setHeroIndex(0);
    } else {
      setHeroIndex(page - 1);
    }
    heroStart();
  };

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
  const colCardH = Math.round(colCardW * (10 / 16));

  // Products above the fold: the first personalized rail sits directly under Shop-by-note,
  // the editorial collection banner comes after it, then the remaining rails.
  const firstRail = modules[0];
  const restRails = modules.slice(1);

  // "More to explore" — the screen's own end, not a link out to a separate catalog
  // screen. Everything already surfaced in a curated rail above is skipped so this
  // reads as genuinely more, not a repeat; reveals in batches as the page scrolls
  // toward the bottom, and simply stops with no total-count marker when it runs out.
  const shownProductIds = useMemo(() => new Set(modules.flatMap((m) => m.products.map((p) => p.id))), [modules]);
  const exploreProducts = useMemo(() => {
    const rest = products.filter((p) => !shownProductIds.has(p.id));
    return rest.length > 0 ? rest : products;
  }, [products, shownProductIds]);
  const [visibleCount, setVisibleCount] = useState(GRID_BATCH);
  const gridCardW = Math.floor((width - space.gutter * 2 - space.lg) / 2);
  const gridImgH = Math.round(gridCardW * 1.3);

  if (onboarded === false) return <Redirect href="/onboarding" />;

  if (isLoading && products.length === 0) {
    return (
      <View style={s.screen}>
        <ThemedStatusBar />
        <HomeSkeleton topInset={insets.top} heroW={width} />
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <StatusBar style={overHero ? "light" : mode === "dark" ? "light" : "dark"} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: space["3xl"] }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.ink40} colors={[colors.accent]} progressViewOffset={insets.top} />}
        scrollEventThrottle={16}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          const y = contentOffset.y;
          reportScroll(y, viewportH.current);
          const over = y < (heroH + insets.top) * 0.5;
          if (over !== overHero) setOverHero(over);
          if (visibleCount < exploreProducts.length) {
            const distanceFromBottom = contentSize.height - y - layoutMeasurement.height;
            if (distanceFromBottom < 600) {
              setVisibleCount((v) => Math.min(exploreProducts.length, v + GRID_BATCH));
            }
          }
        }}
        onLayout={(e) => {
          viewportH.current = e.nativeEvent.layout.height;
          reportScroll(0, e.nativeEvent.layout.height);
        }}
      >
        {/* immersive hero — full-bleed, bleeds up under the status bar. The greeting +
            actions float over the photo (top scrim); the caption sits on the bottom scrim.
            Every curated slide auto-advances through a genuinely infinite loop (swipe
            either direction, forever) — each page carries its own image, scrim and
            caption, same visual language as the old single-slide hero, just repeated
            per slide so paging never mixes stale text with a new photo mid-swipe. */}
        <TrackImpression module="hero" position={0}>
          <View style={[s.hero, { height: heroFullH }]}>
            {heroCount > 1 ? (
              <>
                <ScrollView
                  ref={heroScrollRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  contentOffset={{ x: width, y: 0 }}
                  onScrollBeginDrag={heroStop}
                  onMomentumScrollEnd={(e) => handleHeroMomentumEnd(e.nativeEvent.contentOffset.x)}
                  style={StyleSheet.absoluteFill}
                >
                  {heroLoop.map((slide, i) => (
                    <HeroSlide
                      key={`${slide.key}-${i}`}
                      slide={slide}
                      w={width}
                      h={heroFullH}
                      insets={insets}
                      onPress={() => {
                        track("module_tap", { module: "hero", position: 0, metadata: { to: String(slide.to), slide: heroIndex } });
                        router.push(slide.to);
                      }}
                    />
                  ))}
                </ScrollView>
                {/* pagination dots — rendered once, centered on the full hero width,
                    not nested in the per-slide caption's left-gutter box */}
                <View pointerEvents="none" style={s.heroDotsWrap}>
                  {heroSlides.map((hs, di) => (
                    <View key={hs.key} style={[s.heroDot, di === heroIndex ? s.heroDotOn : s.heroDotOff]} />
                  ))}
                </View>
              </>
            ) : (
              <HeroSlide
                slide={heroSlides[0]}
                w={width}
                h={heroFullH}
                insets={insets}
                onPress={() => {
                  track("module_tap", { module: "hero", position: 0, metadata: { to: String(heroSlides[0].to), slide: 0 } });
                  router.push(heroSlides[0].to);
                }}
              />
            )}
            {/* header floats over the hero (above the gesture layer so bell/avatar taps land) */}
            <View style={[s.heroHeader, { top: insets.top + space.xs }]} pointerEvents="box-none">
              <AppText variant="heading" numberOfLines={1} style={[s.onPhoto, { flex: 1 }]}>{greeting(firstName)}</AppText>
              <HeaderActions light />
            </View>
          </View>
        </TrackImpression>

        {/* search — on paper, just below the hero */}
        <View style={s.searchWrap}>
          <SearchButton onPress={() => router.push("/search")} onFilter={() => router.push("/shop")} placeholder="Fragrances, notes, brands" />
        </View>

        {/* shop by note — horizontal rail, ordered by taste */}
        {orderedNotes.length > 0 ? (
          <TrackImpression module="shop_by_note" position={1}>
            <View style={{ marginTop: space["4xl"] }}>
              <View style={s.gutter}>
                <AppText variant="heading">Shop by note</AppText>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
                {orderedNotes.map((n, i) => (
                  <NoteCard
                    key={n.family}
                    label={n.label}
                    count={n.count}
                    source={n.source}
                    origin="topLeft"
                    onPress={() => {
                      track("module_tap", { module: "shop_by_note", position: i, metadata: { family: n.family } });
                      router.push({ pathname: "/shop", params: { family: n.family } });
                    }}
                  />
                ))}
              </ScrollView>
            </View>
          </TrackImpression>
        ) : null}

        {/* first personalized product rail — products above the fold */}
        {firstRail ? <FeedRail key={firstRail.key} module={firstRail.key} title={firstRail.title} products={firstRail.products} position={2} /> : null}

        {/* leaderboard teaser — top buyers + your standing; self-hides until there's a board */}
        <LeaderboardBand position={3} />

        {/* collections — swipeable shelf of stacked, paper-folded cards, ordered per user */}
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
                    <CollectionCard
                      key={c.slug}
                      w={colCardW}
                      h={colCardH}
                      i={i}
                      name={c.name}
                      count={count}
                      src={src}
                      onPress={() => {
                        track("module_tap", { module: "collection", position: i, metadata: { slug: c.slug } });
                        router.push({ pathname: "/shop", params: { collection: c.slug } });
                      }}
                    />
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

        {/* more to explore — the screen's own infinite scroll, not a dead-end link
            out to the catalog. Reveals in batches as the page nears the bottom and
            simply stops when the catalog is exhausted; no final count or "that's
            everything" marker. */}
        {exploreProducts.length > 0 ? (
          <View style={{ marginTop: space["4xl"] }}>
            <View style={s.gutter}>
              <AppText variant="heading">More to explore</AppText>
            </View>
            <View style={[s.grid, { marginTop: space.lg }]}>
              {exploreProducts.slice(0, visibleCount).map((p, i) => (
                <ProductCard key={p.id} product={p} width={gridCardW} imageHeight={gridImgH} shape={i % 2 === 0 ? "tearLeft" : "tearRight"} />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  heroHeader: { position: "absolute", left: space.gutter, right: space.gutter, flexDirection: "row", alignItems: "center", gap: space.md },
  searchWrap: { paddingHorizontal: space.gutter, paddingTop: space.xl },
  hero: { backgroundColor: colors.surface, overflow: "hidden" },
  scrimTop: { position: "absolute", top: 0, left: 0, right: 0 },
  scrimBottom: { position: "absolute", bottom: 0, left: 0, right: 0, height: 220 },
  heroCaption: { position: "absolute", left: space.gutter, right: space.gutter, bottom: space.xl },
  // On-photo text/button stay light in both themes (they sit over imagery).
  onPhoto: { color: lightColors.paper },
  heroBtn: { alignSelf: "flex-start", marginTop: space.lg, height: 44, paddingHorizontal: space.xl, backgroundColor: lightColors.paper, alignItems: "center", justifyContent: "center" },
  // pagination dots — rendered once as a centered overlay (not per-slide, not
  // left-aligned with the caption).
  heroDotsWrap: { position: "absolute", left: 0, right: 0, bottom: space.sm, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  heroDot: { height: 6, borderRadius: 3 },
  heroDotOn: { width: 18, backgroundColor: PAPER },
  heroDotOff: { width: 6, backgroundColor: PAPER_DIM },
  rail: { paddingHorizontal: space.gutter, gap: space.lg, paddingTop: space.lg },
  gutter: { paddingHorizontal: space.gutter },
  noteCard: { width: 120 },
  noteCardBed: { width: 120, height: 140, borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: colors.surface, shadowColor: "#1A140E", shadowOpacity: 0.14, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  noteCardClip: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  colRail: { paddingHorizontal: space.gutter, gap: space.lg, paddingTop: space.lg },
  // front card sits bottom-right of its stack container — the backing plate
  // (top-left) peeks out by COL_STACK on those two edges.
  colCard: { position: "absolute", bottom: 0, right: 0, backgroundColor: colors.surface, overflow: "hidden" },
  colCardBack: { position: "absolute", top: 0, left: 0, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  collectionScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "58%" },
  collectionCaption: { position: "absolute", left: space.lg, right: space.lg, bottom: space.lg },
  // The one bronze accent moment on the card — a small deliberate mark between
  // name and count, in place of the redundant "Collection" eyebrow it replaced.
  collectionRule: { width: 24, height: 2, backgroundColor: "rgba(138,83,39,0.9)", marginTop: space.sm, marginBottom: space.xs },
  // The dog-ear: same layered-triangle technique as points.tsx's MemberCard
  // (a darker under-shadow, a lighter catch-of-light face on top), scaled down
  // and kept within the caption's own 16px inset so it never reads under text.
  colFoldShadow: {
    position: "absolute", bottom: 0, left: 0, width: 0, height: 0,
    borderStyle: "solid", borderBottomWidth: 16, borderLeftWidth: 16,
    borderBottomColor: "transparent", borderLeftColor: "rgba(0,0,0,0.35)",
  },
  colFoldFace: {
    position: "absolute", bottom: 1, left: 1, width: 0, height: 0,
    borderStyle: "solid", borderBottomWidth: 12, borderLeftWidth: 12,
    borderBottomColor: "transparent", borderLeftColor: "rgba(250,248,245,0.16)",
  },
  // "more to explore" grid — same 2-column flex-wrap pattern as shop.tsx's own grid
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", paddingHorizontal: space.gutter, rowGap: space["2xl"] },
});
