import { CaretLeft } from "phosphor-react-native";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "@/lib/theme";
import { GlassCircle } from "./Glass";

/** Liquid-glass circular back button. Pass `style` to position it (absolute over content, or in-flow). */
export function BackButton({ onPress, style, size = 42 }: { onPress: () => void; style?: StyleProp<ViewStyle>; size?: number }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back" style={style}>
      <GlassCircle size={size}>
        <CaretLeft size={20} color={colors.ink} weight="bold" />
      </GlassCircle>
    </Pressable>
  );
}
