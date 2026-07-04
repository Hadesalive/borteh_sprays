import * as Haptics from "expo-haptics";
import { type ReactNode, useRef } from "react";
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, font, radius, shadow, space } from "@/lib/theme";
import { GlassFill } from "./Glass";
import { AppText } from "./Text";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "tonal";

/** The one button. primary = amber fill, secondary = soft tonal, ghost = hairline outline,
 *  outline = bold ink border, tonal = amber-soft fill.
 *  Handles the press-spring, haptic, disabled dim, optional leading icon and trailing value. */
export function Button({
  title,
  onPress,
  variant = "primary",
  size = "lg",
  icon,
  trailing,
  disabled = false,
  elevated = false,
  glass = false,
  full = true,
  haptic = true,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: "lg" | "md";
  icon?: ReactNode;
  trailing?: string;
  disabled?: boolean;
  elevated?: boolean;
  glass?: boolean;
  full?: boolean;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (to: number) => Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  const txtColor = variant === "primary" ? colors.onAccent : variant === "tonal" ? colors.accentInk : colors.ink;
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        if (haptic) Haptics.selectionAsync();
        onPress();
      }}
      onPressIn={() => !disabled && spring(0.97)}
      onPressOut={() => spring(1)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={[full && { alignSelf: "stretch" }, style]}
    >
      <Animated.View
        style={[
          s.base,
          size === "md" ? s.md : s.lg,
          glass ? s.glassBase : s[variant],
          elevated && shadow.nav,
          disabled && { opacity: 0.55 },
          { transform: [{ scale }] },
        ]}
      >
        {glass ? (
          <>
            <GlassFill radius={radius.pill} tint={variant === "primary" ? "light" : "dark"} tintColor={variant === "primary" ? "rgba(154,91,45,0.4)" : "rgba(18,18,20,0.5)"} />
            <View style={[StyleSheet.absoluteFillObject, { borderRadius: radius.pill, backgroundColor: variant === "primary" ? "rgba(154,91,45,0.66)" : "rgba(18,18,20,0.45)" }]} pointerEvents="none" />
          </>
        ) : null}
        {icon ? <View>{icon}</View> : null}
        <AppText style={[size === "md" ? s.txtMd : s.txt, { color: txtColor }]}>{title}</AppText>
        {trailing ? (
          <>
            <View style={[s.sep, { backgroundColor: variant === "primary" ? "rgba(255,255,255,0.3)" : colors.line }]} />
            <AppText style={[size === "md" ? s.txtMd : s.txt, { color: txtColor }]}>{trailing}</AppText>
          </>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  base: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, borderRadius: radius.pill, paddingHorizontal: space.xl },
  lg: { height: 56 },
  md: { height: 48 },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.field },
  ghost: { borderWidth: 1, borderColor: colors.line, backgroundColor: "transparent" },
  outline: { borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.bg },
  tonal: { backgroundColor: colors.accentSoft },
  glassBase: { backgroundColor: "transparent" },
  txt: { fontFamily: font.bold, fontSize: 16, letterSpacing: 0.2 },
  txtMd: { fontFamily: font.bold, fontSize: 14, letterSpacing: 0.1 },
  sep: { width: 1, height: 18, marginHorizontal: 2 },
});
