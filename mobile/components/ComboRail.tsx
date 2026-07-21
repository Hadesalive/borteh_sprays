import { ScrollView, StyleSheet, View } from "react-native";
import { type Combo } from "@/lib/combos";
import { space } from "@/lib/theme";
import { ComboCard } from "./ComboCard";
import { SectionHeader } from "./ui";

// A titled horizontal rail of pair cards. Used by the home ("Perfect pairs") and the product page
// ("Complete the pair"). Renders nothing when there are no available combos. Pass onSeeAll to show
// a "See all" link (home only) that opens the full pairs screen.
export function ComboRail({ title, combos, onOpen, onSeeAll, cardWidth = 260 }: { title: string; combos: Combo[]; onOpen: (slug: string) => void; onSeeAll?: () => void; cardWidth?: number }) {
  if (!combos.length) return null;
  return (
    <View style={{ marginTop: space["5xl"] }}>
      <SectionHeader title={title} trailing={onSeeAll ? "See all" : undefined} onPressTrailing={onSeeAll} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
        {combos.map((c) => (
          <ComboCard key={c.id} combo={c} width={cardWidth} onPress={() => onOpen(c.slug)} />
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  rail: { paddingHorizontal: space.gutter, gap: space.lg, paddingTop: space.lg },
});
