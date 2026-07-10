import { Image } from "expo-image";
import { Plus } from "phosphor-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { type Combo } from "@/lib/combos";
import { formatLe } from "@/lib/format";
import { productImage } from "@/lib/productImage";
import { colors, space } from "@/lib/theme";
import { AppText } from "./Text";

// A "pair" card — the two products side by side on one bed, split by a thin paper seam with a
// bronze "+" between them, then the combo name + live price. Squared, flat (Maison).
export function ComboCard({ combo, width = 260, onPress }: { combo: Combo; width?: number; onPress: () => void }) {
  const imgH = Math.round(width * 0.6);
  const pair = combo.items.slice(0, 2);
  const deal = combo.priceMinor < combo.sumMinor;
  return (
    <Pressable onPress={onPress} style={{ width }} accessibilityRole="button" accessibilityLabel={combo.name}>
      <View style={[s.bed, { height: imgH }]}>
        {pair.map((it, i) => (
          <View key={it.variant.id} style={[s.half, i === 0 && s.seam]}>
            <Image source={productImage(it.product)} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={it.variant.id} />
          </View>
        ))}
        <View style={s.plus} pointerEvents="none">
          <Plus size={16} color={colors.ink} weight="bold" />
        </View>
      </View>
      <AppText variant="serif20" numberOfLines={1} style={{ marginTop: space.sm }}>{combo.name}</AppText>
      <AppText variant="caption" numberOfLines={1}>{pair.map((i) => i.product.name).join(" + ")}</AppText>
      <View style={s.priceRow}>
        <AppText variant="price">{formatLe(combo.priceMinor)}</AppText>
        {deal ? <AppText variant="caption" style={s.strike}>{formatLe(combo.sumMinor)}</AppText> : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  bed: { flexDirection: "row", backgroundColor: colors.surface, overflow: "hidden" },
  half: { flex: 1 },
  seam: { borderRightWidth: 1, borderRightColor: colors.paper },
  plus: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -13,
    marginTop: -13,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: space.sm, marginTop: 2 },
  strike: { textDecorationLine: "line-through", color: colors.ink40 },
});
