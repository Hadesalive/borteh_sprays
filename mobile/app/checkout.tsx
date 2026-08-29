import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Check, DeviceMobile, Money, Tag } from "phosphor-react-native";
import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { AppText } from "@/components/Text";
import { HeaderActions, LinkLabel, ToggleSwitch } from "@/components/ui";
import { UssdPaymentCard } from "@/components/UssdPayment";
import { takePendingCoupon, tierFor, useLoyalty, useLoyaltyConfig, useLoyaltyTiers, validatePromo } from "@/lib/account";
import { usePressScale } from "@/lib/animations";
import { useProducts } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { cartTotalMinor, clearBag, useCart, useCartCombos } from "@/lib/cart";
import { resolveComboClaims, useCombos } from "@/lib/combos";
import { formatLe } from "@/lib/format";
import { placeOrder, useOrder, type PaymentMethod } from "@/lib/orders";
import { initMomoPayment, type MomoProvider } from "@/lib/payments";
import { Colors, font, space } from "@/lib/theme";
import { ThemedStatusBar, useTheme, useThemedStyles } from "@/lib/theme-context";
import { track } from "@/lib/track";

const MOMO_LABEL: Record<MomoProvider, string> = { m17: "Orange Money", m18: "Afrimoney" };

export default function Checkout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const qc = useQueryClient();
  const items = useCart();
  const cartCombos = useCartCombos();
  const combos = useCombos();
  const { data: products } = useProducts();

  const [step, setStep] = useState<"delivery" | "payment" | "ussd">("delivery");
  const [name, setName] = useState((session?.user.user_metadata?.display_name as string) || "");
  const [phone, setPhone] = useState((session?.user.user_metadata?.phone as string) || "");
  const [landmark, setLandmark] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash_on_delivery");
  const [momoProvider, setMomoProvider] = useState<MomoProvider | null>(null);
  const [ussdCode, setUssdCode] = useState<string | null>(null);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState<{ code: string; label: string; discountMinor: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [usePoints, setUsePoints] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: loyalty } = useLoyalty();
  const { data: loyaltyCfg } = useLoyaltyConfig();
  const { data: tiers } = useLoyaltyTiers();
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);

  const subtotal = cartTotalMinor(items);
  // Combo deal savings — the pairs the shopper added, priced by the same rule the
  // server enforces (only pairs actually backed by the bag). comboPayload is what
  // we send as p_combos; the server re-derives the number authoritatively.
  const { savingsMinor: comboSavings, payload: comboPayload } = useMemo(
    () => resolveComboClaims(items, cartCombos, combos),
    [items, cartCombos, combos],
  );
  // The loyalty-card perk is automatic ("N% off every order") — server-applied
  // in fn_place_order; this preview mirrors the same rule via tierFor().
  const tier = tierFor(loyalty, tiers, loyaltyCfg?.tiersEnabled ?? false);
  const tierDiscount = tier ? Math.floor((subtotal * tier.discountPercent) / 100) : 0;
  const promoDiscount = applied?.discountMinor ?? 0;
  const discount = Math.min(comboSavings + tierDiscount + promoDiscount, subtotal); // combined, capped — matches the server
  // Points preview mirrors the server's rules exactly: capped by balance AND by
  // what's left after the discounts (fn_place_order re-enforces both).
  const pointValue = loyaltyCfg?.pointValueMinor ?? 0;
  const canRedeem = (loyaltyCfg?.enabled ?? false) && pointValue > 0 && (loyalty?.points ?? 0) > 0;
  const redeemPoints = usePoints && canRedeem ? Math.min(loyalty?.points ?? 0, Math.floor((subtotal - discount) / pointValue)) : 0;
  const redeemValue = redeemPoints * pointValue;
  const total = Math.max(0, subtotal - discount - redeemValue);
  // Split the combined discount back out for the summary (combo, then tier, then promo).
  const shownCombo = Math.min(comboSavings, subtotal);
  const shownTier = Math.min(tierDiscount, subtotal - shownCombo);
  const shownPromo = Math.max(0, discount - shownCombo - shownTier);
  const lines = useMemo(
    () => items.map((it) => ({ ...it, name: (products ?? []).find((p) => p.slug === it.slug)?.name ?? it.slug })),
    [items, products],
  );

  // Coupons are validated + priced SERVER-side (fn_validate_promo) — the same
  // rules fn_place_order enforces, so the preview can't drift from the charge.
  const applyCoupon = async (raw?: string) => {
    const code = (raw ?? coupon).trim().toUpperCase();
    if (!code) return;
    try {
      const res = await validatePromo(code, subtotal);
      setApplied({ code, label: res.label, discountMinor: res.discountMinor });
      setCoupon("");
      setCouponMsg(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setApplied(null);
      setCouponMsg(e?.message ?? "That code isn't valid.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // A coupon staged from the wallet ("Use at checkout") applies itself.
  useEffect(() => {
    const staged = takePendingCoupon();
    if (staged && subtotal > 0) applyCoupon(staged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal > 0]);

  // Screen 1 → 2: the delivery details are validated here so the customer gets
  // the feedback immediately, not after they've already picked a payment method.
  const continueToPayment = () => {
    if (!name.trim() || !phone.trim() || !landmark.trim()) {
      setError("Add your name, phone and a delivery landmark.");
      return;
    }
    setError(null);
    Haptics.selectionAsync();
    setStep("payment");
  };

  const chooseMomo = (provider: MomoProvider) => {
    Haptics.selectionAsync();
    setPaymentMethod("monime");
    setMomoProvider(provider);
  };

  // Fires once the customer has seen (and presumably dialed) the USSD code,
  // or immediately for cash — the same "order genuinely placed" tail either
  // way. The webhook, not this, is what ever confirms a Monime payment.
  const finishPlacement = (orderId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // recs: strongest signal — one purchase event per product, before the bag is cleared.
    for (const it of items) {
      track("purchase", { productId: it.productId, metadata: { variantId: it.variantId, qty: it.qty, priceMinor: it.priceMinor, orderId } });
    }
    clearBag();
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["loyalty"] });
    qc.invalidateQueries({ queryKey: ["loyalty-ledger"] });
    router.replace({ pathname: "/order/[id]", params: { id: orderId, placed: "1" } });
  };

  // The reservation sweep (fn_expire_monime_intents, every 5 min) cancels an
  // unpaid Monime hold — which ALSO moves the order off pending_payment. So
  // "left pending_payment" is not the same as "paid": this is the failure
  // tail, deliberately separate from finishPlacement's success tail. No
  // purchase events, no celebration, and the bag stays put — nothing was
  // bought. The customer lands on the real (cancelled) order, not a party.
  const abandonPlacement = (orderId: string) => {
    setStep("payment");
    setUssdCode(null);
    setPlacedOrderId(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["order", orderId] });
    router.replace({ pathname: "/order/[id]", params: { id: orderId } });
    Alert.alert(
      "Payment window closed",
      "We couldn't confirm your payment in time, so this order was cancelled and the bottles released. If money did leave your account, send us your order number and we'll sort it out.",
    );
  };

  // While the USSD screen is up, piggyback on useOrder's existing 3s poll
  // (lib/orders.ts) — it already stops once the order leaves pending_payment.
  // Branch on WHICH status it landed on: only a genuine confirmation earns
  // the success tail (see abandonPlacement above for why).
  const { data: pendingOrder } = useOrder(step === "ussd" ? (placedOrderId ?? undefined) : undefined);
  useEffect(() => {
    if (step !== "ussd" || !pendingOrder || pendingOrder.status === "pending_payment") return;
    if (pendingOrder.status === "cancelled" || pendingOrder.status === "returned") {
      abandonPlacement(pendingOrder.id);
    } else {
      finishPlacement(pendingOrder.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pendingOrder?.status]);

  const submit = async () => {
    if (busy) return;
    if (!items.length) {
      setError("Your bag is empty.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { orderId, paymentIntentId } = await placeOrder({
        items: items.map((it) => ({ variant_id: it.variantId, qty: it.qty })),
        landmark,
        phone,
        recipientName: name,
        promoCode: applied?.code ?? null, // re-validated + priced by the server
        redeemPoints, // balance-checked + capped by the server
        combos: comboPayload, // pairs to deal-price; server re-validates + reprices
        paymentMethod,
      });

      // Monime: the order is reserved but stays pending_payment until the
      // webhook confirms it (payment_code.completed) — showing the USSD code
      // is never proof of payment, only that the code exists to dial.
      if (paymentMethod === "monime" && paymentIntentId && momoProvider) {
        try {
          const { ussdCode: code } = await initMomoPayment(paymentIntentId, momoProvider);
          setUssdCode(code);
          setPlacedOrderId(orderId);
          setStep("ussd");
        } catch (e) {
          console.warn("monime payment code failed", e);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          // Clear the bag only once the alert is dismissed — doing it before
          // showing the alert emptied the cart immediately, so the screen
          // behind the alert flashed "Total Le 0" while it was still up.
          Alert.alert(
            "Couldn't get a payment code",
            "Your order is saved — open it from Orders to try again.",
            [{
              text: "OK",
              onPress: () => {
                clearBag(); // the order is real and reserved server-side — don't resubmit it on retry
                qc.invalidateQueries({ queryKey: ["orders"] });
                router.replace({ pathname: "/order/[id]", params: { id: orderId } });
              },
            }],
          );
        }
        return;
      }

      finishPlacement(orderId);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e?.message ?? "Couldn't place your order. Try again.");
    } finally {
      setBusy(false);
    }
  };

  // ---- SCREEN 1: delivery details --------------------------------------------------------
  if (step === "delivery") {
    return (
      <View style={s.screen}>
        <ThemedStatusBar />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + 120, paddingHorizontal: space.gutter }}>
            <View style={s.topRow}>
              <BackButton onPress={() => router.back()} />
              <HeaderActions />
            </View>
            <AppText variant="heading" style={{ marginTop: space.lg }}>Checkout</AppText>
            <AppText variant="bodySoft" style={{ marginTop: space.xs }}>Step 1 of 2 — where it's going</AppText>

            <AppText variant="label" style={s.eyebrow}>Delivery</AppText>
            <View style={{ gap: space.md, marginTop: space.md }}>
              <View style={{ flexDirection: "row", gap: space.md }}>
                <View style={{ flex: 1 }}>
                  <Field label="Name" value={name} onChangeText={setName} placeholder="Aminata Kamara" autoCapitalize="words" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="077 123 456" keyboardType="phone-pad" />
                </View>
              </View>
              <Field label="Delivery landmark / area" value={landmark} onChangeText={setLandmark} placeholder="e.g. Lumley, near the petrol station" autoCapitalize="sentences" />
            </View>

            {error ? <AppText variant="caption" style={{ color: colors.error, marginTop: space.lg }}>{error}</AppText> : null}
          </ScrollView>

          <View style={[s.footer, { paddingBottom: insets.bottom + space.lg }]}>
            <Button title="Continue to payment" onPress={continueToPayment} disabled={!items.length} />
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ---- SCREEN 3: USSD code (Monime orders only) -------------------------------------------
  if (step === "ussd" && ussdCode && placedOrderId && momoProvider) {
    return (
      <View style={s.screen}>
        <ThemedStatusBar />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + 120, paddingHorizontal: space.gutter }}>
          <View style={s.topRow}>
            <HeaderActions />
          </View>
          <AppText variant="heading" style={{ marginTop: space.lg }}>Pay by USSD</AppText>
          <AppText variant="bodySoft" style={{ marginTop: space.xs }}>Your order is saved and waiting on this payment.</AppText>
          <View style={{ marginTop: space.xl }}>
            <UssdPaymentCard ussdCode={ussdCode} providerLabel={MOMO_LABEL[momoProvider]} />
          </View>
        </ScrollView>
        <View style={[s.footer, { paddingBottom: insets.bottom + space.lg }]}>
          <Button title="Done" onPress={() => finishPlacement(placedOrderId)} />
        </View>
      </View>
    );
  }

  // ---- SCREEN 2: payment + summary --------------------------------------------------------
  return (
    <View style={s.screen}>
      <ThemedStatusBar />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + 120, paddingHorizontal: space.gutter }}>
          <View style={s.topRow}>
            <BackButton onPress={() => setStep("delivery")} />
            <HeaderActions />
          </View>
          <AppText variant="heading" style={{ marginTop: space.lg }}>Payment</AppText>
          <AppText variant="bodySoft" style={{ marginTop: space.xs }}>Step 2 of 2 — how you're paying</AppText>

          {/* Payment */}
          <AppText variant="label" style={s.eyebrow}>Payment method</AppText>
          <View style={{ marginTop: space.xs }}>
            <PaymentRow
              icon={<Money size={20} color={colors.ink} weight="regular" />}
              title="Cash on delivery"
              subtitle="Pay the rider on arrival"
              on={paymentMethod === "cash_on_delivery"}
              first
              onPress={() => { setPaymentMethod("cash_on_delivery"); setMomoProvider(null); }}
              s={s}
              colors={colors}
            />
            <PaymentRow
              icon={<DeviceMobile size={20} color={colors.ink} weight="regular" />}
              title="Orange Money"
              subtitle="Pay by mobile money, via Monime"
              on={paymentMethod === "monime" && momoProvider === "m17"}
              onPress={() => chooseMomo("m17")}
              s={s}
              colors={colors}
            />
            <PaymentRow
              icon={<DeviceMobile size={20} color={colors.ink} weight="regular" />}
              title="Afrimoney"
              subtitle="Pay by mobile money, via Monime"
              on={paymentMethod === "monime" && momoProvider === "m18"}
              onPress={() => chooseMomo("m18")}
              s={s}
              colors={colors}
            />
            {applied ? (
              <View style={s.couponRow}>
                <Check size={18} color={colors.accent} weight="regular" />
                <AppText variant="caption" style={{ flex: 1 }}>
                  <AppText variant="caption" style={{ fontFamily: font.semibold, color: colors.ink }}>{applied.code}</AppText> · {applied.label}
                </AppText>
                <LinkLabel label="Remove" onPress={() => setApplied(null)} color={colors.ink60} />
              </View>
            ) : (
              <View style={s.couponInline}>
                <View style={s.couponPill}>
                  <Tag size={16} color={colors.ink40} weight="regular" />
                  <TextInput
                    value={coupon}
                    onChangeText={(t) => { setCoupon(t); if (couponMsg) setCouponMsg(null); }}
                    placeholder="Coupon code"
                    placeholderTextColor={colors.ink40}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={() => applyCoupon()}
                    style={s.couponInput}
                  />
                </View>
                <Pressable onPress={() => applyCoupon()} style={s.applyBtn}>
                  <AppText variant="label">Apply</AppText>
                </Pressable>
              </View>
            )}
          </View>
          {couponMsg ? <AppText variant="caption" style={{ color: colors.error, marginTop: space.sm }}>{couponMsg}</AppText> : null}

          {/* points — shown only when there's something real to spend */}
          {canRedeem ? (
            <View style={s.pointsRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText variant="body">Use my points</AppText>
                <AppText variant="caption" style={{ marginTop: 2 }}>
                  {usePoints && redeemPoints > 0
                    ? `${redeemPoints} points — ${formatLe(redeemValue)} off`
                    : `${loyalty?.points ?? 0} points ≈ ${formatLe((loyalty?.points ?? 0) * pointValue)}`}
                </AppText>
              </View>
              <ToggleSwitch
                value={usePoints}
                onToggle={(v) => {
                  Haptics.selectionAsync();
                  setUsePoints(v);
                }}
              />
            </View>
          ) : null}

          {/* Summary */}
          <AppText variant="label" style={s.eyebrow}>Summary</AppText>
          <View style={{ marginTop: space.sm }}>
            {lines.map((l) => (
              <View key={l.variantId} style={s.sumRow}>
                <AppText variant="bodySoft" numberOfLines={1} style={{ flex: 1 }}>{l.qty}× {l.name} · {l.sizeMl} ml</AppText>
                <AppText variant="body">{formatLe(l.priceMinor * l.qty)}</AppText>
              </View>
            ))}
            {shownCombo > 0 ? (
              <View style={s.sumRow}>
                <AppText variant="bodySoft" style={{ color: colors.accent }}>Pair savings</AppText>
                <AppText variant="body" style={{ color: colors.accent }}>−{formatLe(shownCombo)}</AppText>
              </View>
            ) : null}
            {shownTier > 0 && tier ? (
              <View style={s.sumRow}>
                <AppText variant="bodySoft" style={{ color: colors.accent }}>{tier.name} ({tier.discountPercent}%)</AppText>
                <AppText variant="body" style={{ color: colors.accent }}>−{formatLe(shownTier)}</AppText>
              </View>
            ) : null}
            {applied && shownPromo > 0 ? (
              <View style={s.sumRow}>
                <AppText variant="bodySoft" style={{ color: colors.accent }}>Discount ({applied.code})</AppText>
                <AppText variant="body" style={{ color: colors.accent }}>−{formatLe(shownPromo)}</AppText>
              </View>
            ) : null}
            {redeemPoints > 0 ? (
              <View style={s.sumRow}>
                <AppText variant="bodySoft" style={{ color: colors.accent }}>Points ({redeemPoints})</AppText>
                <AppText variant="body" style={{ color: colors.accent }}>−{formatLe(redeemValue)}</AppText>
              </View>
            ) : null}
            <View style={s.totalRow}>
              <AppText variant="serif20">Total</AppText>
              <AppText variant="serif20">{formatLe(total)}</AppText>
            </View>
            <AppText variant="caption" style={{ marginTop: space.xs }}>Delivery fee confirmed by phone after you order.</AppText>
          </View>

          {error ? <AppText variant="caption" style={{ color: colors.error, marginTop: space.lg }}>{error}</AppText> : null}
        </ScrollView>

        <View style={[s.footer, { paddingBottom: insets.bottom + space.lg }]}>
          <Button title={busy ? "Placing order…" : "Place order"} trailing={busy ? undefined : formatLe(total)} onPress={submit} disabled={busy || !items.length} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// A proper radio row (indicator + icon + title/subtitle) — one call site per
// payment method in Checkout(), state/onPress owned by the caller.
function PaymentRow({
  icon, title, subtitle, on, first, onPress, s, colors,
}: {
  icon: React.ReactNode; title: string; subtitle: string; on: boolean; first?: boolean;
  onPress: () => void; s: ReturnType<typeof makeStyles>; colors: Colors;
}) {
  const { pressStyle, onPressIn, onPressOut } = usePressScale();
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={title}
    >
      <Animated.View style={[s.payRow, first && s.top, on && s.payRowOn, pressStyle]}>
        <View style={[s.radio, on && s.radioOn]}>{on ? <View style={s.radioDot} /> : null}</View>
        {icon}
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="body">{title}</AppText>
          <AppText variant="caption" style={{ marginTop: 2 }}>{subtitle}</AppText>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: colors.ink60, marginTop: space["2xl"] },
  payRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md, paddingHorizontal: space.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  payRowOn: { backgroundColor: colors.surface },
  top: { borderTopWidth: 1, borderTopColor: colors.line },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: colors.ink40, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: colors.ink },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink },
  couponRow: { flexDirection: "row", alignItems: "center", gap: space.md, height: 48, marginTop: space.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  couponInline: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  couponPill: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.sm, height: 48, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.line },
  applyBtn: { height: 48, paddingHorizontal: space.lg, borderWidth: 1, borderColor: colors.ink, alignItems: "center", justifyContent: "center" },
  pointsRow: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  couponInput: { flex: 1, fontFamily: font.regular, fontSize: 14, color: colors.ink, padding: 0 },
  sumRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, paddingVertical: space.sm },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: space.md, marginTop: space.sm, borderTopWidth: 1, borderTopColor: colors.line },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.gutter, paddingTop: space.lg, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line },
});
