import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Check, Heart, Plus, Star, StarHalf } from "phosphor-react-native";
import { useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { noteLine, type Product } from "@/lib/api";
import { addToBag } from "@/lib/cart";
import { formatLe } from "@/lib/format";
import { openPeek } from "@/lib/quickPeek";
import { productImage } from "@/lib/productImage";
import { colors, font, radius, shadow, space } from "@/lib/theme";
import { toggleWish, useWishlist } from "@/lib/wishlist";
import { AppText } from "./Text";

const groupThousands = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <View style={s.stars}>
      {Array.from({ length: 5 }).map((_, i) => {
        if (i < full) return <Star key={i} size={13} color={colors.rating} weight="fill" />;
        if (i === full && half) return <StarHalf key={i} size={13} color={colors.rating} weight="fill" />;
        return <Star key={i} size={13} color="#E2E2E2" weight="fill" />;
      })}
    </View>
  );
}

export function ProductCard({ product, width, imageHeight }: { product: Product; width: number; imageHeight: number }) {
  const router = useRouter();
  const wished = useWishlist();
  const liked = wished.includes(product.slug);
  const notes = noteLine(product);
  const variant = product.variants[0]; // cheapest — what quick-add buys

  const [added, setAdded] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const addScale = useRef(new Animated.Value(1)).current;

  const pressIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();

  const quickAdd = () => {
    if (!variant) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addToBag({ variantId: variant.id, slug: product.slug, sizeMl: variant.sizeMl, priceMinor: variant.priceMinor }, 1);
    addScale.setValue(0.6);
    Animated.spring(addScale, { toValue: 1, useNativeDriver: true, friction: 3, tension: 140 }).start();
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/product/[slug]", params: { slug: product.slug } })}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        openPeek(product.slug);
      }}
      delayLongPress={220}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={{ width }}
      accessibilityRole="button"
      accessibilityLabel={product.name}
    >
      <Animated.View style={[s.card, { transform: [{ scale }] }]}>
        <View style={[s.imageWrap, { height: imageHeight }]}>
          <Image
            source={productImage(product)}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={250}
            cachePolicy="memory-disk"
            recyclingKey={product.id}
            accessibilityLabel={product.name}
          />
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              toggleWish(product.slug);
            }}
            hitSlop={8}
            style={s.heart}
            accessibilityRole="button"
            accessibilityLabel={liked ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart size={16} color={liked ? colors.badge : colors.ink} weight={liked ? "fill" : "regular"} />
          </Pressable>
        </View>

        <View style={s.body}>
          <AppText variant="cardTitle" numberOfLines={1}>
            {product.name}
          </AppText>
          {/* Always render with a fixed 2-line slot so every card is the same height */}
          <AppText variant="small" numberOfLines={2} style={s.desc}>
            {notes}
          </AppText>
          <View style={s.priceRow}>
            <AppText variant="price" style={s.price}>
              {formatLe(product.fromPriceMinor)}
            </AppText>
            {variant ? (
              <Pressable onPress={quickAdd} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Add ${product.name} to bag`}>
                <Animated.View style={[s.add, added && s.addDone, { transform: [{ scale: addScale }] }]}>
                  {added ? <Check size={16} color={colors.onAccent} weight="bold" /> : <Plus size={16} color={colors.onAccent} weight="bold" />}
                </Animated.View>
              </Pressable>
            ) : null}
          </View>
          <View style={s.ratingRow}>
            {product.reviews > 0 ? (
              <>
                <Stars rating={product.rating} />
                <AppText style={s.count}>{groupThousands(product.reviews)}</AppText>
              </>
            ) : (
              <AppText style={s.newTag}>New arrival</AppText>
            )}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, overflow: "hidden", ...shadow.soft },
  imageWrap: { backgroundColor: colors.plinth },
  heart: { position: "absolute", top: space.md, right: space.md, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center", ...shadow.soft },
  body: { paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.md },
  desc: { marginTop: 3, height: 32, color: colors.inkSoft, lineHeight: 16 },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.sm },
  price: { fontSize: 16 },
  add: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  addDone: { backgroundColor: colors.accentInk },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: space.sm },
  stars: { flexDirection: "row", gap: 1 },
  count: { fontFamily: font.regular, fontSize: 12, color: colors.inkMute },
  newTag: { fontFamily: font.semibold, fontSize: 11, letterSpacing: 0.4, textTransform: "uppercase", color: colors.inkMute },
});
