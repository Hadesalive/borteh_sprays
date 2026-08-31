import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Check, Money } from "phosphor-react-native";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { AppText } from "@/components/Text";
import { MOMO_LABEL, MOMO_LOGO, type MomoProvider } from "@/lib/payments";
import { setDefaultPayment, useDefaultPayment } from "@/lib/paymentPrefs";
import { Colors, space } from "@/lib/theme";
import { ThemedStatusBar, useTheme, useThemedStyles } from "@/lib/theme-context";

// Explicit control over what checkout.tsx opens collapsed on — separate from
// the implicit "first payment sets it" behavior in checkout itself. This is
// the only place a default can be CHANGED after that first time; a one-off
// different choice at checkout no longer silently overwrites it.
export default function DefaultPayment() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);
  const defaultPayment = useDefaultPayment();
  const current = defaultPayment ?? { method: "cash_on_delivery" as const, momoProvider: null };

  const choose = (method: "cash_on_delivery" | "monime", momoProvider: MomoProvider | null) => {
    Haptics.selectionAsync();
    setDefaultPayment(method, momoProvider);
    router.back();
  };

  return (
    <View style={s.screen}>
      <ThemedStatusBar />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + space["3xl"] }}>
        <BackButton onPress={() => router.back()} />
        <AppText variant="heading" style={{ marginTop: space.lg }}>Default payment</AppText>
        <AppText variant="bodySoft" style={{ marginTop: space.xs }}>
          What checkout opens to first. You can still pick something else for any one order.
        </AppText>

        <View style={{ marginTop: space["2xl"], gap: space.sm }}>
          <Option
            icon={<Money size={20} color={colors.ink} weight="regular" />}
            title="Cash on delivery"
            subtitle="Pay the rider on arrival"
            selected={current.method === "cash_on_delivery"}
            onPress={() => choose("cash_on_delivery", null)}
            s={s}
            colors={colors}
          />
          <Option
            logo={MOMO_LOGO.m17}
            title={MOMO_LABEL.m17}
            subtitle="Pay by mobile money, via Monime"
            selected={current.method === "monime" && current.momoProvider === "m17"}
            onPress={() => choose("monime", "m17")}
            s={s}
            colors={colors}
          />
          <Option
            logo={MOMO_LOGO.m18}
            title={MOMO_LABEL.m18}
            subtitle="Pay by mobile money, via Monime"
            selected={current.method === "monime" && current.momoProvider === "m18"}
            onPress={() => choose("monime", "m18")}
            s={s}
            colors={colors}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function Option({
  icon, logo, title, subtitle, selected, onPress, s, colors,
}: {
  icon?: React.ReactNode; logo?: number; title: string; subtitle: string; selected: boolean;
  onPress: () => void; s: ReturnType<typeof makeStyles>; colors: Colors;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={title}>
      <View style={s.row}>
        {icon}
        {logo ? (
          <View style={s.logoBadge}>
            <Image source={logo} style={{ width: "100%", height: "100%" }} contentFit="contain" />
          </View>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="body">{title}</AppText>
          <AppText variant="caption" style={{ marginTop: 2 }}>{subtitle}</AppText>
        </View>
        {selected ? <Check size={20} color={colors.accent} weight="bold" /> : null}
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 80, paddingVertical: space.md, paddingHorizontal: space.md, backgroundColor: colors.paper },
  logoBadge: { width: 56, height: 56, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.line, padding: 6 },
});
