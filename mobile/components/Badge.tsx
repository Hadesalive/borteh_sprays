import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "@/lib/theme";
import { AppText } from "./Text";

// Squared, 1px border, 12px uppercase label. Tinted only for semantic state.
type Tone = "neutral" | "muted" | "success" | "warning" | "error";

const TEXT: Record<Tone, string> = {
  neutral: colors.ink,
  muted: colors.ink60,
  success: colors.success,
  warning: colors.warning,
  error: colors.error,
};

export function Badge({ label, tone = "neutral", style }: { label: string; tone?: Tone; style?: StyleProp<ViewStyle> }) {
  const color = TEXT[tone];
  const borderColor = tone === "neutral" || tone === "muted" ? colors.line : color;
  return (
    <View style={[s.badge, { borderColor }, style]}>
      <AppText variant="label" style={{ color }} maxFontSizeMultiplier={1.2}>
        {label}
      </AppText>
    </View>
  );
}

const s = StyleSheet.create({
  badge: { alignSelf: "flex-start", borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
});
