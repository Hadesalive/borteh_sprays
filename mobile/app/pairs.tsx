import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { ComboCard } from "@/components/ComboCard";
import { EmptyState } from "@/components/EmptyState";
import { Skel } from "@/components/Skeleton";
import { AppText } from "@/components/Text";
import { HeaderActions } from "@/components/ui";
import { useProducts } from "@/lib/api";
import { useCombos } from "@/lib/combos";
import { colors, space } from "@/lib/theme";

// The "see all combos" screen — every active, fully-available pair as a full-width card.
// Reached from the home "Perfect pairs" rail. Tapping a card opens the pair's detail.
export default function Pairs() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const combos = useCombos();
  const { isLoading } = useProducts();

  const leave = () => (router.canGoBack() ? router.back() : router.navigate("/"));
  const cardW = width - space.gutter * 2;

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + space["5xl"] }}>
        <View style={s.topRow}>
          <BackButton onPress={leave} />
          <HeaderActions />
        </View>

        <AppText variant="display" style={{ marginTop: space.lg }}>Perfect pairs</AppText>
        {combos.length > 0 ? (
          <AppText variant="caption" style={{ marginTop: space.xs }}>
            {combos.length} {combos.length === 1 ? "pair" : "pairs"} curated to wear together
          </AppText>
        ) : null}

        {combos.length > 0 ? (
          <View style={{ marginTop: space.xl, gap: space["2xl"] }}>
            {combos.map((c) => (
              <ComboCard key={c.id} combo={c} width={cardW} onPress={() => router.push({ pathname: "/combo/[slug]", params: { slug: c.slug } })} />
            ))}
          </View>
        ) : isLoading ? (
          <View style={{ marginTop: space.xl, gap: space["2xl"] }}>
            {[0, 1, 2].map((i) => (
              <View key={i}>
                <Skel h={Math.round(cardW * 0.6)} />
                <Skel w={180} h={20} style={{ marginTop: space.sm }} />
                <Skel w={120} h={14} style={{ marginTop: space.xs }} />
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            inline
            title="No pairs yet."
            body="Curated fragrance pairs will show up here. Browse the shop in the meantime."
            action={<Button title="Browse fragrances" variant="secondary" onPress={() => router.push("/shop")} />}
          />
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
