import * as Haptics from "expo-haptics";
import { Phone } from "phosphor-react-native";
import { Linking, StyleSheet, View } from "react-native";
import { Button } from "@/components/Button";
import { AppText } from "@/components/Text";
import { Colors, space } from "@/lib/theme";
import { useTheme, useThemedStyles } from "@/lib/theme-context";

/** Shown after a Monime Payment Code is created — no browser, no redirect.
 *  The customer dials the USSD string themselves; confirmation only ever
 *  arrives via the monime-webhook function (payment_code.completed), same
 *  as before — this card is purely presentational. */
export function UssdPaymentCard({ ussdCode, providerLabel }: { ussdCode: string; providerLabel: string }) {
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);

  const dial = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`tel:${encodeURIComponent(ussdCode)}`).catch(() => {});
  };

  return (
    <View style={s.card}>
      <AppText variant="label" style={{ color: colors.ink60 }}>{providerLabel}</AppText>
      <AppText variant="display" style={s.code}>{ussdCode}</AppText>
      <AppText variant="bodySoft" style={{ marginTop: space.sm }}>
        Dial this on your phone to pay. We'll confirm here automatically once it goes through — no need to come back and check.
      </AppText>
      <View style={{ marginTop: space.lg }}>
        <Button title="Dial now" icon={<Phone size={18} color={colors.onInk} weight="regular" />} onPress={dial} />
      </View>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  card: { padding: space.xl, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  code: { marginTop: space.sm, letterSpacing: 1 },
});
