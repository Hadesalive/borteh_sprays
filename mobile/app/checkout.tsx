import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Check, Money, Tag } from "phosphor-react-native";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { ListRow } from "@/components/ListRow";
import { AppText } from "@/components/Text";
import { HeaderActions, LinkLabel, ToggleSwitch } from "@/components/ui";
import { takePendingCoupon, tierFor, useLoyalty, useLoyaltyConfig, useLoyaltyTiers, validatePromo } from "@/lib/account";
import { useProducts } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { cartTotalMinor, clearBag, useCart } from "@/lib/cart";
import { formatLe } from "@/lib/format";
import { placeOrder } from "@/lib/orders";
import { colors, font, space } from "@/lib/theme";
import { track } from "@/lib/track";

export default function Checkout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const qc = useQueryClient();
  const items = useCart();
  const { data: products } = useProducts();

  const [name, setName] = useState((session?.user.user_metadata?.display_name as string) || "");
  const [phone, setPhone] = useState((session?.user.user_metadata?.phone as string) || "");
  const [landmark, setLandmark] = useState("");
  const [notes, setNotes] = useState("");
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState<{ code: string; label: string; discountMinor: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [usePoints, setUsePoints] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: loyalty } = useLoyalty();
  const { data: loyaltyCfg } = useLoyaltyConfig();
  const { data: tiers } = useLoyaltyTiers();

  const subtotal = cartTotalMinor(items);
  // The loyalty-card perk is automatic ("N% off every order") — server-applied
  // in fn_place_order; this preview mirrors the same rule via tierFor().
  const tier = tierFor(loyalty, tiers, loyaltyCfg?.tiersEnabled ?? false);
  const tierDiscount = tier ? Math.floor((subtotal * tier.discountPercent) / 100) : 0;
  const promoDiscount = applied?.discountMinor ?? 0;
  const discount = Math.min(tierDiscount + promoDiscount, subtotal); // combined, capped — matches the server
  // Points preview mirrors the server's rules exactly: capped by balance AND by
  // what's left after the discounts (fn_place_order re-enforces both).
  const pointValue = loyaltyCfg?.pointValueMinor ?? 0;
  const canRedeem = (loyaltyCfg?.enabled ?? false) && pointValue > 0 && (loyalty?.points ?? 0) > 0;
  const redeemPoints = usePoints && canRedeem ? Math.min(loyalty?.points ?? 0, Math.floor((subtotal - discount) / pointValue)) : 0;
  const redeemValue = redeemPoints * pointValue;
  const total = Math.max(0, subtotal - discount - redeemValue);
  // Split the combined discount back out for the summary (tier is applied first).
  const shownTier = Math.min(tierDiscount, subtotal);
  const shownPromo = Math.max(0, discount - shownTier);
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

  const submit = async () => {
    if (busy) return;
    if (!name.trim() || !phone.trim() || !landmark.trim()) {
      setError("Add your name, phone and a delivery landmark.");
      return;
    }
    if (!items.length) {
      setError("Your bag is empty.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { orderId } = await placeOrder({
        items: items.map((it) => ({ variant_id: it.variantId, qty: it.qty })),
        landmark,
        phone,
        recipientName: name,
        notes,
        promoCode: applied?.code ?? null, // re-validated + priced by the server
        redeemPoints, // balance-checked + capped by the server
      });
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
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e?.message ?? "Couldn't place your order. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + 120, paddingHorizontal: space.gutter }}>
          <View style={s.topRow}>
            <BackButton onPress={() => router.back()} />
            <HeaderActions />
          </View>
          <AppText variant="heading" style={{ marginTop: space.lg }}>Checkout</AppText>

          {/* Delivery */}
          <AppText variant="label" style={s.eyebrow}>Delivery</AppText>
          <View style={{ gap: space.md, marginTop: space.md }}>
            <Field label="Recipient name" value={name} onChangeText={setName} placeholder="Aminata Kamara" autoCapitalize="words" />
            <Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="077 123 456" keyboardType="phone-pad" />
            <Field label="Delivery landmark / area" value={landmark} onChangeText={setLandmark} placeholder="e.g. Lumley, near the petrol station" autoCapitalize="sentences" />
            <Field label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Anything the rider should know" autoCapitalize="sentences" />
          </View>

          {/* Payment */}
          <AppText variant="label" style={s.eyebrow}>Payment</AppText>
          <View style={{ marginTop: space.xs }}>
            <ListRow icon={<Money size={20} color={colors.ink} weight="regular" />} title="Cash on delivery" value="Pay the rider on arrival" arrow={false} borderTop />
            {applied ? (
              <View style={s.couponRow}>
                <Check size={20} color={colors.accent} weight="regular" />
                <AppText variant="body" style={{ flex: 1 }}>
                  <AppText variant="body" style={{ fontFamily: font.semibold }}>{applied.code}</AppText> · {applied.label}
                </AppText>
                <LinkLabel label="Remove" onPress={() => setApplied(null)} color={colors.ink60} />
              </View>
            ) : (
              <View style={s.couponRow}>
                <Tag size={20} color={colors.ink} weight="regular" />
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
                <LinkLabel label="Apply" onPress={() => applyCoupon()} color={coupon.trim() ? colors.accent : colors.ink40} />
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

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: colors.ink60, marginTop: space["2xl"] },
  couponRow: { flexDirection: "row", alignItems: "center", gap: space.md, height: 56, borderBottomWidth: 1, borderBottomColor: colors.line },
  pointsRow: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  couponInput: { flex: 1, fontFamily: font.regular, fontSize: 14, color: colors.ink, padding: 0 },
  sumRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, paddingVertical: space.sm },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: space.md, marginTop: space.sm, borderTopWidth: 1, borderTopColor: colors.line },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.gutter, paddingTop: space.lg, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line },
});
