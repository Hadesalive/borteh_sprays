import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Heart } from "phosphor-react-native";
import { useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { type Product, productSubline } from "@/lib/api";
import { formatLe } from "@/lib/format";
import { openPeek } from "@/lib/quickPeek";
import { productImage } from "@/lib/productImage";
import { colors, space } from "@/lib/theme";
import { toggleWish, useWishlist } from "@/lib/wishlist";
import { AppText } from "./Text";

// Flat Maison card: 3:4 image on a surface bed, bare heart top-right, serif name,
// brand·notes, price. No border, no shadow, no quick-add — the photo leads.
export function ProductCard({ product, width, imageHeight }: { product: Product; width: number; imageHeight: number }) {
  const router = useRouter();
  const liked = useWishlist().includes(product.slug);
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/product/[slug]", params: { slug: product.slug } })}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        openPeek(product.slug);
      }}
      delayLongPress={220}
      onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 40 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start()}
      style={{ width }}
      accessibilityRole="button"
      accessibilityLabel={product.name}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
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
            hitSlop={12}
            style={s.heart}
            accessibilityRole="button"
            accessibilityLabel={liked ? "Remove from saved" : "Save"}
          >
            <Heart size={24} color={colors.ink} weight={liked ? "fill" : "regular"} />
          </Pressable>
        </View>

        <AppText variant="serif20" numberOfLines={1} style={s.name}>
          {product.name}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {productSubline(product)}
        </AppText>
        <AppText variant="price" style={s.price}>
          {product.fromPriceMinor != null ? formatLe(product.fromPriceMinor) : "—"}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  imageWrap: { backgroundColor: colors.surface },
  heart: { position: "absolute", top: space.md, right: space.md },
  name: { marginTop: space.sm },
  price: { marginTop: space.xs },
});
