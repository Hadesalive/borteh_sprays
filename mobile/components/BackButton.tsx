import { ArrowLeft } from "phosphor-react-native";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "@/lib/theme";

/** Maison back — a bare ink arrow (no chrome). Pass `style` to position it
 *  (absolute over a hero image, or in-flow above a title). */
export function BackButton({ onPress, style, size = 24 }: { onPress: () => void; style?: StyleProp<ViewStyle>; size?: number }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={style}>
      <ArrowLeft size={size} color={colors.ink} weight="regular" />
    </Pressable>
  );
}
