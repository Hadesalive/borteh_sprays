import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, Bell, CaretDown, Drop, Heart, Minus, Plus, Truck } from "phosphor-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, UIManager, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { ListRow } from "@/components/ListRow";
import { ProductCard } from "@/components/ProductCard";
import { ComboRail } from "@/components/ComboRail";
import { StarRow } from "@/components/StarRow";
import { AppText } from "@/components/Text";
import { FrostCircle, LinkLabel, SectionHeader } from "@/components/ui";
import { type Band, type Concentration, noteLine, type Product, type ProductVariant, useProducts, useSimilarProducts } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { addToBag } from "@/lib/cart";
import { useCombosForProduct } from "@/lib/combos";
import { formatLe } from "@/lib/format";
import { useRestockSub, useToggleRestockSub } from "@/lib/notifications";
import { productImage } from "@/lib/productImage";
import { recordView } from "@/lib/recentlyViewed";
import { Colors, lightColors, radius, space } from "@/lib/theme";
import { ThemedStatusBar, useTheme, useThemedStyles } from "@/lib/theme-context";
import { track } from "@/lib/track";
import { toggleWish, useWishlist } from "@/lib/wishlist";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
const ease = () => LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));

// Track padding for the segmented control's sliding pill — same inset as
// Shop's own gender segmented control, for a consistent language app-wide.
const SEG_PAD = 3;

const GENDER_LABEL: Record<Product["gender"], string> = { male: "Men", female: "Women", unisex: "Unisex" };
const POS_LABEL = { top: "Top", heart: "Heart", base: "Base" } as const;
const STOCK: Record<Band, { label: string; tone: "success" | "warning" | "error" }> = {
  in_stock: { label: "In stock", tone: "success" },
  low: { label: "Only a few left", tone: "warning" },
  out: { label: "Out of stock", tone: "error" },
};
const CONC_NAME: Record<Concentration, string> = {
  EDC: "Eau de Cologne",
  EDT: "Eau de Toilette",
  EDP: "Eau de Parfum",
  Parfum: "Parfum",
  Extrait: "Extrait de Parfum",
};

/** Size picker — Apple's own segmented-control structure (one sliding ink pill
 *  behind plain-text segments in a rounded track), matching Shop's gender
 *  filter, but driven by core Animated: each segment reports its own real
 *  pixel position/width via onLayout (segments aren't assumed equal width),
 *  and the pill's x + width animate to match on selection. Core Animated
 *  only — see the file-level note on why this file never imports Reanimated. */
function SizeControl({
  variants,
  selectedId,
  onSelect,
}: {
  variants: ProductVariant[];
  selectedId?: string;
  onSelect: (v: ProductVariant) => void;
}) {
  const s = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const layouts = useRef<Record<string, { x: number; width: number }>>({});
  const initialized = useRef(false);
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorW = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!selectedId) return;
    const l = layouts.current[selectedId];
    if (!l || !initialized.current) return; // first paint snaps via onLayout instead — see below
    Animated.parallel([
      Animated.spring(indicatorX, { toValue: l.x, useNativeDriver: false, friction: 8, tension: 100 }),
      Animated.spring(indicatorW, { toValue: l.width, useNativeDriver: false, friction: 8, tension: 100 }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <View style={s.sizeTrack}>
      {/* width is a layout property, not transform — but this is exactly the
          skill's own carve-out: an absolutely positioned, childless fill with
          nothing else to re-lay-out, where animating width (not scaleX) is
          what keeps the pill's corner radius from smearing. */}
      <Animated.View style={[s.sizeIndicator, { transform: [{ translateX: indicatorX }], width: indicatorW }]} />
      {variants.map((v) => {
        const active = v.id === selectedId;
        const unavailable = v.band === "out";
        return (
          <Pressable
            key={v.id}
            onPress={() => onSelect(v)}
            onLayout={(e) => {
              const { x, width } = e.nativeEvent.layout;
              layouts.current[v.id] = { x, width };
              if (!initialized.current && v.id === selectedId) {
                initialized.current = true;
                indicatorX.setValue(x);
                indicatorW.setValue(width);
              }
            }}
            style={s.sizeSegSlot}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <AppText variant="label" maxFontSizeMultiplier={1.3} style={{ color: active ? colors.onInk : colors.ink60, textDecorationLine: unavailable ? "line-through" : "none" }}>
              {v.sizeMl} ml
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ProductDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);
  const { height } = useWindowDimensions();
  const heroH = Math.max(320, Math.min(Math.round(height * 0.46), 460));
  const { data, isLoading } = useProducts();
  const product = useMemo(() => (data ?? []).find((p) => p.slug === slug), [data, slug]);
  const wished = useWishlist();
  const session = useSession();

  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [descLines, setDescLines] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const [added, setAdded] = useState(false);

  // Variant selection is derived before the early returns so the restock-subscription
  // hooks below can run unconditionally.
  const variants = product?.variants ?? [];
  const selected: ProductVariant | undefined = variants.find((v) => v.id === variantId) ?? variants[0];
  // Persisted "Notify me" — real subscription state, not a local flag (honest affordances).
  const { data: subscribed = false } = useRestockSub(selected?.id);
  const toggleSub = useToggleRestockSub();

  const qtyScale = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;
  const minusScale = useRef(new Animated.Value(1)).current;
  const plusScale = useRef(new Animated.Value(1)).current;
  const chevronRotate = useRef(new Animated.Value(0)).current; // 0 = closed, 1 = open
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (product) recordView(product.slug);
  }, [product]);
  // recs: a "view" when the product resolves, a "dwell" (time-on-screen) on unmount/switch.
  useEffect(() => {
    if (!product) return;
    const id = product.id;
    track("view", { productId: id, metadata: { slug: product.slug } });
    const start = Date.now();
    return () => {
      const dwellMs = Date.now() - start;
      if (dwellMs >= 1000) track("dwell", { productId: id, metadata: { dwell_ms: dwellMs } });
    };
  }, [product?.id]);

  const combos = useCombosForProduct(product?.id);
  const { data: similarIds } = useSimilarProducts(product?.id);
  const similar = useMemo(() => {
    if (!product) return [];
    const all = data ?? [];
    // Prefer embedding-ranked neighbours (fn_similar_products); fall back to a content
    // filter until embeddings are populated — the section never blanks.
    if (similarIds && similarIds.length) {
      const byId = new Map(all.map((p) => [p.id, p]));
      const ranked = similarIds.map((id) => byId.get(id)).filter(Boolean) as Product[];
      if (ranked.length) return ranked.slice(0, 6);
    }
    return all
      .filter((p) => p.slug !== product.slug && ((product.scentFamily && p.scentFamily === product.scentFamily) || p.brand === product.brand))
      .slice(0, 6);
  }, [data, product, similarIds]);

  // ---- Loading & not-found, both with a way back ----
  if (!product) {
    return (
      <View style={s.screen}>
        <ThemedStatusBar />
        <View style={{ paddingTop: insets.top + space.md, paddingHorizontal: space.gutter }}>
          <BackButton onPress={() => router.back()} />
          {isLoading ? (
            <>
              <View style={[s.skel, { width: "60%", height: 34, marginTop: space["3xl"] }]} />
              <View style={[s.skel, { width: "40%", height: 20, marginTop: space.md }]} />
              <View style={[s.skel, { width: "100%", height: heroH * 0.5, marginTop: space["2xl"] }]} />
            </>
          ) : (
            <View style={{ marginTop: space["4xl"] }}>
              <AppText variant="display">Fragrance not found.</AppText>
              <AppText variant="bodySoft" style={{ marginTop: space.sm }}>
                This item may have sold out or moved.
              </AppText>
              <Button title="Browse the shop" variant="secondary" onPress={() => router.replace("/shop")} style={{ marginTop: space["2xl"] }} />
            </View>
          )}
        </View>
      </View>
    );
  }

  const lineTotal = selected ? selected.priceMinor * qty : null;
  const outOfStock = selected?.band === "out";
  const stock = selected ? STOCK[selected.band] : null;
  const notes = noteLine(product);
  // A collapsed-row preview truncated at a fixed character count (numberOfLines={1}
  // on the full note list) cuts mid-word wherever it happens to land — whole names
  // + a "+N more" count reads clean regardless of how many notes there are.
  const NOTE_PREVIEW_COUNT = 3;
  const notePreview =
    product.notes.length > NOTE_PREVIEW_COUNT
      ? `${product.notes.slice(0, NOTE_PREVIEW_COUNT).map((n) => n.name).join(" · ")} +${product.notes.length - NOTE_PREVIEW_COUNT} more`
      : notes;
  const eyebrow = [product.brand, selected ? CONC_NAME[selected.concentration] : null, product.releaseYear].filter(Boolean).join("  ·  ");

  const bump = (delta: number) => {
    Haptics.selectionAsync();
    setQty((q) => Math.max(1, Math.min(9, q + delta)));
    qtyScale.setValue(1.2);
    Animated.spring(qtyScale, { toValue: 1, useNativeDriver: true, friction: 4, tension: 120 }).start();
  };
  const pickSize = (v: ProductVariant) => {
    if (v.id === selected?.id) return;
    Haptics.selectionAsync();
    ease();
    setVariantId(v.id);
  };
  const toggleLike = () => {
    Haptics.selectionAsync();
    heartScale.setValue(0.7);
    Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, friction: 3, tension: 140 }).start();
    toggleWish(product.slug, product.id);
  };
  const onAdd = () => {
    if (!selected) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addToBag({ productId: product.id, variantId: selected.id, slug: product.slug, sizeMl: selected.sizeMl, priceMinor: selected.priceMinor }, qty);
    ease();
    setAdded(true);
    setTimeout(() => {
      ease();
      setAdded(false);
    }, 1600);
  };
  // Straight to checkout: drop it in the bag and open the bag (which is the checkout surface).
  const onBuyNow = () => {
    if (!selected) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addToBag({ productId: product.id, variantId: selected.id, slug: product.slug, sizeMl: selected.sizeMl, priceMinor: selected.priceMinor }, qty);
    router.push("/cart");
  };
  const onNotify = () => {
    if (!selected) return;
    if (!session) {
      router.push("/login"); // restock alerts need an account to deliver to
      return;
    }
    const next = !subscribed;
    Haptics.notificationAsync(next ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
    ease();
    toggleSub.mutate({ variantId: selected.id, subscribe: next });
    if (next) track("notify_subscribe", { productId: product.id, metadata: { variantId: selected.id, sizeMl: selected.sizeMl } });
  };
  const liked = wished.includes(product.slug);

  return (
    <View style={s.screen}>
      <ThemedStatusBar />
      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={(e) => scrollY.setValue(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
      >
        <View>
          {/* hero — full-bleed, bleeds up under the status bar (extra height = the inset) */}
          <View style={[s.hero, { height: heroH + insets.top }]}>
            <Image
              source={productImage(product)}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={280}
              cachePolicy="memory-disk"
              recyclingKey={product.id}
              accessibilityLabel={product.name}
            />
          </View>

          <View style={[s.body, { paddingTop: space["2xl"] }]}>
            <AppText variant="label" style={{ color: colors.ink60 }}>
              {eyebrow || `${product.brand}  ·  ${product.scentFamily ?? GENDER_LABEL[product.gender]}`}
            </AppText>

            <View style={s.nameRow}>
              <AppText variant="display" numberOfLines={2} style={s.name}>
                {product.name}
              </AppText>
              <AppText variant="heading">{formatLe(selected?.priceMinor ?? product.fromPriceMinor)}</AppText>
            </View>

            <View style={s.metaRow}>
              {stock ? <Badge label={stock.label} tone={stock.tone} /> : null}
              <AppText variant="caption">
                {product.reviews > 0 ? `${product.rating.toFixed(1)} · ${product.reviews.toLocaleString()} reviews` : "New arrival"}
              </AppText>
            </View>

            {product.description ? (
              <View>
                <AppText variant="bodySoft" numberOfLines={expanded ? undefined : 4} style={{ marginTop: space["2xl"] }}>
                  {product.description}
                </AppText>
                <AppText variant="bodySoft" style={[s.measurer]} onTextLayout={(e) => setDescLines(e.nativeEvent.lines.length)}>
                  {product.description}
                </AppText>
                {descLines > 4 ? <View style={{ marginTop: space.md }}><LinkLabel label={expanded ? "Read less" : "Read more"} onPress={() => { ease(); setExpanded((v) => !v); }} /></View> : null}
              </View>
            ) : null}

            {/* size + quantity — space-between only makes sense when both
                sides have content; out-of-stock hides the stepper entirely,
                which otherwise leaves the size control stranded on the left
                with the whole right side of the row blank. */}
            <View style={[s.configRow, outOfStock && s.configRowSingle]}>
              {variants.length > 0 ? (
                <SizeControl variants={variants} selectedId={selected?.id} onSelect={pickSize} />
              ) : (
                <View />
              )}

              {!outOfStock ? (
                <View style={s.stepper}>
                  <Pressable
                    onPress={() => bump(-1)}
                    onPressIn={() => Animated.spring(minusScale, { toValue: 0.9, useNativeDriver: true, speed: 40 }).start()}
                    onPressOut={() => Animated.spring(minusScale, { toValue: 1, useNativeDriver: true, friction: 5 }).start()}
                    style={s.stepBtn}
                    hitSlop={4}
                    accessibilityLabel="Decrease quantity"
                    disabled={qty <= 1}
                  >
                    <Animated.View style={{ transform: [{ scale: minusScale }] }}>
                      <Minus size={20} color={qty <= 1 ? colors.ink40 : colors.ink} weight="regular" />
                    </Animated.View>
                  </Pressable>
                  <Animated.View style={{ transform: [{ scale: qtyScale }] }}>
                    <AppText variant="bodyLg" maxFontSizeMultiplier={1.2} style={s.qty}>
                      {qty}
                    </AppText>
                  </Animated.View>
                  <Pressable
                    onPress={() => bump(1)}
                    onPressIn={() => Animated.spring(plusScale, { toValue: 0.9, useNativeDriver: true, speed: 40 }).start()}
                    onPressOut={() => Animated.spring(plusScale, { toValue: 1, useNativeDriver: true, friction: 5 }).start()}
                    style={s.stepBtn}
                    hitSlop={4}
                    accessibilityLabel="Increase quantity"
                    disabled={qty >= 9}
                  >
                    <Animated.View style={{ transform: [{ scale: plusScale }] }}>
                      <Plus size={20} color={qty >= 9 ? colors.ink40 : colors.ink} weight="regular" />
                    </Animated.View>
                  </Pressable>
                </View>
              ) : null}
            </View>

            {/* info rows */}
            <View style={{ marginTop: space["3xl"] }}>
              {product.notes.length ? (
                <View style={s.notesTop}>
                  <Pressable
                    onPress={() => {
                      ease();
                      Animated.timing(chevronRotate, { toValue: notesOpen ? 0 : 1, duration: 200, useNativeDriver: true }).start();
                      setNotesOpen((v) => !v);
                    }}
                    style={s.notesHead}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: notesOpen }}
                    accessibilityLabel="Notes"
                  >
                    <View style={s.notesIcon}>
                      <Drop size={20} color={colors.ink} weight="regular" />
                    </View>
                    <AppText variant="body" style={s.notesTitle}>Notes</AppText>
                    {!notesOpen ? (
                      <AppText variant="body" numberOfLines={1} style={s.notesPreview}>{notePreview}</AppText>
                    ) : null}
                    <Animated.View
                      style={{
                        transform: [{ rotate: chevronRotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] }) }],
                      }}
                    >
                      <CaretDown size={16} color={colors.ink40} weight="regular" />
                    </Animated.View>
                  </Pressable>
                  {notesOpen ? (
                    <View style={s.pyramid}>
                      {(["top", "heart", "base"] as const).map((pos) => {
                        const names = product.notes.filter((n) => n.position === pos).map((n) => n.name);
                        if (!names.length) return null;
                        return (
                          <View key={pos} style={s.pyramidRow}>
                            <AppText variant="label" style={s.pyramidLabel}>{POS_LABEL[pos]}</AppText>
                            <AppText variant="body" style={s.pyramidNotes}>{names.join(" · ")}</AppText>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              ) : null}
              <ListRow
                title="Delivery"
                value="Freetown · cash on delivery"
                icon={<Truck size={20} color={colors.ink} weight="regular" />}
                arrow={false}
                borderTop={!product.notes.length}
              />
            </View>

            {/* restock notice — when the selected size is out */}
            {outOfStock ? (
              <View style={s.notice}>
                <Bell size={20} color={colors.ink} weight="regular" />
                <View style={{ flex: 1 }}>
                  <AppText variant="body">{selected?.sizeMl} ml is out of stock</AppText>
                  <AppText variant="caption" style={{ marginTop: 2 }}>
                    {subscribed ? "You're on the list. We'll tell you the moment it returns." : "We'll tell you the moment it returns."}
                  </AppText>
                </View>
                <LinkLabel label={subscribed ? "Added" : "Notify me"} onPress={onNotify} color={colors.accent} />
              </View>
            ) : null}
          </View>

          {/* complete the pair — combos containing this fragrance */}
          <ComboRail title="Complete the pair" combos={combos} onOpen={(slug) => router.push({ pathname: "/combo/[slug]", params: { slug } })} />

          {/* similar scents — SectionHeader, same as Reviews/Complete the
              pair, in place of a bare heading in its own s.body wrapper */}
          {similar.length > 0 ? (
            <View style={{ marginTop: space["5xl"] }}>
              <SectionHeader title="Similar scents" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
                {similar.map((p, i) => (
                  // alternating diagonal "petal" corners — the same rhythm
                  // Shop's own grid uses — instead of every card being an
                  // identical top-rounded rectangle
                  <ProductCard key={p.id} product={p} width={140} imageHeight={172} shape={i % 2 === 0 ? "tearLeft" : "tearRight"} />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* reviews — a compact average, the App Store/Play Store way, not a
              dumped-in list of who wrote what. The full list lives on its own
              screen, opened only when specifically asked for ("See all"),
              via a trailing header link (same SectionHeader as "Complete the
              pair"/"Similar scents"), not a separate bordered row underneath.
              SectionHeader supplies its own gutter padding, so it sits
              outside s.body rather than nested in it (which would double it). */}
          <View style={{ marginTop: space["5xl"] }}>
            <SectionHeader
              title="Reviews"
              trailing={product.reviews > 0 ? "See all" : undefined}
              onPressTrailing={() => router.push({ pathname: "/reviews", params: { productId: product.id, productName: product.name } })}
            />
            <View style={s.body}>
              {product.reviews > 0 ? (
                // The whole summary is itself the tap target to the full screen —
                // not just the header link — one big star row leading, the
                // number/count a quiet caption underneath.
                <Pressable
                  onPress={() => router.push({ pathname: "/reviews", params: { productId: product.id, productName: product.name } })}
                  style={s.reviewSummary}
                  accessibilityRole="button"
                  accessibilityLabel="See all reviews"
                >
                  <StarRow rating={product.rating} size={24} />
                  <AppText variant="caption" style={{ marginTop: space.xs }}>
                    {product.rating.toFixed(1)} · {product.reviews.toLocaleString()} reviews
                  </AppText>
                </Pressable>
              ) : (
                <>
                  <AppText variant="bodySoft" style={{ marginTop: space.md }}>
                    No reviews yet. Be the first to share your thoughts.
                  </AppText>
                  <Button
                    title="Write a review"
                    variant="secondary"
                    onPress={() => router.push(session ? { pathname: "/review", params: { productId: product.id, productName: product.name } } : "/login")}
                    style={{ marginTop: space.lg }}
                  />
                </>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Status-bar mask: transparent over the hero (the image bleeds under the clock), fading to
          paper once the hero scrolls away so body text never runs under the clock. */}
      <Animated.View
        pointerEvents="none"
        style={[
          s.statusMask,
          {
            height: insets.top,
            opacity: scrollY.interpolate({
              inputRange: [0, heroH * 0.55, heroH * 0.9],
              outputRange: [0, 0, 1],
              extrapolate: "clamp",
            }),
          },
        ]}
      />

      {/* fixed hero controls — frosted for contrast over photography. Fixed
          light on-photo color, not themed ink: these sit over an arbitrary
          product photo, not over the app's own paper/ink chrome, and a
          light-tinted frost circle disappears against a white/pale bottle
          shot if the icon inside is dark too. */}
      <Pressable onPress={() => router.back()} style={[s.floatL, { top: insets.top + space.md }]} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
        <FrostCircle size={44}>
          <ArrowLeft size={22} color={lightColors.paper} weight="regular" />
        </FrostCircle>
      </Pressable>
      <Pressable onPress={toggleLike} style={[s.floatR, { top: insets.top + space.md }]} hitSlop={8} accessibilityRole="button" accessibilityLabel={liked ? "Remove from saved" : "Save"}>
        <FrostCircle size={44}>
          {/* Bronze when saved, not red — this design system reserves red (`error`)
              for functional error/destructive states, not a "liked" affordance. */}
          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            <Heart size={22} color={liked ? colors.accent : lightColors.paper} weight={liked ? "fill" : "regular"} />
          </Animated.View>
        </FrostCircle>
      </Pressable>

      {/* floating CTA — no slab; the buttons themselves carry the weight */}
      <View style={[s.footer, { paddingBottom: insets.bottom + space.lg }]}>
        {outOfStock ? (
          <Button title={subscribed ? "We'll let you know" : "Notify me when back in stock"} variant="secondary" haptic={false} onPress={onNotify} />
        ) : (
          <View style={s.ctaRow}>
            <View style={{ flex: 1 }}>
              <Button title={added ? "Added ✓" : "Add to bag"} variant="secondary" haptic={false} disabled={!selected} onPress={onAdd} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Buy now" trailing={formatLe(lineTotal)} haptic={false} disabled={!selected} onPress={onBuyNow} />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  hero: { backgroundColor: colors.surface },
  body: { paddingHorizontal: space.gutter },
  skel: { backgroundColor: colors.surface },

  nameRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.lg, marginTop: space.sm },
  name: { flex: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.md },
  measurer: { position: "absolute", left: 0, right: 0, top: 0, opacity: 0 },

  configRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.lg, marginTop: space["2xl"] },
  configRowSingle: { justifyContent: "flex-start" },
  // segmented control: one sliding ink pill in a rounded track — same
  // structure as Shop's own gender filter. alignSelf explicit so the track
  // always hugs its own segments' content width and never stretches to fill
  // configRow's row, even though nothing here was actually observed stretching.
  sizeTrack: { flexDirection: "row", alignSelf: "flex-start", position: "relative", backgroundColor: colors.surface, borderRadius: radius.pill, padding: SEG_PAD, height: 44 },
  sizeSegSlot: { alignItems: "center", justifyContent: "center", paddingHorizontal: space.lg },
  sizeIndicator: { position: "absolute", top: SEG_PAD, bottom: SEG_PAD, left: 0, backgroundColor: colors.ink, borderRadius: radius.pill },
  stepper: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.line },
  stepBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  qty: { minWidth: 32, textAlign: "center" },

  notesTop: { borderTopWidth: 1, borderTopColor: colors.line, borderBottomWidth: 1, borderBottomColor: colors.line },
  notesHead: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 56 },
  // same 20px icon-slot convention as ListRow's own leading icon
  notesIcon: { width: 20, alignItems: "center" },
  notesTitle: { color: colors.ink },
  notesPreview: { flex: 1, textAlign: "right", color: colors.ink60 },
  pyramid: { paddingBottom: space.lg, gap: space.md },
  pyramidRow: { flexDirection: "row", gap: space.lg },
  pyramidLabel: { color: colors.ink40, width: 52, paddingTop: 3 },
  pyramidNotes: { flex: 1, color: colors.ink },

  notice: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space["2xl"], borderWidth: 1, borderColor: colors.line, padding: space.lg },

  rail: { paddingHorizontal: space.gutter, gap: space.lg, paddingTop: space.lg },
  reviewSummary: { gap: 4, alignItems: "flex-start", marginTop: space.md, paddingBottom: space.lg, borderBottomWidth: 1, borderBottomColor: colors.line },

  statusMask: { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: colors.paper, zIndex: 10 },
  floatL: { position: "absolute", left: space.gutter, zIndex: 11 },
  floatR: { position: "absolute", right: space.gutter, zIndex: 11 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.gutter, paddingTop: space.lg, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line },
  ctaRow: { flexDirection: "row", gap: space.md },
});
