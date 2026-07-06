import { ScrollView, StyleSheet, View } from "react-native";
import { type Product } from "@/lib/api";
import { space } from "@/lib/theme";
import { SectionHeader } from "@/components/ui";
import { TrackImpression } from "@/components/TrackImpression";
import { ProductCard } from "./ProductCard";

// A titled horizontal rail of products for one personalized home-feed module. Mirrors the
// Best-sellers rail so it reads as part of the same Maison home. `module` drives both the
// impression (once/session) and the per-card module_tap attribution.
export function FeedRail({
  module,
  title,
  products,
  position = 0,
}: {
  module: string;
  title: string;
  products: Product[];
  position?: number;
}) {
  if (products.length === 0) return null;
  return (
    <TrackImpression module={module} position={position}>
      <View style={{ marginTop: space["5xl"] }}>
        <SectionHeader title={title} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} width={160} imageHeight={200} source={module} position={i} />
          ))}
        </ScrollView>
      </View>
    </TrackImpression>
  );
}

const s = StyleSheet.create({
  rail: { paddingHorizontal: space.gutter, gap: space.lg, paddingTop: space.lg },
});
