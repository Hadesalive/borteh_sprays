import { useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
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
import { AppText } from "@/components/Text";
import { useProducts } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { cartTotalMinor, clearBag, useCart } from "@/lib/cart";
import { formatLe } from "@/lib/format";
import { placeOrder } from "@/lib/orders";
import { colors, font, radius, space } from "@/lib/theme";

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
    <View style={s.fill}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + 124, paddingHorizontal: space.xl }}
        >
          <BackButton onPress={() => router.back()} style={{ marginBottom: space.sm }} />
          <AppText style={s.title}>Checkout</AppText>

          {/* Delivery */}
          <AppText style={s.h2}>Delivery details</AppText>
          <View style={s.form}>
            <Field minimal label="Recipient name" value={name} onChangeText={setName} placeholder="Aminata Kamara" autoCapitalize="words" />
            <Field minimal label="Phone number" value={phone} onChangeText={setPhone} placeholder="077 123456" keyboardType="phone-pad" />
            <Field minimal label="Delivery landmark / area" value={landmark} onChangeText={setLandmark} placeholder="e.g. Lumley, near the petrol station" autoCapitalize="sentences" />
            <Field minimal label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Anything the rider should know" autoCapitalize="sentences" />
          </View>

          {/* Payment — text, no box */}
          <AppText style={s.h2}>Payment</AppText>
          <View style={s.payRow}>
            <Money size={20} color={colors.ink} weight="regular" />
            <View style={{ flex: 1 }}>
              <AppText style={s.payTitle}>Cash on delivery</AppText>
              <AppText style={s.paySub}>Pay the rider when your order arrives.</AppText>
            </View>
          </View>

          {/* Coupon */}
          <AppText style={s.h2}>Coupon</AppText>
          {applied ? (
            <View style={s.appliedRow}>
              <Check size={17} color={colors.accentInk} weight="bold" />
              <AppText style={s.appliedTxt}>
                <AppText style={s.appliedCode}>{applied.code}</AppText> · {applied.label}
              </AppText>
              <Pressable onPress={() => setApplied(null)} hitSlop={8} accessibilityRole="button">
                <AppText style={s.removeLink}>Remove</AppText>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={s.couponRow}>
                <Tag size={18} color={colors.inkMute} weight="regular" />
                <TextInput
                  value={coupon}
                  onChangeText={(t) => {
                    setCoupon(t);
                    if (couponMsg) setCouponMsg(null);
                  }}
                  placeholder="Enter code"
                  placeholderTextColor={colors.placeholder}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={applyCoupon}
                  style={s.couponInput}
                />
                <Pressable onPress={applyCoupon} hitSlop={8} disabled={!coupon.trim()} style={{ opacity: coupon.trim() ? 1 : 0.4 }} accessibilityRole="button">
                  <AppText style={s.applyLink}>Apply</AppText>
                </Pressable>
              </View>
              {couponMsg ? <AppText style={s.couponMsg}>{couponMsg}</AppText> : null}
            </>
          )}

          {/* Summary — text + one hairline */}
          <AppText style={s.h2}>Order summary</AppText>
          <View style={s.summary}>
            {lines.map((l) => (
              <View key={l.variantId} style={s.sumRow}>
                <AppText style={s.sumName} numberOfLines={1}>
                  {l.qty}× {l.name} · {l.sizeMl} ml
                </AppText>
                <AppText style={s.sumVal}>{formatLe(l.priceMinor * l.qty)}</AppText>
              </View>
            ))}
            <View style={s.divider} />
            <View style={s.sumRow}>
              <AppText style={s.sumMute}>Subtotal</AppText>
              <AppText style={s.sumMuteVal}>{formatLe(subtotal)}</AppText>
            </View>
            {applied ? (
              <View style={s.sumRow}>
                <AppText style={s.discountLabel}>Discount ({applied.code})</AppText>
                <AppText style={s.discountVal}>−{formatLe(discount)}</AppText>
              </View>
            ) : null}
            <View style={s.sumRow}>
              <AppText style={s.sumMute}>Delivery fee</AppText>
              <AppText style={s.sumMute}>Confirmed after you order</AppText>
            </View>
            <View style={s.divider} />
            <View style={s.sumRow}>
              <AppText style={s.totalLabel}>Total</AppText>
              <AppText style={s.totalVal}>{formatLe(total)}</AppText>
            </View>
          </View>

          {error ? <AppText style={s.error}>{error}</AppText> : null}
        </ScrollView>

        {/* Place order — gradient fade, no border */}
        <View style={[s.footer, { paddingBottom: insets.bottom + space.md }]} pointerEvents="box-none">
          <LinearGradient colors={["rgba(255,255,255,0)", colors.bg]} locations={[0, 0.45]} style={StyleSheet.absoluteFill} pointerEvents="none" />
          <Button title={busy ? "Placing order…" : "Place order"} trailing={formatLe(total)} onPress={submit} disabled={busy || !items.length} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  title: { fontFamily: font.bold, fontSize: 28, color: colors.ink, letterSpacing: -0.5 },
  h2: { fontFamily: font.bold, fontSize: 16, color: colors.ink, letterSpacing: -0.2, marginTop: space["2xl"] },
  form: { gap: space.lg, marginTop: space.lg },
  payRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.md },
  payTitle: { fontFamily: font.bold, fontSize: 15, color: colors.ink },
  paySub: { fontFamily: font.regular, fontSize: 13, color: colors.inkSoft, marginTop: 1 },
  couponRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.md, paddingBottom: space.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  couponInput: { flex: 1, fontFamily: font.semibold, fontSize: 15, color: colors.ink, letterSpacing: 0.4, padding: 0 },
  applyLink: { fontFamily: font.bold, fontSize: 14, color: colors.accentInk },
  couponMsg: { fontFamily: font.medium, fontSize: 13, color: colors.badge, marginTop: space.sm },
  appliedRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.md },
  appliedTxt: { flex: 1, fontFamily: font.regular, fontSize: 14, color: colors.inkSoft },
  appliedCode: { fontFamily: font.bold, color: colors.ink },
  removeLink: { fontFamily: font.semibold, fontSize: 13, color: colors.inkSoft },
  summary: { marginTop: space.lg, gap: space.md },
  sumRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  sumName: { flex: 1, fontFamily: font.regular, fontSize: 14, color: colors.inkSoft },
  sumVal: { fontFamily: font.medium, fontSize: 14, color: colors.ink },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: space.xs },
  sumMute: { fontFamily: font.regular, fontSize: 14, color: colors.inkSoft },
  sumMuteVal: { fontFamily: font.medium, fontSize: 14, color: colors.ink },
  discountLabel: { fontFamily: font.medium, fontSize: 14, color: colors.accentInk },
  discountVal: { fontFamily: font.bold, fontSize: 14, color: colors.accentInk },
  totalLabel: { fontFamily: font.bold, fontSize: 17, color: colors.ink, letterSpacing: -0.2 },
  totalVal: { fontFamily: font.bold, fontSize: 17, color: colors.ink, letterSpacing: -0.2 },
  error: { fontFamily: font.medium, fontSize: 13, color: colors.badge, marginTop: space.lg },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.xl, paddingTop: space["3xl"] },
});
