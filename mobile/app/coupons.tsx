import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ticket } from "phosphor-react-native";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Skel } from "@/components/Skeleton";
import { AppText } from "@/components/Text";
import { LinkLabel } from "@/components/ui";
import { stageCoupon, useMyCoupons } from "@/lib/account";
import { useSession } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { formatLe } from "@/lib/format";
import { colors, space } from "@/lib/theme";

// The coupon wallet — codes issued to YOU (RLS keeps everyone else's invisible).
// "Use at checkout" stages the code; checkout picks it up and applies it,
// validated + priced server-side. No copying, no typing.

export default function Coupons() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const items = useCart();
  const { data, isLoading } = useMyCoupons();
  const coupons = data ?? [];

  const use = (code: string) => {
    Haptics.selectionAsync();
    stageCoupon(code);
    router.push(items.length ? "/checkout" : "/shop"); // nothing in the bag yet → go fill it
  };

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + space["3xl"] }}>
        <BackButton onPress={() => router.back()} />
        <AppText variant="heading" style={{ marginTop: space.lg }}>Coupons</AppText>
        <AppText variant="caption" style={{ marginTop: space.xs }}>
          Yours alone — applied at checkout.
        </AppText>

        {!session ? (
          <EmptyState
            inline
            icon={<Ticket size={32} color={colors.ink40} weight="regular" />}
            title="Sign in to see your coupons."
            body="Codes issued to you live here."
            action={<Button title="Sign in" variant="secondary" onPress={() => router.push("/login")} />}
          />
        ) : isLoading && coupons.length === 0 ? (
          <View style={{ marginTop: space.lg }}>
            <Skel h={96} />
            <Skel h={96} style={{ marginTop: space.md }} />
          </View>
        ) : coupons.length === 0 ? (
          <EmptyState
            inline
            icon={<Ticket size={32} color={colors.ink40} weight="regular" />}
            title="No coupons right now."
            body="When the maison sends you one, it lands here — and in your notifications."
            action={<Button title="Browse fragrances" variant="secondary" onPress={() => router.push("/shop")} />}
          />
        ) : (
          <View style={{ marginTop: space.lg }}>
            {coupons.map((c) => (
              <View key={c.id} style={s.coupon}>
                <View style={s.couponTop}>
                  <AppText variant="serif20">{c.label}</AppText>
                  <AppText variant="label" style={{ color: colors.accent }}>{c.code}</AppText>
                </View>
                <AppText variant="caption" style={{ marginTop: space.xs }}>
                  {[
                    c.minOrderMinor > 0 ? `Orders over ${formatLe(c.minOrderMinor)}` : "Any order",
                    c.endsAt ? `until ${new Date(c.endsAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </AppText>
                <View style={{ marginTop: space.md }}>
                  <LinkLabel label="Use at checkout" onPress={() => use(c.code)} />
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  coupon: { borderWidth: 1, borderColor: colors.line, padding: space.lg, marginBottom: space.md },
  couponTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.md },
});
