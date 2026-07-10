import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Plus } from "phosphor-react-native";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Skel } from "@/components/Skeleton";
import { AppText } from "@/components/Text";
import { HeaderActions } from "@/components/ui";
import { useProducts } from "@/lib/api";
import { addComboToBag, useCombo } from "@/lib/combos";
import { formatLe } from "@/lib/format";
import { productImage } from "@/lib/productImage";
import { colors, space } from "@/lib/theme";

export default function ComboDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const combo = useCombo(slug);
  const { isLoading } = useProducts();

  const leave = () => (router.canGoBack() ? router.back() : router.navigate("/"));
  const heroH = Math.round(width * 0.64);

  const onAdd = () => {
    if (!combo) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addComboToBag(combo);
    router.push("/cart");
  };

  const deal = combo ? combo.priceMinor < combo.sumMinor : false;

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + 120 }}>
        <View style={[s.body, s.topRow]}>
          <BackButton onPress={leave} />
          <HeaderActions />
        </View>

        {combo ? (
          <>
            {/* the pair — two products side by side */}
            <View style={[s.bed, { height: heroH, marginTop: space.lg }]}>
              {combo.items.slice(0, 2).map((it, i) => (
                <View key={it.variant.id} style={[s.half, i === 0 && s.seam]}>
                  <Image source={productImage(it.product)} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={it.variant.id} />
                </View>
              ))}
              <View style={s.plus} pointerEvents="none">
                <Plus size={20} color={colors.ink} weight="bold" />
              </View>
            </View>

            <View style={[s.body, { marginTop: space.xl }]}>
              <AppText variant="label" style={{ color: colors.ink60 }}>The pair</AppText>
              <AppText variant="display" style={{ marginTop: space.xs }}>{combo.name}</AppText>
              {combo.description ? <AppText variant="bodySoft" style={{ marginTop: space.md }}>{combo.description}</AppText> : null}
            </View>

            {/* the two fragrances */}
            <View style={[s.body, { marginTop: space["2xl"] }]}>
              {combo.items.map((it) => (
                <Pressable
                  key={it.variant.id}
                  style={s.itemRow}
                  onPress={() => router.push({ pathname: "/product/[slug]", params: { slug: it.product.slug } })}
                  accessibilityRole="button"
                  accessibilityLabel={it.product.name}
                >
                  <View style={s.thumb}>
                    <Image source={productImage(it.product)} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={it.variant.id} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText variant="serif20" numberOfLines={1}>{it.product.name}</AppText>
                    <AppText variant="caption" numberOfLines={1} style={{ marginTop: space.xs }}>
                      {it.product.brand} · {it.variant.sizeMl} ml
                    </AppText>
                  </View>
                  <AppText variant="price">{formatLe(it.variant.priceMinor * it.qty)}</AppText>
                </Pressable>
              ))}

              <View style={s.totalRow}>
                <AppText variant="serif20">Pair total</AppText>
                <View style={s.priceRow}>
                  {deal ? <AppText variant="caption" style={s.strike}>{formatLe(combo.sumMinor)}</AppText> : null}
                  <AppText variant="serif20">{formatLe(combo.priceMinor)}</AppText>
                </View>
              </View>
            </View>
          </>
        ) : isLoading ? (
          <View style={[s.body, { marginTop: space.lg }]}>
            <Skel h={heroH} />
            <Skel w={200} h={32} style={{ marginTop: space.xl }} />
            <Skel w={140} h={16} style={{ marginTop: space.md }} />
          </View>
        ) : (
          <EmptyState
            inline
            title="This pair isn't available."
            body="It may have sold out or been retired. Browse the shop for more."
            action={<Button title="Browse fragrances" variant="secondary" onPress={() => router.push("/shop")} />}
          />
        )}
      </ScrollView>

      {combo ? (
        <View style={[s.footer, { paddingBottom: insets.bottom + space.lg }]}>
          <Button title="Add pair to bag" trailing={formatLe(combo.priceMinor)} onPress={onAdd} />
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  body: { paddingHorizontal: space.gutter },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bed: { flexDirection: "row", backgroundColor: colors.surface, overflow: "hidden" },
  half: { flex: 1 },
  seam: { borderRightWidth: 1, borderRightColor: colors.paper },
  plus: { position: "absolute", top: "50%", left: "50%", marginLeft: -18, marginTop: -18, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center" },
  itemRow: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  thumb: { width: 56, height: 64, backgroundColor: colors.surface, overflow: "hidden" },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: space.lg, marginTop: space.sm },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  strike: { textDecorationLine: "line-through", color: colors.ink40 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.gutter, paddingTop: space.lg, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line },
});
