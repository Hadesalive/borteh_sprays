import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Star } from "phosphor-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, View } from "react-native";
import { noteLine, useProducts } from "@/lib/api";
import { addToBag } from "@/lib/cart";
import { formatLe } from "@/lib/format";
import { productImage } from "@/lib/productImage";
import { closePeek, useQuickPeek } from "@/lib/quickPeek";
import { colors, font, radius, space } from "@/lib/theme";
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
      scale.setValue(0.9);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 13, bounciness: 9 }),
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [slug, scale, opacity]);

  const variant = product?.variants.find((v) => v.id === variantId) ?? product?.variants[0] ?? null;
  const notes = product ? noteLine(product) : "";

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
            <Image source={productImage(product)} style={st.hero} contentFit="contain" cachePolicy="memory-disk" recyclingKey={product.id} />
            <View style={st.body}>
              <AppText style={st.brand}>{product.brand}</AppText>
              <AppText style={st.name} numberOfLines={2}>
                {product.name}
              </AppText>
              <View style={st.metaRow}>
                <Star size={13} color={colors.rating} weight="fill" />
                <AppText style={st.rating}>{product.rating.toFixed(1)}</AppText>
                {product.scentFamily ? <AppText style={st.meta}>· {product.scentFamily}</AppText> : null}
                <AppText style={st.price}>{formatLe(variant?.priceMinor ?? product.fromPriceMinor ?? 0)}</AppText>
              </View>
              {notes ? (
                <AppText style={st.notes} numberOfLines={2}>
                  {notes}
                </AppText>
              ) : null}

              {product.variants.length > 1 ? (
                <View style={st.sizes}>
                  {product.variants.map((v) => {
                    const on = v.id === variant?.id;
                    return (
                      <Pressable
                        key={v.id}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setVariantId(v.id);
                        }}
                        style={[st.size, on && st.sizeOn]}
                        accessibilityRole="button"
                      >
                        <AppText style={[st.sizeTxt, on && st.sizeTxtOn]}>{v.sizeMl} ml</AppText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              <View style={st.actions}>
                <View style={{ flex: 1 }}>
                  <Button variant="ghost" title="Details" onPress={view} />
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
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(20,18,16,0.45)" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: space.xl },
  card: { width: "100%", maxWidth: 380, backgroundColor: colors.bg, borderRadius: radius.xl, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 32, shadowOffset: { width: 0, height: 18 }, elevation: 16 },
  hero: { width: "100%", height: 196, backgroundColor: colors.plinth },
  body: { padding: space.xl },
  brand: { fontFamily: font.regular, fontSize: 13, color: colors.inkSoft },
  name: { fontFamily: font.bold, fontSize: 20, color: colors.ink, letterSpacing: -0.4, marginTop: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: space.sm },
  rating: { fontFamily: font.semibold, fontSize: 13, color: colors.ink },
  meta: { fontFamily: font.regular, fontSize: 13, color: colors.inkSoft },
  price: { fontFamily: font.bold, fontSize: 16, color: colors.ink, marginLeft: "auto" },
  notes: { fontFamily: font.regular, fontSize: 13, lineHeight: 19, color: colors.inkSoft, marginTop: space.md },
  sizes: { flexDirection: "row", gap: space.sm, marginTop: space.lg },
  size: { height: 38, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: colors.field, alignItems: "center", justifyContent: "center" },
  sizeOn: { backgroundColor: colors.accent },
  sizeTxt: { fontFamily: font.semibold, fontSize: 13, color: colors.ink },
  sizeTxtOn: { color: colors.onAccent },
  actions: { flexDirection: "row", gap: space.md, marginTop: space.xl },
});
