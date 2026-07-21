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
import { track } from "@/lib/track";
import { toggleWish, useWishlist } from "@/lib/wishlist";
import { AppText } from "./Text";

// The heart uses the brand's flower red, not the muted functional error tone.
const HEART_RED = "#EA2A3E";

// Maison card: 3:4 image on a surface bed with softly rounded TOP corners (squared
// at the base where it meets the type), bare heart top-right, serif name, brand·notes,
// price. No border, no shadow, no quick-add — the photo leads.
// `source`/`position`: when a card lives inside a tracked home module, they attribute the
// tap to that module (module_tap). Omitted elsewhere — the card stays untracked.
export function ProductCard({
  product,
  width,
  imageHeight,
  source,
  position,
  shape = "top",
}: {
  product: Product;
  width: number;
  imageHeight: number;
  source?: string;
  position?: number;
  /** Corner treatment. "top" = both top corners (default, home/saved). "tearLeft"/"tearRight" =
   *  a diagonal petal (two opposite corners soft, two sharp) — the shop grid mirrors these by column. */
  shape?: "top" | "tearLeft" | "tearRight";
}) {
  const router = useRouter();
  const liked = useWishlist().includes(product.slug);
  const scale = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;
  const R = 14;

  const onToggleLike = () => {
    Haptics.selectionAsync();
    heartScale.setValue(0.5);
    Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, friction: 3, tension: 170 }).start();
    toggleWish(product.slug, product.id);
  };
  const corners =
    shape === "tearLeft"
      ? { borderTopLeftRadius: R, borderBottomRightRadius: R }
      : shape === "tearRight"
        ? { borderTopRightRadius: R, borderBottomLeftRadius: R }
        : { borderTopLeftRadius: R, borderTopRightRadius: R };

  return (
    <Pressable
      onPress={() => {
        if (source) track("module_tap", { productId: product.id, module: source, position, metadata: { slug: product.slug } });
        router.push({ pathname: "/product/[slug]", params: { slug: product.slug } });
      }}
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
        {/* shadow layer carries the depth (can't clip); clip layer rounds the photo */}
        <View style={[s.imageBed, corners, { height: imageHeight }]}>
          <View style={[s.imageClip, corners]}>
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
              onPress={onToggleLike}
              hitSlop={12}
              style={s.heart}
              accessibilityRole="button"
              accessibilityLabel={liked ? "Remove from saved" : "Save"}
            >
              {/* Brand-red heart with a soft shadow so it reads on light or dark photography */}
              <Animated.View style={[s.heartGlyph, { transform: [{ scale: heartScale }] }]}>
                <Heart size={24} color={HEART_RED} weight={liked ? "fill" : "regular"} />
              </Animated.View>
            </Pressable>
          </View>
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
  // depth: a soft, warm shadow on the un-clipped bed; kept low so it lifts, not floats.
  // Corner radii come in per-instance (shape) so the shop grid can mirror the petal.
  imageBed: {
    backgroundColor: colors.surface,
    shadowColor: "#1A140E",
    shadowOpacity: 0.14,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  imageClip: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  heart: { position: "absolute", top: space.md, right: space.md },
  heartGlyph: { shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  name: { marginTop: space.sm },
  price: { marginTop: space.xs },
});
