import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Bell, CheckCircle } from "phosphor-react-native";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { AppText } from "@/components/Text";
import { LinkLabel } from "@/components/ui";
import { formatLe } from "@/lib/format";
import { STATUS_LABEL, STATUS_TONE, useOrder } from "@/lib/orders";
import { enablePush, usePushStatus } from "@/lib/push";
import { colors, font, space } from "@/lib/theme";

export default function OrderDetail() {
  const { id, placed } = useLocalSearchParams<{ id: string; placed?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: order, isLoading } = useOrder(id);
  const justPlaced = placed === "1";
  const pushStatus = usePushStatus();

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + (justPlaced ? 96 : space["3xl"]), paddingHorizontal: space.gutter }}>
        <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} />

        {!order ? (
          <AppText variant="bodySoft" style={{ marginTop: space["3xl"] }}>{isLoading ? "Loading…" : "Order not found."}</AppText>
        ) : (
          <>
            {justPlaced ? (
              <View style={{ marginTop: space["2xl"] }}>
                <CheckCircle size={32} color={colors.success} weight="regular" />
                <AppText variant="display" style={{ marginTop: space.md }}>Your order is in.</AppText>
                <AppText variant="bodySoft" style={{ marginTop: space.sm }}>
                  We'll confirm the delivery fee and call you on {order.phone} before the rider leaves.
                </AppText>
              </View>
            ) : (
              <AppText variant="heading" style={{ marginTop: space.lg }}>Order details</AppText>
            )}

            {/* meta */}
            <View style={s.metaRow}>
              <View>
                <AppText variant="label" style={{ color: colors.ink60 }}>Order</AppText>
                <AppText variant="body" style={{ fontFamily: font.semibold, marginTop: space.xs }}>{order.number}</AppText>
              </View>
              <Badge label={STATUS_LABEL[order.status]} tone={STATUS_TONE[order.status]} />
            </View>

            {/* items + totals */}
            <View style={{ marginTop: space.sm }}>
              {order.items.map((it, i) => (
                <View key={i} style={s.sumRow}>
                  <AppText variant="bodySoft" numberOfLines={2} style={{ flex: 1 }}>{it.qty}× {it.name}</AppText>
                  <AppText variant="body">{formatLe(it.lineTotalMinor)}</AppText>
                </View>
              ))}
              <View style={s.sumRow}>
                <AppText variant="bodySoft">Delivery</AppText>
                <AppText variant="bodySoft">{order.deliveryFeeMinor == null ? "To be confirmed" : formatLe(order.deliveryFeeMinor)}</AppText>
              </View>
              <View style={s.totalRow}>
                <AppText variant="serif20">Total{order.deliveryFeeMinor == null ? " so far" : ""}</AppText>
                <AppText variant="serif20">{formatLe(order.totalMinor)}</AppText>
              </View>
            </View>

            {/* deliver to */}
            <View style={s.deliver}>
              <AppText variant="label" style={{ color: colors.ink60 }}>Deliver to</AppText>
              {order.recipientName ? <AppText variant="body" style={{ marginTop: space.sm }}>{order.recipientName}</AppText> : null}
              <AppText variant="bodySoft">{[order.landmark, order.phone].filter(Boolean).join(" · ")}</AppText>
            </View>

            {/* push opt-in — the moment it's actually useful, never on launch */}
            {justPlaced && pushStatus === "undetermined" ? (
              <View style={s.pushCard}>
                <Bell size={20} color={colors.ink} weight="regular" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText variant="body">Follow this order on your lock screen</AppText>
                  <AppText variant="caption" style={{ marginTop: 2 }}>We'll only ping you about orders and restocks.</AppText>
                </View>
                <LinkLabel label="Turn on" color={colors.accent} onPress={() => enablePush()} />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {order && justPlaced ? (
        <View style={[s.footer, { paddingBottom: insets.bottom + space.lg }]}>
          <Button title="Continue shopping" variant="secondary" onPress={() => router.replace("/(tabs)")} />
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space["2xl"], paddingVertical: space.lg, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  sumRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, paddingVertical: space.sm },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: space.md, marginTop: space.sm, borderTopWidth: 1, borderTopColor: colors.line },
  deliver: { marginTop: space["2xl"], paddingTop: space.lg, borderTopWidth: 1, borderTopColor: colors.line },
  pushCard: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space["2xl"], borderWidth: 1, borderColor: colors.line, padding: space.lg },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.gutter, paddingTop: space.lg, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line },
});
