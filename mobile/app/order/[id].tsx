import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Bell, CheckCircle, WarningCircle } from "phosphor-react-native";
import { useEffect, useRef, useState } from "react";
import { Alert, Animated, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Confetti } from "@/components/Confetti";
import { AppText } from "@/components/Text";
import { LinkLabel } from "@/components/ui";
import { UssdPaymentCard } from "@/components/UssdPayment";
import { formatLe } from "@/lib/format";
import { STATUS_LABEL, STATUS_TONE, useOrder, type OrderStatus } from "@/lib/orders";
import { initMomoPayment, type MomoProvider } from "@/lib/payments";
import { enablePush, usePushStatus } from "@/lib/push";
import { Colors, font, space } from "@/lib/theme";
import { ThemedStatusBar, useTheme, useThemedStyles } from "@/lib/theme-context";

const MOMO_LABEL: Record<string, string> = { m17: "Orange Money", m18: "Afrimoney" };

// Statuses that have actually earned the "Your order is in." celebration.
// pending_payment is deliberately absent: for a Monime order it means the
// USSD payment hasn't landed yet, and cancelled/returned obviously haven't.
const CELEBRATED: readonly OrderStatus[] = ["confirmed", "preparing", "out_for_delivery", "delivered"];

export default function OrderDetail() {
  const { id, placed } = useLocalSearchParams<{ id: string; placed?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: order, isLoading } = useOrder(id);
  // `placed=1` only says the customer came from checkout — it says nothing about
  // whether the payment landed. The sweep can cancel an unpaid Monime hold at any
  // moment, so the hero is gated on what the server actually reports. useOrder
  // polls while pending_payment, so this flips on by itself the moment the
  // webhook confirms.
  const justPlaced = placed === "1" && !!order && CELEBRATED.includes(order.status);
  // Came from checkout but the order is dead — the customer needs to be told why,
  // and told what to do if the money did in fact leave their account.
  const placementFailed = placed === "1" && !!order && (order.status === "cancelled" || order.status === "returned");
  const pushStatus = usePushStatus();
  const checkScale = useRef(new Animated.Value(0.6)).current;
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);
  const [payingNow, setPayingNow] = useState(false);
  const [retryCode, setRetryCode] = useState<string | null>(null);

  // Retry an interrupted/never-started Monime payment. payment-init hands back
  // the existing code while it's still dialable and mints a fresh one (new
  // Idempotency-Key) once it has expired, so this is safe to tap more than
  // once and genuinely works after the first code goes stale. Reuses the
  // provider the customer originally picked (payment_intent.metadata.momo_provider).
  const retryMonime = async () => {
    if (payingNow || !order?.paymentIntentId || !order.momoProvider) return;
    setPayingNow(true);
    try {
      const { ussdCode } = await initMomoPayment(order.paymentIntentId, order.momoProvider as MomoProvider);
      setRetryCode(ussdCode);
    } catch (e) {
      console.warn("monime retry failed", e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Couldn't get a payment code", "Check your connection and try again.");
    } finally {
      setPayingNow(false);
    }
  };

  // Celebrate the placed order — a haptic roll (following checkout's success),
  // the check springing in, and a Maison-palette confetti burst.
  useEffect(() => {
    if (!justPlaced) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const t1 = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 150);
    const t2 = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 300);
    Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, friction: 4, tension: 130 }).start();
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [justPlaced, checkScale]);

  return (
    <View style={s.screen}>
      <ThemedStatusBar />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + (justPlaced || placementFailed || (order && order.status === "pending_payment" && order.paymentMethod === "monime" && order.paymentIntentId && order.momoProvider) ? 96 : space["3xl"]), paddingHorizontal: space.gutter }}>
        <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} />

        {!order ? (
          <AppText variant="bodySoft" style={{ marginTop: space["3xl"] }}>{isLoading ? "Loading…" : "Order not found."}</AppText>
        ) : (
          <>
            {justPlaced ? (
              <View style={s.placedHero}>
                <Animated.View style={{ transform: [{ scale: checkScale }] }}>
                  <CheckCircle size={44} color={colors.success} weight="fill" />
                </Animated.View>
                <AppText variant="display" style={s.placedTitle}>Your order is in.</AppText>
                <AppText variant="bodySoft" style={s.placedSub}>
                  We'll confirm the delivery fee and call you on {order.phone} before the rider leaves.
                </AppText>
              </View>
            ) : (
              <AppText variant="heading" style={{ marginTop: space.lg }}>Order details</AppText>
            )}

            {placementFailed ? (
              <View style={s.failedCard}>
                <WarningCircle size={20} color={colors.error} weight="regular" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText variant="body">This order was cancelled</AppText>
                  <AppText variant="caption" style={{ marginTop: 2 }}>
                    The payment wasn't confirmed in time, so we released the bottles. If money did leave your account, send us {order.number} and we'll sort it out.
                  </AppText>
                </View>
              </View>
            ) : null}

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
              {order.discountMinor > 0 ? (
                <View style={s.sumRow}>
                  <AppText variant="bodySoft" style={{ color: colors.accent }}>Savings</AppText>
                  <AppText variant="body" style={{ color: colors.accent }}>−{formatLe(order.discountMinor)}</AppText>
                </View>
              ) : null}
              {order.loyaltyRedeemMinor > 0 ? (
                <View style={s.sumRow}>
                  <AppText variant="bodySoft" style={{ color: colors.accent }}>Points</AppText>
                  <AppText variant="body" style={{ color: colors.accent }}>−{formatLe(order.loyaltyRedeemMinor)}</AppText>
                </View>
              ) : null}
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

            {/* USSD code — appears once retryMonime() has fetched one */}
            {retryCode && order.momoProvider ? (
              <View style={{ marginTop: space["2xl"] }}>
                <UssdPaymentCard ussdCode={retryCode} providerLabel={MOMO_LABEL[order.momoProvider] ?? "Mobile money"} />
              </View>
            ) : null}

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

      {order && (justPlaced || placementFailed) ? (
        <View style={[s.footer, { paddingBottom: insets.bottom + space.lg }]}>
          <Button title="Continue shopping" variant="secondary" onPress={() => router.replace("/(tabs)")} />
        </View>
      ) : order && !justPlaced && order.status === "pending_payment" && order.paymentMethod === "monime" && order.paymentIntentId && order.momoProvider ? (
        <View style={[s.footer, { paddingBottom: insets.bottom + space.lg }]}>
          <AppText variant="caption" style={{ marginBottom: space.sm }}>Payment hasn't gone through yet.</AppText>
          <Button
            title={payingNow ? "Getting code…" : retryCode ? "Get a new code" : `Pay with ${MOMO_LABEL[order.momoProvider] ?? "mobile money"}`}
            trailing={payingNow ? undefined : formatLe(order.totalMinor)}
            onPress={retryMonime}
            disabled={payingNow}
          />
        </View>
      ) : null}

      {justPlaced ? <Confetti originY={insets.top + 110} /> : null}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  placedHero: { alignItems: "center", marginTop: space["3xl"], marginBottom: space.md },
  placedTitle: { marginTop: space.lg, textAlign: "center" },
  placedSub: { marginTop: space.sm, textAlign: "center", maxWidth: 320 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space["2xl"], paddingVertical: space.lg, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  sumRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, paddingVertical: space.sm },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: space.md, marginTop: space.sm, borderTopWidth: 1, borderTopColor: colors.line },
  deliver: { marginTop: space["2xl"], paddingTop: space.lg, borderTopWidth: 1, borderTopColor: colors.line },
  pushCard: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space["2xl"], borderWidth: 1, borderColor: colors.line, padding: space.lg },
  failedCard: { flexDirection: "row", alignItems: "flex-start", gap: space.md, marginTop: space["2xl"], borderWidth: 1, borderColor: colors.error, padding: space.lg },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.gutter, paddingTop: space.lg, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line },
});
