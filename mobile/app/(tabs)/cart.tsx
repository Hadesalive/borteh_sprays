import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Handbag, Minus, Plus, Trash, X } from "phosphor-react-native";
import { useMemo } from "react";
import { LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, UIManager, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { AppText } from "@/components/Text";
import { useProducts } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { cartTotalMinor, removeFromBag, setQty, useCart } from "@/lib/cart";
import { formatLe } from "@/lib/format";
import { productImage } from "@/lib/productImage";
import { colors, space } from "@/lib/theme";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
const ease = () => LayoutAnimation.configureNext(LayoutAnimation.create(200, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));

export default function Cart() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useSession();
  const items = useCart();
  const { data } = useProducts();

  const leave = () => (router.canGoBack() ? router.back() : router.navigate("/"));

  const rows = useMemo(
    () =>
      items
        .map((it) => {
          const product = (data ?? []).find((p) => p.slug === it.slug);
          return product ? { ...it, product } : null;
        })
        .filter((r): r is NonNullable<typeof r> => r != null),
    [items, data],
  );

  if (!items.length) {
    return (
      <View style={s.screen}>
        <StatusBar style="dark" />
        <BackButton onPress={leave} style={[s.back, { top: insets.top + space.md }]} />
        <EmptyState
          icon={<Handbag size={32} color={colors.ink40} weight="regular" />}
          title="Your bag is empty."
          body="Browse fragrances and the ones you add will show up here."
          action={<Button title="Browse fragrances" variant="secondary" onPress={() => router.push("/shop")} />}
        />
      </View>
    );
  }

  const total = cartTotalMinor(items);
  const count = items.reduce((n, i) => n + i.qty, 0);
  const step = (variantId: string, qty: number) => {
    Haptics.selectionAsync();
    ease();
    setQty(variantId, qty);
  };
  const remove = (variantId: string) => {
    Haptics.selectionAsync();
    ease();
    removeFromBag(variantId);
  };

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 120 }}>
        <BackButton onPress={leave} />
        <AppText variant="heading" style={{ marginTop: space.lg }}>Bag</AppText>
        <AppText variant="caption" style={{ marginTop: space.xs }}>
          {count} {count === 1 ? "item" : "items"}
        </AppText>

        <View style={{ marginTop: space.lg }}>
          {rows.map(({ product, ...it }) => (
            <View key={it.variantId} style={s.row}>
              <Pressable onPress={() => router.push({ pathname: "/product/[slug]", params: { slug: it.slug } })}>
                <View style={s.thumb}>
                  <Image source={productImage(product)} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={product.id} />
                </View>
              </Pressable>
              <View style={s.middle}>
                <AppText variant="serif20" numberOfLines={1}>{product.name}</AppText>
                <AppText variant="caption" numberOfLines={1} style={{ marginTop: space.xs }}>
                  {product.brand} · {it.sizeMl} ml
                </AppText>
                <View style={s.stepper}>
                  <Pressable onPress={() => (it.qty === 1 ? remove(it.variantId) : step(it.variantId, it.qty - 1))} style={s.stepBtn} accessibilityLabel={it.qty === 1 ? "Remove" : "Decrease quantity"}>
                    {it.qty === 1 ? <Trash size={20} color={colors.ink60} weight="regular" /> : <Minus size={20} color={colors.ink60} weight="regular" />}
                  </Pressable>
                  <AppText variant="body" style={s.qty}>{it.qty}</AppText>
                  <Pressable onPress={() => step(it.variantId, it.qty + 1)} style={s.stepBtn} accessibilityLabel="Increase quantity">
                    <Plus size={20} color={colors.ink} weight="regular" />
                  </Pressable>
                </View>
              </View>
              <View style={s.right}>
                <AppText variant="serif20">{formatLe(it.priceMinor * it.qty)}</AppText>
                <Pressable onPress={() => remove(it.variantId)} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Remove ${product.name}`}>
                  <X size={20} color={colors.ink40} weight="regular" />
                </Pressable>
              </View>
            </View>
          ))}
        </View>

        {/* summary */}
        <View style={{ marginTop: space["2xl"] }}>
          <View style={s.sumRow}>
            <AppText variant="bodySoft">Subtotal</AppText>
            <AppText variant="body">{formatLe(total)}</AppText>
          </View>
          <View style={s.sumRow}>
            <AppText variant="bodySoft">Delivery</AppText>
            <AppText variant="bodySoft">Confirmed after checkout</AppText>
          </View>
          <View style={s.totalRow}>
            <AppText variant="serif20">Total</AppText>
            <AppText variant="serif20">{formatLe(total)}</AppText>
          </View>
        </View>
      </ScrollView>

      {/* sticky checkout */}
      <View style={[s.footer, { paddingBottom: insets.bottom + space.lg }]}>
        <Button title="Checkout" trailing={formatLe(total)} onPress={() => router.push(session ? "/checkout" : "/login")} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  back: { position: "absolute", left: space.gutter, zIndex: 10 },
  row: { flexDirection: "row", gap: space.lg, paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  thumb: { width: 112, height: 128, backgroundColor: colors.surface, overflow: "hidden" },
  middle: { flex: 1, minWidth: 0, height: 128 },
  stepper: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.line, alignSelf: "flex-start", marginTop: "auto" },
  stepBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  qty: { width: 32, textAlign: "center" },
  right: { height: 128, alignItems: "flex-end", justifyContent: "space-between" },
  sumRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: space.sm },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: space.md, marginTop: space.sm, borderTopWidth: 1, borderTopColor: colors.line },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.gutter, paddingTop: space.lg, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line },
});
