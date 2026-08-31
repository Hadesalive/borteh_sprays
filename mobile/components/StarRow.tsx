import { Star, StarHalf } from "phosphor-react-native";
import { View } from "react-native";
import { useTheme } from "@/lib/theme-context";

// A muted antique gold, not a saturated primary yellow — reads as "star
// rating" (the one universally-understood exception to this app's bronze/
// ink palette) while still sitting close enough to the accent's own warm
// family that it doesn't clash with the Maison aesthetic.
export const STAR_GOLD = "#C9A227";

/** A row of gold stars — filled up to `rating`, half-filled at the .5 mark,
 *  outline for the rest. No animation: this renders once per number, it's
 *  not a control. Shared by the product page's summary and the full
 *  reviews screen. */
export function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  const { colors } = useTheme();
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const diff = rating - (i - 1);
    if (diff >= 1) stars.push(<Star key={i} size={size} color={STAR_GOLD} weight="fill" />);
    else if (diff >= 0.5) stars.push(<StarHalf key={i} size={size} color={STAR_GOLD} weight="fill" />);
    else stars.push(<Star key={i} size={size} color={colors.ink40} weight="regular" />);
  }
  return <View style={{ flexDirection: "row", gap: 2 }}>{stars}</View>;
}
