import { ArrowRight } from "phosphor-react-native";
import { type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { usePressScale } from "@/lib/animations";
import { Colors, space } from "@/lib/theme";
import { useTheme, useThemedStyles } from "@/lib/theme-context";
import { AppText } from "./Text";

// h56 row, 1px line separators. Optional left icon (20), trailing value + arrow.
// The workhorse for menus, info rows, order lists.
export function ListRow({
  title,
  value,
  icon,
  onPress,
  arrow = true,
  borderTop = false,
  danger = false,
}: {
  title: string;
  value?: string;
  icon?: ReactNode;
  onPress?: () => void;
  arrow?: boolean;
  borderTop?: boolean;
  danger?: boolean;
}) {
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);
  const { pressStyle, onPressIn, onPressOut } = usePressScale();

  const content = (
    <>
      {icon ? <View style={s.icon}>{icon}</View> : null}
      <AppText variant="body" numberOfLines={1} style={[s.title, danger && { color: colors.error }]}>
        {title}
      </AppText>
      {value ? (
        <AppText variant="body" style={s.value} numberOfLines={1}>
          {value}
        </AppText>
      ) : null}
      {arrow ? <ArrowRight size={20} color={colors.ink} weight="regular" /> : null}
    </>
  );

  if (!onPress) {
    return <View style={[s.row, borderTop && s.top]}>{content}</View>;
  }

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} accessibilityRole="button" accessibilityLabel={title}>
      <Animated.View style={[s.row, borderTop && s.top, pressStyle]}>{content}</Animated.View>
    </Pressable>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md, height: 56, borderBottomWidth: 1, borderBottomColor: colors.line },
  top: { borderTopWidth: 1, borderTopColor: colors.line },
  icon: { width: 20, alignItems: "center" },
  title: { flex: 1 },
  value: { color: colors.ink60 },
});
