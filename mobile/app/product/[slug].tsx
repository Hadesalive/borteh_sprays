import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Bell, Heart, Minus, Plus } from "phosphor-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, UIManager, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { ListRow } from "@/components/ListRow";
import { ProductCard } from "@/components/ProductCard";
import { AppText } from "@/components/Text";
import { LinkLabel } from "@/components/ui";
import { type Band, type Concentration, noteLine, type Product, type ProductVariant, useProducts } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { addToBag } from "@/lib/cart";
import { formatLe } from "@/lib/format";
import { productImage } from "@/lib/productImage";
import { recordView } from "@/lib/recentlyViewed";
import { useReviews } from "@/lib/reviews";
import { colors, space } from "@/lib/theme";
import { toggleWish, useWishlist } from "@/lib/wishlist";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
const ease = () => LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));

const GENDER_LABEL: Record<Product["gender"], string> = { male: "Men", female: "Women", unisex: "Unisex" };
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

export default function ProductDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const heroH = Math.max(320, Math.min(Math.round(height * 0.46), 460));
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

  const enter = useRef(new Animated.Value(0)).current;
  const qtyScale = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);
  const reviewsY = useRef(0);

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [enter]);
  useEffect(() => {
    if (product) recordView(product.slug);
  }, [product]);

  const similar = useMemo(() => {
    if (!product) return [];
    return (data ?? [])
      .filter((p) => p.slug !== product.slug && ((product.scentFamily && p.scentFamily === product.scentFamily) || p.brand === product.brand))
      .slice(0, 6);
  }, [data, product]);

  // ---- Loading & not-found, both with a way back ----
  if (!product) {
    return (
      <View style={s.screen}>
        <StatusBar style="dark" />
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

  const variants = product.variants ?? [];
  const selected: ProductVariant | undefined = variants.find((v) => v.id === variantId) ?? variants[0];
  const lineTotal = selected ? selected.priceMinor * qty : null;
  const outOfStock = selected?.band === "out";
  const stock = selected ? STOCK[selected.band] : null;
  const notes = noteLine(product);
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
    toggleWish(product.slug);
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
  const liked = wished.includes(product.slug);

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}>
        <Animated.View style={{ opacity: enter }}>
          {/* hero */}
          <View style={[s.hero, { height: heroH }]}>
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

          <View style={s.body}>
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

            {/* size + quantity */}
            <View style={s.configRow}>
              {variants.length > 1 ? (
                <View style={s.sizeRow}>
                  {variants.map((v, i) => {
                    const active = v.id === selected?.id;
                    const unavailable = v.band === "out";
                    return (
                      <Pressable
                        key={v.id}
                        onPress={() => pickSize(v)}
                        style={[s.sizeSeg, i > 0 && { marginLeft: -1 }, active ? s.sizeSegOn : s.sizeSegOff]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <AppText variant="label" maxFontSizeMultiplier={1.3} style={{ color: active ? colors.ink : colors.ink40, textDecorationLine: unavailable ? "line-through" : "none" }}>
                          {v.sizeMl} ml
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : selected ? (
                <View style={[s.sizeSeg, s.sizeSegOn]}>
                  <AppText variant="label">{selected.sizeMl} ml</AppText>
                </View>
              ) : (
                <View />
              )}

              {!outOfStock ? (
                <View style={s.stepper}>
                  <Pressable onPress={() => bump(-1)} style={s.stepBtn} hitSlop={4} accessibilityLabel="Decrease quantity" disabled={qty <= 1}>
                    <Minus size={20} color={qty <= 1 ? colors.ink40 : colors.ink} weight="regular" />
                  </Pressable>
                  <Animated.View style={{ transform: [{ scale: qtyScale }] }}>
                    <AppText variant="bodyLg" maxFontSizeMultiplier={1.2} style={s.qty}>
                      {qty}
                    </AppText>
                  </Animated.View>
                  <Pressable onPress={() => bump(1)} style={s.stepBtn} hitSlop={4} accessibilityLabel="Increase quantity" disabled={qty >= 9}>
                    <Plus size={20} color={qty >= 9 ? colors.ink40 : colors.ink} weight="regular" />
                  </Pressable>
                </View>
              ) : null}
            </View>

            {/* info rows */}
            <View style={{ marginTop: space["3xl"] }}>
              {notes ? <ListRow title="Notes" value={notes} arrow={false} borderTop /> : null}
              <ListRow title="Delivery" value="Freetown · cash on delivery" arrow={false} borderTop={!notes} />
              <ListRow
                title="Reviews"
                value={product.reviews > 0 ? `${product.rating.toFixed(1)} · ${product.reviews.toLocaleString()}` : "None yet"}
                onPress={() => scrollRef.current?.scrollTo({ y: Math.max(0, reviewsY.current - 12), animated: true })}
              />
            </View>

            {/* restock notice — when the selected size is out */}
            {outOfStock ? (
              <View style={s.notice}>
                <Bell size={20} color={colors.ink} weight="regular" />
                <View style={{ flex: 1 }}>
                  <AppText variant="body">{selected?.sizeMl} ml is out of stock</AppText>
                  <AppText variant="caption" style={{ marginTop: 2 }}>
                    {notifyOn ? "We'll message you the moment it returns." : "We'll tell you the moment it returns."}
                  </AppText>
                </View>
                <LinkLabel label={notifyOn ? "Added" : "Notify me"} onPress={onNotify} color={colors.accent} />
              </View>
            ) : null}
          </View>

          {/* similar scents */}
          {similar.length > 0 ? (
            <View style={{ marginTop: space["5xl"] }}>
              <View style={s.body}>
                <AppText variant="heading">Similar scents</AppText>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
                {similar.map((p) => (
                  <ProductCard key={p.id} product={p} width={140} imageHeight={172} />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* reviews */}
          <View style={[s.body, { marginTop: space["5xl"] }]} onLayout={(e) => (reviewsY.current = e.nativeEvent.layout.y)}>
            <AppText variant="heading">Reviews</AppText>
            {product.reviews > 0 ? (
              <View style={s.reviewSummary}>
                <AppText variant="display">{product.rating.toFixed(1)}</AppText>
                <AppText variant="caption">out of 5 · {product.reviews.toLocaleString()} reviews</AppText>
              </View>
            ) : (
              <AppText variant="bodySoft" style={{ marginTop: space.md }}>
                No reviews yet — be the first to share your thoughts.
              </AppText>
            )}

            {reviews && reviews.length > 0
              ? reviews.slice(0, 3).map((rv) => (
                  <View key={rv.id} style={s.reviewItem}>
                    <AppText variant="body">“{rv.body || rv.title || "Lovely scent."}”</AppText>
                    <AppText variant="caption" style={{ marginTop: space.sm }}>
                      {rv.reviewerName || "Customer"}
                      {rv.mine && rv.status !== "published" ? " · pending" : ""}
                    </AppText>
                  </View>
                ))
              : null}

            <Button
              title="Write a review"
              variant="secondary"
              onPress={() => router.push(session ? { pathname: "/review", params: { productId: product.id, productName: product.name } } : "/login")}
              style={{ marginTop: space.lg }}
            />
          </View>
        </Animated.View>
      </ScrollView>

      {/* fixed hero controls */}
      <BackButton onPress={() => router.back()} style={[s.floatL, { top: insets.top + space.md }]} />
      <Pressable onPress={toggleLike} style={[s.floatR, { top: insets.top + space.md }]} hitSlop={12} accessibilityRole="button" accessibilityLabel={liked ? "Remove from saved" : "Save"}>
        <Animated.View style={{ transform: [{ scale: heartScale }] }}>
          <Heart size={24} color={colors.ink} weight={liked ? "fill" : "regular"} />
        </Animated.View>
      </Pressable>

      {/* sticky CTA */}
      <View style={[s.footer, { paddingBottom: insets.bottom + space.lg }]}>
        {outOfStock ? (
          <Button title={notifyOn ? "We'll let you know" : "Notify me when back in stock"} variant="secondary" haptic={false} onPress={onNotify} />
        ) : (
          <Button title={added ? "Added to bag" : "Add to bag"} trailing={added ? undefined : formatLe(lineTotal)} haptic={false} disabled={!selected} onPress={onAdd} />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  hero: { backgroundColor: colors.surface },
  body: { paddingHorizontal: space.gutter },
  skel: { backgroundColor: colors.surface },

  nameRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.lg, marginTop: space.sm },
  name: { flex: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.md },
  measurer: { position: "absolute", left: 0, right: 0, top: 0, opacity: 0 },

  configRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.lg, marginTop: space["2xl"] },
  sizeRow: { flexDirection: "row" },
  sizeSeg: { height: 44, paddingHorizontal: space.lg, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  sizeSegOn: { borderColor: colors.ink },
  sizeSegOff: { borderColor: colors.line },
  stepper: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.line },
  stepBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  qty: { minWidth: 32, textAlign: "center" },

  notice: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space["2xl"], borderWidth: 1, borderColor: colors.line, padding: space.lg },

  rail: { paddingHorizontal: space.gutter, gap: space.lg, paddingTop: space.lg },
  reviewSummary: { flexDirection: "row", alignItems: "baseline", gap: space.md, marginTop: space.md, paddingBottom: space.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  reviewItem: { paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: colors.line },

  floatL: { position: "absolute", left: space.gutter },
  floatR: { position: "absolute", right: space.gutter },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.gutter, paddingTop: space.lg, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line },
});
