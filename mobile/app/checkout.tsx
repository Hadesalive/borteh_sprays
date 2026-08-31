import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Check, Money, Tag } from "phosphor-react-native";
import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { AppText } from "@/components/Text";
import { PaymentWaitPanel } from "@/components/PaymentWait";
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
import { setDefaultPayment, useDefaultPayment, useDefaultPaymentLoaded } from "@/lib/paymentPrefs";
import { initMomoPayment, MOMO_LABEL, MOMO_LOGO, type MomoProvider } from "@/lib/payments";
import { Colors, font, space } from "@/lib/theme";
import { ThemedStatusBar, useTheme, useThemedStyles } from "@/lib/theme-context";
import { track } from "@/lib/track";

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
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash_on_delivery");
  const [momoProvider, setMomoProvider] = useState<MomoProvider | null>(null);
  // Collapsed-by-default once we know their last choice, so returning customers
  // aren't shown all three options every time — first-timers (no default yet)
  // see the full list immediately, since there's nothing to collapse to.
  const [methodExpanded, setMethodExpanded] = useState(false);
  const [appliedDefault, setAppliedDefault] = useState(false);
  const defaultPayment = useDefaultPayment();
  const defaultPaymentLoaded = useDefaultPaymentLoaded();
  useEffect(() => {
    if (appliedDefault || !defaultPaymentLoaded) return;
    setAppliedDefault(true);
    if (defaultPayment) {
      setPaymentMethod(defaultPayment.method);
      setMomoProvider(defaultPayment.momoProvider);
    } else {
      setMethodExpanded(true); // nothing remembered yet — show all options
    }
  }, [appliedDefault, defaultPayment, defaultPaymentLoaded]);
  const [ussdCode, setUssdCode] = useState<string | null>(null);
  const [ussdExpiresAt, setUssdExpiresAt] = useState<string | null>(null);
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
    () => items.map((it) => {
      const product = (products ?? []).find((p) => p.slug === it.slug);
      return { ...it, name: product?.name ?? it.slug, thumbUrl: product?.imageUrl ?? null };
    }),
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

  // Only the FIRST-ever payment sets the default automatically — after that,
  // picking something different at checkout is a one-off for THIS order, not
  // a silent change to what they usually pay with. Changing the actual
  // default on purpose is the Settings screen's job (default-payment.tsx).
  const chooseMomo = (provider: MomoProvider) => {
    Haptics.selectionAsync();
    setPaymentMethod("monime");
    setMomoProvider(provider);
    if (!defaultPayment) setDefaultPayment("monime", provider);
    setMethodExpanded(false);
  };

  const chooseCash = () => {
    setPaymentMethod("cash_on_delivery");
    setMomoProvider(null);
    if (!defaultPayment) setDefaultPayment("cash_on_delivery", null);
    setMethodExpanded(false);
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
    setUssdExpiresAt(null);
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
        notes: notes.trim() || undefined,
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
          const { ussdCode: code, expiresAt } = await initMomoPayment(paymentIntentId, momoProvider);
          setUssdCode(code);
          setUssdExpiresAt(expiresAt ?? null);
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
            "Your order is saved. Open it from Orders to try again.",
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
            <AppText variant="bodySoft" style={{ marginTop: space.xs }}>Step 1 of 2: where it's going</AppText>

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
              <Field
                label="Notes for the rider (optional)"
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. call before arriving, leave with security"
                autoCapitalize="sentences"
                multiline
              />
            </View>

            {/* mini bag — real context while they fill in delivery details, not filler */}
            <AppText variant="label" style={s.eyebrow}>In your bag</AppText>
            <View style={s.bagCard}>
              {lines.map((l, i) => (
                <View key={l.variantId} style={[s.bagRow, i < lines.length - 1 && s.bagRowBorder]}>
                  <View style={s.bagThumb}>
                    {l.thumbUrl ? <Image source={{ uri: l.thumbUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText variant="bodySoft" numberOfLines={1}>{l.name}</AppText>
                    <AppText variant="caption" style={{ marginTop: 2 }}>{l.qty}× · {l.sizeMl} ml</AppText>
                  </View>
                  <AppText variant="body">{formatLe(l.priceMinor * l.qty)}</AppText>
                </View>
              ))}
              <View style={s.bagTotalRow}>
                <AppText variant="bodySoft">Subtotal</AppText>
                <AppText variant="body" style={{ fontFamily: font.semibold }}>{formatLe(subtotal)}</AppText>
              </View>
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
        {/* No BackButton (can't casually bail mid-payment) AND no HeaderActions
            — notification/profile nav has no place on a focused, single-task
            payment screen, same reasoning Apple Pay uses to strip its own
            chrome during an active payment sheet. */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space["2xl"], paddingBottom: insets.bottom + 120, paddingHorizontal: space.gutter }}>
          <AppText variant="heading">Pay by USSD</AppText>
          <AppText variant="bodySoft" style={{ marginTop: space.xs }}>Your order is saved and waiting on this payment.</AppText>
          <View style={{ marginTop: space.xl }}>
            <UssdPaymentCard ussdCode={ussdCode} providerLabel={MOMO_LABEL[momoProvider]} />
          </View>
          <PaymentWaitPanel expiresAt={ussdExpiresAt} />
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
          <AppText variant="bodySoft" style={{ marginTop: space.xs }}>Step 2 of 2: how you're paying</AppText>

          {/* Payment */}
          <AppText variant="label" style={s.eyebrow}>Payment method</AppText>
          {methodExpanded ? (
            <AppText variant="caption" style={{ marginTop: 2 }}>Pick whichever's easiest. We'll confirm the rest by phone.</AppText>
          ) : null}
          <View style={{ marginTop: space.sm, gap: space.sm }}>
            {!methodExpanded ? (
              // Collapsed to the remembered default — most returning customers pay
              // the same way every time, so there's no need to re-show all three
              // options on every checkout. First-timers never see this state (see
              // the mount effect above).
              <Pressable onPress={() => { Haptics.selectionAsync(); setMethodExpanded(true); }} accessibilityRole="button" accessibilityLabel="Change payment method">
                {/* paddingHorizontal: 0 override — this summary card has no
                    border to anchor against (unlike the coupon box below),
                    so its content needs to sit flush at the gutter to align
                    with everything else on the screen, not inset from it. */}
                <View style={[s.payRow, s.payRowOn, { paddingHorizontal: 0 }]}>
                  {paymentMethod === "monime" && momoProvider ? (
                    <View style={[s.logoBadge, { width: 56 }]}>
                      <Image source={MOMO_LOGO[momoProvider]} style={{ width: "100%", height: "100%" }} contentFit="contain" />
                    </View>
                  ) : (
                    <View style={[s.logoBadge, s.logoBadgeIcon, { width: 56 }]}>
                      <Money size={20} color={colors.ink} weight="regular" />
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText variant="body">{paymentMethod === "monime" && momoProvider ? MOMO_LABEL[momoProvider] : "Cash on delivery"}</AppText>
                    <AppText variant="caption" style={{ marginTop: 2 }}>Your default payment method</AppText>
                  </View>
                  <AppText variant="label" style={{ color: colors.accent, textDecorationLine: "underline" }}>Change</AppText>
                </View>
              </Pressable>
            ) : (
              <>
                <PaymentRow
                  icon={<Money size={20} color={colors.ink} weight="regular" />}
                  title="Cash on delivery"
                  subtitle="Pay the rider on arrival"
                  on={paymentMethod === "cash_on_delivery"}
                  onPress={chooseCash}
                  s={s}
                  colors={colors}
                />
                <PaymentRow
                  logo={MOMO_LOGO.m17}
                  title="Orange Money"
                  subtitle="Pay by mobile money, via Monime"
                  on={paymentMethod === "monime" && momoProvider === "m17"}
                  onPress={() => chooseMomo("m17")}
                  s={s}
                  colors={colors}
                />
                <PaymentRow
                  logo={MOMO_LOGO.m18}
                  title="Afrimoney"
                  subtitle="Pay by mobile money, via Monime"
                  on={paymentMethod === "monime" && momoProvider === "m18"}
                  onPress={() => chooseMomo("m18")}
                  s={s}
                  colors={colors}
                />
              </>
            )}
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
                    ? `${redeemPoints} points, ${formatLe(redeemValue)} off`
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
  icon, logo, logoWidth, title, subtitle, on, onPress, s, colors,
}: {
  icon?: React.ReactNode; logo?: number; logoWidth?: number; title: string; subtitle: string; on: boolean;
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
      <Animated.View style={[s.payRow, on && s.payRowOn, pressStyle]}>
        <View style={[s.radio, on && s.radioOn]}>{on ? <View style={s.radioDot} /> : null}</View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="body">{title}</AppText>
          <AppText variant="caption" style={{ marginTop: 2 }}>{subtitle}</AppText>
        </View>
        {/* Trailing mark, every method the same: a real provider logo gets its
            own white seat since it isn't designed for an arbitrary background;
            cash's icon gets the identical seat so all three rows read as the
            same considered choice instead of two logos and a loose glyph. */}
        {logo ? (
          <View style={[s.logoBadge, { width: logoWidth ?? 56 }]}>
            <Image source={logo} style={{ width: "100%", height: "100%" }} contentFit="contain" />
          </View>
        ) : icon ? (
          <View style={[s.logoBadge, s.logoBadgeIcon, { width: logoWidth ?? 56 }]}>
            {icon}
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: colors.ink60, marginTop: space["2xl"] },
  // Each method is its own bordered seat, not a melted-together list — reads
  // as distinct considered choices, not a form. Selected state gets the
  // maison's bronze accent, not a generic grey tint.
  // minHeight so Cash's small icon and the mobile-money rows' taller logo
  // badges don't produce three visibly different row heights — every option
  // reads as the same size choice regardless of what's inside it.
  // No drawn border — rows are separated by whitespace (Gestalt proximity)
  // instead of a boundary; the radio's filled/hollow state alone communicates
  // selection, same as a native iOS/Android radio list.
  payRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 80, paddingVertical: space.md, paddingHorizontal: space.md, backgroundColor: colors.paper },
  payRowOn: {},
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: colors.lineStrong, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  // A brand mark's own white seat — squared to match the maison's flat
  // language (theme.ts radius.lg = 0), not a soft pill. Height is shared;
  // width is per-logo (passed as logoWidth) since Orange Money's wordmark is
  // wide and Afrimoney's is square — a shared box let the square one shrink
  // to the box's short side and swim in empty space either way.
  logoBadge: { height: 56, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.line, padding: 6 },
  // Cash's icon has no native artwork to fill the seat, unlike a logo image —
  // center it instead of letting it sit flush top-left.
  logoBadgeIcon: { alignItems: "center", justifyContent: "center" },
  couponRow: { flexDirection: "row", alignItems: "center", gap: space.md, height: 48, marginTop: space.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  couponInline: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  couponPill: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.sm, height: 48, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.line },
  applyBtn: { height: 48, paddingHorizontal: space.lg, borderWidth: 1, borderColor: colors.ink, alignItems: "center", justifyContent: "center" },
  pointsRow: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  couponInput: { flex: 1, fontFamily: font.regular, fontSize: 14, color: colors.ink, padding: 0 },
  sumRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, paddingVertical: space.sm },
  bagCard: { marginTop: space.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  bagRow: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md },
  bagRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  bagThumb: { width: 44, height: 44, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: "hidden" },
  bagTotalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.md, paddingVertical: space.md, borderTopWidth: 1, borderTopColor: colors.line },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: space.md, marginTop: space.sm, borderTopWidth: 1, borderTopColor: colors.line },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.gutter, paddingTop: space.lg, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line },
});
