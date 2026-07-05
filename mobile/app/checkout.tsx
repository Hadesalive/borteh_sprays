import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Check, Money, Tag } from "phosphor-react-native";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { ListRow } from "@/components/ListRow";
import { AppText } from "@/components/Text";
import { LinkLabel } from "@/components/ui";
import { useProducts } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { cartTotalMinor, clearBag, useCart } from "@/lib/cart";
import { formatLe } from "@/lib/format";
import { placeOrder } from "@/lib/orders";
import { colors, font, space } from "@/lib/theme";

// Demo coupons — the owner can edit these (value is in minor units; Le 50 = 5000).
const COUPONS: Record<string, { label: string; type: "pct" | "flat"; value: number }> = {
  BORTEH10: { label: "10% off", type: "pct", value: 10 },
  WELCOME: { label: "Le 50 off", type: "flat", value: 5000 },
};

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
  const [applied, setApplied] = useState<{ code: string; label: string; type: "pct" | "flat"; value: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = cartTotalMinor(items);
  const discount = applied ? (applied.type === "pct" ? Math.round((subtotal * applied.value) / 100) : Math.min(applied.value, subtotal)) : 0;
  const total = Math.max(0, subtotal - discount);
  const lines = useMemo(
    () => items.map((it) => ({ ...it, name: (products ?? []).find((p) => p.slug === it.slug)?.name ?? it.slug })),
    [items, products],
  );

  const applyCoupon = () => {
    const code = coupon.trim().toUpperCase();
    if (!code) return;
    const found = COUPONS[code];
    if (!found) {
      setApplied(null);
      setCouponMsg("That code isn't valid.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setApplied({ code, ...found });
    setCoupon("");
    setCouponMsg(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

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
      const orderNotes = applied ? `${notes}${notes ? " — " : ""}Coupon ${applied.code} (${applied.label})` : notes;
      const { orderId } = await placeOrder({
        items: items.map((it) => ({ variant_id: it.variantId, qty: it.qty })),
        landmark,
        phone,
        recipientName: name,
        notes: orderNotes,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      clearBag();
      qc.invalidateQueries({ queryKey: ["orders"] });
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
          <BackButton onPress={() => router.back()} />
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
                  onSubmitEditing={applyCoupon}
                  style={s.couponInput}
                />
                <LinkLabel label="Apply" onPress={applyCoupon} color={coupon.trim() ? colors.accent : colors.ink40} />
              </View>
            )}
          </View>
          {couponMsg ? <AppText variant="caption" style={{ color: colors.error, marginTop: space.sm }}>{couponMsg}</AppText> : null}

          {/* Summary */}
          <AppText variant="label" style={s.eyebrow}>Summary</AppText>
          <View style={{ marginTop: space.sm }}>
            {lines.map((l) => (
              <View key={l.variantId} style={s.sumRow}>
                <AppText variant="bodySoft" numberOfLines={1} style={{ flex: 1 }}>{l.qty}× {l.name} · {l.sizeMl} ml</AppText>
                <AppText variant="body">{formatLe(l.priceMinor * l.qty)}</AppText>
              </View>
            ))}
            {applied ? (
              <View style={s.sumRow}>
                <AppText variant="bodySoft" style={{ color: colors.accent }}>Discount ({applied.code})</AppText>
                <AppText variant="body" style={{ color: colors.accent }}>−{formatLe(discount)}</AppText>
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
  eyebrow: { color: colors.ink60, marginTop: space["2xl"] },
  couponRow: { flexDirection: "row", alignItems: "center", gap: space.md, height: 56, borderBottomWidth: 1, borderBottomColor: colors.line },
  couponInput: { flex: 1, fontFamily: font.regular, fontSize: 14, color: colors.ink, padding: 0 },
  sumRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, paddingVertical: space.sm },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: space.md, marginTop: space.sm, borderTopWidth: 1, borderTopColor: colors.line },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.gutter, paddingTop: space.lg, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line },
});
