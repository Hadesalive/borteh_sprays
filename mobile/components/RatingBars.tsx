import { StyleSheet, View } from "react-native";
import { Colors, space } from "@/lib/theme";
import { useThemedStyles } from "@/lib/theme-context";
import { AppText } from "./Text";

/** Per-star (5★→1★) distribution — the standard App Store/Play Store summary
 *  shape, flat proportional bars (radius 0, matching this app's own
 *  track/fill language elsewhere) built from real bucketed counts. Renders
 *  nothing if there's nothing rated yet. */
export function RatingBars({ counts }: { counts: number[] }) {
  const s = useThemedStyles(makeStyles);
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  return (
    <View style={{ gap: 6 }}>
      {[5, 4, 3, 2, 1].map((star) => {
        const count = counts[star - 1];
        const pct = count / total;
        return (
          <View key={star} style={s.row}>
            <AppText variant="caption" style={s.star}>{star}</AppText>
            <View style={s.track}>
              <View style={[s.fill, { width: `${Math.round(pct * 100)}%` }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  star: { width: 10, color: colors.ink60, textAlign: "right" },
  track: { flex: 1, height: 4, backgroundColor: colors.line },
  fill: { height: 4, backgroundColor: colors.ink },
});
