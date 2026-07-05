import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, View } from "react-native";
import { productSubline, useProducts } from "@/lib/api";
import { addToBag } from "@/lib/cart";
import { formatLe } from "@/lib/format";
import { productImage } from "@/lib/productImage";
import { closePeek, useQuickPeek } from "@/lib/quickPeek";
import { colors, space } from "@/lib/theme";
import { Button } from "./Button";
import { AppText } from "./Text";

/** Long-press preview: a centered quick-look card that springs in. Mounted at root. */
export function QuickPeek() {
  const slug = useQuickPeek();
  const router = useRouter();
  const { data } = useProducts();
  const product = useMemo(() => (data ?? []).find((p) => p.slug === slug), [data, slug]);
  const [variantId, setVariantId] = useState<string | null>(null);

  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setVariantId(product?.variants[0]?.id ?? null);
  }, [product?.slug]);

  useEffect(() => {
    if (slug) {
      scale.setValue(0.94);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 6 }),
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [slug, scale, opacity]);

  const variant = product?.variants.find((v) => v.id === variantId) ?? product?.variants[0] ?? null;

  const add = () => {
    if (!product || !variant) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addToBag({ variantId: variant.id, slug: product.slug, sizeMl: variant.sizeMl, priceMinor: variant.priceMinor }, 1);
    closePeek();
  };
  const view = () => {
    const s = product?.slug;
    closePeek();
    if (s) router.push({ pathname: "/product/[slug]", params: { slug: s } });
  };

  return (
    <Modal visible={!!slug} transparent animationType="none" onRequestClose={closePeek} statusBarTranslucent>
      <Animated.View style={[st.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closePeek} accessibilityLabel="Close preview" />
      </Animated.View>

      <View style={st.center} pointerEvents="box-none">
        {product ? (
          <Animated.View style={[st.card, { opacity, transform: [{ scale }] }]}>
            <View style={st.hero}>
              <Image source={productImage(product)} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={product.id} />
            </View>
            <View style={st.body}>
              <AppText variant="serif20" numberOfLines={2}>{product.name}</AppText>
              <AppText variant="caption" numberOfLines={1} style={{ marginTop: space.xs }}>{productSubline(product)}</AppText>
              <AppText variant="serif20" style={{ marginTop: space.sm }}>{formatLe(variant?.priceMinor ?? product.fromPriceMinor)}</AppText>

              {product.variants.length > 1 ? (
                <View style={st.sizes}>
                  {product.variants.map((v, i) => {
                    const on = v.id === variant?.id;
                    return (
                      <Pressable key={v.id} onPress={() => { Haptics.selectionAsync(); setVariantId(v.id); }} style={[st.size, i > 0 && { marginLeft: -1 }, on ? st.sizeOn : st.sizeOff]} accessibilityRole="button">
                        <AppText variant="label" style={{ color: on ? colors.ink : colors.ink40 }}>{v.sizeMl} ml</AppText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              <View style={st.actions}>
                <View style={{ flex: 1 }}>
                  <Button variant="secondary" title="Details" onPress={view} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title="Add to bag" onPress={add} />
                </View>
              </View>
            </View>
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(34,30,25,0.45)" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: space.gutter },
  card: { width: "100%", maxWidth: 380, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, overflow: "hidden" },
  hero: { width: "100%", height: 220, backgroundColor: colors.surface },
  body: { padding: space.gutter },
  sizes: { flexDirection: "row", marginTop: space.lg },
  size: { height: 40, paddingHorizontal: space.lg, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sizeOn: { borderColor: colors.ink },
  sizeOff: { borderColor: colors.line },
  actions: { flexDirection: "row", gap: space.md, marginTop: space.xl },
});
