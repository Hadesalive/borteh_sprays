import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Handbag, Minus, Plus, Trash } from "phosphor-react-native";
import { useMemo } from "react";
import { LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, UIManager, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { AppText } from "@/components/Text";
import { Avatar } from "@/components/ui";
import { useProducts } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { cartTotalMinor, setQty, useCart } from "@/lib/cart";
import { formatLe } from "@/lib/format";
import { productImage } from "@/lib/productImage";
import { colors, font, radius, shadow, space } from "@/lib/theme";

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

  const Back = (
    <BackButton onPress={leave} style={[s.back, { top: insets.top + space.sm }]} />
  );
  const Account = (
    <Pressable onPress={() => router.push("/profile")} style={[s.account, { top: insets.top + space.sm }]} hitSlop={8} accessibilityRole="button" accessibilityLabel="Account">
      <Avatar size={40} />
    </Pressable>
  );

  if (!items.length) {
    return (
      <View style={s.fill}>
        <StatusBar style="dark" />
        {Back}
        {Account}
        <EmptyState
          icon={<Handbag size={36} color={colors.inkMute} weight="regular" />}
          title="Your bag is empty"
          body="Browse fragrances and the ones you add will show up here."
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

  return (
    <View style={s.fill}>
      <StatusBar style="dark" />
      {Back}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 62, paddingHorizontal: space.xl, paddingBottom: insets.bottom + 130 }}
      >
        <AppText style={s.title}>Your bag</AppText>
        <AppText style={s.count}>
          {count} item{count === 1 ? "" : "s"}
        </AppText>

        <View style={s.list}>
          {rows.map(({ product, ...it }, i) => (
            <View key={it.variantId} style={[s.row, i > 0 && s.rowBorder]}>
              <Pressable onPress={() => router.push({ pathname: "/product/[slug]", params: { slug: it.slug } })} style={s.rowMain}>
                <Image source={productImage(product)} style={s.thumb} contentFit="contain" cachePolicy="memory-disk" recyclingKey={product.id} />
                <View style={s.info}>
                  <AppText style={s.brand}>{product.brand}</AppText>
                  <AppText style={s.name} numberOfLines={1}>
                    {product.name}
                  </AppText>
                  <AppText style={s.size}>{it.sizeMl} ml</AppText>
                  <AppText style={s.price}>{formatLe(it.priceMinor * it.qty)}</AppText>
                </View>
              </Pressable>
              <View style={s.stepper}>
                <Pressable onPress={() => step(it.variantId, it.qty - 1)} hitSlop={6} style={s.stepBtn} accessibilityLabel={it.qty === 1 ? "Remove" : "Decrease quantity"}>
                  {it.qty === 1 ? <Trash size={15} color={colors.inkSoft} /> : <Minus size={15} color={colors.ink} weight="bold" />}
                </Pressable>
                <AppText style={s.qty}>{it.qty}</AppText>
                <Pressable onPress={() => step(it.variantId, it.qty + 1)} hitSlop={6} style={s.stepBtn} accessibilityLabel="Increase quantity">
                  <Plus size={15} color={colors.ink} weight="bold" />
                </Pressable>
              </View>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={s.summary}>
          <View style={s.sumRow}>
            <AppText style={s.sumLabel}>Subtotal ({count} item{count === 1 ? "" : "s"})</AppText>
            <AppText style={s.sumLabel}>{formatLe(total)}</AppText>
          </View>
          <View style={s.sumRow}>
            <AppText style={s.sumMute}>Delivery fee</AppText>
            <AppText style={s.sumMute}>Confirmed after checkout</AppText>
          </View>
          <View style={s.sumDivider} />
          <View style={s.sumRow}>
            <AppText style={s.sumTotal}>Total</AppText>
            <AppText style={s.sumTotal}>{formatLe(total)}</AppText>
          </View>
        </View>
      </ScrollView>

      {/* Floating checkout */}
      <View style={[s.footer, { paddingBottom: insets.bottom + space.md }]} pointerEvents="box-none">
        <LinearGradient colors={["rgba(255,255,255,0)", colors.bg]} locations={[0, 0.5]} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <Button
          title="Checkout"
          trailing={formatLe(total)}
          icon={<Handbag size={19} color={colors.onAccent} weight="bold" />}
          onPress={() => router.push(session ? "/checkout" : "/login")}
          elevated
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  back: { position: "absolute", left: space.lg, zIndex: 10, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  account: { position: "absolute", right: space.lg, zIndex: 10, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: font.bold, fontSize: 28, lineHeight: 34, color: colors.ink, letterSpacing: -0.5 },
  count: { fontFamily: font.regular, fontSize: 13, color: colors.inkSoft, marginTop: 4 },
  list: { marginTop: space.xl },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.lg },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.lg },
  thumb: { width: 76, height: 76, borderRadius: radius.md, backgroundColor: colors.plinth },
  info: { flex: 1 },
  brand: { fontFamily: font.regular, fontSize: 12, color: colors.inkSoft },
  name: { fontFamily: font.bold, fontSize: 15, color: colors.ink, letterSpacing: -0.1, marginTop: 1 },
  size: { fontFamily: font.regular, fontSize: 12, color: colors.inkMute, marginTop: 1 },
  price: { fontFamily: font.bold, fontSize: 15, color: colors.ink, marginTop: space.sm },
  stepper: { flexDirection: "row", alignItems: "center", gap: space.md },
  stepBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  qty: { fontFamily: font.bold, fontSize: 15, color: colors.ink, minWidth: 16, textAlign: "center" },
  summary: { marginTop: space["2xl"], gap: space.md },
  sumRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sumLabel: { fontFamily: font.medium, fontSize: 14, color: colors.ink },
  sumMute: { fontFamily: font.regular, fontSize: 13, color: colors.inkSoft },
  sumDivider: { height: 1, backgroundColor: colors.line, marginVertical: space.xs },
  sumTotal: { fontFamily: font.bold, fontSize: 17, color: colors.ink, letterSpacing: -0.2 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.xl, paddingTop: space["3xl"], alignItems: "center" },
  checkout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, height: 56, borderRadius: radius.pill, backgroundColor: colors.accent, ...shadow.nav },
  checkoutTxt: { fontFamily: font.bold, fontSize: 16, color: colors.onAccent, letterSpacing: 0.2 },
  sep: { width: 1, height: 18, backgroundColor: "rgba(255,255,255,0.3)", marginHorizontal: 2 },
  checkoutPrice: { fontFamily: font.bold, fontSize: 16, color: colors.onAccent },
});
