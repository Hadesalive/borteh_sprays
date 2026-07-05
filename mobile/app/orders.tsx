import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ArrowRight } from "phosphor-react-native";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Badge } from "@/components/Badge";
import { BackButton } from "@/components/BackButton";
import { AppText } from "@/components/Text";
import { formatLe } from "@/lib/format";
import { STATUS_LABEL, STATUS_TONE, useOrders } from "@/lib/orders";
import { colors, font, space } from "@/lib/theme";

export default function Orders() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: orders, isLoading } = useOrders();

  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space["3xl"], paddingHorizontal: space.gutter }}>
        <BackButton onPress={() => router.back()} />
        <AppText variant="heading" style={{ marginTop: space.lg }}>Orders</AppText>

        {!orders || orders.length === 0 ? (
          <View style={s.empty}>
            <AppText variant="heading" style={{ textAlign: "center" }}>{isLoading ? "Loading…" : "No orders yet."}</AppText>
            {!isLoading ? <AppText variant="bodySoft" style={{ textAlign: "center", marginTop: space.sm }}>When you place an order it'll show up here.</AppText> : null}
          </View>
        ) : (
          <View style={{ marginTop: space.md }}>
            {orders.map((o) => {
              const count = o.items.reduce((n, i) => n + i.qty, 0);
              return (
                <Pressable key={o.id} onPress={() => router.push({ pathname: "/order/[id]", params: { id: o.id } })} style={s.row} accessibilityRole="button" accessibilityLabel={`Order ${o.number}`}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="body" style={{ fontFamily: font.semibold }}>{o.number}</AppText>
                    <AppText variant="caption" style={{ marginTop: space.xs }}>
                      {fmtDate(o.placedAt)} · {count} {count === 1 ? "item" : "items"} · {formatLe(o.totalMinor)}
                    </AppText>
                  </View>
                  <Badge label={STATUS_LABEL[o.status]} tone={STATUS_TONE[o.status]} />
                  <ArrowRight size={20} color={colors.ink} weight="regular" />
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  empty: { paddingTop: space["4xl"], alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
});
