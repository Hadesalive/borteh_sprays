import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { CaretRight, Handbag } from "phosphor-react-native";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { AppText } from "@/components/Text";
import { formatLe } from "@/lib/format";
import { STATUS_LABEL, useOrders } from "@/lib/orders";
import { colors, font, radius, space } from "@/lib/theme";

export default function Orders() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: orders, isLoading } = useOrders();

  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");

  return (
    <View style={s.fill}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space["3xl"], paddingHorizontal: space.xl }}>
        <BackButton onPress={() => router.back()} style={{ marginBottom: space.sm }} />
        <AppText style={s.title}>Your orders</AppText>

        {!orders || orders.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Handbag size={32} color={colors.inkMute} weight="regular" />
            </View>
            <AppText style={s.emptyTitle}>{isLoading ? "Loading…" : "No orders yet"}</AppText>
            {!isLoading ? <AppText style={s.emptyBody}>When you place an order it'll show up here.</AppText> : null}
          </View>
        ) : (
          <View style={{ marginTop: space.xl, gap: space.md }}>
            {orders.map((o) => (
              <Pressable key={o.id} onPress={() => router.push({ pathname: "/order/[id]", params: { id: o.id } })} style={({ pressed }) => [s.card, pressed && { opacity: 0.9 }]} accessibilityRole="button">
                <View style={{ flex: 1 }}>
                  <View style={s.cardTop}>
                    <AppText style={s.number}>{o.number}</AppText>
                    <View style={s.statusPill}>
                      <AppText style={s.statusTxt}>{STATUS_LABEL[o.status]}</AppText>
                    </View>
                  </View>
                  <AppText style={s.meta}>
                    {fmtDate(o.placedAt)} · {o.items.reduce((n, i) => n + i.qty, 0)} item{o.items.reduce((n, i) => n + i.qty, 0) === 1 ? "" : "s"} · {formatLe(o.totalMinor)}
                  </AppText>
                </View>
                <CaretRight size={18} color={colors.inkMute} weight="bold" />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  back: { width: 44, height: 44, justifyContent: "center", marginLeft: -10, marginBottom: space.sm },
  title: { fontFamily: font.bold, fontSize: 28, color: colors.ink, letterSpacing: -0.5 },
  empty: { alignItems: "center", paddingTop: space["4xl"] },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.field, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: font.bold, fontSize: 18, color: colors.ink, marginTop: space.lg },
  emptyBody: { fontFamily: font.regular, fontSize: 14, color: colors.inkSoft, textAlign: "center", marginTop: 4 },
  card: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, borderRadius: radius.md, backgroundColor: colors.field },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  number: { fontFamily: font.bold, fontSize: 15, color: colors.ink },
  statusPill: { backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingHorizontal: space.md, height: 26, alignItems: "center", justifyContent: "center" },
  statusTxt: { fontFamily: font.bold, fontSize: 11, color: colors.accentInk },
  meta: { fontFamily: font.regular, fontSize: 13, color: colors.inkSoft, marginTop: 5 },
});
