import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Bell, BellRinging, CaretLeft, Check, Handbag, Heart, Minus, Plus, Star } from "phosphor-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, UIManager, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { GlassCircle } from "@/components/Glass";
import { AppText } from "@/components/Text";
import { type Band, type Concentration, type Product, type ProductVariant, useProducts } from "@/lib/api";
import { addToBag } from "@/lib/cart";
import { formatLe } from "@/lib/format";
import { productImage } from "@/lib/productImage";
import { useSession } from "@/lib/auth";
import { recordView } from "@/lib/recentlyViewed";
import { useReviews } from "@/lib/reviews";
import { colors, font, radius, shadow, space } from "@/lib/theme";
import { toggleWish, useWishlist } from "@/lib/wishlist";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
const ease = () => LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));

const GENDER_LABEL: Record<Product["gender"], string> = { male: "Men", female: "Women", unisex: "Unisex" };
const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const STOCK: Record<Band, { label: string; color: string }> = {
  in_stock: { label: "In stock", color: "#1E8E4E" },
  low: { label: "Only a few left", color: "#B26A12" },
  out: { label: "Out of stock", color: "#B0413E" },
};
const CONC_NAME: Record<Concentration, string> = {
  EDC: "Eau de Cologne",
  EDT: "Eau de Toilette",
  EDP: "Eau de Parfum",
  Parfum: "Parfum",
  Extrait: "Extrait de Parfum",
};

function BackButton({ top }: { top: number }) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.back()} style={[s.circlePos, { top, left: space.xl }]} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
      <GlassCircle size={44}>
        <CaretLeft size={20} color={colors.ink} weight="bold" />
      </GlassCircle>
    </Pressable>
  );
}

export default function ProductDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const heroH = Math.max(260, Math.min(Math.round(height * 0.46), 460));
  const { data, isLoading } = useProducts();
  const product = useMemo(() => (data ?? []).find((p) => p.slug === slug), [data, slug]);
  const wished = useWishlist();
  const session = useSession();
  const { data: reviews } = useReviews(product?.id);

  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [descLines, setDescLines] = useState(0);
  const [added, setAdded] = useState(false);
  const [notifyOn, setNotifyOn] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);

  // Motion — built-in Animated/LayoutAnimation (no native rebuild needed)
  const enter = useRef(new Animated.Value(0)).current;
  const qtyScale = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 360, useNativeDriver: true }).start();
  }, [enter]);
  useEffect(() => {
    if (product) recordView(product.slug);
  }, [product]);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 720, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 720, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const liked = product ? wished.includes(product.slug) : false;

  // ---- Loading & not-found, both with a way back ----
  if (!product) {
    if (isLoading) {
      return (
        <View style={s.fill}>
          <StatusBar style="dark" />
          <View style={[s.hero, { height: heroH }]} />
          <View style={[s.sheet, { minHeight: height * 0.55 }]}>
            <Animated.View style={{ opacity: pulse }}>
              <View style={[s.skel, { width: "38%", height: 13 }]} />
              <View style={[s.skel, { width: "66%", height: 28, marginTop: 12 }]} />
              <View style={[s.skel, { width: "42%", height: 13, marginTop: 16 }]} />
              <View style={[s.skel, { width: "100%", height: 12, marginTop: 28 }]} />
              <View style={[s.skel, { width: "92%", height: 12, marginTop: 10 }]} />
              <View style={[s.skel, { width: "70%", height: 12, marginTop: 10 }]} />
            </Animated.View>
          </View>
          <BackButton top={insets.top + space.sm} />
        </View>
      );
    }
    return (
      <View style={[s.fill, s.center]}>
        <StatusBar style="dark" />
        <AppText variant="title" style={{ color: colors.ink }}>
          Fragrance not found
        </AppText>
        <AppText variant="body" style={{ marginTop: 6, textAlign: "center", paddingHorizontal: space["3xl"] }}>
          This item may have sold out or moved.
        </AppText>
        <Pressable onPress={() => router.replace("/shop")} style={s.notFoundCta} accessibilityRole="button">
          <AppText style={s.notFoundCtaTxt}>Browse the shop</AppText>
        </Pressable>
        <BackButton top={insets.top + space.sm} />
      </View>
    );
  }

  const variants = product.variants ?? [];
  const selected: ProductVariant | undefined = variants.find((v) => v.id === variantId) ?? variants[0];
  const lineTotal = selected ? selected.priceMinor * qty : null;
  const outOfStock = selected?.band === "out";
  const stock = selected ? STOCK[selected.band] : null;

  const bump = (delta: number) => {
    Haptics.selectionAsync();
    setQty((q) => Math.max(1, Math.min(9, q + delta)));
    qtyScale.setValue(1.22);
    Animated.spring(qtyScale, { toValue: 1, useNativeDriver: true, friction: 4, tension: 120 }).start();
  };

  const pickSize = (v: ProductVariant) => {
    if (v.id === selected?.id) return;
    Haptics.selectionAsync();
    ease(); // smooth the footer swap if stock/price differs
    setVariantId(v.id);
  };

  const toggleLike = () => {
    Haptics.selectionAsync();
    heartScale.setValue(0.7);
    Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, friction: 3, tension: 140 }).start();
    toggleWish(product.slug);
  };

  const toggleExpand = () => {
    ease();
    setExpanded((v) => !v);
  };

  const onAdd = () => {
    if (!selected) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addToBag({ variantId: selected.id, slug: product.slug, sizeMl: selected.sizeMl, priceMinor: selected.priceMinor }, qty);
    ease();
    setAdded(true);
    setTimeout(() => {
      ease();
      setAdded(false);
    }, 1600);
  };

  const onNotify = () => {
    Haptics.notificationAsync(notifyOn ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success);
    ease();
    setNotifyOn((v) => !v);
  };


  return (
    <View style={s.fill}>
      <StatusBar style="dark" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 116 }}>
        <View style={[s.hero, { height: heroH, paddingTop: insets.top }]}>
          <Image
            source={productImage(product)}
            style={s.bottle}
            contentFit="contain"
            transition={280}
            cachePolicy="memory-disk"
            recyclingKey={product.id}
            accessibilityLabel={product.name}
          />
        </View>

        <Animated.View style={[s.sheet, { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>
          {/* Name + price — name leads, price secondary */}
          <View style={s.headRow}>
            <View style={s.headLeft}>
              <AppText style={s.name} numberOfLines={2}>
                {product.name}
              </AppText>
              <AppText style={s.subLabel}>
                {product.brand} · {product.scentFamily ?? GENDER_LABEL[product.gender]}
                {product.releaseYear ? ` · ${product.releaseYear}` : ""}
              </AppText>
            </View>
            <View style={s.headRight}>
              <View style={s.priceRow}>
                <AppText style={s.price} maxFontSizeMultiplier={1.3}>
                  {formatLe(selected?.priceMinor ?? null)}
                </AppText>
                {selected?.compareMinor ? <AppText style={s.compare}>{formatLe(selected.compareMinor)}</AppText> : null}
              </View>
              {selected ? <AppText style={s.concCaption}>{CONC_NAME[selected.concentration]}</AppText> : null}
            </View>
          </View>

          {/* Rating · availability */}
          <View style={s.ratingRow}>
            <Star size={15} color={colors.rating} weight="fill" />
            {product.reviews > 0 ? (
              <AppText style={s.ratingTxt}>
                <AppText style={s.ratingStrong}>{product.rating.toFixed(1)}</AppText> ({product.reviews.toLocaleString()} reviews)
              </AppText>
            ) : (
              <AppText style={s.ratingTxt}>New arrival</AppText>
            )}
            {stock ? (
              <>
                <AppText style={s.metaDot}>·</AppText>
                <AppText style={[s.stockTxt, { color: stock.color }]}>{stock.label}</AppText>
              </>
            ) : null}
          </View>

          {/* Configure — size (if a choice) and quantity, grouped */}
          <View style={s.configRow}>
            {variants.length > 1 ? (
              <View style={s.sizeRow}>
                {variants.map((v) => {
                  const active = v.id === selected?.id;
                  return (
                    <Pressable
                      key={v.id}
                      onPress={() => pickSize(v)}
                      style={({ pressed }) => [s.sizePill, active ? s.sizePillOn : s.sizePillOff, pressed && { transform: [{ scale: 0.96 }] }]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <AppText style={[s.sizePillTxt, active && s.sizePillTxtOn]} maxFontSizeMultiplier={1.3}>
                        {v.sizeMl} ml
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <AppText style={s.cfgLabel}>Quantity</AppText>
            )}

            <View style={s.stepper}>
              <Pressable onPress={() => bump(-1)} style={s.stepBtn} hitSlop={6} accessibilityLabel="Decrease quantity" disabled={qty <= 1}>
                <Minus size={16} color={qty <= 1 ? colors.inkMute : colors.ink} weight="bold" />
              </Pressable>
              <Animated.View style={{ transform: [{ scale: qtyScale }] }}>
                <AppText style={s.qty} maxFontSizeMultiplier={1.2}>
                  {qty}
                </AppText>
              </Animated.View>
              <Pressable onPress={() => bump(1)} style={s.stepBtn} hitSlop={6} accessibilityLabel="Increase quantity" disabled={qty >= 9}>
                <Plus size={16} color={qty >= 9 ? colors.inkMute : colors.ink} weight="bold" />
              </Pressable>
            </View>
          </View>

          {/* About */}
          {product.description ? (
            <View style={s.section}>
              <AppText style={s.h2}>About this fragrance</AppText>
              <AppText style={s.desc} numberOfLines={expanded ? undefined : 3}>
                {product.description}
              </AppText>
              {/* invisible measurer: counts true line count so "Read more" only shows when needed */}
              <AppText style={[s.desc, s.measurer]} onTextLayout={(e) => setDescLines(e.nativeEvent.lines.length)}>
                {product.description}
              </AppText>
              {descLines > 3 ? (
                <Pressable onPress={toggleExpand} hitSlop={8} accessibilityRole="button">
                  <AppText style={s.readMore}>{expanded ? "Read less" : "Read more"}</AppText>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* Main accords — even two-column list, scales cleanly from 1 to 7 */}
          {product.accords.length > 0 ? (
            <View style={s.section}>
              <AppText style={s.h2}>Main accords</AppText>
              <View style={s.accordGrid}>
                {product.accords.map((a) => (
                  <View key={a} style={s.accordItem}>
                    <View style={s.bulletDot} />
                    <AppText style={s.bulletTxt} numberOfLines={1}>
                      {titleCase(a)}
                    </AppText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Details */}
          <View style={s.section}>
            <AppText style={s.h2}>Details</AppText>
            <View style={s.bullets}>
              <Bullet text="100% authentic & sealed" />
              <Bullet text="Ships from Freetown" />
              <Bullet text="Cash on delivery" />
            </View>
          </View>

          {/* Reviews */}
          <View style={s.section}>
            <View style={s.reviewHead}>
              <AppText style={s.h2}>Reviews</AppText>
              <Pressable
                onPress={() => router.push(session ? { pathname: "/review", params: { productId: product.id, productName: product.name } } : "/login")}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Write a review"
              >
                <AppText style={s.writeLink}>Write a review</AppText>
              </Pressable>
            </View>
            {reviews && reviews.length > 0 ? (
              <>
                <View style={{ gap: space.lg, marginTop: space.lg }}>
                  {reviews.slice(0, showAllReviews ? reviews.length : 3).map((rv) => (
                    <View key={rv.id}>
                      <View style={s.reviewTop}>
                        <View style={s.reviewStars}>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star key={n} size={12} color={n <= rv.rating ? colors.rating : "#E2E2E2"} weight="fill" />
                          ))}
                        </View>
                        {rv.mine && rv.status !== "published" ? <AppText style={s.pendingTag}>Pending review</AppText> : null}
                      </View>
                      {rv.title ? <AppText style={s.reviewTitle}>{rv.title}</AppText> : null}
                      {rv.body ? <AppText style={s.reviewBody}>{rv.body}</AppText> : null}
                      <AppText style={s.reviewMeta}>{rv.reviewerName || "Customer"}</AppText>
                    </View>
                  ))}
                </View>
                {reviews.length > 3 ? (
                  <Button
                    variant="ghost"
                    size="md"
                    title={showAllReviews ? "Show less" : `See all ${reviews.length} reviews`}
                    onPress={() => {
                      ease();
                      setShowAllReviews((v) => !v);
                    }}
                    style={{ marginTop: space.lg }}
                  />
                ) : null}
              </>
            ) : (
              <AppText style={s.reviewEmpty}>No reviews yet — be the first to share your thoughts.</AppText>
            )}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Fixed floating controls */}
      <BackButton top={insets.top + space.sm} />
      <Pressable onPress={toggleLike} style={[s.circlePos, { top: insets.top + space.sm, right: space.xl }]} hitSlop={8} accessibilityRole="button" accessibilityLabel={liked ? "Remove from wishlist" : "Add to wishlist"}>
        <GlassCircle size={44}>
          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            <Heart size={19} color={liked ? colors.badge : colors.ink} weight={liked ? "fill" : "regular"} />
          </Animated.View>
        </GlassCircle>
      </Pressable>

      {/* Floating action — transparent, content fades under the pill */}
      <View style={[s.footer, { paddingBottom: insets.bottom + space.md }]} pointerEvents="box-none">
        <LinearGradient colors={["rgba(255,255,255,0)", colors.bg]} locations={[0, 0.55]} style={StyleSheet.absoluteFill} pointerEvents="none" />
        {outOfStock ? (
          <Button
            full
            haptic={false}
            variant={notifyOn ? "tonal" : "outline"}
            icon={notifyOn ? <BellRinging size={19} color={colors.accentInk} weight="fill" /> : <Bell size={19} color={colors.ink} weight="bold" />}
            title={notifyOn ? "We'll let you know" : "Notify me when back in stock"}
            onPress={onNotify}
          />
        ) : (
          <Button
            full
            elevated
            haptic={false}
            disabled={!selected}
            icon={added ? <Check size={20} color={colors.onAccent} weight="bold" /> : <Handbag size={20} color={colors.onAccent} weight="bold" />}
            title={added ? "Added to bag" : "Add to bag"}
            trailing={added ? undefined : `${qty > 1 ? `${qty} · ` : ""}${formatLe(lineTotal)}`}
            onPress={onAdd}
          />
        )}
      </View>
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={s.bullet}>
      <View style={s.bulletDot} />
      <AppText style={s.bulletTxt}>{text}</AppText>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  hero: { backgroundColor: colors.plinth, alignItems: "center", justifyContent: "center" },
  bottle: { width: "80%", height: "88%" },
  circlePos: { position: "absolute", borderRadius: 22, ...shadow.soft },

  sheet: {
    flexGrow: 1, // fill to the bottom so there's never a mid-screen edge
    marginTop: -radius.xl,
    paddingHorizontal: space.xl,
    paddingTop: space["2xl"],
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    // No shadow: the grey hero + white rounded top separate the layers, and a shadow here
    // bled past the sheet's bottom edge and read as a cut-off line.
  },
  skel: { backgroundColor: colors.field, borderRadius: 7 },

  // Name leads (27), price secondary (22)
  headRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.lg },
  headLeft: { flex: 1 },
  name: { fontFamily: font.bold, fontSize: 27, lineHeight: 32, color: colors.ink, letterSpacing: -0.5 },
  subLabel: { fontFamily: font.regular, fontSize: 13, color: colors.inkSoft, marginTop: 5 },
  headRight: { alignItems: "flex-end", paddingTop: 4 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  price: { fontFamily: font.bold, fontSize: 22, lineHeight: 27, color: colors.ink, letterSpacing: -0.3 },
  compare: { fontFamily: font.regular, fontSize: 13, color: colors.inkSoft, textDecorationLine: "line-through" },
  concCaption: { fontFamily: font.regular, fontSize: 12.5, color: colors.inkSoft, marginTop: 3 },

  ratingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: space.md },
  ratingTxt: { fontFamily: font.regular, fontSize: 13, color: colors.inkSoft },
  ratingStrong: { fontFamily: font.bold, fontSize: 13, color: colors.ink },
  metaDot: { fontFamily: font.regular, fontSize: 13, color: colors.inkMute, marginHorizontal: 2 },
  stockTxt: { fontFamily: font.semibold, fontSize: 13, letterSpacing: -0.1 },

  configRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, marginTop: space.xl },
  cfgLabel: { fontFamily: font.medium, fontSize: 14, color: colors.ink },
  sizeRow: { flexDirection: "row", gap: space.sm },
  sizePill: { height: 38, paddingHorizontal: space.lg, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  sizePillOff: { backgroundColor: colors.field },
  sizePillOn: { backgroundColor: colors.accent },
  sizePillTxt: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  sizePillTxtOn: { color: colors.onAccent },

  // Supporting sections — quieter than the hero cluster, varied spacing
  section: { marginTop: space["2xl"] },
  h2: { fontFamily: font.semibold, fontSize: 15, color: colors.ink, letterSpacing: -0.1 },
  reviewHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  writeLink: { fontFamily: font.bold, fontSize: 14, color: colors.accentInk },
  reviewTop: { flexDirection: "row", alignItems: "center", gap: space.sm },
  reviewStars: { flexDirection: "row", gap: 1 },
  pendingTag: { fontFamily: font.semibold, fontSize: 11, color: colors.accentInk, backgroundColor: colors.accentSoft, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.sm, overflow: "hidden" },
  reviewTitle: { fontFamily: font.bold, fontSize: 14, color: colors.ink, marginTop: 6 },
  reviewBody: { fontFamily: font.regular, fontSize: 14, lineHeight: 21, color: colors.inkSoft, marginTop: 3 },
  reviewMeta: { fontFamily: font.medium, fontSize: 12, color: colors.inkMute, marginTop: 6 },
  reviewEmpty: { fontFamily: font.regular, fontSize: 14, lineHeight: 21, color: colors.inkSoft, marginTop: space.md },
  moreReviews: { marginTop: space.lg, height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  moreReviewsTxt: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  desc: { fontFamily: font.regular, fontSize: 14, lineHeight: 22, color: colors.inkSoft, marginTop: space.sm },
  measurer: { position: "absolute", left: 0, right: 0, top: 0, opacity: 0 },
  readMore: { fontFamily: font.bold, fontSize: 14, color: colors.ink, marginTop: space.sm },
  accordGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: space.md },
  accordItem: { width: "50%", flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: 6, paddingRight: space.sm },

  bullets: { marginTop: space.md, gap: space.sm },
  bullet: { flexDirection: "row", alignItems: "center", gap: space.sm },
  bulletDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.accent },
  bulletTxt: { fontFamily: font.regular, fontSize: 14, color: colors.ink },

  // Footer: quantity + buy
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.xl, paddingTop: space["3xl"], backgroundColor: "transparent" },
  stepper: { flexDirection: "row", alignItems: "center", gap: space.sm },
  stepBtn: { width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.field, alignItems: "center", justifyContent: "center" },
  qty: { fontFamily: font.bold, fontSize: 16, color: colors.ink, minWidth: 22, textAlign: "center" },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, height: 56, borderRadius: radius.pill, backgroundColor: colors.accent, ...shadow.soft },
  addBtnDone: { backgroundColor: colors.accentInk },
  addTxt: { fontFamily: font.bold, fontSize: 16, color: colors.onAccent, letterSpacing: 0.2 },
  addSep: { width: 1, height: 18, backgroundColor: "rgba(255,255,255,0.3)", marginHorizontal: 2 },
  addPrice: { fontFamily: font.bold, fontSize: 15, color: colors.onAccent },
  notifyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, height: 56, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.bg },
  notifyOn: { borderColor: "transparent", backgroundColor: colors.accentSoft },
  notifyTxt: { fontFamily: font.bold, fontSize: 16, color: colors.ink, letterSpacing: 0.2 },
  notifyTxtOn: { color: colors.accentInk },

  notFoundCta: { marginTop: space.xl, height: 48, paddingHorizontal: space.xl, borderRadius: radius.pill, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  notFoundCtaTxt: { fontFamily: font.bold, fontSize: 15, color: colors.onInk },
});
