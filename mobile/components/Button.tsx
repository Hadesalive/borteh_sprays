import * as Haptics from "expo-haptics";
import { type ReactNode, useRef } from "react";
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, font, label as labelToken, space } from "@/lib/theme";

// Maison variants. primary = ink fill / paper label, secondary = 1px ink border,
// ghost = underlined label. Legacy "outline"/"tonal" map onto these.
type Variant = "primary" | "secondary" | "ghost" | "outline" | "tonal";

/** The one button — h52, squared, one primary per screen. A price rides in the
 *  label via `trailing`: "Add to bag — Le 680". Keeps the press-spring + haptic. */
export function Button({
  title,
  onPress,
  variant = "primary",
  tone = "default",
  icon,
  trailing,
  disabled = false,
  full = true,
  haptic = true,
  style,
  // accepted-but-ignored legacy props (Maison has no glass / elevation / sizes)
  size,
  elevated,
  glass,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  tone?: "default" | "destructive";
  icon?: ReactNode;
  trailing?: string;
  disabled?: boolean;
  full?: boolean;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: "lg" | "md";
  elevated?: boolean;
  glass?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (to: number) => Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 0 }).start();

  const kind: "primary" | "secondary" | "ghost" = variant === "outline" ? "secondary" : variant === "tonal" ? "primary" : variant;
  const destructive = tone === "destructive";
  const labelColor = kind === "primary" ? colors.onInk : destructive ? colors.error : colors.ink;
  const composed = trailing ? `${title} — ${trailing}` : title;

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        if (haptic) Haptics.selectionAsync();
        onPress();
      }}
      onPressIn={() => !disabled && spring(0.98)}
      onPressOut={() => spring(1)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={composed}
      style={[full && { alignSelf: "stretch" }, style]}
    >
      <Animated.View
        style={[
          s.base,
          s[kind],
          destructive && kind === "secondary" && { borderColor: colors.error },
          destructive && kind === "primary" && { backgroundColor: colors.error },
          disabled && { opacity: 0.45 },
          { transform: [{ scale }] },
        ]}
      >
        {icon ? <View>{icon}</View> : null}
        <View style={kind === "ghost" ? [s.underline, destructive && { borderBottomColor: colors.error }] : undefined}>
          <Animated.Text
            maxFontSizeMultiplier={1.3}
            style={[styles.label, { color: labelColor }]}
          >
            {composed}
          </Animated.Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  base: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, height: 52, paddingHorizontal: space.lg },
  primary: { backgroundColor: colors.ink },
  secondary: { borderWidth: 1, borderColor: colors.ink, backgroundColor: "transparent" },
  ghost: { backgroundColor: "transparent" },
  underline: { borderBottomWidth: 1, borderBottomColor: colors.ink, paddingBottom: 2 },
});

const styles = StyleSheet.create({
  label: { ...labelToken, fontFamily: font.semibold },
});
