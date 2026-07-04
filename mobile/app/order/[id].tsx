import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { CheckCircle } from "phosphor-react-native";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { AppText } from "@/components/Text";
import { formatLe } from "@/lib/format";
import { STATUS_LABEL, useOrder } from "@/lib/orders";
import { colors, font, radius, space } from "@/lib/theme";

export default function OrderDetail() {
  const { id, placed } = useLocalSearchParams<{ id: string; placed?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: order, isLoading } = useOrder(id);

  return (
    <View style={s.fill}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space["3xl"], paddingHorizontal: space.xl }}>
        <BackButton onPress={() => router.back()} style={{ marginBottom: space.sm }} />

        {!order ? (
          <AppText variant="body" style={{ marginTop: space.xl }}>
            {isLoading ? "Loading…" : "Order not found."}
          </AppText>
        ) : (
          <>
            {placed === "1" ? (
              <View style={s.hero}>
                <CheckCircle size={48} color="#1E8E4E" weight="fill" />
                <AppText style={s.heroTitle}>Order placed</AppText>
                <AppText style={s.heroSub}>We'll confirm your delivery fee and call you on {order.phone}.</AppText>
              </View>
            ) : (
              <AppText style={s.pageTitle}>Order details</AppText>
            )}

            <View style={s.metaRow}>
              <View>
                <AppText style={s.metaLabel}>Order</AppText>
                <AppText style={s.metaValue}>{order.number}</AppText>
              </View>
              <View style={s.statusPill}>
                <AppText style={s.statusTxt}>{STATUS_LABEL[order.status]}</AppText>
              </View>
            </View>

            <AppText style={s.h2}>Items</AppText>
            <View style={s.card}>
              {order.items.map((it, i) => (
                <View key={i} style={[s.row, i > 0 && s.rowBorder]}>
                  <AppText style={s.itemName} numberOfLines={2}>
                    {it.qty}× {it.name}
                  </AppText>
                  <AppText style={s.itemVal}>{formatLe(it.lineTotalMinor)}</AppText>
                </View>
              ))}
            </View>

            <View style={s.totals}>
              <View style={s.tRow}>
                <AppText style={s.tMute}>Subtotal</AppText>
                <AppText style={s.tMute}>{formatLe(order.subtotalMinor)}</AppText>
              </View>
              <View style={s.tRow}>
                <AppText style={s.tMute}>Delivery fee</AppText>
                <AppText style={s.tMute}>{order.deliveryFeeMinor == null ? "To be confirmed" : formatLe(order.deliveryFeeMinor)}</AppText>
              </View>
              <View style={[s.tRow, { marginTop: space.xs }]}>
                <AppText style={s.tTotal}>Total {order.deliveryFeeMinor == null ? "(so far)" : ""}</AppText>
                <AppText style={s.tTotal}>{formatLe(order.totalMinor)}</AppText>
              </View>
            </View>

            <AppText style={s.h2}>Delivery</AppText>
            <View style={s.card}>
              {order.recipientName ? <AppText style={s.delName}>{order.recipientName}</AppText> : null}
              <AppText style={s.delTxt}>{order.landmark}</AppText>
              <AppText style={s.delTxt}>{order.phone}</AppText>
            </View>

            <Pressable onPress={() => router.replace("/(tabs)")} style={({ pressed }) => [s.cta, pressed && { opacity: 0.9 }]} accessibilityRole="button">
              <AppText style={s.ctaTxt}>Continue shopping</AppText>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  back: { width: 44, height: 44, justifyContent: "center", marginLeft: -10, marginBottom: space.sm },
  hero: { alignItems: "center", paddingTop: space.lg, paddingHorizontal: space.lg },
  heroTitle: { fontFamily: font.bold, fontSize: 24, color: colors.ink, letterSpacing: -0.4, marginTop: space.lg },
  heroSub: { fontFamily: font.regular, fontSize: 14, lineHeight: 21, color: colors.inkSoft, textAlign: "center", marginTop: space.sm },
  pageTitle: { fontFamily: font.bold, fontSize: 28, lineHeight: 34, color: colors.ink, letterSpacing: -0.5, marginTop: space.sm },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space["3xl"] },
  metaLabel: { fontFamily: font.regular, fontSize: 12, color: colors.inkMute },
  metaValue: { fontFamily: font.bold, fontSize: 16, color: colors.ink, marginTop: 2 },
  statusPill: { backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingHorizontal: space.md, height: 30, alignItems: "center", justifyContent: "center" },
  statusTxt: { fontFamily: font.bold, fontSize: 12, color: colors.accentInk },
  h2: { fontFamily: font.bold, fontSize: 16, color: colors.ink, letterSpacing: -0.2, marginTop: space["2xl"] },
  card: { marginTop: space.md, padding: space.lg, borderRadius: radius.md, backgroundColor: colors.field },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, paddingVertical: space.sm },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  itemName: { flex: 1, fontFamily: font.medium, fontSize: 14, color: colors.ink },
  itemVal: { fontFamily: font.medium, fontSize: 14, color: colors.ink },
  totals: { marginTop: space.lg, gap: space.sm },
  tRow: { flexDirection: "row", justifyContent: "space-between" },
  tMute: { fontFamily: font.regular, fontSize: 14, color: colors.inkSoft },
  tTotal: { fontFamily: font.bold, fontSize: 16, color: colors.ink },
  delName: { fontFamily: font.bold, fontSize: 15, color: colors.ink, marginBottom: 4 },
  delTxt: { fontFamily: font.regular, fontSize: 14, lineHeight: 21, color: colors.inkSoft },
  cta: { height: 56, borderRadius: radius.pill, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", marginTop: space["3xl"] },
  ctaTxt: { fontFamily: font.bold, fontSize: 16, color: colors.onInk },
});
