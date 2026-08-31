import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Bell, CheckCircle, WarningCircle, WhatsappLogo } from "phosphor-react-native";
import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Confetti } from "@/components/Confetti";
import { AppText } from "@/components/Text";
import { LinkLabel } from "@/components/ui";
import { PaymentWaitPanel } from "@/components/PaymentWait";
import { UssdPaymentCard } from "@/components/UssdPayment";
import { formatLe } from "@/lib/format";
import { useWhatsAppSupport } from "@/lib/account";
import { cancelOrder, STATUS_LABEL, STATUS_TONE, useOrder, type OrderStatus } from "@/lib/orders";
import { initMomoPayment, MOMO_LABEL, type MomoProvider } from "@/lib/payments";
import { enablePush, usePushStatus } from "@/lib/push";
import { Colors, font, space } from "@/lib/theme";
import { ThemedStatusBar, useTheme, useThemedStyles } from "@/lib/theme-context";

// Statuses that have actually earned the "Your order is in." celebration.
// pending_payment is deliberately absent: for a Monime order it means the
// USSD payment hasn't landed yet, and cancelled/returned obviously haven't.
const CELEBRATED: readonly OrderStatus[] = ["confirmed", "preparing", "out_for_delivery", "delivered"];

// Copy per cancel_reason — a customer who tapped "Cancel order" themselves
// shouldn't read "we couldn't confirm your payment", and vice versa.
const CANCEL_COPY: Record<string, string> = {
  customer_cancelled: "You cancelled this order.",
  payment_expired: "The payment wasn't confirmed in time, so we released the bottles.",
  staff_cancelled: "This order was cancelled by our team.",
};
const DEFAULT_CANCEL_COPY = "This order was cancelled and the bottles were released.";

export default function OrderDetail() {
  const { id, placed } = useLocalSearchParams<{ id: string; placed?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data: order, isLoading } = useOrder(id);
  const whatsapp = useWhatsAppSupport();
  // `placed=1` only says the customer came from checkout — it says nothing about
  // whether the payment landed. The sweep can cancel an unpaid Monime hold at any
  // moment, so the hero is gated on what the server actually reports. useOrder
  // polls while pending_payment, so this flips on by itself the moment the
  // webhook confirms.
  const justPlaced = placed === "1" && !!order && CELEBRATED.includes(order.status);
  // NOT gated on `placed` — the sweep can cancel an order whenever it likes,
  // and the customer is just as likely to discover that from the Orders list
  // tomorrow as they are to be watching the checkout screen when it happens.
  // If money moved on a Monime order, this needs to say so wherever they see it.
  const orderFailed = !!order && (order.status === "cancelled" || order.status === "returned");
  const pushStatus = usePushStatus();
  const checkScale = useRef(new Animated.Value(0.6)).current;
  const scrollRef = useRef<ScrollView>(null);
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);
  const [payingNow, setPayingNow] = useState(false);
  const [retryCode, setRetryCode] = useState<string | null>(null);
  const [retryExpiresAt, setRetryExpiresAt] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Self-service cancel — server enforces ownership + pending_payment only
  // (fn_cancel_own_order). Confirm first: this releases the hold for good.
  const confirmCancel = () => {
    if (!order || cancelling) return;
    Alert.alert(
      "Cancel this order?",
      "This can't be undone. If you've already sent payment, dial the code again instead of cancelling.",
      [
        { text: "Keep order", style: "cancel" },
        {
          text: "Cancel order",
          style: "destructive",
          onPress: async () => {
            setCancelling(true);
            try {
              await cancelOrder(order.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              qc.invalidateQueries({ queryKey: ["order", order.id] });
              qc.invalidateQueries({ queryKey: ["orders"] });
            } catch (e: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("Couldn't cancel", e?.message ?? "Try again.");
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  // Retry an interrupted/never-started Monime payment. payment-init hands back
  // the existing code while it's still dialable and mints a fresh one (new
  // Idempotency-Key) once it has expired, so this is safe to tap more than
  // once and genuinely works after the first code goes stale. Reuses the
  // provider the customer originally picked (payment_intent.metadata.momo_provider).
  const retryMonime = async () => {
    if (payingNow || !order?.paymentIntentId || !order.momoProvider) return;
    setPayingNow(true);
    try {
      const { ussdCode, expiresAt } = await initMomoPayment(order.paymentIntentId, order.momoProvider as MomoProvider);
      setRetryCode(ussdCode);
      setRetryExpiresAt(expiresAt ?? null);
      // The code now renders at the top of the screen — if they'd scrolled
      // down to tap this button, bring them back up to actually see it.
      scrollRef.current?.scrollTo({ y: 0, animated: true });
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
      {/* The pending-payment footer (caption + a full button) is meaningfully
          taller than the simple one-button footer — sharing one fixed value
          between them meant it was tuned for the shorter case and the taller
          one quietly overlapped whatever content sat just above it. */}
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + (order?.status === "pending_payment" ? 140 : justPlaced || orderFailed ? 96 : space["3xl"]), paddingHorizontal: space.gutter }}>
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
              <View style={s.headingRow}>
                <AppText variant="heading">Order details</AppText>
                {order.status === "pending_payment" ? (
                  <Pressable onPress={confirmCancel} disabled={cancelling} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel order">
                    <AppText variant="label" style={{ color: colors.error }}>{cancelling ? "Cancelling…" : "Cancel order"}</AppText>
                  </Pressable>
                ) : null}
              </View>
            )}

            {orderFailed ? (
              <View style={s.failedCard}>
                <WarningCircle size={20} color={colors.error} weight="regular" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText variant="body">This order was cancelled</AppText>
                  <AppText variant="caption" style={{ marginTop: 2 }}>
                    {(order.cancelReason && CANCEL_COPY[order.cancelReason]) ?? DEFAULT_CANCEL_COPY}
                    {order.paymentMethod === "monime" ? " If money did leave your account, we'll sort it out." : ""}
                  </AppText>
                  {/* the old copy told the customer to "send us" the order number
                      with no actual way to do that — a real link, order number
                      already in the message, not an instruction with no action */}
                  {order.paymentMethod === "monime" && whatsapp.available ? (
                    <View style={{ marginTop: space.sm }}>
                      <LinkLabel
                        label="Message us on WhatsApp"
                        color={colors.error}
                        onPress={() => whatsapp.open(`Hi, my order ${order.number} was cancelled but I think a payment went through. Can you check?`)}
                      />
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* USSD code — appears once retryMonime() has fetched one. Kept at
                the TOP, right under the heading, not buried below the order
                summary: the whole reason someone tapped "Get a new code" is to
                act on it immediately, not scroll to find it. */}
            {retryCode && order.momoProvider ? (
              <View style={{ marginTop: space.lg }}>
                <UssdPaymentCard ussdCode={retryCode} providerLabel={MOMO_LABEL[order.momoProvider as MomoProvider] ?? "Mobile money"} />
              </View>
            ) : null}
            {order.status === "pending_payment" && order.paymentMethod === "monime" ? (
              <PaymentWaitPanel expiresAt={retryExpiresAt ?? order.ussdCodeExpiresAt} />
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

            {/* persistent, not conditional on status — a question about a normal
                in-progress order is just as real a reason to reach us as a
                failed payment, and the failedCard above only shows for that
                one narrow case */}
            {whatsapp.available ? (
              <Pressable
                style={s.helpCard}
                onPress={() => whatsapp.open(`Hi, I have a question about order ${order.number}.`)}
                accessibilityRole="button"
                accessibilityLabel="Message us about this order"
              >
                <WhatsappLogo size={20} color={colors.ink} weight="fill" />
                <AppText variant="body" style={{ flex: 1 }}>Need help with this order?</AppText>
                <AppText variant="label" style={{ color: colors.accent }}>Message us</AppText>
              </Pressable>
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

      {order && (justPlaced || orderFailed) ? (
        <View style={[s.footer, { paddingBottom: insets.bottom + space.lg }]}>
          <Button title="Continue shopping" variant="secondary" onPress={() => router.replace("/(tabs)")} />
        </View>
      ) : order && !justPlaced && order.status === "pending_payment" ? (
        <View style={[s.footer, { paddingBottom: insets.bottom + space.lg }]}>
          <AppText variant="caption" style={{ marginBottom: space.sm }}>Payment hasn't gone through yet.</AppText>
          {order.momoProvider ? (
            <Button
              title={payingNow ? "Getting code…" : retryCode ? "Get a new code" : `Pay with ${MOMO_LABEL[order.momoProvider as MomoProvider] ?? "mobile money"}`}
              trailing={payingNow ? undefined : formatLe(order.totalMinor)}
              onPress={retryMonime}
              disabled={payingNow || cancelling}
            />
          ) : null}
        </View>
      ) : null}

      {justPlaced ? <Confetti originY={insets.top + 110} /> : null}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  headingRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: space.lg },
  placedHero: { alignItems: "center", marginTop: space["3xl"], marginBottom: space.md },
  placedTitle: { marginTop: space.lg, textAlign: "center" },
  placedSub: { marginTop: space.sm, textAlign: "center", maxWidth: 320 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space["2xl"], paddingVertical: space.lg, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  sumRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, paddingVertical: space.sm },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: space.md, marginTop: space.sm, borderTopWidth: 1, borderTopColor: colors.line },
  deliver: { marginTop: space["2xl"], paddingTop: space.lg, borderTopWidth: 1, borderTopColor: colors.line },
  pushCard: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space["2xl"], borderWidth: 1, borderColor: colors.line, padding: space.lg },
  helpCard: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space["2xl"], borderWidth: 1, borderColor: colors.line, padding: space.lg },
  failedCard: { flexDirection: "row", alignItems: "flex-start", gap: space.md, marginTop: space["2xl"], borderWidth: 1, borderColor: colors.error, padding: space.lg },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.gutter, paddingTop: space.lg, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line },
});
